const assert=require('node:assert/strict');
const {consumeAiQuota,LIMITS}=require('../functions/aiQuota');
function makeAdmin(){
 const docs={};
 const db={collection:name=>({doc:id=>({path:`${name}/${id}`})}),
  runTransaction:async fn=>fn({get:async r=>({data:()=>docs[r.path]}),set:(r,p)=>{docs[r.path]={...docs[r.path],...p}}})};
 return {admin:{firestore:()=>db},docs};
}
const signedIn=uid=>({uid,token:{firebase:{sign_in_provider:'password'}}});
const anonymous=uid=>({uid,token:{firebase:{sign_in_provider:'anonymous'}}});
(async()=>{
 const day=new Date().toISOString().slice(0,10);
 let {admin,docs}=makeAdmin();
 // An anonymous caller gets the small allowance, then a clear message; other kinds are separate.
 for(let i=0;i<LIMITS.generate.anonymous;i++)await consumeAiQuota(admin,anonymous('a1'),'generate','en');
 await assert.rejects(consumeAiQuota(admin,anonymous('a1'),'generate','en'),e=>e.code==='resource-exhausted'&&/Sign in/.test(e.message));
 await assert.rejects(consumeAiQuota(admin,anonymous('a1'),'generate','he'),e=>/מכסה/.test(e.message));
 await consumeAiQuota(admin,anonymous('a1'),'plan','en');
 assert.equal(docs[`aiUsage/${day}_a1`].generate,LIMITS.generate.anonymous);
 assert.equal(docs[`aiUsage/${day}_a1`].plan,1);
 // A refused call is not counted.
 assert.equal(docs[`aiUsage/${day}_global`].generate,LIMITS.generate.anonymous);
 // A different person is unaffected, and a real account gets the larger allowance.
 await consumeAiQuota(admin,anonymous('a2'),'generate','en');
 for(let i=0;i<LIMITS.generate.user;i++)await consumeAiQuota(admin,signedIn('u1'),'generate','en');
 await assert.rejects(consumeAiQuota(admin,signedIn('u1'),'generate','en'),e=>e.code==='resource-exhausted'&&!/Sign in/.test(e.message));
 // The global cap stops everyone, however many separate accounts are used.
 ({admin,docs}=makeAdmin());
 docs[`aiUsage/${day}_global`]={generate:LIMITS.generate.global};
 await assert.rejects(consumeAiQuota(admin,signedIn('fresh'),'generate','en'),e=>e.code==='resource-exhausted'&&/capacity/.test(e.message));
 assert.equal(docs[`aiUsage/${day}_fresh`],undefined);
 // Master is never limited; an unknown kind is a programming error, not a silent pass.
 await consumeAiQuota(admin,{uid:'m',token:{email:'omris18@gmail.com',email_verified:true}},'generate','en');
 await assert.rejects(consumeAiQuota(admin,signedIn('u2'),'nonsense','en'),/Unknown AI quota kind/);
 console.log('aiQuota: per-user, anonymous and global daily caps enforced; refused calls are not counted');
})().catch(e=>{console.error(e);process.exit(1)});
