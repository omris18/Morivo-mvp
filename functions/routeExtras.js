// Hotel/attraction choice missions (generated separately from the main AI flow - see
// generateExperience) used to get spliced into the matching part of the day-by-day route by
// guessing their destination from title/text word-matching against every other mission - fragile
// (a false word match could splice a later city's hotel mission in far too early) and, per
// organizer feedback, not even the right shape: these are logistics decisions, not day-by-day
// journey content, and read better grouped into their own "Coordination" section than scattered
// across the destinations they happen to concern. Tag every one of them and keep them together as
// one block, placed right after the trip's own opening mission - not literally first (that stays
// the narrative hook into the trip), but before any day-by-day content.
function insertExtrasIntoFlow(flow, extras) {
  if (!extras.length) return [...flow];
  const tagged = extras.map((extra) => ({ ...extra, isCoordination: true }));
  const routeFlow = [...flow];
  routeFlow.splice(Math.min(1, routeFlow.length), 0, ...tagged);
  return routeFlow;
}

module.exports = { insertExtrasIntoFlow };
