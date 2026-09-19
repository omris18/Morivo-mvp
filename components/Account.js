"use client";
import {useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {upgradeToEmailAccount, signInWithEmail, signOutUser, signInWithGoogle} from "../lib/morivoData";

export default function Account({user}){
 const [mode,setMode]=useState("save");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false);

 if(!firebaseConfigured) return null;

 const isReal = user && user.isAnonymous===false;

 if(isReal){
   return <div className="accountBar">
     <span>Signed in as <b>{user.email}</b></span>
     <button onClick={signOutUser}>Sign out</button>
   </div>;
 }

 async function submit(){
   if(!email.trim()||!password.trim())return alert("Enter an email and password");
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
   <span>{mode==="save"?"Guest session — save your experiences to an account":"Sign in to an existing account"}</span>
   <button disabled={busy} onClick={google}>🔵 Continue with Google</button>
   <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
   <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
   <button className="primary" disabled={busy} onClick={submit}>{busy?"…":mode==="save"?"Save Account":"Sign In"}</button>
   <button onClick={()=>setMode(mode==="save"?"signin":"save")}>{mode==="save"?"Already have an account?":"New here?"}</button>
 </div>;
}
