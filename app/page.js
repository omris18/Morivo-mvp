"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import MasterDashboard from "../components/MasterDashboard";
import masterAccess from "../functions/masterAccess";
import AICreator from "../components/AICreator";
import Studio from "../components/Studio";
import Runtime from "../components/Runtime";
import Participant from "../components/Participant";
import Memory from "../components/Memory";
import FirebaseStatus from "../components/FirebaseStatus";
import Account from "../components/Account";
import FlagIcon from "../components/FlagIcon";
import { firebaseConfigured, auth } from "../lib/firebase";
import { onIdTokenChanged } from "firebase/auth";
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
 const [isMaster,setIsMaster]=useState(false);
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
  const [memoryId,setMemoryId]=useState("");
  const [lang,setLang]=useState("en");
 const [country,setCountry]=useState("US");

 useEffect(()=>{
   const saved=window.localStorage?.getItem("morivo_lang");
   if(saved && STRINGS[saved]) setLang(saved);
   const savedCountry=window.localStorage?.getItem("morivo_country");
   if(savedCountry && COUNTRY_FLAGS.some(f=>f.country===savedCountry)) setCountry(savedCountry);
   else if(saved && STRINGS[saved]){
     const match=COUNTRY_FLAGS.find(f=>f.lang===saved);
     if(match) setCountry(match.country);
   }
 },[]);
 useEffect(()=>{
   try{ window.localStorage?.setItem("morivo_lang", lang); }catch{}
 },[lang]);
 useEffect(()=>{
   try{ window.localStorage?.setItem("morivo_country", country); }catch{}
 },[country]);
 function selectLang(f){ setLang(f.lang); setCountry(f.country); }

 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const pc=params.get("pcode");
   const q=params.get("join");
   const mem=params.get("memory");
   if(pc){ setPortalCode(pc.toUpperCase()); setView("portal"); }
   else if(q){ setDeepLinkCode(q.toUpperCase()); setView("participant"); }
   else if(mem){ setMemoryId(mem); setView("memoryPublic"); }
 },[]);

 useEffect(()=>{
   if(!firebaseConfigured) return;
   let unsubExp=()=>{},generation=0,previousUid=null;
   const unsubAuth=onIdTokenChanged(auth, async u=>{
     const current=++generation;
     unsubExp();
     setIsMaster(false);
     if(previousUid!==u?.uid){setActiveId(null);setExperience({id:null,name:"",flow:[],status:"draft"});setExperiences([]);setView(v=>["studio","runtime","memory","master"].includes(v)?"dashboard":v)}
     previousUid=u?.uid||null;
     setUser(u);
     if(u) unsubExp=subscribeExperiences(u.uid, rows=>setExperiences(rows));
     else setExperiences([]);
     if(u){try{const result=await u.getIdTokenResult();if(current===generation)setIsMaster(masterAccess.isMasterToken(result.claims))}catch{if(current===generation)setIsMaster(false)}}
   });
   completeGoogleRedirect().catch(console.error).finally(()=>{ ensureUser().catch(console.error); });
   return ()=>{generation++;unsubExp();unsubAuth()};
 },[]);

 useEffect(()=>{
   if(!firebaseConfigured || !activeId) return;
   return subscribeExperience(activeId, remote=>{
     if(remote) setExperience(remote);
   });
 },[activeId]);

 function openExperience(exp,target="studio"){
   setExperience(exp);
   if(firebaseConfigured && exp.id && exp.id!=="thailand-demo") setActiveId(exp.id);
   setView(target);
 }

 const t=STRINGS[lang];
 const dir=getDir(lang);
 const props={experience,setExperience,setView,user,isMaster,experiences,setExperiences,activeId,setActiveId,openExperience,deepLinkCode,lang,setLang,country,selectLang,t,dir};

 const Screen=useMemo(()=>({
   dashboard:<Dashboard {...props}/>,
   master:<MasterDashboard {...props}/>,
   ai:<AICreator {...props}/>,
   studio:<Studio {...props}/>,
   runtime:<Runtime {...props}/>,
   participant:<Participant {...props}/>,
   memory:<Memory {...props}/>
 })[view],[view,experience,experiences,user,isMaster,activeId,lang]);

 if(view==="portal"){
   return <Participant {...props} portal chromeless portalCode={portalCode}/>;
 }

 if(view==="participant" && deepLinkCode){
   return <Participant {...props} chromeless/>;
 }

 if(view==="memoryPublic"){
   return <div className="memoryPublicShell" dir={dir}><Memory {...props} publicView memoryId={memoryId}/></div>;
 }

 return <div className="appShell" dir={dir}>
   <Sidebar view={view} setView={setView} t={t} isMaster={isMaster} lang={lang}/>
   <main className="content">
     <div className="topBar">
       <FirebaseStatus t={t}/>
       <div className="topBarRight">
         <div className="langSwitchGlobal">
           {COUNTRY_FLAGS.map(f=>(
             <button key={f.country} className={country===f.country?"active":""} onClick={()=>selectLang(f)} title={f.label} aria-label={f.label}><FlagIcon code={f.country}/></button>
           ))}
         </div>
         <Account user={user} t={t} isMaster={isMaster} lang={lang}/>
       </div>
     </div>
     {isMaster&&activeId&&experience.ownerUid!==user?.uid&&["studio","runtime","memory"].includes(view)&&<div className="masterContext"><span>{lang==="he"?"מצב מאסטר · ניהול חוויה של משתמש אחר":"Master mode · managing another user's experience"}</span><button onClick={()=>setView("master")}>{lang==="he"?"כל החוויות":"All experiences"}</button></div>}
     <div className="viewFade" key={view}>{Screen}</div>
   </main>
 </div>;
}
