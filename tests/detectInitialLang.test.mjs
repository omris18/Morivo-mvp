import assert from "node:assert/strict";
import {detectInitialLang} from "../lib/i18n.js";

// The device's own language always wins, in the order the person ranked them.
assert.equal(detectInitialLang(["ja-JP","en-US"],"Asia/Tokyo"),"ja");
assert.equal(detectInitialLang(["he"],""),"he");
assert.equal(detectInitialLang(["fr-FR","de-DE"],"Europe/Paris"),"de");
// An English phone in Japan stays English - a supported device language is never overridden.
assert.equal(detectInitialLang(["en-US"],"Asia/Tokyo"),"en");
// No supported device language: the device region, then the time zone, stand in for location.
assert.equal(detectInitialLang(["fr-JP"],"Europe/Paris"),"ja");
assert.equal(detectInitialLang(["zh-Hans-TH"],""),"th");
assert.equal(detectInitialLang(["fr-FR"],"Asia/Bangkok"),"th");
assert.equal(detectInitialLang(["ru"],"Asia/Jerusalem"),"he");
// Nothing matches, or nothing is known at all.
assert.equal(detectInitialLang(["fr-FR"],"Europe/Paris"),"en");
assert.equal(detectInitialLang([],""),"en");
assert.equal(detectInitialLang(undefined,undefined),"en");
console.log("detectInitialLang: device language first, then region, then time zone, then English");
