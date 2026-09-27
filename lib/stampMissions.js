// A mission earns a passport stamp only when it's tied to a destination in the
// trip (m.destination, the same field the route map groups stops by) or the
// organizer explicitly flagged it as a stamp mission - not on every completion.
export function isStampMission(m) {
  return !!(m?.stamp || m?.destination);
}
