// Shared by generation, the editor and participants, including older experiences.
const plain = value => String(value ?? "").trim();
const isLabel = value => /^[A-Dא-ד1-4][.)\]:-]?$/i.test(plain(value));
const cleanOption = value => plain(typeof value === "object" ? value?.label || value?.text || value?.value : value).replace(/^[A-Dא-ד1-4][.)\]:-]\s*/i, "").trim();
function normalizeMission(m = {}) {
  if (!["quiz", "puzzle", "note"].includes(m.type)) return m;
  const reflection = /מה\s+(?:למדת(?:ם|ן)?|אהבת(?:ם|ן)?|הרגשת(?:ם|ן)?|גילית(?:ם|ן)?)|מה היה.*(?:הכי|אהוב)|שתפו.*(?:למד|חוויה|הרגש)|what (?:did you learn|have you learned|was your favou?rite)|how did you feel/i.test(`${m.title || ""} ${m.text || ""}`);
  if (m.type === "note" || m.responseMode === "open" || (m.responseMode !== "graded" && reflection)) {
    return {...m, type:"note", responseMode:"open", answer:"", options:[]};
  }
  if (m.type !== "quiz") return m;
  let options = (Array.isArray(m.options) ? m.options : []).map(cleanOption).filter(x => x && !isLabel(x));
  if (options.length < 2) {
    options = String(m.text || "").split(/\n/).filter(x => /^\s*[A-Dא-ד1-4][.)\]:-]\s*\S/i.test(x)).map(cleanOption).filter(x => !isLabel(x));
  }
  options = [...new Set(options)];
  let answer = plain(m.answer);
  if (isLabel(answer)) {
    const key = answer.replace(/[.)\]:-]/g, "").toUpperCase();
    const index = "ABCD".indexOf(key) >= 0 ? "ABCD".indexOf(key) : "אבגד".indexOf(key) >= 0 ? "אבגד".indexOf(key) : Number(key) - 1;
    answer = options[index] || "";
  } else answer = cleanOption(answer);
  // No invented choices or guessed correct option. Legacy malformed quizzes accept
  // a written response until their organizer supplies a real question/answer.
  if (options.length < 2) return {...m, type:answer ? "puzzle" : "note", responseMode:answer ? "graded" : "open", options:[], answer, needsAnswerReview:true};
  return {...m, options, answer:options.includes(answer) ? answer : "", needsAnswerReview:!options.includes(answer)};
}
function answerMatches(actual, expected) {
  const normalize = x => plain(x).normalize("NFKC").toLocaleLowerCase().replace(/[\u0591-\u05C7]/g, "").replace(/[.,!?;:״"׳'؟،]/g, "").replace(/\s+/g, " ").trim();
  return normalize(actual) === normalize(expected);
}
module.exports = {normalizeMission, answerMatches};
