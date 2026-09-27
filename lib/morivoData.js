"use client";
import {
  signInAnonymously, onAuthStateChanged, EmailAuthProvider, linkWithCredential,
  signInWithEmailAndPassword, signOut as firebaseSignOut,
  GoogleAuthProvider, linkWithPopup, signInWithPopup,
  linkWithRedirect, signInWithRedirect, getRedirectResult,
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch, runTransaction
} from "firebase/firestore";
import { deleteObject, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, functions, firebaseConfigured } from "./firebase";
import journeyProgress from "../functions/journeyProgress";
import masterAccess from "../functions/masterAccess";
import {shufflePieceLayout} from "./familyPuzzle";

let signingIn = null;
export async function ensureUser() {
  if (!firebaseConfigured) return null;
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  if (!signingIn) signingIn = signInAnonymously(auth).finally(() => { signingIn = null; });
  await signingIn;
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) { stop(); resolve(user); }
    });
  });
}

export async function upgradeToEmailAccount(email, password) {
  if (!firebaseConfigured) throw new Error("Firebase is not connected");
  const user = await ensureUser();
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(user, credential);
  return result.user;
}

export async function signInWithEmail(email, password) {
  if (!firebaseConfigured) throw new Error("Firebase is not connected");
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOutUser() {
  if (!firebaseConfigured) return;
  await firebaseSignOut(auth);
}

const POPUP_FALLBACK_CODES = ["auth/popup-blocked", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"];

export async function signInWithGoogle() {
  if (!firebaseConfigured) throw new Error("Firebase is not connected");
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;
  if (current && current.isAnonymous) {
    try {
      const result = await linkWithPopup(current, provider);
      return result.user;
    } catch (err) {
      if (err.code === "auth/credential-already-in-use") {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      }
      if (POPUP_FALLBACK_CODES.includes(err.code)) {
        await linkWithRedirect(current, provider);
        return null; // page is navigating away to Google
      }
      throw err;
    }
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    if (POPUP_FALLBACK_CODES.includes(err.code)) {
      await signInWithRedirect(auth, provider);
      return null; // page is navigating away to Google
    }
    throw err;
  }
}

export async function completeGoogleRedirect() {
  if (!firebaseConfigured) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (err) {
    console.error("Google redirect sign-in failed", err);
    return null;
  }
}

export function subscribeExperiences(uid, callback) {
  if (!firebaseConfigured || !uid) return () => {};
  const q = query(collection(db, "experiences"), where("ownerUid", "==", uid));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  });
}

export async function computeOwnerStats(experiences) {
  if (!firebaseConfigured || !experiences?.length) return { participants: 0, missionsCompleted: 0, memoriesCreated: 0 };
  let participants = 0, missionsCompleted = 0, memoriesCreated = 0;
  await Promise.all(experiences.filter(exp => exp?.id).map(async (exp) => {
    const [pSnap, progSnap, mediaSnap, ansSnap] = await Promise.all([
      getDocs(collection(db, "experiences", exp.id, "participants")),
      getDocs(collection(db, "experiences", exp.id, "progress")),
      getDocs(collection(db, "experiences", exp.id, "media")),
      getDocs(collection(db, "experiences", exp.id, "answers")),
    ]);
    participants += pSnap.size;
    progSnap.docs.forEach(d => { missionsCompleted += (d.data().completedMissionIds || []).length; });
    memoriesCreated += mediaSnap.size + ansSnap.size;
  }));
  return { participants, missionsCompleted, memoriesCreated };
}

export function subscribeExperience(experienceId, callback, onError) {
  if (!firebaseConfigured || !experienceId) return () => {};
  return onSnapshot(doc(db, "experiences", experienceId), snap => {
    callback(snap.exists() ? { id:snap.id, ...snap.data() } : null);
  }, onError || (() => {}));
}

export async function createExperienceRemote(uid, data, portraitFile = null) {
  if (!firebaseConfigured) return null;
  const ref = await addDoc(collection(db, "experiences"), {
    ...data,
    ownerUid: uid,
    ownerEmail: auth.currentUser?.email || null,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if(portraitFile) {
    try { await uploadCelebrationPortrait(ref.id,portraitFile); }
    catch(e) { alert(data.lang==="he"?"החוויה נשמרה, אך התמונה לא עלתה. אפשר לנסות שוב בניהול החי.":"Experience saved, but the photo upload failed. Retry in Live management."); }
  }
  generateExperienceArtworkRemote(ref.id).catch(()=>{});
  return ref.id;
}

const artworkRequests = new Map();
export function generateExperienceArtworkRemote(experienceId) {
  if(artworkRequests.has(experienceId))return artworkRequests.get(experienceId);
  const promise=(async()=>{await ensureUser();const call=httpsCallable(functions,"generateExperienceArtwork",{timeout:190000});return (await call({experienceId})).data;})();
  artworkRequests.set(experienceId,promise);
  promise.finally(()=>artworkRequests.delete(experienceId)).catch(()=>{});
  return promise;
}
export function generateCelebrationCartoonRemote(experienceId) {
  if(!firebaseConfigured)return Promise.reject(new Error("Firebase is not connected"));
  const call=httpsCallable(functions,"generateCelebrationCartoon",{timeout:190000});
  return (async()=>{await ensureUser();return (await call({experienceId})).data})();
}
export async function uploadCelebrationPortrait(experienceId,file) {
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024)throw new Error("Choose a JPG, PNG or WebP image up to 10 MB.");
  const user=await ensureUser(),expRef=doc(db,"experiences",experienceId),exp=(await getDoc(expRef)).data();
  const token=await user.getIdTokenResult();
  if(!masterAccess.canManageExperience({uid:user.uid,token:token.claims},exp))throw new Error("Only the organizer or master can upload this photo.");
  const path=`experiences/${experienceId}/media/${user.uid}/portrait-${Date.now()}`;
  const photoRef=storageRef(storage,path);
  await uploadBytes(photoRef,file,{contentType:file.type});
  const portrait={url:await getDownloadURL(photoRef),storagePath:path};
  await updateDoc(expRef,{celebrationPortrait:portrait});
  if(exp.celebrationPortrait?.storagePath)await deleteObject(storageRef(storage,exp.celebrationPortrait.storagePath)).catch(()=>{});
  return portrait;
}

export function generateFamilyPuzzleCartoonRemote(experienceId) {
  if(!firebaseConfigured)return Promise.reject(new Error("Firebase is not connected"));
  const call=httpsCallable(functions,"generateFamilyPuzzleCartoon",{timeout:190000});
  return (async()=>{await ensureUser();return (await call({experienceId})).data})();
}
export async function uploadFamilyPhoto(experienceId,file) {
  if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024)throw new Error("Choose a JPG, PNG or WebP image up to 10 MB.");
  const user=await ensureUser(),expRef=doc(db,"experiences",experienceId),exp=(await getDoc(expRef)).data();
  const token=await user.getIdTokenResult();
  if(!masterAccess.canManageExperience({uid:user.uid,token:token.claims},exp))throw new Error("Only the organizer or master can upload this photo.");
  const path=`experiences/${experienceId}/media/${user.uid}/family-${Date.now()}`;
  const photoRef=storageRef(storage,path);
  await uploadBytes(photoRef,file,{contentType:file.type});
  const familyPuzzle={url:await getDownloadURL(photoRef),storagePath:path,totalPieces:8,layout:shufflePieceLayout(8)};
  await updateDoc(expRef,{familyPuzzle});
  if(exp.familyPuzzle?.storagePath)await deleteObject(storageRef(storage,exp.familyPuzzle.storagePath)).catch(()=>{});
  return familyPuzzle;
}
export async function reshuffleFamilyPuzzleLayout(experienceId,totalPieces) {
  const layout=shufflePieceLayout(totalPieces||8);
  await updateDoc(doc(db,"experiences",experienceId),{"familyPuzzle.layout":layout});
  return layout;
}

export async function deleteExperienceRemote(experience) {
  if (!firebaseConfigured || !experience?.id) return;
  const experienceId = experience.id;

  const mediaSnap = await getDocs(collection(db, "experiences", experienceId, "media"));
  const storagePaths = [...mediaSnap.docs.map(d => d.data().storagePath),experience.celebrationPortrait?.storagePath,experience.familyPuzzle?.storagePath].filter(Boolean);

  for (const name of ["participants", "events", "progress", "answers", "messages", "media"]) {
    const snap = name === "media" ? mediaSnap : await getDocs(collection(db, "experiences", experienceId, name));
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await Promise.all(storagePaths.map(path =>
    deleteObject(storageRef(storage, path)).catch(e => console.error("Failed to delete storage file", path, e))
  ));

  if (experience.joinCode) {
    try { await deleteDoc(doc(db, "publicExperiences", experience.joinCode)); }
    catch (e) { console.error("Failed to remove publicExperiences entry", e); }
  }

  await deleteDoc(doc(db, "experiences", experienceId));
}

export async function updateExperienceRemote(experienceId, patch) {
  if (!firebaseConfigured || !experienceId) return;
  await updateDoc(doc(db, "experiences", experienceId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function reorderExperienceRemote(experienceId,order,expectedOrder) {
 await ensureUser();
 return (await httpsCallable(functions,"reorderExperience")({experienceId,order,expectedOrder})).data;
}
export async function updateMissionRemote(experienceId,original,edited) {
 const ref=doc(db,"experiences",experienceId);
 const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.keys(v).sort().reduce((o,k)=>(o[k]=v[k],o),{}):v);
 let changed=false;
 await runTransaction(db,async tx=>{
  const exp=(await tx.get(ref)).data(),current=exp?.flow?.find(m=>m.id===original.id);
  if(!current||canonical(current)!==canonical(original))throw new Error("המשימה השתנתה בינתיים. פתחו אותה מחדש לפני שמירה.");
  const merged={...current,...edited,id:original.id};
  changed=canonical(current)!==canonical(merged);
  tx.update(ref,{flow:exp.flow.map(m=>m.id===original.id?merged:m),updatedAt:serverTimestamp()});
 });
 // Editing a live mission can make a participant's earlier completion stale (wrong
 // answer key, changed instructions, etc), so anyone who already finished it gets
 // reset and can complete it again against the new content.
 if(changed){
  try{ await resetMissionForAllParticipants(experienceId,original.id,edited.title||original.title); }
  catch(e){ console.error("Failed to reset participant progress after mission edit:",e); }
 }
}

// Removes a single mission's completion/skip state from one progress doc, recomputing
// the participant's current position and deducting any points it had awarded.
function computeMissionReset(progress,flow,missionId){
 const p=journeyProgress.normalizeProgress(progress,flow);
 if(!p.completedMissionIds.includes(missionId)&&!p.skippedMissionIds.includes(missionId))return null;
 const mission=flow.find(m=>m.id===missionId);
 const wasCompleted=p.completedMissionIds.includes(missionId);
 const deducted=wasCompleted?Math.max(0,Math.min(500,Number(mission?.points??100)||0)):0;
 const completedMissionIds=p.completedMissionIds.filter(id=>id!==missionId);
 const skippedMissionIds=p.skippedMissionIds.filter(id=>id!==missionId);
 const next=journeyProgress.normalizeProgress({...p,completedMissionIds,skippedMissionIds,currentMissionId:null,journeyEnded:false},flow);
 return {...next,points:Math.max(0,(p.points||0)-deducted)};
}

export async function resetMissionForParticipant(experienceId,targetUid,missionId) {
 if(!firebaseConfigured)return;
 const r=doc(db,"experiences",experienceId,"progress",targetUid);
 let old={},missionTitle="";
 await runTransaction(db,async tx=>{
  const s=await tx.get(r),exp=await tx.get(doc(db,"experiences",experienceId)),flow=exp.data()?.flow||[];
  old=s.exists()?s.data():{};
  missionTitle=flow.find(m=>m.id===missionId)?.title||"";
  const next=computeMissionReset(old,flow,missionId);
  if(next)tx.set(r,{...next,updatedAt:serverTimestamp()},{merge:true});
 });
 await addDoc(collection(db, "experiences", experienceId, "events"), {
  type:"organizer_reset", text:`↺ Organizer reset "${missionTitle}" for ${old.participantName||"a participant"}`,
  uid:targetUid, missionId, createdAt:serverTimestamp(),
 });
}

export async function resetMissionForAllParticipants(experienceId,missionId,missionTitle) {
 if(!firebaseConfigured)return;
 const exp=await getDoc(doc(db,"experiences",experienceId)),flow=exp.data()?.flow||[];
 const progressSnap=await getDocs(collection(db,"experiences",experienceId,"progress"));
 const batch=writeBatch(db);
 let touched=0;
 progressSnap.docs.forEach(d=>{
  const next=computeMissionReset(d.data(),flow,missionId);
  if(next){batch.set(d.ref,{...next,updatedAt:serverTimestamp()},{merge:true});touched++}
 });
 if(!touched)return;
 await batch.commit();
 await addDoc(collection(db, "experiences", experienceId, "events"), {
  type:"organizer_mission_reset", text:`↺ Organizer edited "${missionTitle||"a mission"}" — progress reset for ${touched} participant${touched===1?"":"s"}`,
  missionId, createdAt:serverTimestamp(),
 });
}

export async function publishExperienceRemote(experience) {
  if (!firebaseConfigured) return null;
  const joinCode = (experience.joinCode || ("M" + experience.id.slice(-7))).toUpperCase();
  // Both writes must land together - if the publicExperiences doc never gets created, the
  // experience would look "live" to the organizer while every participant's join attempt fails.
  const batch = writeBatch(db);
  batch.update(doc(db, "experiences", experience.id), {
    status:"live", joinCode, updatedAt:serverTimestamp()
  });
  batch.set(doc(db, "publicExperiences", joinCode), {
    experienceId: experience.id,
    ownerUid: experience.ownerUid,
    name: experience.name,
    status: "live",
    joinCode,
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  return joinCode;
}

const participantIdentities = new Map();
export async function participantUser(experienceId) {
  const user = await ensureUser();
  const saved = participantIdentities.get(experienceId);
  return { uid: saved?.authUid === user.uid ? saved.uid : user.uid };
}
async function resolveParticipant(input) {
  const user = await ensureUser();
  const { data } = await httpsCallable(functions, "resolveParticipantIdentity")(input);
  if (data.uid && input.action !== "create") participantIdentities.set(data.experienceId, { authUid: user.uid, uid: data.uid });
  return data;
}
export async function joinExperienceByCode(code, participantName="") {
  return resolveParticipant({ action: "join", code, name: participantName });
}
export async function addParticipantCode(experienceId, ownerUid, name, participantId) {
  const result = await resolveParticipant({ action: "create", experienceId, name, ...(participantId ? { participantId } : {}) });
  return result.code;
}

export function subscribeParticipantCodes(experienceId, callback, onError) {
  if (!firebaseConfigured || !experienceId) return () => {};
  const q = query(collection(db, "participantCodes"), where("experienceId", "==", experienceId));
  return onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({ code: d.id, ...d.data() }));
    // No orderBy in the query (avoids needing a composite index) - sort client-side so the
    // list doesn't reshuffle on every write. A doc not yet confirmed by the server has a null
    // createdAt; treat it as "now" so it sorts last instead of jumping around.
    rows.sort((a, b) => (a.createdAt?.toMillis() ?? Date.now()) - (b.createdAt?.toMillis() ?? Date.now()));
    callback(rows);
  }, onError);
}

export async function removeParticipantCode(code) {
  if (!firebaseConfigured) return;
  await deleteDoc(doc(db, "participantCodes", code));
}

export async function joinExperienceByPersonalCode(pcode) {
  return resolveParticipant({ action: "personal", code: pcode });
}

export function subscribeParticipants(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  return onSnapshot(collection(db, "experiences", experienceId, "participants"), snap => {
    callback(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  });
}

export function subscribeEvents(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  const q = query(collection(db, "experiences", experienceId, "events"), orderBy("createdAt","desc"), limit(8));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  });
}

export function subscribeMyProgress(experienceId, uid, callback) {
  if (!firebaseConfigured || !experienceId || !uid) return () => {};
  return onSnapshot(doc(db,"experiences",experienceId,"progress",uid), snap =>
    callback(snap.exists()?snap.data():{uid,completedMissionIds:[],currentMissionIndex:0,points:0}));
}
export function subscribeAllProgress(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  return onSnapshot(collection(db,"experiences",experienceId,"progress"), snap =>
    callback(snap.docs.map(d=>({uid:d.id,...d.data()}))));
}
export async function initializeProgress(experienceId,uid){
  if(!firebaseConfigured)return;
  const r=doc(db,"experiences",experienceId,"progress",uid);
  await runTransaction(db,async tx=>{const s=await tx.get(r),exp=await tx.get(doc(db,"experiences",experienceId));if(!s.exists())tx.set(r,{...journeyProgress.normalizeProgress({uid,points:0},exp.data()?.flow||[]),updatedAt:serverTimestamp()})});
}
export async function skipMissionForParticipant(experienceId, targetUid, flowLength) {
  if (!firebaseConfigured) return;
  const r = doc(db, "experiences", experienceId, "progress", targetUid);
  let old={};
  await runTransaction(db,async tx=>{const s=await tx.get(r),exp=await tx.get(doc(db,"experiences",experienceId)),flow=exp.data()?.flow||[];old=s.exists()?s.data():{};const p=journeyProgress.normalizeProgress(old,flow);if(p.currentMissionId)tx.set(r,{...journeyProgress.advanceProgress(p,flow,p.currentMissionId,{skip:true}),updatedAt:serverTimestamp()},{merge:true})});
  await addDoc(collection(db, "experiences", experienceId, "events"), {
    type:"organizer_skip", text:`⏭ Organizer skipped a mission for ${old.participantName||"a participant"}`,
    uid:targetUid, createdAt:serverTimestamp(),
  });
}

export async function awardBonusPoints(experienceId, targetUid, amount) {
  if (!firebaseConfigured) return;
  const r = doc(db, "experiences", experienceId, "progress", targetUid);
  const s = await getDoc(r);
  const old = s.exists() ? s.data() : { completedMissionIds:[], currentMissionIndex:0, points:0 };
  await setDoc(r, { ...old, points:(old.points||0)+amount, updatedAt:serverTimestamp() }, { merge:true });
  await addDoc(collection(db, "experiences", experienceId, "events"), {
    type:"organizer_bonus", text:`🎁 Organizer awarded +${amount} bonus points to ${old.participantName||"a participant"}`,
    uid:targetUid, createdAt:serverTimestamp(),
  });
}

export function subscribeAnswers(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  const q = query(collection(db, "experiences", experienceId, "answers"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
}

export async function saveMissionAnswer(experienceId, mission, text, participantName="Participant") {
  if (!firebaseConfigured) return;
  const user = await participantUser(experienceId);
  await addDoc(collection(db, "experiences", experienceId, "answers"), {
    uid:user.uid, participantName, missionId:mission?.id||"", missionTitle:mission?.title||"Mission",
    text, createdAt:serverTimestamp(),
  });
  await addDoc(collection(db, "experiences", experienceId, "events"), {
    type:"answer", text:`📝 ${participantName} shared a memory for ${mission?.title||"a mission"}`,
    uid:user.uid, missionId:mission?.id||"", createdAt:serverTimestamp(),
  });
}

export function subscribeLocationVotes(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  return onSnapshot(collection(db, "experiences", experienceId, "locationVotes"), snap => callback(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
}

// One doc per participant PER mission (not just per participant) - an experience can have
// several poll-style missions (a hotel poll per destination, an attractions poll...), and each
// needs its own vote record so voting on one doesn't overwrite a participant's vote on another.
// optionIds is always an array - a single-choice poll (hotel) sends one id, a multi-select poll
// (attractions) sends however many the participant picked.
// customOption carries a participant-written suggestion ({id,name,why}) that isn't in the
// mission's preset options - passed on every vote that references it (not just the first) so
// its name stays recoverable even if the original suggester later changes their own vote.
export async function castLocationVote(experienceId, missionId, optionIds, participantName="Participant", customOption=null) {
  if (!firebaseConfigured) return;
  const user = await participantUser(experienceId);
  const data = {
    uid: user.uid, missionId, optionIds: Array.isArray(optionIds) ? optionIds : [optionIds], participantName, updatedAt: serverTimestamp(),
  };
  if (customOption) data.customOption = customOption;
  await setDoc(doc(db, "experiences", experienceId, "locationVotes", `${user.uid}_${missionId}`), data);
}

export function subscribeMessages(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  const q = query(collection(db, "experiences", experienceId, "messages"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
}

export async function sendOrganizerMessage(experienceId, text) {
  if (!firebaseConfigured || !experienceId || !text.trim()) return;
  const user = await ensureUser();
  await addDoc(collection(db, "experiences", experienceId, "messages"), {
    text: text.trim(), fromUid:user.uid, createdAt:serverTimestamp(),
  });
}

export async function completeJourneyMission(experienceId,mission,index,name="Participant",nextIndex=null){
  const user=await participantUser(experienceId), r=doc(db,"experiences",experienceId,"progress",user.uid);
  const next=await runTransaction(db,async tx=>{
    const s=await tx.get(r),exp=await tx.get(doc(db,"experiences",experienceId)),flow=exp.data()?.flow||[];
    if(exp.data()?.paused)throw new Error("החוויה מושהית כרגע.");
    const old=s.exists()?s.data():{};
    const branchTarget=nextIndex&&typeof nextIndex==="object"?nextIndex.nextMissionId:Number.isFinite(nextIndex)?flow[nextIndex]?.id||null:undefined;
    const next={...journeyProgress.advanceProgress(old,flow,mission.id,{branchTarget,awardedPoints:mission.points}),uid:user.uid,participantName:name,updatedAt:serverTimestamp()};
    tx.set(r,next,{merge:true});return next;
  });
  await addDoc(collection(db,"experiences",experienceId,"events"),{type:"journey_progress",text:`🚀 ${name} completed ${mission.title}`,uid:user.uid,missionId:mission.id,createdAt:serverTimestamp()});
  return next;
}

export async function translateExperienceRemote(experienceId, targetLang) {
  if (!firebaseConfigured || !experienceId || !targetLang) return null;
  const call = httpsCallable(functions, "translateExperience");
  const result = await call({ experienceId, targetLang });
  return result.data;
}

export function subscribeSiteAsset(key, callback) {
  if (!firebaseConfigured || !key) return () => {};
  return onSnapshot(doc(db, "siteAssets", key), snap => {
    callback(snap.exists() ? snap.data().url : null);
  }, () => callback(null));
}

export async function generateBrandImageRemote(key, context) {
  if (!firebaseConfigured) return null;
  const call = httpsCallable(functions, "generateBrandImage");
  const result = await call(context ? { key, context } : { key });
  return result.data?.url || null;
}
