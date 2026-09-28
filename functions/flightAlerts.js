const { onSchedule } = require("firebase-functions/v2/scheduler");

// Only worth polling a flight within this window around its scheduled time - well before that
// there's nothing useful to report yet, and well after it the trip has moved on.
const WINDOW_MS = 36 * 60 * 60 * 1000;

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
        if (!Number.isFinite(scheduled) || Math.abs(scheduled - now) > WINDOW_MS) return f;

        const info = await fetchFlightStatus(f.flightNumber, f.date, apiKey);
        if (!info) return f;

        if (info.status !== f.lastStatus) {
          dirty = true;
          await notifyFlightChange(admin, doc.id, exp, f.flightNumber, info);
        }
        return { ...f, lastStatus: info.status, lastGate: info.gate || null, lastCheckedAt: now };
      }));

      if (dirty) {
        await doc.ref.update({ flights: nextFlights });
      }
    }
  }
);
