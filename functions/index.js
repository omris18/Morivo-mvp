const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

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

const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"];

function bookingSearchUrl(name, location) {
  const q = [name, location].filter(Boolean).join(" ");
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`;
}

function mapsSearchUrl(name, location) {
  const q = [name, location].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

async function askGeminiJSON(promptText, label) {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.value().trim()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) {
        console.error(`Gemini ${label} HTTP error (model ${model})`, res.status, await res.text());
        continue;
      }
      const json = await res.json();
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) continue;
      try {
        return JSON.parse(raw);
      } catch {
        continue;
      }
    } catch (err) {
      console.error(`Gemini ${label} request failed (model ${model})`, err);
    }
  }
  return null;
}

function optionsToMissionText(options, max, urlFor, location) {
  const lines = options.slice(0, max).map((o, i) => {
    const name = String(o?.name || "").trim().slice(0, 100);
    const why = String(o?.why || "").trim().slice(0, 220);
    if (!name) return null;
    return `${i + 1}. ${name}${why ? ` — ${why}` : ""}\n${urlFor(name, location)}`;
  }).filter(Boolean);
  return lines.length ? lines.join("\n\n") : null;
}

async function suggestHotel({ location, prompt, people, duration, lang }) {
  const hotelPrompt = `Suggest 2 to 3 specific, realistic accommodation options in or near "${location}" that would suit this group: "${prompt}"${people ? ` (${people} people)` : ""}${duration ? `, staying for ${duration}` : ""}. For each option give a real, findable hotel/accommodation name or a specific well-known area, and a 1-2 sentence reason it fits this exact group - practical and specific, not generic travel-blog language. Write in the same language as the group description above (detect it automatically). Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape: {"options":[{"name":"hotel or area name","why":"1-2 sentence reason"}]}`;
  const data = await askGeminiJSON(hotelPrompt, "hotel suggestion");
  if (!Array.isArray(data?.options) || !data.options.length) return null;
  const text = optionsToMissionText(data.options, 3, bookingSearchUrl, location);
  if (!text) return null;
  return {
    id: `story-${Date.now()}-hotel`,
    type: "story",
    title: lang === "he" ? "היכן להתארח" : "Where to Stay",
    text: text.slice(0, 1200),
    reward: "",
    points: 0,
  };
}

async function suggestAttractions({ location, prompt, people, duration, lang }) {
  const attrPrompt = `Suggest 3 to 4 specific, real attractions or activities in or near "${location}" that would suit this group: "${prompt}"${people ? ` (${people} people)` : ""}${duration ? `, over ${duration}` : ""}. For each, give a real, findable attraction or activity name and a 1-2 sentence reason it fits this exact group - their ages, interests, and any dietary/religious/accessibility needs mentioned - practical and specific, not generic travel-blog language. Write in the same language as the group description above (detect it automatically). Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape: {"options":[{"name":"attraction or activity name","why":"1-2 sentence reason"}]}`;
  const data = await askGeminiJSON(attrPrompt, "attraction suggestion");
  if (!Array.isArray(data?.options) || !data.options.length) return null;
  const text = optionsToMissionText(data.options, 4, mapsSearchUrl, location);
  if (!text) return null;
  return {
    id: `story-${Date.now()}-attractions`,
    type: "story",
    title: lang === "he" ? "מה לעשות" : "Things to Do",
    text: text.slice(0, 1400),
    reward: "",
    points: 0,
  };
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
  const attractionsMissionPromise = (multiDay && location) ? suggestAttractions({ location, prompt, people, duration, lang }) : Promise.resolve(null);

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

  const [hotelMission, attractionsMission] = await Promise.all([hotelMissionPromise, attractionsMissionPromise]);
  const extras = [hotelMission, attractionsMission].filter(Boolean);

  return {
    name: String(data.name || prompt).slice(0, 120),
    flow: extras.length ? [...extras, ...flow] : flow,
  };
});

exports.generateMemoryStory = onCall({ secrets: [openaiApiKey], cors: true, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before generating a story.");
  }

  const { experienceId } = request.data || {};
  if (!experienceId) {
    throw new HttpsError("invalid-argument", "experienceId is required.");
  }

  const expRef = db.collection("experiences").doc(experienceId);
  const expSnap = await expRef.get();
  if (!expSnap.exists) {
    throw new HttpsError("not-found", "Experience not found.");
  }
  const experience = expSnap.data();
  if (experience.ownerUid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the experience owner can generate its story.");
  }

  const [mediaSnap, answersSnap] = await Promise.all([
    expRef.collection("media").get(),
    expRef.collection("answers").get(),
  ]);

  const flow = experience.flow || [];
  const chapters = flow.map((m) => {
    const photos = mediaSnap.docs.filter((d) => d.data().missionId === m.id);
    const quotes = answersSnap.docs.filter((d) => d.data().missionId === m.id);
    return {
      title: m.title,
      type: m.type,
      photoCount: photos.length,
      photoBy: [...new Set(photos.map((d) => d.data().participantName).filter(Boolean))],
      quotes: quotes.map((d) => ({ text: d.data().text, by: d.data().participantName })),
    };
  }).filter((c) => c.photoCount > 0 || c.quotes.length > 0);

  if (!chapters.length) {
    throw new HttpsError("failed-precondition", "No memories have been collected yet - nothing to write about.");
  }

  const chaptersText = chapters.map((c, i) =>
    `${i + 1}. "${c.title}" (${c.type})` +
    (c.photoCount ? ` - ${c.photoCount} photo/video captured${c.photoBy.length ? ` by ${c.photoBy.join(", ")}` : ""}` : "") +
    (c.quotes.length ? `\n   Quotes: ${c.quotes.map((q) => `"${q.text}" — ${q.by || "a participant"}`).join(" | ")}` : "")
  ).join("\n");

  const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });
  const prompt = `You write warm, specific retellings of real interactive experiences for an app called Morivo. Given the experience's name, its original intent, and what actually happened chapter by chapter (real photo/video counts, who captured them, and real quotes participants wrote), write a flowing 3 to 5 paragraph narrative retelling of the experience as it actually happened. Reference the real chapters, real quotes and real people by name where given - do not invent details the input doesn't support. Write in the same language as the text below (detect it automatically). Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape: {"story": "the narrative text"}

Experience name: ${experience.name || ""}
Original intent: ${experience.story || ""}

What happened, chapter by chapter:
${chaptersText}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.85,
    });
  } catch (err) {
    console.error("OpenAI memory story request failed", err);
    throw new HttpsError("unavailable", "The AI service failed to respond. Please try again.");
  }

  let story;
  try {
    story = JSON.parse(completion.choices[0].message.content).story;
  } catch (err) {
    throw new HttpsError("internal", "The AI returned data in an unexpected format.");
  }
  if (!story || !String(story).trim()) {
    throw new HttpsError("internal", "The AI didn't return a story.");
  }

  const finalStory = String(story).trim().slice(0, 4000);
  await expRef.update({
    memoryStory: finalStory,
    memoryStoryGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { story: finalStory };
});
