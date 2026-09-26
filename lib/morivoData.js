"use client";
import {
  signInAnonymously, onAuthStateChanged, EmailAuthProvider, linkWithCredential,
  signInWithEmailAndPassword, signOut as firebaseSignOut,
  GoogleAuthProvider, linkWithPopup, signInWithPopup,
  linkWithRedirect, signInWithRedirect, getRedirectResult,
} from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, storage, functions, firebaseConfigured } from "./firebase";

export async function ensureUser() {
  if (!firebaseConfigured) return null;
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
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

export async function createExperienceRemote(uid, data) {
  if (!firebaseConfigured) return null;
  const ref = await addDoc(collection(db, "experiences"), {
    ...data,
    ownerUid: uid,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteExperienceRemote(experience) {
  if (!firebaseConfigured || !experience?.id) return;
  const experienceId = experience.id;

  const mediaSnap = await getDocs(collection(db, "experiences", experienceId, "media"));
  const storagePaths = mediaSnap.docs.map(d => d.data().storagePath).filter(Boolean);

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

export async function joinExperienceByCode(code, participantName="Guest") {
  if (!firebaseConfigured) return null;
  const user = await ensureUser();
  const publicRef = doc(db, "publicExperiences", code.trim().toUpperCase());
  const publicSnap = await getDoc(publicRef);
  if (!publicSnap.exists()) throw new Error("Invalid join code");
  const data = publicSnap.data();
  const participantRef = doc(db, "experiences", data.experienceId, "participants", user.uid);
  // This device/browser's current sign-in is reused as-is (that's what lets a returning
  // participant keep their progress across visits). If it was already joined under a
  // different name, that's someone testing a second identity from the same browser rather
  // than a real second participant - Firebase Auth only holds one identity per browser, so
  // the old name's record is about to be overwritten. Surface that instead of doing it silently.
  const existingSnap = await getDoc(participantRef);
  const renamedFrom = existingSnap.exists() && existingSnap.data().name && existingSnap.data().name !== participantName
    ? existingSnap.data().name : null;
  await setDoc(participantRef, {
    uid:user.uid,
    name:participantName,
    team:"Participants",
    points:0,
    missions:0,
    joinedAt:serverTimestamp()
  }, {merge:true});
  await addDoc(collection(db, "experiences", data.experienceId, "events"), {
    type:"join",
    text:`👋 ${participantName} joined the experience`,
    uid:user.uid,
    createdAt:serverTimestamp()
  });
  return { experienceId: data.experienceId, renamedFrom };
}

export async function addParticipantCode(experienceId, ownerUid, name) {
  if (!firebaseConfigured) return null;
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();
  await setDoc(doc(db, "participantCodes", code), {
    experienceId, ownerUid, name: name.trim().slice(0, 80), createdAt: serverTimestamp(),
  });
  return code;
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
  if (!firebaseConfigured) return null;
  const codeRef = doc(db, "participantCodes", pcode.trim().toUpperCase());
  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) throw new Error("Invalid personal code");
  const data = codeSnap.data();
  const user = await ensureUser();
  const participantRef = doc(db, "experiences", data.experienceId, "participants", user.uid);
  // See joinExperienceByCode - same-browser identity reuse means a second different personal
  // code tapped from this device overwrites whichever name it last resolved to.
  const existingSnap = await getDoc(participantRef);
  const renamedFrom = existingSnap.exists() && existingSnap.data().name && existingSnap.data().name !== data.name
    ? existingSnap.data().name : null;
  await setDoc(participantRef, {
    uid: user.uid, name: data.name, team: "Participants", points: 0, missions: 0, joinedAt: serverTimestamp(),
  }, { merge: true });
  await addDoc(collection(db, "experiences", data.experienceId, "events"), {
    type: "join", text: `👋 ${data.name} joined the experience`, uid: user.uid, createdAt: serverTimestamp(),
  });
  return { experienceId: data.experienceId, name: data.name, uid: user.uid, renamedFrom };
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
  const r=doc(db,"experiences",experienceId,"progress",uid), s=await getDoc(r);
  if(!s.exists()) await setDoc(r,{uid,completedMissionIds:[],currentMissionIndex:0,points:0,updatedAt:serverTimestamp()});
}
export async function skipMissionForParticipant(experienceId, targetUid, flowLength) {
  if (!firebaseConfigured) return;
  const r = doc(db, "experiences", experienceId, "progress", targetUid);
  const s = await getDoc(r);
  const old = s.exists() ? s.data() : { completedMissionIds:[], currentMissionIndex:0, points:0 };
  const nextIndex = Math.min((old.currentMissionIndex||0) + 1, flowLength);
  await setDoc(r, { ...old, currentMissionIndex:nextIndex, updatedAt:serverTimestamp() }, { merge:true });
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
  const user = await ensureUser();
  await addDoc(collection(db, "experiences", experienceId, "answers"), {
    uid:user.uid, participantName, missionId:mission?.id||"", missionTitle:mission?.title||"Mission",
    text, createdAt:serverTimestamp(),
  });
  await addDoc(collection(db, "experiences", experienceId, "events"), {
    type:"answer", text:`📝 ${participantName} shared a memory for ${mission?.title||"a mission"}`,
    uid:user.uid, missionId:mission?.id||"", createdAt:serverTimestamp(),
  });
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

export async function completeJourneyMission(experienceId,mission,index,name="Participant"){
  const user=await ensureUser(), r=doc(db,"experiences",experienceId,"progress",user.uid), s=await getDoc(r);
  const old=s.exists()?s.data():{completedMissionIds:[],currentMissionIndex:0,points:0};
  const already=(old.completedMissionIds||[]).includes(mission.id);
  const next={uid:user.uid,participantName:name,completedMissionIds:Array.from(new Set([...(old.completedMissionIds||[]),mission.id])),
    currentMissionIndex:Math.max(old.currentMissionIndex||0,index+1),points:(old.points||0)+(already?0:Number(mission.points||100)),
    lastMissionId:mission.id,lastMissionTitle:mission.title,updatedAt:serverTimestamp()};
  await setDoc(r,next,{merge:true});
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
