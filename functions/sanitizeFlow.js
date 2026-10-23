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
        // 600 cut real, grounded mission text off mid-sentence - the SYSTEM_PROMPT asks for
        // "one to two sentences," but a grounded mission naming a specific real place, why it
        // fits this exact group, and a concrete action easily runs longer than that estimate
        // assumed, especially since missions started citing researched detail (see
        // generateMissionsGrounded in index.js). Raised well past the longest mission text seen
        // in practice rather than trim content that's already correct, just verbose.
        text: String(m.text || "").slice(0, 1500),
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
      // Same reasoning for the day number: the AI is asked for a structured "day" integer
      // (see SYSTEM_PROMPT in index.js) instead of making every caller parse it back out of a
      // title that's free-text in whichever of the 9 supported languages the AI chose - without
      // this the day-completeness safety net in generateExperience could only recognize English
      // "Day N" / Hebrew "יום N" titles and would synthesize duplicate fallback missions for any
      // other language, which is exactly the "structural problems with days" symptom reported.
      const dayNum = Number(m.day ?? m.dayNumber);
      if (Number.isFinite(dayNum)) atom.day = Math.max(1, Math.round(dayNum));
      // A hotel/attraction choice mission (see insertExtrasIntoFlow in routeExtras.js) belongs to
      // its own "Coordination" section, not the day-by-day journey - this mission never actually
      // reaches sanitizeFlow today (those are built directly, not AI-generated), but reviseExperience
      // round-trips every mission through here after an AI edit, and would otherwise silently drop
      // this flag exactly like destination and day already were once each - see reviseExperience's
      // own position-based backfill in index.js for the other half of that guarantee.
      if (m.isCoordination) atom.isCoordination = true;
      return atom;
    });
}

module.exports = { sanitizeFlow, MISSION_TYPES };
