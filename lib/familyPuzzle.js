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

// Maps grid position -> piece number, shuffled so pieces unlocked back-to-back (n, n+1)
// don't land in neighboring grid cells - a predictable left-to-right reveal would make the
// "which piece unlocks next" mechanic pointless the moment two adjacent missions complete.
export function shufflePieceLayout(totalPieces, cols = 4) {
  const layout = Array.from({ length: totalPieces }, (_, i) => i + 1);
  for (let i = layout.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [layout[i], layout[j]] = [layout[j], layout[i]];
  }
  const posOf = n => layout.indexOf(n);
  const cell = idx => ({ col: idx % cols, row: Math.floor(idx / cols) });
  const adjacent = (a, b) => { const ca = cell(a), cb = cell(b); return Math.abs(ca.col - cb.col) + Math.abs(ca.row - cb.row) === 1; };
  const firstViolation = () => { for (let n = 1; n < totalPieces; n++) if (adjacent(posOf(n), posOf(n + 1))) return n; return -1; };
  // Fixing one pair can un-fix an earlier one (its swap partner might be a piece we already
  // placed apart from its neighbor), so this re-scans from the top after every swap instead
  // of a single forward pass - it always converges for grids this small.
  let n, globalAttempts = 0;
  while ((n = firstViolation()) !== -1 && globalAttempts < 200) {
    const idxB = posOf(n + 1);
    const swapWith = Math.floor(Math.random() * totalPieces);
    if (swapWith !== idxB) [layout[idxB], layout[swapWith]] = [layout[swapWith], layout[idxB]];
    globalAttempts++;
  }
  return layout;
}

// Layout normalized to identity order (piece N at grid index N-1) whenever none was
// generated yet, so older experiences without a stored layout still render correctly.
function resolveLayout(layout, totalPieces) {
  return Array.isArray(layout) && layout.length === totalPieces ? layout : Array.from({ length: totalPieces }, (_, i) => i + 1);
}
export function pieceAtGridIndex(layout, totalPieces, gridIndex) {
  return resolveLayout(layout, totalPieces)[gridIndex];
}
export function gridIndexForPiece(layout, totalPieces, piece) {
  const idx = resolveLayout(layout, totalPieces).indexOf(piece);
  return idx >= 0 ? idx : piece - 1;
}
