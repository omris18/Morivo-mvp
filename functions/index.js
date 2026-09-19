const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

const MISSION_TYPES = ["photo", "video", "quiz", "puzzle", "note", "map", "story", "reward"];

const SYSTEM_PROMPT = `You design short interactive real-world "experiences" (treasure-hunt-style journeys) for an app called Morivo, used for family trips, birthdays, team building, school outings and similar events. Morivo is a global product used by people writing in many different languages - always respond in the same language the user wrote their description in, never default to English just because these instructions are in English.

Given a free-text description of the people, place and occasion, invent a specific, concrete journey of 5 to 8 missions (called "atoms") for a single-sitting experience. If the request says this is a multi-day trip, instead build roughly 2 to 3 missions per day (up to 18 missions total for longer trips), and open each day with a short "story" mission whose title names that day (e.g. "Day 1", "Day 2" - translated into the description's language) so the journey is clearly organized by day. This is the single most important rule: every mission must be built out of a concrete detail from the description - a name, a relationship, an inside joke, a place, a hobby, an occasion detail. If the description mentions a person, place or theme, weave it into the mission text itself, not just the experience title. A mission that could be copy-pasted into any other unrelated experience without changes is a failure.

Bad (too generic - never write like this): "Take a photo that could only belong to this group." / "Answer a playful question about the people sharing this experience." / "Capture something surprising, funny or beautiful."
Good (specific, built from the input): if the input mentions a grandmother's 70th birthday at the beach, a good mission is "Find someone who remembers Grandma's first trip to this beach and get them to tell the story on camera" - concrete, references the actual people and place, gives a reason the moment matters.

Vary the mission types meaningfully:
${MISSION_TYPES.join(", ")}
- "photo"/"video": ask participants to capture something specific and evocative, tied to a real detail from the description - not just "take a photo".
- "note": ask for a short written memory, reflection or answer that only makes sense for this specific group and occasion.
- "quiz"/"puzzle"/"map": a lightweight in-context challenge, written using real names/places/facts from the description where possible (the app currently renders these as simple generic prompts, so keep the mission's "text" self-contained and understandable without extra UI).
- "story": a narrative beat with no participant action, used for openings/transitions/closings - reference the actual occasion, not a generic "the beginning".
- "reward": a payoff moment that ties back to something earlier in the journey.

Give the whole journey a real arc: a hook that pulls people in using a specific detail from the description, rising missions that build on each other and reference earlier moments, then a closing mission that pays off the theme. Titles must be punchy and specific to this exact experience - never generic labels like "The Beginning" or "Capture the Moment".

Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape:
{"name": "short experience title", "flow": [{"type": "photo", "title": "short title", "text": "one to two sentence instruction shown to the participant", "reward": "short reward label", "points": 100}]}

"type" must be one of: ${MISSION_TYPES.join(", ")}. "points" is an integer between 50 and 200. Do not include an "id" field, the app assigns those.`;

async function suggestHotel({ location, prompt, people, duration, lang }) {
  try {
    const hotelPrompt = `Suggest one specific, realistic accommodation option in or near "${location}" that would suit this group: "${prompt}"${people ? ` (${people} people)` : ""}${duration ? `, staying for ${duration}` : ""}. Respond in 2-3 sentences, in the same language as the group description above (detect it automatically), naming a real type of place or area and explaining briefly why it fits this specific group. Be practical and specific, not generic travel-blog language. Do not use markdown.`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.value().trim()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: hotelPrompt }] }] }),
    });
    if (!res.ok) {
      console.error("Gemini hotel suggestion HTTP error", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || !text.trim()) return null;
    return {
      id: `story-${Date.now()}-hotel`,
      type: "story",
      title: lang === "he" ? "היכן להתארח" : "Where to Stay",
      text: text.trim().slice(0, 600),
      reward: "",
      points: 0,
    };
  } catch (err) {
    console.error("Gemini hotel suggestion failed", err);
    return null;
  }
}

exports.generateExperience = onCall({ secrets: [openaiApiKey, geminiApiKey], cors: true, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in (even anonymously) before generating an experience.");
  }

  const { prompt, type, location, duration, people, lang, multiDay, needsHotel } = request.data || {};

  if (!prompt || !String(prompt).trim()) {
    throw new HttpsError("invalid-argument", "A description of the experience is required.");
  }

  const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });

  const userPrompt = [
    `Description: ${prompt}`,
    type ? `Experience type: ${type}` : null,
    location ? `Location: ${location}` : null,
    duration ? `Duration: ${duration}` : null,
    people ? `Participants: ${people}` : null,
    multiDay ? `This is a multi-day trip - structure the missions across the days as described above, not a single sitting.` : null,
    `Write "name", and every mission's "title", "text" and "reward", in the same language the Description above is written in - detect it automatically, it can be any language (Hebrew, English, Arabic, French, Spanish, German, Russian, or any other). Use natural, native-sounding phrasing for that language and its culture, not a literal translation. Only if the Description is too short or ambiguous to confidently detect a language, default to ${lang === "he" ? "Hebrew" : "English"}.`,
  ].filter(Boolean).join("\n");

  const hotelMissionPromise = (needsHotel && location) ? suggestHotel({ location, prompt, people, duration, lang }) : Promise.resolve(null);

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

  const hotelMission = await hotelMissionPromise;

  return {
    name: String(data.name || prompt).slice(0, 120),
    flow: hotelMission ? [hotelMission, ...flow] : flow,
  };
});
