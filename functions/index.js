const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const MISSION_TYPES = ["photo", "video", "quiz", "puzzle", "note", "map", "story", "reward"];

const SYSTEM_PROMPT = `You design short interactive real-world "experiences" (treasure-hunt-style journeys) for an app called Morivo, used for family trips, birthdays, team building, school outings and similar events.

Given a free-text description of the people, place and occasion, invent a specific, concrete journey of 5 to 8 missions (called "atoms"). Make it feel personal to what was described, not generic. Vary the mission types meaningfully:
${MISSION_TYPES.join(", ")}
- "photo"/"video": ask participants to capture something specific and evocative, not just "take a photo".
- "note": ask for a short written memory, reflection or answer.
- "quiz"/"puzzle"/"map": a lightweight in-context challenge (the app currently renders these as simple generic prompts, so keep the mission's "text" self-contained and understandable without extra UI).
- "story": a narrative beat with no participant action, used for openings/transitions/closings.
- "reward": a payoff moment.

Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape:
{"name": "short experience title", "flow": [{"type": "photo", "title": "short title", "text": "one to two sentence instruction shown to the participant", "reward": "short reward label", "points": 100}]}

"type" must be one of: ${MISSION_TYPES.join(", ")}. "points" is an integer between 50 and 200. Do not include an "id" field, the app assigns those.`;

exports.generateExperience = onCall({ secrets: [openaiApiKey], cors: true, timeoutSeconds: 60 }, async (request) => {
  const { prompt, type, location, duration, people, lang } = request.data || {};

  if (!prompt || !String(prompt).trim()) {
    throw new HttpsError("invalid-argument", "A description of the experience is required.");
  }

  const client = new OpenAI({ apiKey: openaiApiKey.value() });

  const userPrompt = [
    `Description: ${prompt}`,
    type ? `Experience type: ${type}` : null,
    location ? `Location: ${location}` : null,
    duration ? `Duration: ${duration}` : null,
    people ? `Participants: ${people}` : null,
    `Write the "title" and "text" fields in ${lang === "he" ? "Hebrew" : "English"}.`,
  ].filter(Boolean).join("\n");

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
    });
  } catch (err) {
    console.error("OpenAI request failed", err);
    throw new HttpsError("unavailable", "The AI service failed to respond. Please try again.");
  }

  let data;
  try {
    data = JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    throw new HttpsError("internal", "The AI returned data in an unexpected format.");
  }

  if (!data || !Array.isArray(data.flow) || data.flow.length === 0) {
    throw new HttpsError("internal", "The AI returned an unexpected experience shape.");
  }

  const flow = data.flow
    .filter(m => m && typeof m === "object")
    .map((m, i) => ({
      id: `${MISSION_TYPES.includes(m.type) ? m.type : "story"}-${Date.now()}-${i}`,
      type: MISSION_TYPES.includes(m.type) ? m.type : "story",
      title: String(m.title || `Mission ${i + 1}`).slice(0, 120),
      text: String(m.text || "").slice(0, 600),
      reward: String(m.reward || "").slice(0, 120),
      points: Number.isFinite(Number(m.points)) ? Math.max(50, Math.min(200, Math.round(Number(m.points)))) : 100,
    }));

  return {
    name: String(data.name || prompt).slice(0, 120),
    flow,
  };
});
