// Run with Firebase Firestore + Storage emulators and @firebase/rules-unit-testing installed.
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const sdk=require('node:module').createRequire(require.resolve('@firebase/rules-unit-testing'));
const {doc,setDoc,getDoc,collection,query,where,getDocs,updateDoc}=sdk('firebase/firestore');
const {ref,uploadBytes,getBytes}=sdk('firebase/storage');
const fs=require('node:fs');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-morivo-families',firestore:{host:'127.0.0.1',port:8085,rules:fs.readFileSync('firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9195,rules:fs.readFileSync('storage.rules','utf8')}});
 try{
 await env.withSecurityRulesDisabled(async ctx=>{
 const db=ctx.firestore();
 await setDoc(doc(db,'experiences/trip'),{ownerUid:'owner',status:'live',joinCode:'GROUP',families:[{id:'a'},{id:'b'}]});
 for(const [uid,familyId] of [['a1','a'],['a2','a'],['b1','b']])await setDoc(doc(db,`experiences/trip/participantSessions/${uid}`),{participantId:uid,familyId});
 for(const col of ['media','answers','progress'])for(const f of ['a','b'])await setDoc(doc(db,`experiences/trip/${col}/${f}1`),{uid:f+'1',familyId:f,text:'private',points:0,completedMissionIds:[]});
 await setDoc(doc(db,'experiences/trip/familyBooks/a'),{memoryStory:'private A'});
 await setDoc(doc(db,'experiences/trip/familyInvites/a'),{code:'SECRET'});
 await setDoc(doc(db,'participantCodes/PERSON'),{experienceId:'trip',ownerUid:'owner',familyId:'a'});
 await setDoc(doc(db,'familyCodes/SECRET'),{familyId:'a'});
 await setDoc(doc(db,'experiences/legacy'),{ownerUid:'owner',memoryPublic:true});
 await setDoc(doc(db,'experiences/legacy/media/photo'),{uid:'old'});
 });
 const a=env.authenticatedContext('a1').firestore(),a2=env.authenticatedContext('a2').firestore(),b=env.authenticatedContext('b1').firestore(),owner=env.authenticatedContext('owner').firestore(),stranger=env.authenticatedContext('stranger').firestore();
 for(const col of ['media','answers','progress']){
 await assertSucceeds(getDoc(doc(a,`experiences/trip/${col}/a1`)));
 await assertSucceeds(getDoc(doc(a2,`experiences/trip/${col}/a1`)));
 await assertFails(getDoc(doc(b,`experiences/trip/${col}/a1`)));
 await assertFails(getDocs(collection(a,`experiences/trip/${col}`)));
 await assertSucceeds(getDocs(query(collection(a,`experiences/trip/${col}`),where('familyId','==','a'))));
 await assertSucceeds(getDocs(collection(owner,`experiences/trip/${col}`)));
 }
 await assertSucceeds(getDoc(doc(a2,'experiences/trip/progress/a2')));
 await assertSucceeds(setDoc(doc(a2,'experiences/trip/progress/a2'),{uid:'a2',familyId:'a',points:0,completedMissionIds:[]}));
 await assertSucceeds(setDoc(doc(a,'experiences/trip/media/new'),{uid:'a1',familyId:'a'}));
 await assertFails(setDoc(doc(a,'experiences/trip/media/spoof'),{uid:'a1',familyId:'b'}));
 await assertFails(updateDoc(doc(a,'experiences/trip/media/new'),{familyId:'b'}));
 await assertFails(setDoc(doc(a,'experiences/trip/answers/spoof'),{uid:'a1',familyId:'b',text:'wrong'}));
 await assertSucceeds(getDoc(doc(a,'experiences/trip/familyBooks/a')));
 await assertFails(getDoc(doc(b,'experiences/trip/familyBooks/a')));
 await assertFails(setDoc(doc(a,'experiences/trip/familyBooks/a'),{memoryStory:'spoof'}));
 await assertSucceeds(setDoc(doc(owner,'experiences/trip/familyBooks/a'),{memoryDesign:{seed:'one'}}));
 await assertFails(getDoc(doc(a,'experiences/trip/familyInvites/a')));
 await assertSucceeds(getDoc(doc(owner,'experiences/trip/familyInvites/a')));
 await assertFails(getDoc(doc(owner,'familyCodes/SECRET')));
 await assertSucceeds(getDocs(query(collection(owner,'participantCodes'),where('experienceId','==','trip'),where('ownerUid','==','owner'))));
 await assertFails(getDocs(query(collection(a,'participantCodes'),where('experienceId','==','trip'))));
 await assertFails(getDoc(doc(stranger,'experiences/trip')));
 await assertFails(updateDoc(doc(owner,'experiences/trip'),{families:[{id:'changed'}]}));
 await assertSucceeds(getDoc(doc(stranger,'experiences/legacy/media/photo')));
 const storageA=env.authenticatedContext('a1').storage(),storageB=env.authenticatedContext('b1').storage();
 await assertSucceeds(uploadBytes(ref(env.authenticatedContext('owner').storage(),'experiences/trip/media/owner/family-puzzle.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'}));
 const path='experiences/trip/families/a/media/a1/test.jpg';
 await assertSucceeds(uploadBytes(ref(storageA,path),new Uint8Array([1,2,3]),{contentType:'image/jpeg'}));
 await assertSucceeds(getBytes(ref(storageA,path)));
 await assertFails(getBytes(ref(storageB,path)));
 await assertFails(uploadBytes(ref(storageA,'experiences/trip/families/b/media/a1/no.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'}));
 await assertFails(uploadBytes(ref(storageA,'experiences/trip/media/a1/old.jpg'),new Uint8Array([1]),{contentType:'image/jpeg'}));
 console.log('PASS: family reads, scoped queries, same-family sharing, cross-family denial, spoofing denial, private invites/books, membership locking, Storage isolation and legacy compatibility');
 }finally{await env.cleanup()}
})().catch(e=>{console.error(e);process.exit(1)});
