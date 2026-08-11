"use client";
import { firebaseConfigured } from "../lib/firebase";

export default function FirebaseStatus(){
  return <div className={firebaseConfigured ? "firebaseStatus connected" : "firebaseStatus"}>
    <span className="dot"></span>
    {firebaseConfigured ? "Firebase connected · Realtime mode" : "Demo mode · Firebase not connected"}
  </div>
}
