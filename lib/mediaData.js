"use client";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage, firebaseConfigured } from "./firebase";
import { ensureUser } from "./morivoData";

export function subscribeMedia(experienceId, callback) {
  if (!firebaseConfigured || !experienceId) return () => {};
  const q = query(collection(db, "experiences", experienceId, "media"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
}

export async function uploadMissionPhoto({experienceId, mission, file, participantName="Participant", onProgress=()=>{}}) {
  if (!firebaseConfigured) throw new Error("Firebase is not connected");
  if (!experienceId) throw new Error("Missing experience id");
  if (!file) throw new Error("Choose a photo first");
  const user = await ensureUser();
  const safeName = file.name.replace(/[^\\w.\\-]+/g, "_");
  const storagePath = `experiences/${experienceId}/media/${user.uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file, {contentType:file.type||"image/jpeg",customMetadata:{experienceId,uid:user.uid,missionId:mission?.id||""}});
  await new Promise((resolve,reject)=>task.on("state_changed", snap=>{const pct=snap.totalBytes?Math.round((snap.bytesTransferred/snap.totalBytes)*100):0;onProgress(pct)}, reject, resolve));
  const downloadURL = await getDownloadURL(task.snapshot.ref);
  const docRef = await addDoc(collection(db, "experiences", experienceId, "media"), {uid:user.uid,participantName,missionId:mission?.id||"",missionTitle:mission?.title||"Mission",storagePath,downloadURL,fileName:safeName,contentType:file.type||"image/jpeg",createdAt:serverTimestamp()});
  await addDoc(collection(db, "experiences", experienceId, "events"), {type:"media_upload",text:`📸 ${participantName} uploaded a photo for ${mission?.title||"a mission"}`,uid:user.uid,missionId:mission?.id||"",createdAt:serverTimestamp()});
  return {id:docRef.id,downloadURL,storagePath};
}
