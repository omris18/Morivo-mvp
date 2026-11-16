const assert=require('node:assert/strict');
const {bookingUrl}=require('../functions/bookingLinks');
const {familyBookingUrl}=require('../functions/families');
const a={id:'a',adults:2,children:1,childrenAges:[7],rooms:1};
const b={id:'b',adults:4,children:4,childrenAges:[2,5,8,10],rooms:2};
const exp={location:'Athens',startDate:'2026-12-06',endDate:'2026-12-10',families:[a,b]};
const stale='https://www.booking.com/hotel/gr/example.html?checkin=2025-01-01&checkout=2025-01-02&checkin_year=2025&group_adults=9&group_children=2&no_rooms=3&age=3&age=4&room1=A,A&aid=123#availability';
for(const family of [a,b]){
 const u=new URL(bookingUrl(stale,exp,family.id));
 assert.equal(u.pathname,'/hotel/gr/example.html');assert.equal(u.searchParams.get('aid'),'123');
 assert.equal(u.searchParams.get('checkin'),exp.startDate);assert.equal(u.searchParams.get('checkout'),exp.endDate);
 assert.equal(u.searchParams.get('group_adults'),String(family.adults));assert.equal(u.searchParams.get('group_children'),String(family.children));assert.equal(u.searchParams.get('no_rooms'),String(family.rooms));assert.deepEqual(u.searchParams.getAll('age'),family.childrenAges.map(String));assert.equal(u.searchParams.has('room1'),false);assert.equal(u.searchParams.has('checkin_year'),false);
}
const missing=new URL(bookingUrl('https://www.booking.com/',exp,'a'));assert.equal(missing.pathname,'/searchresults.html');assert.equal(missing.searchParams.get('ss'),'Athens');assert.equal(missing.searchParams.get('checkin'),exp.startDate);
const updated=new URL(bookingUrl(stale,{...exp,startDate:'2027-01-10',endDate:'2027-01-15'},'a'));assert.equal(updated.searchParams.get('checkin'),'2027-01-10');
const familyLink=familyBookingUrl(a,'The Stanley, Athens','2025-01-01','2025-01-03');const owner=new URL(bookingUrl(familyLink,exp));assert.equal(owner.searchParams.get('group_adults'),'2');assert.equal(owner.searchParams.has('morivo_family'),false);assert.equal(owner.searchParams.get('ss'),'The Stanley, Athens');
const legacy=new URL(bookingUrl(familyLink.replace('&morivo_family=a',''),exp));assert.equal(legacy.searchParams.get('group_children'),'1');
const noChildren=new URL(bookingUrl(stale,{startDate:exp.startDate,endDate:exp.endDate,adultsCount:2,childrenCount:0}));assert.deepEqual(noChildren.searchParams.getAll('age'),[]);
const semicolon=new URL(bookingUrl('https://www.booking.com/searchresults.html?ss=Athens;checkin=2020-01-01;checkout=2020-01-03',exp,'a'));assert.equal(semicolon.searchParams.get('ss'),'Athens');assert.equal(semicolon.searchParams.get('checkin'),exp.startDate);
assert.equal(bookingUrl('https://example.com/?date=old',exp,'a'),'https://example.com/?date=old');
const html=new URL(bookingUrl('https://www.booking.com/?ss=Athens&amp;checkin=old)',exp,'b'));assert.equal(html.searchParams.get('checkin'),exp.startDate);
console.log('PASS: both families, live date changes, missing/stale dates, hotel preservation, legacy family links, child ages, rooms, HTML/markdown and non-booking links');
