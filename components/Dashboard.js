import {useEffect,useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {computeOwnerStats,deleteExperienceRemote} from "../lib/morivoData";

export default function Dashboard({experience,experiences,setView,openExperience,activeId,setActiveId,t}){
 const [deletingId,setDeletingId]=useState(null);
 const [stats,setStats]=useState({participants:0,missionsCompleted:0,memoriesCreated:0});
 const rows=experiences?.length ? experiences : [experience];
 const d=t.dashboard;

 useEffect(()=>{
   let alive=true;
   if(firebaseConfigured&&experiences?.length){
     computeOwnerStats(experiences).then(s=>{if(alive)setStats(s)});
   }else{
     setStats({participants:0,missionsCompleted:0,memoriesCreated:0});
   }
   return ()=>{alive=false};
 },[experiences]);

 async function remove(x,e){
   e.stopPropagation();
   if(!window.confirm(d.confirmDelete(x.name||"")))return;
   setDeletingId(x.id);
   try{
     await deleteExperienceRemote(x);
     if(activeId===x.id) setActiveId(null);
   }catch(err){alert(err.message)}finally{setDeletingId(null)}
 }

 return <section>
   <div className="hero">
     <div className="tag">{d.tag}</div>
     <h1>{d.heroTitle1}<span>{d.heroTitleHighlight}</span></h1>
     <p>{d.heroSub}</p>
     <div className="actions">
       <button onClick={()=>setView("ai")}>{d.createWithAI}</button><button className="primary" onClick={()=>setView("create")}>{d.createExperience}</button>
     </div>
   </div>
   <div className="kpis">
     <div><small>{d.experiences}</small><b>{experiences?.length||0}</b></div><div><small>{d.participants}</small><b>{stats.participants}</b></div>
     <div><small>{d.missionsCompleted}</small><b>{stats.missionsCompleted}</b></div><div><small>{d.memoriesCreated}</small><b>{stats.memoriesCreated}</b></div>
   </div>
   <div className="panel">
     <div className="tag">{d.yourExperiences}</div>
     {rows.map(x=><div className="experienceRow" key={x.id}>
       <div><h3>{x.name}</h3><p>{x.location || x.type} · {x.status || d.draft}</p></div>
       <div className="rowActions">
         <button onClick={()=>openExperience(x)}>{d.open}</button>
         {firebaseConfigured && x.id && <button className="danger" disabled={deletingId===x.id} onClick={e=>remove(x,e)}>{deletingId===x.id?d.deleting:d.delete}</button>}
       </div>
     </div>)}
   </div>
 </section>
}
