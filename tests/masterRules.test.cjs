// Run with @firebase/rules-unit-testing + firebase in NODE_PATH and the Firestore emulator.
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const sdkRequire=require('node:module').createRequire(require.resolve('@firebase/rules-unit-testing'));
const {doc,setDoc,getDoc,getDocs,collection,query,where,updateDoc}=sdkRequire('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-morivo-master',firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync('firestore.rules','utf8')}});
 try{
  await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'experiences/other-trip'),{ownerUid:'owner',name:'Other trip',flow:[],status:'draft',memoryPublic:false});await setDoc(doc(db,'experiences/other-trip/progress/kid'),{points:0,completedMissionIds:[]});});
  const master=env.authenticatedContext('master',{email:'Omris18@gmail.com',email_verified:true}).firestore();
  const owner=env.authenticatedContext('owner').firestore();
  const other=env.authenticatedContext('other',{email:'other@gmail.com',email_verified:true}).firestore();
  const imposter=env.authenticatedContext('fake',{email:'omris18@gmail.com',email_verified:false}).firestore();
  const anonymous=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(master,'experiences')));
  await assertSucceeds(updateDoc(doc(master,'experiences/other-trip'),{name:'Managed by master'}));
  await assertSucceeds(updateDoc(doc(master,'experiences/other-trip/progress/kid'),{points:50}));
  await assertSucceeds(setDoc(doc(master,'publicExperiences/TEST'),{ownerUid:'owner',experienceId:'other-trip'}));
  await assertSucceeds(setDoc(doc(master,'participantCodes/TEST'),{ownerUid:'owner',experienceId:'other-trip',name:'Test'}));
  await assertSucceeds(getDocs(query(collection(owner,'experiences'),where('ownerUid','==','owner'))));
  await assertSucceeds(updateDoc(doc(owner,'experiences/other-trip'),{name:'Owner still controls it'}));
  for(const db of [other,imposter,anonymous]){
   await assertFails(getDocs(collection(db,'experiences')));
   await assertFails(getDoc(doc(db,'experiences/other-trip')));
   await assertFails(updateDoc(doc(db,'experiences/other-trip'),{paused:true}));
  }
  await assertSucceeds(setDoc(doc(other,'users/other'),{role:'master',email:'omris18@gmail.com',email_verified:true}));
  await assertFails(getDocs(collection(other,'experiences')));
  await assertFails(updateDoc(doc(owner,'experiences/other-trip'),{ownerUid:'other'}));
  await assertFails(updateDoc(doc(master,'experiences/other-trip'),{ownerUid:'master'}));
  console.log('PASS: actual Firestore rules enforce verified master, ownership, list access and reject profile spoofing.');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exitCode=1});
