const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {experienceArtContext}=require('../functions/experienceArtContext');
const records=new Map([['experiences/trip',{ownerUid:'owner',name:'יום כיף',location:'חי פארק קריית מוצקין',type:'טיול משפחתי'}]]);
let calls=0,saved=0;
function ref(path){return {path,get:async()=>({data:()=>records.get(path)}),set:async(data,opts)=>records.set(path,opts?.merge?{...records.get(path),...data}:data),update:async data=>records.set(path,{...records.get(path),...data})};}
const db={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,d)=>r.set(d),update:(r,d)=>r.update(d)})};
const admin={firestore:()=>db,storage:()=>({bucket:()=>({name:'bucket',file:()=>({save:async()=>saved++})})})};
class HttpsError extends Error {constructor(code,msg){super(msg);this.code=code}}
class OpenAI {constructor(){this.images={generate:async options=>{calls++;assert.ok(options.prompt.includes('חי פארק'));return {data:[{b64_json:Buffer.from('test').toString('base64')}]}}}}}
const moduleMock={exports:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../functions/experienceArtwork'),'utf8'),{module:moduleMock,require:name=>name==='firebase-functions/v2/https'?{onCall:(opts,fn)=>fn,HttpsError}:name==='openai'?OpenAI:name==='./experienceArtContext'?{experienceArtContext}:name==='./masterAccess'?require('../functions/masterAccess'):require(name),Buffer,console});
const handler=moduleMock.exports(admin,{value:()=> 'test-only'});
(async()=>{
 await assert.rejects(handler({data:{experienceId:'trip'}}),e=>e.code==='unauthenticated');
 await assert.rejects(handler({auth:{uid:'other'},data:{experienceId:'trip'}}),e=>e.code==='permission-denied');
 assert.equal(calls,0);
 const request={auth:{uid:'owner'},data:{experienceId:'trip'}};
 const first=await handler(request);assert.equal(calls,1);assert.equal(saved,1);assert.ok(first.url.includes('firebasestorage.googleapis.com'));
 assert.equal(records.get('experiences/trip').routeArtwork.context,experienceArtContext(records.get('experiences/trip')));
 assert.deepEqual(await handler(request),first);assert.equal(calls,1);
 records.get('experiences/trip').name='יום כיף חדש';await handler(request);assert.equal(calls,2);
 records.get('experiences/trip').name='עוד שינוי';records.set('experienceArtworkJobs/trip',{startedAt:Date.now()});
 await assert.rejects(handler(request),e=>e.code==='aborted');assert.equal(calls,2);
 console.log('Artwork authorization, caching, invalidation and duplicate-request checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
