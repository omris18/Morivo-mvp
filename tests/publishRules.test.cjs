// Run with @firebase/rules-unit-testing + firebase in NODE_PATH and the Firestore emulator.
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const sdkRequire=require('node:module').createRequire(require.resolve('@firebase/rules-unit-testing'));
const {doc,setDoc,getDoc,updateDoc,deleteDoc,addDoc,collection,writeBatch}=sdkRequire('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-morivo-publish',firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync('firestore.rules','utf8')}});
 try{
  await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();
   await setDoc(doc(db,'experiences/draft-trip'),{ownerUid:'owner',name:'Draft',flow:[{id:'a'}],status:'draft'});
   await setDoc(doc(db,'experiences/live-trip'),{ownerUid:'owner',name:'Live',flow:[{id:'a'}],status:'live',joinCode:'MLIVE01',paused:false});
   await setDoc(doc(db,'publicExperiences/MLIVE01'),{ownerUid:'owner',experienceId:'live-trip',status:'live',joinCode:'MLIVE01'});
   await setDoc(doc(db,'aiUsage/2026-01-01_owner'),{generate:1});
  });
  const owner=env.authenticatedContext('owner').firestore();
  const master=env.authenticatedContext('master',{email:'omris18@gmail.com',email_verified:true}).firestore();
  // Everything the app's own screens do keeps working.
  await assertSucceeds(addDoc(collection(owner,'experiences'),{ownerUid:'owner',name:'New',flow:[],status:'draft'}));
  await assertSucceeds(addDoc(collection(owner,'experiences'),{ownerUid:'owner',name:'No status yet',flow:[]}));
  await assertSucceeds(updateDoc(doc(owner,'experiences/draft-trip'),{flow:[{id:'a'},{id:'b'}],name:'Renamed',people:4}));
  await assertSucceeds(setDoc(doc(owner,'experiences/draft-trip'),{wizardDraft:true,status:'draft'},{merge:true}));
  await assertSucceeds(updateDoc(doc(owner,'experiences/live-trip'),{flow:[{id:'a'},{id:'c'}],paused:true}));
  await assertSucceeds(getDoc(doc(owner,'publicExperiences/MLIVE01')));
  // Going live, join codes and payment fields are set by Cloud Functions only.
  await assertFails(addDoc(collection(owner,'experiences'),{ownerUid:'owner',name:'Client live',flow:[],status:'live'}));
  await assertFails(addDoc(collection(owner,'experiences'),{ownerUid:'owner',name:'Client code',flow:[],status:'draft',joinCode:'MCODE01'}));
  await assertFails(addDoc(collection(owner,'experiences'),{ownerUid:'owner',name:'Client paid',flow:[],paid:true}));
  await assertFails(updateDoc(doc(owner,'experiences/draft-trip'),{status:'live'}));
  await assertFails(updateDoc(doc(owner,'experiences/draft-trip'),{joinCode:'MCODE01'}));
  await assertFails(updateDoc(doc(owner,'experiences/draft-trip'),{paid:true}));
  await assertFails(updateDoc(doc(owner,'experiences/live-trip'),{joinCode:'MOTHER1'}));
  await assertFails(setDoc(doc(owner,'publicExperiences/MCODE01'),{ownerUid:'owner',experienceId:'draft-trip',status:'live',joinCode:'MCODE01'}));
  await assertFails(updateDoc(doc(owner,'publicExperiences/MLIVE01'),{experienceId:'draft-trip'}));
  const batch=writeBatch(owner);
  batch.update(doc(owner,'experiences/draft-trip'),{status:'live',joinCode:'MDRAFT1'});
  batch.set(doc(owner,'publicExperiences/MDRAFT1'),{experienceId:'draft-trip',ownerUid:'owner',name:'Draft',status:'live',joinCode:'MDRAFT1'});
  await assertFails(batch.commit());
  // AI usage counters are not readable or writable by clients.
  await assertFails(getDoc(doc(owner,'aiUsage/2026-01-01_owner')));
  await assertFails(setDoc(doc(owner,'aiUsage/2026-01-01_owner'),{generate:0}));
  // The organizer can still take an experience down and delete it; master keeps full control.
  await assertSucceeds(updateDoc(doc(owner,'experiences/live-trip'),{status:'draft'}));
  await assertSucceeds(deleteDoc(doc(owner,'publicExperiences/MLIVE01')));
  await assertSucceeds(updateDoc(doc(master,'experiences/draft-trip'),{status:'live',joinCode:'MDRAFT1'}));
  console.log('Publish rules: normal editing works; going live, join codes, payment and AI counters are server-only');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exit(1)});
