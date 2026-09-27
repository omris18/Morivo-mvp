const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let exp={ownerUid:'owner',flow:[{id:'a',text:'Original A'},{id:'b',text:'Original B'}]},progress={completedMissionIds:[],currentMissionIndex:0,points:0},writes=0;
class HttpsError extends Error {constructor(code,message){super(message);this.code=code}}
const query={},ref={collection:()=>query};
const tx={get:async x=>x===ref?{data:()=>exp}:{size:1,docs:[{ref:'p',data:()=>progress}]},set:(r,p)=>{writes++;progress=p},update:(r,p)=>{writes++;exp={...exp,...p}}};
const db={collection:()=>({doc:()=>ref}),runTransaction:async fn=>fn(tx)};
const admin={firestore:()=>db};admin.firestore.FieldValue={serverTimestamp:()=>0};
const mod={exports:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../functions/reorderExperience'),'utf8'),{module:mod,require:n=>n==='firebase-functions/v2/https'?{onCall:(o,fn)=>fn,HttpsError}:require('../functions/journeyProgress')});
const handler=mod.exports(admin),data={experienceId:'test',expectedOrder:['a','b'],order:['b','a']};
(async()=>{
 await assert.rejects(handler({data}),e=>e.code==='unauthenticated');
 await assert.rejects(handler({auth:{uid:'intruder'},data}),e=>e.code==='permission-denied');assert.equal(writes,0);
 await assert.rejects(handler({auth:{uid:'owner'},data:{...data,order:['a','a']}}),e=>e.code==='invalid-argument');assert.equal(writes,0);
 await handler({auth:{uid:'owner'},data});assert.deepEqual(exp.flow.map(x=>x.id),['b','a']);assert.equal(exp.flow[1].text,'Original A');assert.equal(progress.currentMissionId,'a');assert.equal(progress.currentMissionIndex,1);assert.equal(progress.points,0);
 const saved=writes;await assert.rejects(handler({auth:{uid:'owner'},data}),e=>e.code==='aborted');assert.equal(writes,saved);
 console.log('Reorder authorization, permutation, stale order and active-mission preservation checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
