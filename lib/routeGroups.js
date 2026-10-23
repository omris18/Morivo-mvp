// Groups a flat mission flow into destination/day "stops" for the route map,
// shared between the organizer's ExperienceRoute and the participant journey map
// so both render the exact same stops in the exact same order.
// A hotel/attraction choice mission carries isCoordination going forward (see
// insertExtrasIntoFlow in functions/routeExtras.js), but experiences generated before that field
// existed still have the exact three builder functions' own markers to go on: isAttractionsPoll,
// isLocationPoll/isDestinationPoll (the "let the group vote" hotel poll), or - for a hotel the
// organizer already picked during planning, which never got a poll-specific flag of its own -
// organizerDecides together with the story type and 0 points every one of those three functions
// uses (functions/index.js: attractionsPollMission/hotelPollMission/hotelMissionFromSelection).
// Not just organizerDecides alone: Studio also lets an organizer manually flag any custom
// "branch"/"story" mission that way for an unrelated day-specific group-decision moment, and
// that default mission template starts at 100 points, not 0 - so this only catches the three
// known auto-generated shapes, not a custom mission that happens to also wait on the organizer.
function isCoordinationMission(m) {
  return !!(m.isCoordination || m.isAttractionsPoll || m.isLocationPoll || m.isDestinationPoll
    || (m.organizerDecides && m.type === "story" && Number(m.points) === 0));
}

// Groups a flat mission flow into destination/day "stops" for the route map,
// shared between the organizer's ExperienceRoute and the participant journey map
// so both render the exact same stops in the exact same order.
export function buildRouteGroups(experience, flow, he) {
  // Hotel/attraction choice missions are logistics, not day-by-day journey content - organizer
  // feedback was that scattering them across the destinations they concern (even correctly)
  // reads worse than a dedicated section. Pulled out first, into their own group placed ahead of
  // everything else, before any of the destination/day grouping below ever sees them - this
  // applies retroactively to every existing experience too (see isCoordinationMission above),
  // not just ones generated after this field was added.
  const coordinationPairs = [];
  flow.forEach((m, i) => { if (isCoordinationMission(m)) coordinationPairs.push({ m, i }); });
  const coordinationGroup = coordinationPairs.length
    ? { key: "coordination", label: he ? "משימות תיאום" : "Coordination", destination: "", missions: coordinationPairs }
    : null;
  const journeyIndices = flow.map((m, i) => i).filter(i => !isCoordinationMission(flow[i]));

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
  const destinationOf = m => {
    // A mission's own destination is only trustworthy when it names one place - a comma
    // means it's the whole trip's combined location string (a past generation bug tagged
    // trip-wide missions like the attractions poll with it), which must never become its
    // own bogus stop. Fall through to text-matching against the real destination list instead.
    if (m.destination && !String(m.destination).includes(",")) return String(m.destination).trim();
    if (!explicit.length) return "";
    const text = String(`${m.title || ""} ${m.text || ""} ${m.description || ""}`).toLocaleLowerCase();
    return explicit.find(d => String(d).split(/[,\s]+/).some(w => w.length > 2 && text.includes(w.toLocaleLowerCase()))) || "";
  };
  const missionDestinations = journeyIndices.map(i => destinationOf(flow[i]));
  const distinctDestinations = [...new Set(missionDestinations.filter(Boolean).map(normKey))];
  const prepend = groups => coordinationGroup ? [coordinationGroup, ...groups] : groups;
  // A single-destination (or destination-less) trip must never get splintered into
  // odd "Day 3" / "Starting missions" sub-buckets just because a few missions have no
  // stated destination - it's one stop, so it's one group, in flow order.
  if (distinctDestinations.length <= 1 && journeyIndices.length) {
    const label = missionDestinations.find(Boolean) || experience.location || experience.name || (he ? "המסלול שלנו" : "Your route");
    return prepend([{ key: "single", label, destination: missionDestinations.find(Boolean) || "", missions: journeyIndices.map(i => ({ m: flow[i], i })) }]);
  }
  const out = [];
  journeyIndices.forEach((i, idx) => {
    const m = flow[i];
    const destination = missionDestinations[idx];
    // Fallback regex covers the day-word in every language this app can generate a title in
    // (see DAY_WORD_RE in functions/index.js) - an explicit m.day always wins when present.
    const dayMatch = (m.title || "").match(/(?:day|יום|tag|giorno|dzie[nń]|nap|ημέρα|วัน)\s*([0-9]+)|([0-9]+)\s*(?:日目|日)/i);
    const rawDay = m.day || m.dayNumber || (dayMatch ? (dayMatch[1] || dayMatch[2]) : null);
    const key = destination ? `destination-${normKey(destination)}` : rawDay ? `day-${rawDay}` : "general";
    let g = out.find(x => x.key === key);
    if (!g) { g = { key, label: destination || (rawDay ? (he ? `יום ${rawDay}` : `Day ${rawDay}`) : (he ? "משימות פתיחה" : "Starting missions")), destination, missions: [] }; out.push(g); }
    g.missions.push({ m, i });
  });
  return prepend(out);
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
