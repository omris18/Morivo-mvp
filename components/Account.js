"use client";
import {useEffect,useRef,useState} from "react";
import {Capacitor} from "@capacitor/core";
import {firebaseConfigured} from "../lib/firebase";
import {upgradeToEmailAccount, signInWithEmail, signOutUser, signInWithGoogle} from "../lib/morivoData";

export default function Account({user,t,isMaster=false,lang}){
 const [mode,setMode]=useState("save");
 const [open,setOpen]=useState(false);
 const [error,setError]=useState("");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false);
 const wrapRef=useRef(null);
 useEffect(()=>{
  if(!open)return;
  function onDocClick(e){ if(wrapRef.current&&!wrapRef.current.contains(e.target)) setOpen(false); }
  document.addEventListener("click",onDocClick);
  return ()=>document.removeEventListener("click",onDocClick);
 },[open]);

 if(!firebaseConfigured) return null;
 const a=t.account;

 const isReal = user && user.isAnonymous===false;

 if(isReal){
   return <div className="accountBar accountSignedIn">
     {isMaster&&<span className="masterBadge">{lang==="he"?"מנהל מערכת":"MASTER"}</span>}
     <span className="accountIdentity">{a.signedInAs} <b dir="ltr">{user.email||user.displayName}</b></span>
     <button onClick={signOutUser}>{a.signOut}</button>
   </div>;
 }

 // Google's own OAuth policy refuses to complete inside an embedded WebView (this app's
 // Capacitor shell, not a real browser) - signInWithPopup/signInWithRedirect just navigate
 // there and never come back, leaving the app stuck until it's force-closed. Disable it on
 // native rather than let people hit that dead end; email/password still works everywhere.
 const nativeApp = typeof window!=="undefined" && Capacitor.isNativePlatform();

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
   if(busy||nativeApp)return;
   setError("");
   setBusy(true);
   try{ await signInWithGoogle(); }
   catch(e){ if(e.code!=="auth/popup-closed-by-user") setError(e.message); }
   finally{ setBusy(false); }
 }

 return <div className="accountWrap" ref={wrapRef}>
  <button type="button" className="accountTrigger" aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
   {mode==="save"?a.saveAccount:a.signIn}
  </button>
  {open&&<section className="accountBar accountGuest accountPanel" aria-label={mode==="save"?a.saveAccount:a.signIn}>
   <div className="accountIntro">
    <span className="accountMark" aria-hidden="true">✦</span>
    <span className="accountMessage">{mode==="save"?a.guestSession:a.signInExisting}</span>
    <button className="accountSwitch" type="button" disabled={busy} onClick={()=>{setMode(mode==="save"?"signin":"save");setError("");}}>{mode==="save"?a.alreadyHaveAccount:a.newHere}</button>
   </div>
   <form className="accountForm" onSubmit={submit}>
    <button className="accountGoogle" type="button" disabled={busy||nativeApp} onClick={google}>{a.continueGoogle}</button>
    {nativeApp&&<small className="accountGoogleHint">{a.googleUnavailableInApp}</small>}
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
  </section>}
 </div>;
}
