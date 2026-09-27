// A puzzle piece unlocks when the participant completes the mission the organizer
// assigned that piece number to (mission.puzzlePiece, 1..totalPieces) - not every
// mission, and not in upload order, so the organizer controls the reveal pace.
export function unlockedPieces(flow, completedMissionIds, totalPieces) {
  const completed = new Set(completedMissionIds || []);
  const unlocked = new Set();
  (flow || []).forEach(m => {
    const piece = Number(m.puzzlePiece);
    if (Number.isInteger(piece) && piece >= 1 && piece <= totalPieces && completed.has(m.id)) unlocked.add(piece);
  });
  return unlocked;
}
