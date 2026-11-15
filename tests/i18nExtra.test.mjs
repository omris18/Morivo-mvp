import assert from "node:assert/strict";
import fs from "node:fs";
import {EXTRA, EXTRA_LANGS} from "../lib/i18nExtra.js";
import {tx, txf, missionLabelsFor, LANGS} from "../lib/i18n.js";

// Every English text the app passes to tx()/txf() - plus the he/en tables a few files keep -
// must have a translation for each of the seven other languages.
const STR = String.raw`"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'`;
const unquote = (dq, sq) => dq !== undefined ? JSON.parse(`"${dq}"`) : sq.replace(/\\'/g, "'");
export function collectKeys() {
  const keys = new Set();
  const files = [...fs.readdirSync("components").map(f => `components/${f}`), "app/page.js", "lib/morivoData.js", "lib/experienceGuidance.js", "lib/experienceVisuals.js"];
  const call = new RegExp(String.raw`\b(?:tx|txf|tr)\(\s*[\w.]+\s*,\s*(?:${STR})\s*,\s*(?:${STR})`, "g");
  const pair = new RegExp(String.raw`\[\s*(?:${STR})\s*,\s*(?:${STR})\s*\]`, "g");
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const m of source.matchAll(call)) keys.add(unquote(m[3], m[4]));
    // [Hebrew, English] pairs: mission type names and participant hints.
    if (/RouteMissionPanel|experienceGuidance/.test(file)) {
      for (const m of source.matchAll(pair)) if (/[֐-׿]/.test(unquote(m[1], m[2]))) keys.add(unquote(m[3], m[4]));
    }
    if (file.endsWith("experienceGuidance.js") || file.endsWith("experienceVisuals.js")) {
      for (const m of source.matchAll(/\ben:\{([^}]*)\}/g)) for (const v of m[1].matchAll(/:"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${v[1]}"`));
      for (const m of source.matchAll(/,en:"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
    }
  }
  return [...keys];
}

if (process.argv[2] === "--list") {
  console.log(JSON.stringify(collectKeys(), null, 1));
} else {
  assert.deepEqual(EXTRA_LANGS, LANGS.filter(l => l !== "en" && l !== "he"));
  const keys = collectKeys();
  assert.ok(keys.length > 200, `expected the app's inline texts, found only ${keys.length}`);
  const problems = [];
  for (const key of keys) {
    const row = EXTRA[key];
    if (!row) { problems.push(`missing: ${key}`); continue; }
    if (row.length !== EXTRA_LANGS.length || row.some(v => typeof v !== "string" || !v.trim())) problems.push(`incomplete: ${key}`);
    const placeholders = s => (s.match(/\{\d+\}/g) || []).sort().join();
    row.forEach((v, i) => { if (placeholders(v) !== placeholders(key)) problems.push(`placeholders differ (${EXTRA_LANGS[i]}): ${key}`); });
  }
  assert.deepEqual(problems, []);
  const unused = Object.keys(EXTRA).filter(k => !keys.includes(k));
  assert.deepEqual(unused, [], "translations for text the app no longer shows");
  // The lookup itself.
  assert.equal(tx("he", "סגירה", "Close"), "סגירה");
  assert.equal(tx("en", "סגירה", "Close"), "Close");
  assert.equal(tx("de", "סגירה", "Close"), EXTRA.Close[0]);
  assert.equal(tx("de", "אין", "No such text anywhere"), "No such text anywhere");
  assert.equal(txf("en", "משימה {0}", "Mission {0}", 4), "Mission 4");
  assert.equal(txf("he", "שלב {0} מתוך {1}", "Step {0} of {1}", 2, 3), "שלב 2 מתוך 3");
  assert.notEqual(missionLabelsFor("ja").photo, missionLabelsFor("en").photo);
  console.log(`i18nExtra: all ${keys.length} inline texts are translated into ${EXTRA_LANGS.join(", ")}`);
}
