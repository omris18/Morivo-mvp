"use client";
import { firebaseConfigured } from "../lib/firebase";

export default function FirebaseStatus({t}){
  return <div className={firebaseConfigured ? "firebaseStatus connected" : "firebaseStatus"}>
    <span className="dot"></span>
    {firebaseConfigured ? t.firebaseConnected : t.firebaseDemo}
  </div>
}
