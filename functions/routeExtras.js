const normDest = (s) => String(s || "").toLocaleLowerCase().trim().replace(/[\s\-–_]+/g, "");

// Splices hotel/attraction missions (generated separately from the main AI flow - see
// generateExperience) into the matching part of a multi-day route, instead of leaving them as a
// disconnected batch tacked onto one end.
function insertExtrasIntoFlow(flow, extras) {
  const routeFlow = [...flow];
  for (const extra of extras) {
    const destination = String(extra.destination || "").trim();
    if (!destination) {
      // A multi-destination trip's attractions poll can't carry one destination of its own (see
      // attractionsPollMission in index.js) - it used to fall straight to routeFlow.push below,
      // landing after every other mission including the trip's own closing/trophy mission.
      // Insert it near the start instead - after the opening mission, not literally first (never
      // a hook before the journey even begins) - so a trip-wide poll never reads as arriving once
      // the trip is already over.
      routeFlow.splice(Math.min(1, routeFlow.length), 0, extra);
      continue;
    }
    // Every mission this function builds now carries its real destination (see
    // generateMissionChunk/sanitizeFlow) - trust that over guessing from title/text word-matching,
    // which could just as easily match an unrelated mission that happens to share a word and
    // splice this destination's hotel mission into an earlier, wrong city's block entirely. That's
    // exactly what made the route map's stop order stop matching the real day order: a spliced-in
    // hotel mission for a later city became that city's first occurrence in the flow, so the map
    // displayed it as an earlier stop than its actual days. Only fall back to word-matching for
    // older data that predates destination tagging.
    const normExtra = normDest(destination);
    let at = routeFlow.findIndex((m) => m.destination && normDest(m.destination) === normExtra);
    if (at === -1) {
      const words = normExtra.split(/[,/\s]+/).filter(Boolean);
      at = routeFlow.findIndex((m) => {
        const title = String(m.title || "").toLowerCase();
        const text = String(m.text || "").toLowerCase();
        return words.some((word) => word.length > 2 && (title.includes(word) || text.includes(word)));
      });
    }
    if (at >= 0) routeFlow.splice(at, 0, extra);
    else routeFlow.push(extra);
  }
  return routeFlow;
}

module.exports = { insertExtrasIntoFlow };
