const assert=require('node:assert/strict');
const {missionSummary,plainSummary}=require('../functions/missionPresentation');
const {sanitizeFlow}=require('../functions/sanitizeFlow');
const text='1. The Stanley Hotel — חדרים למשפחות\nhttps://www.booking.com/searchresults.html?ss=Athens&age=7\n\nמשפחת שדה\nhttps://www.booking.com/searchresults.html?ss=Athens&group_adults=2';
const old={type:'story',organizerDecides:true,points:0,title:'היכן להתארח',text};
assert.ok(!missionSummary(old,'he').includes('https'));
assert.ok(!missionSummary(old,'he').includes('Stanley'));
assert.ok(missionSummary(old,'he').includes('בחרו'));
assert.equal(old.text,text);
for(const type of ['photo','video','quiz','puzzle','note','map','story','reward','branch']){
 const m={type,title:'A task',text:'Take a photo with the family. https://example.com/book?family=7 '+ 'More details '.repeat(80)};
 const summary=missionSummary(m,'en');
 assert.ok(summary.length<=180);assert.ok(!summary.includes('https'));assert.ok(!summary.includes('family=7'));assert.ok(summary.startsWith('Take a photo'));
}
assert.equal(plainSummary('Meet at [the museum](https://example.com/museum).'),'Meet at the museum.');
assert.equal(plainSummary('www.booking.com/search?x=1'),'');
const [made]=sanitizeFlow([{type:'photo',title:'Photo',summary:'Take a group photo. https://example.com/booking',text:'Detailed directions. https://example.com/booking',day:1}]);
assert.equal(made.summary,'Take a group photo.');assert.equal(made.text,'Detailed directions. https://example.com/booking');
const [quiz]=sanitizeFlow([{type:'quiz',title:'Question',text:'What is the capital of Greece?',options:['Athens','Rome','Paris'],answer:'Athens'}]);
assert.equal(quiz.text,'What is the capital of Greece?');assert.equal(quiz.answer,'Athens');
console.log('All mission previews are concise and link-free; legacy logistics, generated summaries, full instructions and quiz answers are preserved');
