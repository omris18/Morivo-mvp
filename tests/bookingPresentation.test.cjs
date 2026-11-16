// NODE_PATH with react-test-renderer@18, react@18 and esbuild.
const assert=require('node:assert/strict'),fs=require('node:fs');
const rendererRequire=require('node:module').createRequire(require.resolve('react-test-renderer'));
const React=rendererRequire('react'),{create,act}=require('react-test-renderer'),{transformSync}=require('esbuild');
function compile(file,extra={}){const m={exports:{}};const code=transformSync(fs.readFileSync(file,'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'}).code;new Function('require','module','exports',code)(id=>{if(id==='react'||id.startsWith('react/'))return rendererRequire(id);if(extra[id])return extra[id];if(id==='../lib/i18n')return {tx:(l,h,e)=>l==='he'?h:e};if(id==='../functions/bookingLinks')return require('../functions/bookingLinks');throw new Error(id)},m,m.exports);return m.exports}
const links=compile('components/BookingLink.js'),text=compile('components/LinkifiedText.js',{'./BookingLink':links});
const exp={startDate:'2026-12-06',endDate:'2026-12-10',families:[{id:'a',adults:2,children:1,childrenAges:[7],rooms:1},{id:'b',adults:4,children:2,childrenAges:[3,10],rooms:2}]};
const raw='https://www.booking.com/hotel/gr/test.html?checkin=2020-01-01&checkout=2020-01-02';
const render=(experience,familyId)=>React.createElement(links.BookingProvider,{experience,familyId},React.createElement(text.default,{text:`מלון: [בדיקה](${raw})\nhttps://www.booking.com/`}),React.createElement(links.default,{href:raw},'Poll booking'));
let tree;act(()=>{tree=create(render(exp,'a'))});
for(const a of tree.root.findAllByType('a')){const p=new URL(a.props.href).searchParams;assert.equal(p.get('checkin'),'2026-12-06');assert.equal(p.get('group_adults'),'2');assert.deepEqual(p.getAll('age'),['7'])}
act(()=>tree.update(render({...exp,startDate:'2027-02-03',endDate:'2027-02-08'},'b')));
for(const a of tree.root.findAllByType('a')){const p=new URL(a.props.href).searchParams;assert.equal(p.get('checkin'),'2027-02-03');assert.equal(p.get('checkout'),'2027-02-08');assert.equal(p.get('group_adults'),'4');assert.equal(p.get('no_rooms'),'2');assert.deepEqual(p.getAll('age'),['3','10'])}
act(()=>tree.unmount());console.log('PASS: rendered detail and poll links share current dates and family; markdown and family/date changes preserve complete query strings');
