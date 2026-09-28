const { onSchedule } = require("firebase-functions/v2/scheduler");

// Check each flight at exactly these milestones instead of continuously polling - once
// travelers are actually at the airport (a few hours out), the airport itself is the source
// of truth for gate/delay changes, so there's nothing to gain from checking more often. This
// caps every flight at 3 AeroDataBox calls total for its entire lifecycle, which matters a lot
// on the free tier's monthly quota.
const CHECKPOINTS = [
  { key: "h24", hoursBefore: 24 },
  { key: "h6", hoursBefore: 6 },
  { key: "h3", hoursBefore: 3 },
];

async function fetchFlightStatus(flightNumber, date, apiKey) {
  const number = String(flightNumber || "").replace(/[\s-]/g, "").toUpperCase();
  if (!number || !date) return null;
  try {
    const res = await fetch(`https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}/${date}`, {
      headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" },
    });
    if (!res.ok) {
      console.error("AeroDataBox HTTP error", number, date, res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const flight = Array.isArray(data) ? data[0] : data;
    if (!flight) return null;
    const status = flight.status || null;
    const gate = flight.departure?.gate || null;
    const terminal = flight.departure?.terminal || null;
    const revisedLocal = flight.departure?.revisedTime?.local || flight.departure?.actualTimeLocal?.local || null;
    if (!status) return null;
    return { status, gate, terminal, revisedLocal };
  } catch (err) {
    console.error("AeroDataBox request failed", number, date, err);
    return null;
  }
}

function describeChange(flightNumber, info, lang) {
  const he = lang === "he";
  const parts = [
    he ? `טיסה ${flightNumber}: ${info.status}` : `Flight ${flightNumber}: ${info.status}`,
    info.gate ? (he ? `שער ${info.gate}` : `Gate ${info.gate}`) : null,
    info.terminal ? (he ? `טרמינל ${info.terminal}` : `Terminal ${info.terminal}`) : null,
    info.revisedLocal ? (he ? `זמן מעודכן ${info.revisedLocal}` : `Updated time ${info.revisedLocal}`) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function notifyFlightChange(admin, experienceId, exp, flightNumber, info) {
  const db = admin.firestore();
  const participantsSnap = await db.collection("experiences").doc(experienceId).collection("participants").get();
  const tokens = [...new Set(participantsSnap.docs.map((d) => d.data().pushToken).filter(Boolean))];
  if (exp.organizerPushToken) tokens.push(exp.organizerPushToken);
  const uniqueTokens = [...new Set(tokens)];
  if (!uniqueTokens.length) return;

  const body = describeChange(flightNumber, info, exp.lang).slice(0, 180);
  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title: exp.name || "Morivo", body },
      webpush: { fcmOptions: { link: "/" } },
    });
    console.log(`Flight push sent for ${experienceId}: ${response.successCount}/${uniqueTokens.length} succeeded`);
  } catch (err) {
    console.error("Failed to send flight push notifications", experienceId, err);
  }
}

module.exports = (admin, aerodataboxApiKey) => onSchedule(
  { schedule: "every 30 minutes", secrets: [aerodataboxApiKey], timeoutSeconds: 300, memory: "256MiB" },
  async () => {
    const apiKey = aerodataboxApiKey.value().trim();
    if (!apiKey) { console.warn("AERODATABOX_API_KEY not set - skipping flight status check."); return; }

    const db = admin.firestore();
    const now = Date.now();
    const snap = await db.collection("experiences").where("status", "==", "live").get();

    for (const doc of snap.docs) {
      const exp = doc.data();
      const flights = Array.isArray(exp.flights) ? exp.flights : [];
      if (!flights.length) continue;

      let dirty = false;
      const nextFlights = await Promise.all(flights.map(async (f) => {
        if (!f.flightNumber || !f.date) return f;
        const scheduled = new Date(`${f.date}T${f.time || "00:00"}`).getTime();
        if (!Number.isFinite(scheduled)) return f;

        const checkedMilestones = f.checkedMilestones || [];
        const due = CHECKPOINTS.find((c) => !checkedMilestones.includes(c.key) && now >= scheduled - c.hoursBefore * 60 * 60 * 1000);
        if (!due) return f;

        const info = await fetchFlightStatus(f.flightNumber, f.date, apiKey);
        const nextCheckedMilestones = [...checkedMilestones, due.key];
        dirty = true;
        if (!info) return { ...f, checkedMilestones: nextCheckedMilestones };

        if (info.status !== f.lastStatus) {
          await notifyFlightChange(admin, doc.id, exp, f.flightNumber, info);
        }
        return { ...f, lastStatus: info.status, lastGate: info.gate || null, lastCheckedAt: now, checkedMilestones: nextCheckedMilestones };
      }));

      if (dirty) {
        await doc.ref.update({ flights: nextFlights });
      }
    }
  }
);
