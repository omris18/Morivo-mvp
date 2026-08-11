"use client";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase";

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

export function subscribeExperiences(uid, callback) {
  if (!firebaseConfigured || !uid) return () => {};
  const q = query(collection(db, "experiences"), where("ownerUid", "==", uid));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  });
}

export function subscribeExperience(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  return onSnapshot(doc(db, "experiences", experienceId), snap => {
    callback(snap.exists() ? { id:snap.id, ...snap.data() } : null);
  });
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
  await updateDoc(doc(db, "experiences", experience.id), {
    status:"live", joinCode, updatedAt:serverTimestamp()
  });
  await setDoc(doc(db, "publicExperiences", joinCode), {
    experienceId: experience.id,
    ownerUid: experience.ownerUid,
    name: experience.name,
    status: "live",
    joinCode,
    updatedAt: serverTimestamp()
  });
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
  return data.experienceId;
}

export function subscribeParticipants(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  return onSnapshot(collection(db, "experiences", experienceId, "participants"), snap => {
    callback(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  });
}

export function subscribeEvents(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  const q = query(collection(db, "experiences", experienceId, "events"), orderBy("createdAt","desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  });
}

export async function completeMissionRemote(experienceId, mission, participantName="Participant") {
  if (!firebaseConfigured) return;
  const user = await ensureUser();
  const participantRef = doc(db, "experiences", experienceId, "participants", user.uid);
  const current = await getDoc(participantRef);
  const old = current.exists() ? current.data() : { points:0, missions:0, name:participantName };
  await setDoc(participantRef, {
    ...old,
    points:(old.points||0)+100,
    missions:(old.missions||0)+1,
    lastMission:mission?.title || "Mission",
    updatedAt:serverTimestamp()
  }, {merge:true});
  await addDoc(collection(db, "experiences", experienceId, "events"), {
    type:"mission_complete",
    text:`✅ ${old.name || participantName} completed ${mission?.title || "a mission"}`,
    uid:user.uid,
    missionId:mission?.id || "",
    createdAt:serverTimestamp()
  });
}
