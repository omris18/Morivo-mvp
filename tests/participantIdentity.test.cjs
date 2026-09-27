const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const mod={exports:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../functions/participantIdentity'),'utf8'),{module:mod,require:n=>n==='firebase-functions/v2/https'?{onCall:(o,fn)=>fn,HttpsError}:n==='node:crypto'?require(n):require('../functions/'+n.replace('./',''))});
let serial=0;
const records=new Map();
const ref=path=>({path,id:path.split('/').at(-1)});
const collection=path=>({path,doc:id=>ref(path+'/'+(id||`p${++serial}`)),where:(field,op,value)=>({path,field,value})});
const snapshot=r=>({...r,exists:records.has(r.path),data:()=>records.get(r.path)});
const db={doc:ref,collection,runTransaction:async fn=>{
 const pending=[];
 const tx={get:async r=>{assert.equal(pending.length,0,'Reads must precede writes');return r.field?{docs:[...records].filter(([k,v])=>k.startsWith(r.path+'/')&&k.split('/').length===r.path.split('/').length+1&&v[r.field]===r.value).map(([k])=>snapshot(ref(k)))}:snapshot(r)},
 create:(r,d)=>{assert(!records.has(r.path),'Must not overwrite');pending.push(()=>records.set(r.path,d))},
 set:(r,d,o)=>pending.push(()=>records.set(r.path,o?.merge?{...records.get(r.path),...d}:d)),
 update:(r,d)=>pending.push(()=>records.set(r.path,{...records.get(r.path),...d}))};
 const result=await fn(tx);pending.forEach(f=>f());return result;
}};
const admin={firestore:()=>db};admin.firestore.FieldValue={serverTimestamp:()=>123};
const call=mod.exports(admin),request=(uid,data)=>call({auth:{uid},data});
const exp='trip';records.set('experiences/trip',{ownerUid:'owner',status:'live',joinCode:'JOIN1234'});records.set('publicExperiences/JOIN1234',{experienceId:exp});
const join=(uid,name)=>request(uid,{action:'join',code:'JOIN1234',name});
const personal=(uid,code)=>request(uid,{action:'personal',code});
const create=(name,participantId)=>request('owner',{action:'create',experienceId:exp,name,participantId});
(async()=>{
 await assert.rejects(call({data:{}}),e=>e.code==='unauthenticated');
 await assert.rejects(request('intruder',{action:'create',experienceId:exp,name:'x'}),e=>e.code==='permission-denied');
 assert.equal((await join('new-browser')).needsName,true);
 const first=await join('browser-a','Dana');assert.equal(first.name,'Dana');assert.match(first.personalCode,/^[A-F0-9]{32}$/);
 records.set(`experiences/trip/progress/${first.uid}`,{points:200,completedMissionIds:['m1'],currentMissionIndex:1});
 const reload=await join('browser-a');assert.equal(reload.uid,first.uid);assert.equal(reload.personalCode,first.personalCode);
 const typo=await join('browser-a','Danaa');assert.equal(typo.name,'Dana');assert.equal(typo.uid,first.uid);
 const otherDevice=await personal('browser-b',first.personalCode);assert.equal(otherDevice.uid,first.uid);assert.equal(records.get(`experiences/trip/progress/${first.uid}`).points,200);
 assert.equal((await create('Dana',first.uid)).code,first.personalCode);
 const planned=await create('  Ori  ');assert.equal((await create('Ori')).code,planned.code);
 const ori=await join('browser-c','Ori');assert.equal(ori.personalCode,planned.code);assert.equal((await personal('browser-d',planned.code)).uid,ori.uid);
 const switchIdentity=await personal('browser-a',planned.code);assert.equal(switchIdentity.uid,ori.uid);assert.equal(records.get(`experiences/trip/participants/${first.uid}`).name,'Dana');assert.equal((await personal('browser-a',first.personalCode)).uid,first.uid);
 const sameName=await join('browser-e','Dana');assert.notEqual(sameName.uid,first.uid);assert.equal((await create('Dana',sameName.uid)).code,sameName.personalCode);
 records.set('experiences/trip/participants/legacy',{uid:'legacy',name:'Legacy',points:50,joinedAt:1});records.set('experiences/trip/progress/legacy',{points:500});
 const legacyInvite=await create('Legacy');const legacy=await join('legacy');assert.equal(legacy.uid,'legacy');assert.equal(legacy.personalCode,legacyInvite.code);assert.equal(records.get('experiences/trip/participants/legacy').points,50);assert.equal(records.get('experiences/trip/progress/legacy').points,500);
 records.set('participantCodes/OLDTAG12',{experienceId:exp,ownerUid:'owner',name:'Old Name'});records.set('experiences/trip/participants/old-device',{uid:'old-device',name:'Old Name'});
 assert.equal((await personal('new-device','OLDTAG12')).uid,'old-device');
 await assert.rejects(personal('new-device','MISSING12'),e=>e.code==='not-found');
 const eventCount=[...records.keys()].filter(k=>k.includes('/events/')).length;await personal('browser-b',first.personalCode);assert.equal([...records.keys()].filter(k=>k.includes('/events/')).length,eventCount);
 assert(!('personalCode' in records.get(`experiences/trip/participants/${first.uid}`)),'Bearer codes must not appear in shared participant records');
 console.log('PASS: auth, organizer authorization, automatic resume, name typo, cross-device stable ID/progress, pre-registration reuse, organizer link reuse, identity switching, same-name separation, legacy migration, missing code, idempotent events and private codes');
})().catch(e=>{console.error(e);process.exit(1)});
