// Groups a flat mission flow into destination/day "stops" for the route map,
// shared between the organizer's ExperienceRoute and the participant journey map
// so both render the exact same stops in the exact same order.
export function buildRouteGroups(experience, flow, he) {
  // Only an organizer-declared destination list is trustworthy for cross-referencing a
  // mission's free text. A regex used to also *invent* destination names straight out of
  // ordinary text ("in the morning", "at the beach") whenever a mission had none of its
  // own - every such false match became its own oddly-named, unrelated cube on the map.
  // The structured "+ destination" flow itself just joins the list into `location` with
  // ", " (see AICreator.js) - so when `destinations` wasn't saved (an older experience, or
  // someone who typed "Phuket, Khao Lak" straight into the location field instead of using
  // the destination chips), splitting `location` the same way recovers the same list.
  const explicit = Array.isArray(experience.destinations) && experience.destinations.length
    ? experience.destinations.map(String).filter(Boolean)
    : String(experience.location || "").split(",").map(s => s.trim()).filter(Boolean);
  const normKey = s => String(s).toLocaleLowerCase().trim().replace(/[\s\-–_]+/g, "");
  // Every mission's own stated destination wins - it's set at generation time and is far
  // more reliable than guessing from day ranges, which broke as soon as a real trip's
  // mission counts per stop stopped matching whatever ranges were hardcoded here before.
  const missionDestinations = flow.map(m => {
    // A mission's own destination is only trustworthy when it names one place - a comma
    // means it's the whole trip's combined location string (a past generation bug tagged
    // trip-wide missions like the attractions poll with it), which must never become its
    // own bogus stop. Fall through to text-matching against the real destination list instead.
    if (m.destination && !String(m.destination).includes(",")) return String(m.destination).trim();
    if (!explicit.length) return "";
    const text = String(`${m.title || ""} ${m.text || ""} ${m.description || ""}`).toLocaleLowerCase();
    return explicit.find(d => String(d).split(/[,\s]+/).some(w => w.length > 2 && text.includes(w.toLocaleLowerCase()))) || "";
  });
  const distinctDestinations = [...new Set(missionDestinations.filter(Boolean).map(normKey))];
  // A single-destination (or destination-less) trip must never get splintered into
  // odd "Day 3" / "Starting missions" sub-buckets just because a few missions have no
  // stated destination - it's one stop, so it's one group, in flow order.
  if (distinctDestinations.length <= 1 && flow.length) {
    const label = missionDestinations.find(Boolean) || experience.location || experience.name || (he ? "המסלול שלנו" : "Your route");
    return [{ key: "single", label, destination: missionDestinations.find(Boolean) || "", missions: flow.map((m, i) => ({ m, i })) }];
  }
  const out = [];
  flow.forEach((m, i) => {
    const destination = missionDestinations[i];
    const rawDay = m.day || m.dayNumber || ((m.title || "").match(/(?:day|יום)\s*([0-9]+)/i)?.[1]);
    const key = destination ? `destination-${normKey(destination)}` : rawDay ? `day-${rawDay}` : "general";
    let g = out.find(x => x.key === key);
    if (!g) { g = { key, label: destination || (rawDay ? (he ? `יום ${rawDay}` : `Day ${rawDay}`) : (he ? "משימות פתיחה" : "Starting missions")), destination, missions: [] }; out.push(g); }
    g.missions.push({ m, i });
  });
  return out;
}

// A group's day range, for a subtitle next to its destination name - never the
// destination name itself again, which just duplicated the header above it.
export function dayRangeText(missions, he) {
  const days = missions.map(({ m }) => m.day).filter(Number.isFinite);
  if (!days.length) return "";
  const first = Math.min(...days), last = Math.max(...days);
  if (first === last) return he ? `יום ${first}` : `Day ${first}`;
  return he ? `ימים ${first}–${last}` : `Days ${first}–${last}`;
}
