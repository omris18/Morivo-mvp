"use client";
import {useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {upgradeToEmailAccount, signInWithEmail, signOutUser, signInWithGoogle} from "../lib/morivoData";

export default function Account({user,t}){
 const [mode,setMode]=useState("save");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false);

 if(!firebaseConfigured) return null;
 const a=t.account;

 const isReal = user && user.isAnonymous===false;

 if(isReal){
   return <div className="accountBar">
     <span>{a.signedInAs} <b>{user.email}</b></span>
     <button onClick={signOutUser}>{a.signOut}</button>
   </div>;
 }

 async function submit(){
   if(!email.trim()||!password.trim())return alert(a.enterEmailPassword);
   setBusy(true);
   try{
     if(mode==="save")await upgradeToEmailAccount(email.trim(),password);
     else await signInWithEmail(email.trim(),password);
   }catch(e){alert(e.message)}finally{setBusy(false)}
 }

 async function google(){
   setBusy(true);
   try{ await signInWithGoogle(); }
   catch(e){ if(e.code!=="auth/popup-closed-by-user") alert(e.message); }
   finally{ setBusy(false); }
 }

 return <div className="accountBar">
   <span>{mode==="save"?a.guestSession:a.signInExisting}</span>
   <button disabled={busy} onClick={google}>{a.continueGoogle}</button>
   <input type="email" placeholder={a.email} value={email} onChange={e=>setEmail(e.target.value)}/>
   <input type="password" placeholder={a.password} value={password} onChange={e=>setPassword(e.target.value)}/>
   <button className="primary" disabled={busy} onClick={submit}>{busy?a.working:mode==="save"?a.saveAccount:a.signIn}</button>
   <button onClick={()=>setMode(mode==="save"?"signin":"save")}>{mode==="save"?a.alreadyHaveAccount:a.newHere}</button>
 </div>;
}
