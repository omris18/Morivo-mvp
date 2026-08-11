"use client";
import {useState} from "react";
import { firebaseConfigured } from "../lib/firebase";
import { completeMissionRemote, joinExperienceByCode } from "../lib/morivoData";

export default function Participant({experience,setExperience,setView,setActiveId}){
 const [code,setCode]=useState(experience.joinCode||"");
 const [name,setName]=useState("Guest");
 const [joined,setJoined]=useState(false);const [done,setDone]=useState(false);
 const mission=experience.flow?.find(x=>x.type==="photo")||experience.flow?.[0];

 async function join(){
   try{
    if(firebaseConfigured){
      const id=await joinExperienceByCode(code,name);setActiveId(id);
    }
    setJoined(true);
   }catch(e){alert(e.message)}
 }
 async function complete(){
   setDone(true);
   if(firebaseConfigured && experience.id) await completeMissionRemote(experience.id,mission,name);
 }
 return <section className="panel narrow">
  <div className="tag">Participant Mode</div><h2>{joined?experience.name:"Join an experience."}</h2>
  {!joined?<><label>Your name</label><input value={name} onChange={e=>setName(e.target.value)}/><label>Join code</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><div className="actions centerActions"><button className="primary" onClick={join}>Join Experience</button></div></>:<div className="phone"><h3>{mission?.title}</h3><p>{mission?.text}</p><div className="mission">{done?"✅ Completed":`Reward: ${mission?.reward||""}`}</div><button className="primary" onClick={complete}>{done?"Completed":"Complete Mission"}</button></div>}
  <div className="actions centerActions"><button onClick={()=>setView("runtime")}>Back</button><button onClick={()=>setView("memory")}>Memory</button></div>
 </section>
}
