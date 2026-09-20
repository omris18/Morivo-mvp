const PALETTES = [
  ["#123a52", "#050e16"],
  ["#3d2b1f", "#140c06"],
  ["#1f3d2e", "#081712"],
  ["#3a1f3d", "#140a17"],
  ["#4a3319", "#1a1206"],
  ["#1f2f3d", "#08121a"],
  ["#3d1f2b", "#170a0e"],
  ["#1f303d", "#081117"],
];

export function experienceGradient(seed) {
  let hash = 0;
  for (const ch of String(seed || "morivo")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = PALETTES[hash % PALETTES.length];
  return `linear-gradient(160deg, ${a}, ${b})`;
}
