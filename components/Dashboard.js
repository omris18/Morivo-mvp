import {useEffect,useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {computeOwnerStats,deleteExperienceRemote} from "../lib/morivoData";

export default function Dashboard({experience,experiences,setView,openExperience,activeId,setActiveId}){
 const [deletingId,setDeletingId]=useState(null);
 const [stats,setStats]=useState({participants:0,missionsCompleted:0,memoriesCreated:0});
 const rows=experiences?.length ? experiences : [experience];

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
   if(!window.confirm(`Delete "${x.name||"this experience"}"? This removes it and everything in it - participants, memories, messages. This can't be undone.`))return;
   setDeletingId(x.id);
   try{
     await deleteExperienceRemote(x);
     if(activeId===x.id) setActiveId(null);
   }catch(err){alert(err.message)}finally{setDeletingId(null)}
 }

 return <section>
   <div className="hero">
     <div className="tag">Morivo Experience OS</div>
     <h1>Build moments people will <span>remember.</span></h1>
     <p>Create, run and preserve interactive experiences from one workspace.</p>
     <div className="actions">
       <button onClick={()=>setView("ai")}>✦ Create with Morivo AI</button><button className="primary" onClick={()=>setView("create")}>＋ Create Experience</button>
     </div>
   </div>
   <div className="kpis">
     <div><small>Experiences</small><b>{experiences?.length||0}</b></div><div><small>Participants</small><b>{stats.participants}</b></div>
     <div><small>Missions completed</small><b>{stats.missionsCompleted}</b></div><div><small>Memories created</small><b>{stats.memoriesCreated}</b></div>
   </div>
   <div className="panel">
     <div className="tag">Your experiences</div>
     {rows.map(x=><div className="experienceRow" key={x.id}>
       <div><h3>{x.name}</h3><p>{x.location || x.type} · {x.status || "draft"}</p></div>
       <div className="rowActions">
         <button onClick={()=>openExperience(x)}>Open</button>
         {firebaseConfigured && x.id && <button className="danger" disabled={deletingId===x.id} onClick={e=>remove(x,e)}>{deletingId===x.id?"Deleting…":"Delete"}</button>}
       </div>
     </div>)}
   </div>
 </section>
}
