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

// Untouched core behavior: id/type/title/text/reward/points still come out as before.
const [basic]=sanitizeFlow([{type:'photo',title:'Take a photo',text:'Capture the moment',reward:'Badge',points:150}]);
assert.equal(basic.type,'photo');
assert.equal(basic.title,'Take a photo');
assert.equal(basic.points,150);
assert.ok(basic.id.startsWith('photo-'));

console.log('sanitizeFlow: destination tag preserved, trimmed/capped, and core mission fields unaffected');
