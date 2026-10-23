const assert=require('node:assert/strict');
const {sanitizeFlow}=require('../functions/sanitizeFlow');

// The exact regression this guards: a mission's destination tag (set by generateMissionChunk so
// the route map can group by ground truth instead of guessing from text - see routeGroups.test.mjs)
// must survive sanitizeFlow, the one place every AI-generated mission passes through before it's
// ever stored or returned to the client.
const [tagged]=sanitizeFlow([{type:'story',title:'Day 1',text:'Arrival',destination:'Phuket'}]);
assert.equal(tagged.destination,'Phuket');

// No destination given - no stray key on the sanitized mission (keeps untagged/legacy data clean).
const [untagged]=sanitizeFlow([{type:'story',title:'Day 1',text:'Arrival'}]);
assert.equal('destination' in untagged,false);

// Trimmed and length-capped like every other free-text field here, not passed through raw.
const [padded]=sanitizeFlow([{type:'story',title:'Day 1',text:'Arrival',destination:'  Phuket  '}]);
assert.equal(padded.destination,'Phuket');
const [long]=sanitizeFlow([{type:'story',title:'Day 1',text:'Arrival',destination:'x'.repeat(200)}]);
assert.equal(long.destination.length,100);

// Same reasoning as destination above, now for the "day" field: the day-completeness safety
// net and the route map/day-lock both need a reliable structured day number instead of parsing
// one back out of a title the AI can write in any of 9 languages - see dayNumberOf/DAY_WORD_RE
// in functions/index.js and missionDayNumber in lib/experienceVisuals.js.
const [withDay]=sanitizeFlow([{type:'story',title:'Day 1',text:'Arrival',day:1}]);
assert.equal(withDay.day,1);
const [noDay]=sanitizeFlow([{type:'story',title:'Day 1',text:'Arrival'}]);
assert.equal('day' in noDay,false);
const [stringDay]=sanitizeFlow([{type:'story',title:'3日目',text:'Arrival',day:'3'}]);
assert.equal(stringDay.day,3);
const [floatDay]=sanitizeFlow([{type:'story',title:'Day 2',text:'Arrival',day:2.7}]);
assert.equal(floatDay.day,3);

// Same reasoning again for isCoordination: a hotel/attraction mission doesn't normally pass
// through sanitizeFlow (it's built directly, not AI-generated - see routeExtras.js), but
// reviseExperience round-trips every mission through here after an AI edit and must not silently
// drop the flag, or an edited coordination mission would fall back into the day-by-day grouping.
const [coordination]=sanitizeFlow([{type:'story',title:'Where to Stay',text:'...',isCoordination:true}]);
assert.equal(coordination.isCoordination,true);
const [notCoordination]=sanitizeFlow([{type:'story',title:'Day 1',text:'Arrival'}]);
assert.equal('isCoordination' in notCoordination,false);

// Untouched core behavior: id/type/title/text/reward/points still come out as before.
const [basic]=sanitizeFlow([{type:'photo',title:'Take a photo',text:'Capture the moment',reward:'Badge',points:150}]);
assert.equal(basic.type,'photo');
assert.equal(basic.title,'Take a photo');
assert.equal(basic.points,150);
assert.ok(basic.id.startsWith('photo-'));

console.log('sanitizeFlow: destination, day and coordination tags preserved, trimmed/capped, and core mission fields unaffected');
