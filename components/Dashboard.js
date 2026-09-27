import PhotoJourney from "./PhotoJourney";
import ExperienceCover from "./ExperienceCover";
import {useEffect,useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {computeOwnerStats,deleteExperienceRemote} from "../lib/morivoData";

export default function Dashboard({experience,experiences,setView,openExperience,activeId,setActiveId,t,lang,isMaster=false}){
 const he=lang==="he";
 function goToCategory(view){
   if(activeId) setView(view);
   else document.getElementById("yourExperiencesList")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 const [deletingId,setDeletingId]=useState(null);
 const [stats,setStats]=useState({participants:0,missionsCompleted:0,memoriesCreated:0});
 const rows=experiences?.length ? experiences : experience?.id?[experience]:[];
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

 return <section className="dashboardPage dashboardWarm">
   <div className="dashboardWelcome"><div><span className="tag">{he?"מרחב החוויות שלך":"YOUR EXPERIENCE SPACE"}</span><p>{he?"יש רגעים שכדאי להפוך לסיפור.":"Some moments deserve a story."}</p></div>{isMaster&&<button className="masterQuickAccess" onClick={()=>setView("master")}>◈ {he?"ניהול כל החוויות":"Manage all experiences"}</button>}</div>
   <div className="hero morivoHero">
     <div className="heroCopy">
       <div className="tag">{d.tag}</div>
       <h1>{d.heroTitle1}<span>{d.heroTitleHighlight}</span></h1>
       <p>{d.heroSub}</p>
       <div className="actions heroActions">
         <button className="aiCta" onClick={()=>setView("ai")}><span className="spark">✦</span>{d.createWithAI}</button>
       </div>
     </div>
     <PhotoJourney/>
   </div>
   <div className="journeyPromise" aria-label={he?"מחוויה לזיכרון":"From experience to memory"}>{(he?["רעיון שמתחיל איתך","מסע שחווים ביחד","ספר שנשאר לתמיד"]:["An idea that starts with you","A journey you share","A book to keep forever"]).map((text,i)=><div key={text}><span>{String(i+1).padStart(2,"0")}</span><p>{text}</p></div>)}</div>

   <div className="kpis dashboardKpis">
     <button className="kpiBtn" onClick={()=>document.getElementById("yourExperiencesList")?.scrollIntoView({behavior:"smooth",block:"start"})}><small>{d.experiences}</small><b>{experiences?.length||0}</b><span>→</span></button>
     <button className="kpiBtn" onClick={()=>goToCategory("runtime")}><small>{d.participants}</small><b>{stats.participants}</b><span>→</span></button>
     <button className="kpiBtn" onClick={()=>goToCategory("runtime")}><small>{d.missionsCompleted}</small><b>{stats.missionsCompleted}</b><span>→</span></button>
     <button className="kpiBtn" onClick={()=>goToCategory("memory")}><small>{d.memoriesCreated}</small><b>{stats.memoriesCreated}</b><span>→</span></button>
   </div>

   <div className="panel experiencePanel" id="yourExperiencesList">
     <div className="sectionHead"><div><div className="tag">{d.yourExperiences}</div><h2>{d.yourExperiences}</h2></div><button className="roundCreate" onClick={()=>setView("ai")} aria-label={d.createWithAI}>＋</button></div>
     <div className="experienceGrid">
     {rows.map(x=><article className="experienceRow" key={x.id}>
       <ExperienceCover experience={x}><span className={"experienceStatus "+(x.paused?"paused":x.status==="live"?"live":"draft")}>{x.paused?(he?"מושהית":"Paused"):x.status==="live"?(he?"פעילה עכשיו":"Live now"):(he?"בדרך להרפתקה":"In the making")}</span><span className="experienceCoverPlace">{x.location||x.type||"MORIVO"}</span></ExperienceCover>
       <div className="experienceInfo"><h3>{x.name||d.draft}</h3><p>{x.flow?.length||0} {he?"תחנות במסע":"stops in your story"}{x.startDate&&<> <span>·</span> {x.startDate}</>}</p></div>
       <div className="rowActions">
         <button className="openExperience" onClick={()=>openExperience(x)}>{d.open}<span>→</span></button>
         {firebaseConfigured && x.id && <button className="danger" disabled={deletingId===x.id} onClick={e=>remove(x,e)}>{deletingId===x.id?d.deleting:d.delete}</button>}
       </div>
     </article>)}
     {!rows.length&&<div className="dashboardEmpty"><img src="/morivo-memories.svg" alt=""/><div><h3>{he?"הסיפור הבא שלכם מתחיל כאן":"Your next story starts here"}</h3><p>{he?"טיול, יום הולדת או יום מיוחד ביחד — ספרו ל־Morivo מה מתכננים.":"A trip, a birthday or a day together — tell Morivo what you have in mind."}</p><button className="primary" onClick={()=>setView("ai")}>{d.createWithAI}</button></div></div>}
     </div>
   </div>
 </section>
}
