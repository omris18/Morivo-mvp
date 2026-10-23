"use client";
import { firebaseConfigured } from "../lib/firebase";
import pkg from "../package.json";
const { version } = pkg;

// Lets the organizer (and us, during testing) confirm at a glance that a just-pushed fix has
// actually deployed - bump package.json's version with every meaningful change, same as every
// commit this session already explains itself; this is just the one place that number is ever
// user-visible, right next to the connection status it's already glancing at.
export default function FirebaseStatus({t}){
  return <div className={firebaseConfigured ? "firebaseStatus connected" : "firebaseStatus"}>
    <span className="dot"></span>
    {firebaseConfigured ? t.firebaseConnected : t.firebaseDemo}
    <span className="firebaseVersion">v{version}</span>
  </div>
}
