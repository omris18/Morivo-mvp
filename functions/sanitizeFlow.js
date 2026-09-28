const { normalizeMission } = require("./missionAnswers");

const MISSION_TYPES = ["photo", "video", "quiz", "puzzle", "note", "map", "story", "reward"];

function sanitizeFlow(rawFlow) {
  return (rawFlow || [])
    .filter((m) => m && typeof m === "object")
    .map((m, i) => {
      m = normalizeMission(m);
      const type = MISSION_TYPES.includes(m.type) ? m.type : "story";
      const atom = {
        id: `${type}-${Date.now()}-${i}`,
        type,
        title: String(m.title || `Mission ${i + 1}`).slice(0, 120),
        text: String(m.text || "").slice(0, 600),
        reward: String(m.reward || "").slice(0, 120),
        points: Number.isFinite(Number(m.points)) ? Math.max(50, Math.min(200, Math.round(Number(m.points)))) : 100,
      };
      if (type === "puzzle" && m.answer) {
        atom.answer = String(m.answer).slice(0, 80);
      }
      if (type === "quiz" && Array.isArray(m.options)) {
        const options = m.options.slice(0, 4).map((o) => String(o || "").slice(0, 120)).filter(Boolean);
        if (options.length >= 2) {
          const rawAnswer = String(m.answer || "").slice(0, 120);
          atom.options = options;
          atom.answer = options.includes(rawAnswer) ? rawAnswer : "";
        }
      }
      // Carries through a destination tagged onto the mission before sanitizing (see
      // generateMissionChunk in index.js) so the route map can group by this ground truth
      // instead of fragile text-matching against the mission's own title/text - the exact
      // regression covered by tests/sanitizeFlow.test.cjs.
      if (m.destination) atom.destination = String(m.destination).trim().slice(0, 100);
      return atom;
    });
}

module.exports = { sanitizeFlow, MISSION_TYPES };
