const {HttpsError} = require("firebase-functions/v2/https");
const {isMasterToken} = require("./masterAccess");

// Daily caps on every AI call, per kind of action. Each one costs real money at OpenAI/Gemini,
// and signing in anonymously (which the app does automatically) is all it takes to call them.
//   user      - a signed-in account (email/password or Google), per day
//   anonymous - an automatic anonymous sign-in, per day; deliberately low, since a script can
//               mint as many anonymous accounts as it likes
//   global    - every caller combined, per day; the backstop that bounds the bill whatever
//               happens. Raise these as real usage grows.
const LIMITS = {
  plan:      {user: 30, anonymous: 5,  global: 500},
  generate:  {user: 15, anonymous: 3,  global: 300},
  revise:    {user: 40, anonymous: 5,  global: 1000},
  translate: {user: 30, anonymous: 10, global: 1000},
  story:     {user: 10, anonymous: 2,  global: 300},
  image:     {user: 30, anonymous: 5,  global: 500},
};

const MESSAGES = {
  user: {
    he: "הגעתם למכסה היומית של פעולת ה-AI הזו. אפשר לנסות שוב מחר.",
    en: "You've reached today's limit for this AI action. Please try again tomorrow.",
  },
  anonymous: {
    he: "הגעתם למכסה היומית של פעולת ה-AI הזו. התחברות עם חשבון מגדילה את המכסה.",
    en: "You've reached today's limit for this AI action. Sign in with an account for a higher limit.",
  },
  global: {
    he: "שירות ה-AI של Morivo הגיע למכסה היומית שלו. נסו שוב מחר.",
    en: "Morivo's AI has reached its daily capacity. Please try again tomorrow.",
  },
};

const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);

// Counts one use and throws resource-exhausted once a cap is hit. Call it only right before an
// AI request is actually about to be made (after any cache lookup), so a cached answer is free.
async function consumeAiQuota(admin, auth, kind, lang) {
  const limits = LIMITS[kind];
  if (!limits) throw new Error(`Unknown AI quota kind: ${kind}`);
  if (isMasterToken(auth.token)) return;
  const anonymous = auth.token?.firebase?.sign_in_provider === "anonymous";
  const perUser = anonymous ? limits.anonymous : limits.user;
  const say = which => MESSAGES[which][lang === "he" ? "he" : "en"];
  const db = admin.firestore(), day = dayKey();
  const userRef = db.collection("aiUsage").doc(`${day}_${auth.uid}`);
  const globalRef = db.collection("aiUsage").doc(`${day}_global`);
  // Lets a Firestore TTL policy on "expireAt" clear old counters; nothing depends on it.
  const expireAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await db.runTransaction(async tx => {
    const used = Number((await tx.get(userRef)).data()?.[kind]) || 0;
    const total = Number((await tx.get(globalRef)).data()?.[kind]) || 0;
    if (used >= perUser) throw new HttpsError("resource-exhausted", say(anonymous ? "anonymous" : "user"));
    if (total >= limits.global) throw new HttpsError("resource-exhausted", say("global"));
    tx.set(userRef, {[kind]: used + 1, uid: auth.uid, day, expireAt}, {merge: true});
    tx.set(globalRef, {[kind]: total + 1, day, expireAt}, {merge: true});
  });
}

module.exports = {consumeAiQuota, LIMITS};
