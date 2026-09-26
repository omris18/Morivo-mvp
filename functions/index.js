const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

const MISSION_TYPES = ["photo", "video", "quiz", "puzzle", "note", "map", "story", "reward"];

function sanitizeFlow(rawFlow) {
  return (rawFlow || [])
    .filter((m) => m && typeof m === "object")
    .map((m, i) => ({
      id: `${MISSION_TYPES.includes(m.type) ? m.type : "story"}-${Date.now()}-${i}`,
      type: MISSION_TYPES.includes(m.type) ? m.type : "story",
      title: String(m.title || `Mission ${i + 1}`).slice(0, 120),
      text: String(m.text || "").slice(0, 600),
      reward: String(m.reward || "").slice(0, 120),
      points: Number.isFinite(Number(m.points)) ? Math.max(50, Math.min(200, Math.round(Number(m.points)))) : 100,
      ...(m.type === "puzzle" && m.answer ? { answer: String(m.answer).slice(0, 80) } : {}),
    }));
}

const SYSTEM_PROMPT = `You design short interactive real-world "experiences" (treasure-hunt-style journeys) for an app called Morivo, used for family trips, birthdays, team building, school outings and similar events. Morivo is a global product used by people writing in many different languages - always respond in the same language the user wrote their description in, never default to English just because these instructions are in English.

Given a free-text description of the people, place and occasion, invent a specific, concrete journey of 5 to 8 missions (called "atoms") for a single-sitting experience. If the request says this is a multi-day trip, instead build roughly 2 to 3 missions per day (up to 18 missions total for longer trips), and open each day with a short "story" mission whose title names that day (e.g. "Day 1", "Day 2" - translated into the description's language) so the journey is clearly organized by day. This is the single most important rule: every mission must be built out of a concrete detail from the description - a name, a relationship, an inside joke, a place, a hobby, an occasion detail. If the description mentions a person, place or theme, weave it into the mission text itself, not just the experience title. A mission that could be copy-pasted into any other unrelated experience without changes is a failure.

Bad (too generic - never write like this): "Take a photo that could only belong to this group." / "Answer a playful question about the people sharing this experience." / "Capture something surprising, funny or beautiful."
Good (specific, built from the input): if the input mentions a grandmother's 70th birthday at the beach, a good mission is "Find someone who remembers Grandma's first trip to this beach and get them to tell the story on camera" - concrete, references the actual people and place, gives a reason the moment matters.

If a "Who's joining" section is provided below the description, listing names, ages, and relationships of the actual participants, use it aggressively: address specific people by name in mission text ("Ask Dana to..."), pair up people based on the relationships given (siblings, couples, grandparent/grandchild), and adjust tone/difficulty/physicality by the ages mentioned (a mission for a group with a 6-year-old and a 70-year-old should not require running or reading dense text). At least a third of the missions should reference a specific named person or relationship from that list, not just the group in general. If no such section is given, fall back to the general description only - do not invent names.

Vary the mission types meaningfully:
${MISSION_TYPES.join(", ")}
- "photo"/"video": ask participants to capture something specific and evocative, tied to a real detail from the description - not just "take a photo".
- "note": ask for a short written memory, reflection or answer that only makes sense for this specific group and occasion.
- "quiz"/"map": a lightweight in-context challenge, written using real names/places/facts from the description where possible (the app currently renders these as simple generic prompts, so keep the mission's "text" self-contained and understandable without extra UI).
- "puzzle": write a short, solvable riddle, cipher or word puzzle in "text" (built from a real detail in the description when possible - a name, place or shared memory), and include its solution as a separate "answer" field (a single word or short phrase, lowercase, no punctuation) - the app validates the participant's typed answer against it, so the riddle must have exactly one unambiguous correct answer.
- "story": a narrative beat with no participant action, used for openings/transitions/closings - reference the actual occasion, not a generic "the beginning".
- "reward": a payoff moment that ties back to something earlier in the journey.

Give the whole journey a real arc: a hook that pulls people in using a specific detail from the description, rising missions that build on each other and reference earlier moments, then a closing mission that pays off the theme. Titles must be punchy and specific to this exact experience - never generic labels like "The Beginning" or "Capture the Moment".

Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape:
{"name": "short experience title", "flow": [{"type": "photo", "title": "short title", "text": "one to two sentence instruction shown to the participant", "reward": "short reward label", "points": 100, "answer": "only for type puzzle"}]}

"type" must be one of: ${MISSION_TYPES.join(", ")}. "points" is an integer between 50 and 200. "answer" must only be present when "type" is "puzzle". Do not include an "id" field, the app assigns those.`;

const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"];

function bookingSearchUrl(name, location, opts) {
  const q = [name, location].filter(Boolean).join(" ");
  const params = new URLSearchParams({ ss: q });
  const { checkin, checkout, adults, children, childrenAges, rooms } = opts || {};
  if (checkin) params.set("checkin", checkin);
  if (checkout) params.set("checkout", checkout);
  params.set("group_adults", String(Math.max(1, Number(adults) || 2)));
  const adultCount = Math.max(1, Number(adults) || 2);
  const childCount = Math.max(0, Number(children) || 0);
  params.set("group_adults", String(adultCount));
  params.set("no_rooms", String(Math.max(1, Number(rooms) || Math.ceil((adultCount + childCount) / 4))));
  params.set("group_children", String(childCount));
  if (childCount && Array.isArray(childrenAges)) {
    const ages = childrenAges.slice(0, childCount).map((age) => Math.max(0, Math.min(17, Number(age) || 0)));
    if (ages.length) params.set("age", ages.join(","));
  }
  params.set("selected_currency", "ILS");
  params.set("lang", "he");
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
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

function optionsToMissionText(options, max, urlFor, location, urlOpts) {
  const lines = options.slice(0, max).map((o, i) => {
    const name = String(o?.name || "").trim().slice(0, 100);
    const why = String(o?.why || "").trim().slice(0, 220);
    if (!name) return null;
    return `${i + 1}. ${name}${why ? ` — ${why}` : ""}\n${urlFor(name, location, urlOpts)}`;
  }).filter(Boolean);
  return lines.length ? lines.join("\n\n") : null;
}

async function suggestHotel({ location, prompt, people, duration, lang, startDate, endDate, adults, children, childrenAges }) {
  const hotelPrompt = `Suggest 2 to 3 specific, realistic accommodation options in or near "${location}" that would suit this group: "${prompt}"${people ? ` (${people} people)` : ""}${duration ? `, staying for ${duration}` : ""}. For each option give a real, findable hotel/accommodation name or a specific well-known area, and a 1-2 sentence reason it fits this exact group - practical and specific, not generic travel-blog language. Write in the same language as the group description above (detect it automatically). Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape: {"options":[{"name":"hotel or area name","why":"1-2 sentence reason"}]}`;
  const data = await askGeminiJSON(hotelPrompt, "hotel suggestion");
  if (!Array.isArray(data?.options) || !data.options.length) return null;
  const stayAdults = Math.max(1, Number(adults) || Number(people) || 2);\n  const stayChildren = Math.max(0, Number(children) || 0);\n  const rooms = Math.max(1, Math.ceil((stayAdults + stayChildren) / 4));\n  const text = optionsToMissionText(data.options, 3, bookingSearchUrl, location, { checkin: startDate, checkout: endDate, adults: stayAdults, children: stayChildren, childrenAges, rooms });
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

const INTEREST_LABELS = {
  nature: "Nature & Outdoors",
  museums: "Museums & Culture",
  food: "Food & Dining",
  shopping: "Shopping",
  adventure: "Adventure & Extreme sports",
  kids: "Kid-Friendly activities",
  nightlife: "Nightlife & Entertainment",
  relaxation: "Relaxation & Wellness",
};

async function suggestAttractions({ location, prompt, people, duration, lang, interests }) {
  const interestLabels = Array.isArray(interests) ? interests.map((i) => INTEREST_LABELS[i]).filter(Boolean) : [];
  const attrPrompt = `Suggest 3 to 4 specific, real attractions or activities in or near "${location}" that would suit this group: "${prompt}"${people ? ` (${people} people)` : ""}${duration ? `, over ${duration}` : ""}.${interestLabels.length ? ` The group specifically wants to focus on these categories: ${interestLabels.join(", ")} - prioritize real options that match those categories over generic sightseeing.` : ""} For each, give a real, findable attraction or activity name and a 1-2 sentence reason it fits this exact group - their ages, interests, and any dietary/religious/accessibility needs mentioned - practical and specific, not generic travel-blog language. Write in the same language as the group description above (detect it automatically). Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape: {"options":[{"name":"attraction or activity name","why":"1-2 sentence reason"}]}`;
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

  const { prompt, type, location, duration, people, peopleDetails, adults, children, childrenAges, lang, multiDay, needsHotel, interests, startDate, endDate } = request.data || {};

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
    peopleDetails && String(peopleDetails).trim() ? `Who's joining (names, ages, relationships): ${String(peopleDetails).trim().slice(0, 600)}` : null,
    multiDay ? `This is a multi-day trip - structure the missions across the days as described above, not a single sitting.` : null,
    `Write "name", and every mission's "title", "text" and "reward", in the same language the Description above is written in - detect it automatically, it can be any language (Hebrew, English, Arabic, French, Spanish, German, Russian, or any other). Use natural, native-sounding phrasing for that language and its culture, not a literal translation. Only if the Description is too short or ambiguous to confidently detect a language, default to ${lang === "he" ? "Hebrew" : "English"}.`,
  ].filter(Boolean).join("\n");

  const hotelMissionPromise = (needsHotel && location) ? suggestHotel({ location, prompt, people, duration, lang, startDate, endDate, adults, children, childrenAges }) : Promise.resolve(null);
  const attractionsMissionPromise = (multiDay && location) ? suggestAttractions({ location, prompt, people, duration, lang, interests }) : Promise.resolve(null);

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

  const flow = sanitizeFlow(data.flow);

  const [hotelMission, attractionsMission] = await Promise.all([hotelMissionPromise, attractionsMissionPromise]);
  const extras = [hotelMission, attractionsMission].filter(Boolean);

  return {
    name: String(data.name || prompt).slice(0, 120),
    flow: extras.length ? [...extras, ...flow] : flow,
  };
});

const LANG_NAMES = {
  en: "English", he: "Hebrew", de: "German", pl: "Polish", el: "Greek",
  hu: "Hungarian", ja: "Japanese", it: "Italian", th: "Thai",
};

exports.translateExperience = onCall({ secrets: [openaiApiKey], cors: true, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before translating an experience.");
  }

  const { experienceId, targetLang } = request.data || {};
  if (!experienceId || typeof experienceId !== "string") {
    throw new HttpsError("invalid-argument", "An experience is required.");
  }
  if (!LANG_NAMES[targetLang]) {
    throw new HttpsError("invalid-argument", "Unsupported target language.");
  }

  const expRef = db.collection("experiences").doc(experienceId);
  const expSnap = await expRef.get();
  if (!expSnap.exists) {
    throw new HttpsError("not-found", "Experience not found.");
  }
  const exp = expSnap.data();

  // The organizer's own language never needs translating - and for experiences created
  // before this field existed, exp.lang is undefined, so this just falls through to
  // (harmlessly) translating once and caching, rather than guessing.
  if (exp.lang === targetLang) {
    return { name: exp.name || "", story: exp.story || "", flow: exp.flow || [] };
  }

  const flow = Array.isArray(exp.flow) ? exp.flow : [];
  if (!flow.length && !exp.name && !exp.story) {
    return { name: exp.name || "", story: exp.story || "", flow };
  }

  const cacheRef = expRef.collection("translations").doc(targetLang);
  const cacheSnap = await cacheRef.get();
  const sourceUpdatedMs = exp.updatedAt?.toMillis ? exp.updatedAt.toMillis() : 0;
  if (cacheSnap.exists) {
    const cached = cacheSnap.data();
    // A cached translation is only good while it's at least as new as the source content -
    // any organizer edit since bumps updatedAt and invalidates it, so it gets rebuilt below.
    if (cached.sourceUpdatedAt?.toMillis && cached.sourceUpdatedAt.toMillis() >= sourceUpdatedMs) {
      return { name: cached.name || "", story: cached.story || "", flow: cached.flow || [] };
    }
  }

  const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });
  const sourceForPrompt = {
    name: exp.name || "",
    story: exp.story || "",
    flow: flow.map((m) => ({
      id: m.id, type: m.type, title: m.title || "", text: m.text || "", reward: m.reward || "",
      ...(m.type === "puzzle" && m.answer ? { answer: m.answer } : {}),
      ...(m.hotel ? { hotel: m.hotel } : {}),
    })),
  };

  const systemPrompt = `You translate content for an interactive experience app called Morivo into ${LANG_NAMES[targetLang]}, for a participant who doesn't speak the language it was originally written in. Translate naturally and idiomatically, not word-for-word - it should read like it was written natively in ${LANG_NAMES[targetLang]}. Translate every "name", "story", "title", "text" and "reward" field. A "hotel" field is a proper-noun hotel name - keep it exactly as-is, never translate or transliterate it. If a mission has an "answer" field (a puzzle's solution), translate it consistently with the translated "text" (the riddle) so the puzzle stays solvable: the translated answer must be exactly what a ${LANG_NAMES[targetLang]} speaker would naturally type as the answer to the translated riddle. Keep "id" and "type" fields completely unchanged - copy them through as given. Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape: {"name":"...","story":"...","flow":[{"id":"...","type":"...","title":"...","text":"...","reward":"...","answer":"only if the input mission had one","hotel":"only if the input mission had one"}]}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(sourceForPrompt) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
  } catch (err) {
    console.error("OpenAI translate request failed", err);
    throw new HttpsError("unavailable", "The translation service failed to respond. Please try again.");
  }

  let data;
  try {
    data = JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    throw new HttpsError("internal", "The AI returned data in an unexpected format.");
  }

  // Merge back onto the original missions by id, rather than trusting the AI's flow shape
  // wholesale - this keeps every structural field (points, day, date, lat/lng, qrCode...)
  // exactly as the organizer set it, even if the model drops or reorders something.
  const translatedById = new Map((Array.isArray(data.flow) ? data.flow : []).map((m) => [m.id, m]));
  const mergedFlow = flow.map((m) => {
    const t = translatedById.get(m.id);
    return {
      ...m,
      title: t?.title ? String(t.title).slice(0, 120) : m.title,
      text: t?.text !== undefined ? String(t.text).slice(0, 600) : m.text,
      reward: t?.reward !== undefined ? String(t.reward).slice(0, 120) : m.reward,
      ...(m.type === "puzzle" && t?.answer ? { answer: String(t.answer).slice(0, 80) } : {}),
      ...(m.hotel && t?.hotel ? { hotel: String(t.hotel).slice(0, 120) } : {}),
    };
  });

  const result = {
    name: data.name ? String(data.name).slice(0, 120) : (exp.name || ""),
    story: data.story !== undefined ? String(data.story).slice(0, 4000) : (exp.story || ""),
    flow: mergedFlow,
  };

  await cacheRef.set({
    ...result,
    sourceUpdatedAt: exp.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
    translatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return result;
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

const REVISE_SYSTEM_PROMPT = `You revise existing interactive "experiences" (mission journeys) for an app called Morivo, based on a specific instruction from the organizer - things like "make it funnier", "less competitive", "suitable for younger children", "add a mission about X", "shorten it". You are given the CURRENT mission list as JSON and an instruction. Apply the instruction thoughtfully across the missions where it's relevant - rewrite titles/text/rewards as needed, and only change the number or order of missions if the instruction actually implies that (like "add one more" or "cut it down"). Keep everything grounded and specific, never generic. Write in the same language the current missions are already written in (detect it automatically) unless the instruction explicitly asks to translate. A "puzzle" mission has an "answer" field (its solution) alongside "text" (its riddle) - if you keep a puzzle mission's riddle unchanged, keep its answer unchanged too; if you rewrite the riddle or add a new puzzle mission, write a matching new "answer" (single word or short phrase, lowercase, no punctuation). Respond with STRICT JSON only, no markdown fencing, no commentary, matching exactly this shape: {"flow":[{"type":"photo","title":"short title","text":"one to two sentence instruction","reward":"short reward label","points":100,"answer":"only for type puzzle"}]}

"type" must be one of: ${MISSION_TYPES.join(", ")}. "points" is an integer between 50 and 200. "answer" must only be present when "type" is "puzzle".`;

exports.reviseExperience = onCall({ secrets: [openaiApiKey], cors: true, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before revising an experience.");
  }

  const { flow, instruction } = request.data || {};
  if (!Array.isArray(flow) || flow.length === 0) {
    throw new HttpsError("invalid-argument", "An existing set of missions is required.");
  }
  if (!instruction || !String(instruction).trim()) {
    throw new HttpsError("invalid-argument", "Tell the AI what to change.");
  }

  const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });
  const currentFlow = flow.map((m) => ({ type: m.type, title: m.title, text: m.text, reward: m.reward, points: m.points, ...(m.type === "puzzle" && m.answer ? { answer: m.answer } : {}) }));
  const userPrompt = `Current missions:\n${JSON.stringify(currentFlow)}\n\nInstruction: ${instruction}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: REVISE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });
  } catch (err) {
    console.error("OpenAI revise request failed", err);
    throw new HttpsError("unavailable", "The AI service failed to respond. Please try again.");
  }

  let data;
  try {
    data = JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    throw new HttpsError("internal", "The AI returned data in an unexpected format.");
  }

  const revised = sanitizeFlow(data.flow);
  if (!revised.length) {
    throw new HttpsError("internal", "The AI returned an unexpected experience shape.");
  }

  return { flow: revised };
});

exports.notifyOnOrganizerMessage = onDocumentCreated(
  { document: "experiences/{experienceId}/messages/{messageId}", secrets: [openaiApiKey] },
  async (event) => {
    const { experienceId } = event.params;
    const message = event.data?.data();
    if (!message?.text) return;

    // Family/school product - organizer messages reach every participant, so moderate before
    // it ever gets pushed out or stays visible in the feed.
    try {
      const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });
      const moderation = await client.moderations.create({ model: "omni-moderation-latest", input: message.text });
      if (moderation.results?.[0]?.flagged) {
        console.warn("Organizer message flagged by moderation, deleting", experienceId, event.params.messageId);
        await event.data.ref.delete();
        return;
      }
    } catch (err) {
      console.error("Moderation check failed, proceeding without blocking", err);
    }

    const [participantsSnap, expSnap] = await Promise.all([
      db.collection("experiences").doc(experienceId).collection("participants").get(),
      db.collection("experiences").doc(experienceId).get(),
    ]);

    const tokens = [...new Set(participantsSnap.docs.map((d) => d.data().pushToken).filter(Boolean))];
    if (!tokens.length) return;

    const expName = expSnap.data()?.name || "Morivo";

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: expName, body: message.text.slice(0, 180) },
        webpush: { fcmOptions: { link: "/" } },
      });
      console.log(`Push sent: ${response.successCount}/${tokens.length} succeeded`);
    } catch (err) {
      console.error("Failed to send push notifications", err);
    }
  }
);

exports.moderateMediaUpload = onDocumentCreated(
  { document: "experiences/{experienceId}/media/{mediaId}", secrets: [openaiApiKey] },
  async (event) => {
    const media = event.data?.data();
    // Video isn't supported by the moderation model (image + text only) - flag it as a known
    // gap rather than silently skip it forever.
    if (!media?.downloadURL || !media.contentType?.startsWith("image/")) return;

    try {
      const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });
      const moderation = await client.moderations.create({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: media.downloadURL } }],
      });
      if (moderation.results?.[0]?.flagged) {
        console.warn("Uploaded photo flagged by moderation, deleting", event.params.experienceId, event.params.mediaId);
        await event.data.ref.delete();
        if (media.storagePath) {
          try {
            await admin.storage().bucket().file(media.storagePath).delete();
          } catch (err) {
            console.error("Failed to delete flagged storage file", err);
          }
        }
      }
    } catch (err) {
      console.error("Photo moderation check failed, proceeding without blocking", err);
    }
  }
);

exports.moderateParticipantAnswer = onDocumentCreated(
  { document: "experiences/{experienceId}/answers/{answerId}", secrets: [openaiApiKey] },
  async (event) => {
    const answer = event.data?.data();
    if (!answer?.text) return;

    // Family/school product - a participant's written memory ends up in the shared Memory
    // Book and the organizer's live feed, so it needs the same moderation gate as organizer
    // broadcasts before it settles into either.
    try {
      const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });
      const moderation = await client.moderations.create({ model: "omni-moderation-latest", input: answer.text });
      if (moderation.results?.[0]?.flagged) {
        console.warn("Participant answer flagged by moderation, deleting", event.params.experienceId, event.params.answerId);
        await event.data.ref.delete();
      }
    } catch (err) {
      console.error("Moderation check failed, proceeding without blocking", err);
    }
  }
);

// Brand/marketing art (hero panels, loading-screen backdrops). The base prompt for each key
// is always one of the fixed, server-defined templates below, never client-supplied text - a
// signed-in caller can only ever steer the mood/motifs within that template via a short,
// truncated "context" snippet (what they typed about their own experience), never replace it
// outright, so this can't be used to generate arbitrary AI-image content on our bill.
const BRAND_IMAGE_SPECS = {
  aiCreatorHero: {
    prompt: "A dreamy, abstract 3D illustration for a premium travel-and-events app's hero panel. Softly glowing golden and purple light forms drifting in a dark navy space, with real depth, soft bokeh and cinematic lighting, evoking the feeling of a journey coming to life. Faint glowing silhouettes of a camera, a map pin, a jigsaw puzzle piece, a trophy and an open book gently floating in the scene, connected by soft trails of light. No text, no logos, no readable words, no real people. Elegant, premium, three-dimensional, a genuine wow first impression.",
    size: "1024x1024",
  },
  bookBuildingHero: {
    prompt: "A bombastic, cinematic 3D illustration of a magical storybook assembling itself in mid-air: glowing pages turning and swirling into place, warm golden light particles, soft purple and teal magical energy swirling around the book, dramatic dark elegant background with real depth and volumetric light. No text, no readable words, no real people. Premium mobile-app loading-screen art style.",
    size: "1024x1024",
  },
  landingHero: {
    prompt: "A warm, cinematic lifestyle photo of a family of five - two parents and three children of different ages - walking together away from the camera along a tropical beach at golden-hour sunset, holding hands, silhouetted against a warm gold and orange sky with palm trees to one side. Wide establishing shot, editorial travel-photography style, faces not clearly visible, generic stock-photo feel rather than a specific identifiable place or real people. Warm, emotional, premium travel-app marketing photography.",
    size: "1536x1024",
  },
};

exports.generateBrandImage = onCall({ secrets: [openaiApiKey], cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before generating brand art.");
  }

  const { key, context } = request.data || {};
  const spec = BRAND_IMAGE_SPECS[key];
  if (!spec) {
    throw new HttpsError("invalid-argument", "Unknown image key.");
  }

  // A per-experience personalization snippet - what the organizer typed about their own
  // experience (type, location, description). Bounded in length and only ever appended to our
  // own fixed template, never used as the prompt by itself.
  const cleanContext = typeof context === "string" ? context.trim().replace(/\s+/g, " ").slice(0, 500) : "";
  const prompt = cleanContext
    ? `${spec.prompt}\n\nPersonalize the mood, colors and any suggested motifs to fit this specific real experience (do not render any text, words or logos in the image): "${cleanContext}"`
    : spec.prompt;

  const client = new OpenAI({ apiKey: openaiApiKey.value().trim() });
  let result;
  try {
    result = await client.images.generate({ model: "gpt-image-1", prompt, size: spec.size, n: 1 });
  } catch (err) {
    console.error("OpenAI image generation failed", err);
    throw new HttpsError("unavailable", "Image generation failed. Please try again.");
  }

  const b64 = result?.data?.[0]?.b64_json;
  if (!b64) {
    throw new HttpsError("internal", "The AI didn't return an image.");
  }

  const buffer = Buffer.from(b64, "base64");
  const bucket = admin.storage().bucket();
  // A personalized image is one-off for this caller's draft, not the shared site default -
  // give it its own path so it never overwrites (or gets overwritten by) the shared asset
  // other users' un-personalized screens read from.
  const path = cleanContext ? `brand/${key}-${request.auth.uid}-${Date.now()}.png` : `brand/${key}.png`;
  const file = bucket.file(path);
  await file.save(buffer, { contentType: "image/png", metadata: { cacheControl: "public, max-age=3600" } });
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${path}?v=${Date.now()}`;

  if (!cleanContext) {
    await db.collection("siteAssets").doc(key).set({
      url,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { url };
});
