const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('functions/index.js','utf8');
const start=source.indexOf('exports.generateMemoryStory ='),end=source.indexOf('\nconst REVISE_SYSTEM_PROMPT',start);
async function run({gemini=null,openai=null,denied=false,quota=false}={}){
 let saved,openaiCalls=0,prompt,queries=[];
 const exp={ownerUid:'owner',lang:'he',families:[{id:'a',name:'A'},{id:'b',name:'B'}],flow:[{id:'m',title:'Day'}]};
 const book={set:async data=>{saved=data}};
 const ref={
   get:async()=>({exists:true,data:()=>exp}),
   collection:col=>({
     doc:()=>book,
     where:(key,value,id)=>{
       queries.push([col,key,value,id]);
       const rows=col==='media'?[{missionId:'m',participantName:'A'},{missionId:'m',participantName:'Removed',deleted:true}]:[];
       return {get:async()=>({docs:rows.map(x=>({data:()=>x}))})};
     }
   })
 };

 class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
 const context={exports:{},onCall:(_options,fn)=>fn,db:{collection:()=>({doc:()=>ref})},openaiApiKey:{value:()=>''},geminiApiKey:{value:()=>''},canManageExperience:()=>!denied,consumeAiQuota:async()=>{if(quota)throw new HttpsError('resource-exhausted','daily limit')},admin:{firestore:{FieldValue:{serverTimestamp:()=>0}}},HttpsError,askGeminiJSON:async text=>{prompt=text;return gemini},OpenAI:class{constructor(){this.chat={completions:{create:async()=>{openaiCalls++;if(openai instanceof Error)throw openai;return{choices:[{message:{content:JSON.stringify(openai)}}]}}}}}},extractJson:JSON.parse,console:{error:()=>{}}};
 vm.runInNewContext(source.slice(start,end),context);
 let result,error;try{result=await context.exports.generateMemoryStory({auth:{uid:'owner'},data:{experienceId:'trip',familyId:'a'}})}catch(e){error=e}
 return{result,error,saved,openaiCalls,prompt,queries};
}
(async()=>{
 let x=await run({gemini:{story:'A family story'}});assert.equal(x.saved.memoryStory,'A family story');assert.equal(x.openaiCalls,0);assert.equal(x.queries.length,2);assert.ok(x.queries.every(q=>q[1]==='familyId'&&q[3]==='a'));assert.ok(!x.prompt.includes('Removed'));assert.ok(x.prompt.includes('1 photo/video'));
 x=await run({openai:{story:'Fallback story'}});assert.equal(x.saved.memoryStory,'Fallback story');assert.equal(x.openaiCalls,1);
 x=await run({openai:new Error('provider unavailable')});assert.equal(x.error.code,'unavailable');assert.equal(x.saved,undefined);
 x=await run({denied:true});assert.equal(x.error.code,'permission-denied');assert.equal(x.saved,undefined);
 x=await run({quota:true});assert.equal(x.error.code,'resource-exhausted');assert.equal(x.openaiCalls,0);
 console.log('Memory story: Gemini success, OpenAI fallback, scoped memories, removed-photo exclusion, authorization and quota verified');
})().catch(e=>{console.error(e);process.exitCode=1});
