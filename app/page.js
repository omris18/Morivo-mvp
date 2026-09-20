"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import CreateExperience from "../components/CreateExperience";
import AICreator from "../components/AICreator";
import Studio from "../components/Studio";
import Runtime from "../components/Runtime";
import Participant from "../components/Participant";
import Memory from "../components/Memory";
import FirebaseStatus from "../components/FirebaseStatus";
import Account from "../components/Account";
import { firebaseConfigured, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ensureUser, subscribeExperiences, subscribeExperience, completeGoogleRedirect } from "../lib/morivoData";
import { STRINGS, getDir, COUNTRY_FLAGS } from "../lib/i18n";

const DEMO={
 id:"thailand-demo", name:"Thailand Family Adventure", type:"Family Trip",
 location:"Thailand", people:18,
 story:"A family experience designed around shared missions and memories.",
 status:"draft",
 flow:[
  {id:"welcome",type:"story",title:"Welcome",text:"Your adventure starts here.",reward:"Welcome badge"},
  {id:"photo",type:"photo",title:"First Memory",text:"Capture one photo that includes everyone.",reward:"100 points"},
  {id:"branch",type:"branch",title:"Choose Your Path",text:"Adventure or relax?",reward:""},
  {id:"sunset",type:"photo",title:"Golden Hour",text:"Create one shared sunset memory.",reward:"Family badge"},
  {id:"memory",type:"story",title:"Final Memory",text:"Choose the moment you never want to forget.",reward:"Memory Book"},
 ]
};

export default function Home(){
 const [view,setView]=useState("dashboard");
 const [user,setUser]=useState(null);
 const [experiences,setExperiences]=useState([]);
 const [experience,setExperience]=useState({
    id: null,
    name: "",
    type: "",
    location: "",
    people: 0,
    story: "",
    flow: [],
    status: "draft",
    joinCode: ""
  });
  const [activeId,setActiveId]=useState(null);
  const [deepLinkCode,setDeepLinkCode]=useState("");
  const [portalCode,setPortalCode]=useState("");
  const [lang,setLang]=useState("en");

 useEffect(()=>{
   const saved=window.localStorage?.getItem("morivo_lang");
   if(saved && STRINGS[saved]) setLang(saved);
 },[]);
 useEffect(()=>{
   try{ window.localStorage?.setItem("morivo_lang", lang); }catch{}
 },[lang]);

 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const pc=params.get("pcode");
   const q=params.get("join");
   if(pc){ setPortalCode(pc.toUpperCase()); setView("portal"); }
   else if(q){ setDeepLinkCode(q.toUpperCase()); setView("participant"); }
 },[]);

 useEffect(()=>{
   if(!firebaseConfigured) return;
   let unsubExp=()=>{};
   const unsubAuth=onAuthStateChanged(auth, u=>{
     unsubExp();
     setUser(u);
     if(u) unsubExp=subscribeExperiences(u.uid, rows=>setExperiences(rows));
     else setExperiences([]);
   });
   completeGoogleRedirect().catch(console.error).finally(()=>{ ensureUser().catch(console.error); });
   return ()=>{unsubExp();unsubAuth()};
 },[]);

 useEffect(()=>{
   if(!firebaseConfigured || !activeId) return;
   return subscribeExperience(activeId, remote=>{
     if(remote) setExperience(remote);
   });
 },[activeId]);

 function openExperience(exp){
   setExperience(exp);
   if(firebaseConfigured && exp.id && exp.id!=="thailand-demo") setActiveId(exp.id);
   setView("studio");
 }

 const t=STRINGS[lang];
 const dir=getDir(lang);
 const props={experience,setExperience,setView,user,experiences,setExperiences,activeId,setActiveId,openExperience,deepLinkCode,lang,setLang,t,dir};

 const Screen=useMemo(()=>({
   dashboard:<Dashboard {...props}/>,
   ai:<AICreator {...props}/>,
   create:<CreateExperience {...props}/>,
   studio:<Studio {...props}/>,
   runtime:<Runtime {...props}/>,
   participant:<Participant {...props}/>,
   memory:<Memory {...props}/>
 })[view],[view,experience,experiences,user,activeId,lang]);

 if(view==="portal"){
   return <Participant {...props} portal chromeless portalCode={portalCode}/>;
 }

 if(view==="participant" && deepLinkCode){
   return <Participant {...props} chromeless/>;
 }

 return <div className="appShell" dir={dir}>
   <Sidebar view={view} setView={setView} t={t}/>
   <main className="content">
     <div className="topBar">
       <FirebaseStatus t={t}/>
       <div className="topBarRight">
         <div className="langSwitchGlobal">
           {COUNTRY_FLAGS.map(f=>(
             <button key={f.country} className={lang===f.lang?"active":""} onClick={()=>setLang(f.lang)} title={f.label} aria-label={f.label}>{f.flag}</button>
           ))}
         </div>
         <Account user={user} t={t}/>
       </div>
     </div>
     <div className="viewFade" key={view}>{Screen}</div>
   </main>
 </div>;
}
