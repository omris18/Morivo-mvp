// Groups a flat mission flow into destination/day "stops" for the route map,
// shared between the organizer's ExperienceRoute and the participant journey map
// so both render the exact same stops in the exact same order.
export function buildRouteGroups(experience, flow, he) {
  const isThailand = /(תאילנד|thailand|פוקט|phuket)/i.test(String(`${experience.name || ""} ${experience.location || ""} ${experience.story || ""}`));
  if (isThailand && flow.length >= 20) {
    const buckets = [["פוקט", 0, 6], ["קאו לאק", 7, 8], ["קראבי", 9, 10], ["קו סמוי", 11, 16], ["פאטאיה", 17, 20], ["בנגקוק", 21, 23], ["חזרה לישראל", 24, 999]];
    return buckets.map(([label, a, b]) => ({ key: `thai-${label}`, label, destination: label, missions: flow.slice(a, Math.min(flow.length, b + 1)).map((m, i) => ({ m, i: a + i })) })).filter(g => g.missions.length);
  }
  const explicit = Array.isArray(experience.destinations) ? experience.destinations.map(String).filter(Boolean) : [];
  const inferred = [...new Set(flow.flatMap(x => { const t = String(`${x.title || ""} ${x.text || ""}`); return [...t.matchAll(/(?:להתארח|טיול|פארק|ב)(?:\s|-)?([א-ת]{3,})/g)].map(m => m[1]); }))];
  const destinations = [...explicit, ...inferred].filter((d, i, a) => d && a.findIndex(x => x.toLocaleLowerCase() === d.toLocaleLowerCase()) === i);
  const out = [];
  flow.forEach((m, i) => {
    const text = String(`${m.title || ""} ${m.text || ""} ${m.description || ""}`).toLocaleLowerCase();
    const destination = String(m.destination || destinations.find(d => String(d).split(/[,\s]+/).some(w => w.length > 2 && text.includes(w.toLocaleLowerCase()))) || "").trim();
    const rawDay = m.day || m.dayNumber || ((m.title || "").match(/(?:day|יום)\s*([0-9]+)/i)?.[1]);
    const key = destination ? `destination-${destination}` : rawDay ? `day-${rawDay}` : "general";
    let g = out.find(x => x.key === key);
    if (!g) { g = { key, label: destination || (rawDay ? (he ? `יום ${rawDay}` : `Day ${rawDay}`) : (he ? "משימות פתיחה" : "Starting missions")), destination, missions: [] }; out.push(g); }
    g.missions.push({ m, i });
  });
  return out;
}
