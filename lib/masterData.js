"use client";
import {collection,onSnapshot} from "firebase/firestore";
import {db} from "./firebase";

export function subscribeAllExperiences(onData,onError) {
  // The server-side rules, not this query or the visible navigation, enforce access.
  return onSnapshot(collection(db,"experiences"),snapshot=>{
    const rows=snapshot.docs.map(d=>({...d.data(),id:d.id}));
    rows.sort((a,b)=>(b.updatedAt?.toMillis?.()||b.createdAt?.toMillis?.()||0)-(a.updatedAt?.toMillis?.()||a.createdAt?.toMillis?.()||0));
    onData(rows);
  },onError);
}
