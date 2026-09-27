// Groups a flat mission flow into destination/day "stops" for the route map,
// shared between the organizer's ExperienceRoute and the participant journey map
// so both render the exact same stops in the exact same order.
export function buildRouteGroups(experience, flow, he) {
  const explicit = Array.isArray(experience.destinations) ? experience.destinations.map(String).filter(Boolean) : [];
  const inferred = [...new Set(flow.flatMap(x => { const t = String(`${x.title || ""} ${x.text || ""}`); return [...t.matchAll(/(?:להתארח|טיול|פארק|ב)(?:\s|-)?([א-ת]{3,})/g)].map(m => m[1]); }))];
  const destinations = [...explicit, ...inferred].filter((d, i, a) => d && a.findIndex(x => x.toLocaleLowerCase() === d.toLocaleLowerCase()) === i);
  const normKey = s => String(s).toLocaleLowerCase().trim().replace(/[\s\-–_]+/g, "");
  const out = [];
  flow.forEach((m, i) => {
    // Every mission's own stated destination wins - it's set at generation time and is far
    // more reliable than guessing from day ranges, which broke as soon as a real trip's
    // mission counts per stop stopped matching whatever ranges were hardcoded here before.
    const text = String(`${m.title || ""} ${m.text || ""} ${m.description || ""}`).toLocaleLowerCase();
    const destination = String(m.destination || destinations.find(d => String(d).split(/[,\s]+/).some(w => w.length > 2 && text.includes(w.toLocaleLowerCase()))) || "").trim();
    const rawDay = m.day || m.dayNumber || ((m.title || "").match(/(?:day|יום)\s*([0-9]+)/i)?.[1]);
    const key = destination ? `destination-${normKey(destination)}` : rawDay ? `day-${rawDay}` : "general";
    let g = out.find(x => x.key === key);
    if (!g) { g = { key, label: destination || (rawDay ? (he ? `יום ${rawDay}` : `Day ${rawDay}`) : (he ? "משימות פתיחה" : "Starting missions")), destination, missions: [] }; out.push(g); }
    g.missions.push({ m, i });
  });
  return out;
}
