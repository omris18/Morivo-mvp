const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code}}
// A tiny in-memory Firestore: just enough for the transaction publishExperience runs.
function makeAdmin(docs){
 const writes=[];
 const ref=path=>({path});
 const db={collection:name=>({doc:id=>ref(`${name}/${id}`)}),
  runTransaction:async fn=>fn({get:async r=>({data:()=>docs[r.path]}),update:(r,p)=>{writes.push(r.path);docs[r.path]={...docs[r.path],...p}},set:(r,p)=>{writes.push(r.path);docs[r.path]=p}})};
 const admin={firestore:()=>db};admin.firestore.FieldValue={serverTimestamp:()=>'now'};
 return {admin,writes};
}
function load(admin,paymentsEnabled){
 const mod={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../functions/publishExperience'),'utf8'),{module:mod,require:n=>n==='firebase-functions/v2/https'?{onCall:(o,fn)=>fn,HttpsError}:n.startsWith('./')?require('../functions/'+n.slice(2)):require(n)});
 return mod.exports(admin,{paymentsEnabled});
}
// Values come back from another vm context, so compare them as plain data.
const plain=x=>JSON.parse(JSON.stringify(x));
const base=()=>({'experiences/abc1234567':{ownerUid:'owner',name:'Trip',flow:[{id:'a'}],status:'draft',adultsCount:2,childrenCount:3}});
(async()=>{
 // Payments off (today): the organizer publishes for free, in one atomic pair of writes.
 let docs=base(),{admin,writes}=makeAdmin(docs),publish=load(admin,false);
 await assert.rejects(publish({data:{experienceId:'abc1234567'}}),e=>e.code==='unauthenticated');
 await assert.rejects(publish({auth:{uid:'owner'},data:{}}),e=>e.code==='invalid-argument');
 await assert.rejects(publish({auth:{uid:'owner'},data:{experienceId:'missing'}}),e=>e.code==='not-found');
 await assert.rejects(publish({auth:{uid:'intruder'},data:{experienceId:'abc1234567'}}),e=>e.code==='permission-denied');
 assert.equal(writes.length,0);
 assert.deepEqual(plain(await publish({auth:{uid:'owner'},data:{experienceId:'abc1234567'}})),{joinCode:'M1234567'});
 assert.equal(docs['experiences/abc1234567'].status,'live');
 assert.equal(docs['experiences/abc1234567'].joinCode,'M1234567');
 assert.deepEqual(plain(docs['publicExperiences/M1234567']),{experienceId:'abc1234567',ownerUid:'owner',name:'Trip',status:'live',joinCode:'M1234567',updatedAt:'now'});
 // Publishing again keeps the same code rather than minting a new one.
 assert.deepEqual(plain(await publish({auth:{uid:'owner'},data:{experienceId:'abc1234567'}})),{joinCode:'M1234567'});
 // Nothing to publish yet.
 docs=base();docs['experiences/abc1234567'].flow=[];({admin,writes}=makeAdmin(docs));
 await assert.rejects(load(admin,false)({auth:{uid:'owner'},data:{experienceId:'abc1234567'}}),e=>e.code==='failed-precondition');
 docs=base();docs['experiences/abc1234567'].wizardDraft=true;({admin,writes}=makeAdmin(docs));
 await assert.rejects(load(admin,false)({auth:{uid:'owner'},data:{experienceId:'abc1234567'}}),e=>e.code==='failed-precondition');
 // A join code already used by a different experience is never taken over.
 docs=base();docs['publicExperiences/M1234567']={experienceId:'someone-else'};({admin,writes}=makeAdmin(docs));
 const other=await load(admin,false)({auth:{uid:'owner'},data:{experienceId:'abc1234567'}});
 assert.notEqual(other.joinCode,'M1234567');assert.match(other.joinCode,/^M[0-9A-F]{7}$/);
 assert.equal(docs['publicExperiences/M1234567'].experienceId,'someone-else');
 // Payments on: unpaid stays a draft and the server states the price; paid goes live.
 docs=base();({admin,writes}=makeAdmin(docs));publish=load(admin,true);
 assert.deepEqual(plain(await publish({auth:{uid:'owner'},data:{experienceId:'abc1234567'}})),{paymentRequired:true,participants:5,amount:10000,currency:'ils'});
 assert.equal(writes.length,0);assert.equal(docs['experiences/abc1234567'].status,'draft');
 docs['experiences/abc1234567'].paid=true;
 assert.deepEqual(plain(await publish({auth:{uid:'owner'},data:{experienceId:'abc1234567'}})),{joinCode:'M1234567'});
 // Master can publish on an organizer's behalf without a payment.
 docs=base();({admin,writes}=makeAdmin(docs));
 assert.deepEqual(plain(await load(admin,true)({auth:{uid:'m',token:{email:'omris18@gmail.com',email_verified:true}},data:{experienceId:'abc1234567'}})),{joinCode:'M1234567'});
 docs=base();docs['experiences/abc1234567'].families=[{id:'a',name:'Alpha',adults:2,children:1,childrenAges:[7],rooms:1},{id:'b',name:'Beta',adults:4,children:4,childrenAges:[2,5,7,10],rooms:2}];
 ({admin,writes}=makeAdmin(docs));publish=load(admin,false);
 await publish({auth:{uid:'owner'},data:{experienceId:'abc1234567'}});
 const familyCode=docs['experiences/abc1234567/familyInvites/a'].code;
 assert.equal(docs[`familyCodes/${familyCode}`].familyId,'a');
 assert.equal(docs['experiences/abc1234567'].people,11);
 await publish({auth:{uid:'owner'},data:{experienceId:'abc1234567'}});
 assert.equal(docs['experiences/abc1234567/familyInvites/a'].code,familyCode);
 assert.notEqual(docs['experiences/abc1234567/familyInvites/b'].code,familyCode);
 console.log('PASS: private stable family invitation codes and normalized totals');
 console.log('publishExperience: ownership, empty flow, join-code collisions and the payment gate all enforced server-side');
})().catch(e=>{console.error(e);process.exit(1)});
