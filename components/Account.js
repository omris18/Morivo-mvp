"use client";
import {useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {upgradeToEmailAccount, signInWithEmail, signOutUser, signInWithGoogle} from "../lib/morivoData";

export default function Account({user,t}){
 const [mode,setMode]=useState("save");
 const [error,setError]=useState("");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false);

 if(!firebaseConfigured) return null;
 const a=t.account;

 const isReal = user && user.isAnonymous===false;

 if(isReal){
   return <div className="accountBar accountSignedIn">
     <span className="accountIdentity">{a.signedInAs} <b dir="ltr">{user.email||user.displayName}</b></span>
     <button onClick={signOutUser}>{a.signOut}</button>
   </div>;
 }

 async function submit(event){
   event.preventDefault();
   if(busy)return;
   setError("");
   if(!email.trim()||!password.trim())return setError(a.enterEmailPassword);
   setBusy(true);
   try{
     if(mode==="save")await upgradeToEmailAccount(email.trim(),password);
     else await signInWithEmail(email.trim(),password);
   }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 async function google(){
   if(busy)return;
   setError("");
   setBusy(true);
   try{ await signInWithGoogle(); }
   catch(e){ if(e.code!=="auth/popup-closed-by-user") setError(e.message); }
   finally{ setBusy(false); }
 }

 return <section className="accountBar accountGuest" aria-label={mode==="save"?a.saveAccount:a.signIn}>
   <div className="accountIntro">
    <span className="accountMark" aria-hidden="true">✦</span>
    <span className="accountMessage">{mode==="save"?a.guestSession:a.signInExisting}</span>
    <button className="accountSwitch" type="button" disabled={busy} onClick={()=>{setMode(mode==="save"?"signin":"save");setError("");}}>{mode==="save"?a.alreadyHaveAccount:a.newHere}</button>
   </div>
   <form className="accountForm" onSubmit={submit}>
    <button className="accountGoogle" type="button" disabled={busy} onClick={google}>{a.continueGoogle}</button>
    <label className="accountField">
     <span>{a.email}</span>
     <input name="email" type="email" dir="ltr" autoComplete="email" placeholder={a.email} required disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/>
    </label>
    <label className="accountField">
     <span>{a.password}</span>
     <input name="password" type="password" dir="ltr" autoComplete={mode==="save"?"new-password":"current-password"} placeholder={a.password} required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/>
    </label>
    <button className="primary" type="submit" disabled={busy}>{busy?a.working:mode==="save"?a.saveAccount:a.signIn}</button>
   </form>
   {error&&<p className="accountError" role="alert">{error}</p>}
 </section>;
}
