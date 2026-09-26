import {useEffect,useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {computeOwnerStats,deleteExperienceRemote} from "../lib/morivoData";

export default function Dashboard({experience,experiences,setView,openExperience,activeId,setActiveId,t}){
 function goToCategory(view){
   if(activeId) setView(view);
   else document.getElementById("yourExperiencesList")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 const [deletingId,setDeletingId]=useState(null);
 const [stats,setStats]=useState({participants:0,missionsCompleted:0,memoriesCreated:0});
 const rows=experiences?.length ? experiences : [experience];
 const d=t.dashboard;

 useEffect(()=>{
   let alive=true;
   if(firebaseConfigured&&experiences?.length){
     computeOwnerStats(experiences).then(s=>{if(alive)setStats(s)});
   }else setStats({participants:0,missionsCompleted:0,memoriesCreated:0});
   return ()=>{alive=false};
 },[experiences]);

 async function remove(x,e){
   e.stopPropagation();
   if(!window.confirm(d.confirmDelete(x.name||"")))return;
   setDeletingId(x.id);
   try{await deleteExperienceRemote(x);if(activeId===x.id)setActiveId(null)}
   catch(err){alert(err.message)}finally{setDeletingId(null)}
 }

 return <section className="dashboardPage">
   <div className="hero morivoHero">
     <div className="heroCopy">
       <div className="tag">{d.tag}</div>
       <h1>{d.heroTitle1}<span>{d.heroTitleHighlight}</span></h1>
       <p>{d.heroSub}</p>
       <div className="actions heroActions">
         <button className="aiCta" onClick={()=>setView("ai")}><span className="spark">✦</span>{d.createWithAI}</button>
         <button className="quietCta" onClick={()=>setView("create")}>{d.createExperience}</button>
       </div>
     </div>
     <div className="heroJourney" aria-hidden="true">
       <svg viewBox="0 0 520 310" preserveAspectRatio="xMidYMid meet">
         <defs><linearGradient id="journeyGlow" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#efc186"/><stop offset=".55" stopColor="#7bc7d8"/><stop offset="1" stopColor="#9d86ff"/></linearGradient></defs>
         <path className="journeyPathGhost" d="M42 247 C100 204 112 126 180 151 S265 253 323 190 S390 75 478 83"/>
         <path className="journeyPath" d="M42 247 C100 204 112 126 180 151 S265 253 323 190 S390 75 478 83"/>
       </svg>
       <div className="journeyPin pinIdea"><i>✦</i><small>IDEA</small></div>
       <div className="journeyPin pinPlace"><i>⌖</i><small>PLACE</small></div>
       <div className="journeyPin pinLive"><i>◉</i><small>LIVE</small></div>
       <div className="journeyPin pinMemory"><i>▤</i><small>MEMORY</small></div>
       <div className="heroBook"><span></span><span></span><b>YOUR STORY</b></div>
     </div>
   </div>

   <div className="kpis dashboardKpis">
     <button className="kpiBtn" onClick={()=>document.getElementById("yourExperiencesList")?.scrollIntoView({behavior:"smooth",block:"start"})}><small>{d.experiences}</small><b>{experiences?.length||0}</b><span>→</span></button>
     <button className="kpiBtn" onClick={()=>goToCategory("runtime")}><small>{d.participants}</small><b>{stats.participants}</b><span>→</span></button>
     <button className="kpiBtn" onClick={()=>goToCategory("runtime")}><small>{d.missionsCompleted}</small><b>{stats.missionsCompleted}</b><span>→</span></button>
     <button className="kpiBtn" onClick={()=>goToCategory("memory")}><small>{d.memoriesCreated}</small><b>{stats.memoriesCreated}</b><span>→</span></button>
   </div>

   <div className="panel experiencePanel" id="yourExperiencesList">
     <div className="sectionHead"><div><div className="tag">{d.yourExperiences}</div><h2>{d.yourExperiences}</h2></div><button className="roundCreate" onClick={()=>setView("ai")} aria-label={d.createWithAI}>＋</button></div>
     <div className="experienceGrid">
     {rows.map(x=><div className="experienceRow" key={x.id}>
       <div className="experienceThumb"><span>✦</span></div>
       <div className="experienceInfo"><h3>{x.name||d.draft}</h3><p>{x.location || x.type || "Morivo"} <span>·</span> {x.status || d.draft}</p></div>
       <div className="rowActions">
         <button className="openExperience" onClick={()=>openExperience(x)}>{d.open}<span>→</span></button>
         {firebaseConfigured && x.id && <button className="danger" disabled={deletingId===x.id} onClick={e=>remove(x,e)}>{deletingId===x.id?d.deleting:d.delete}</button>}
       </div>
     </div>)}
     </div>
   </div>
 </section>
}