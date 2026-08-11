"use client";
import {useState} from "react";
export default function Participant({experience,setView}){
 const [joined,setJoined]=useState(false);const [done,setDone]=useState(false);
 const mission=experience.flow.find(x=>x.type==="photo")||experience.flow[0];
 return <section className="panel narrow">
   <div className="tag">Participant Mode</div><h2>{joined?experience.name:"Join an experience."}</h2>
   {!joined?<><input defaultValue="MORIVO26"/><div className="actions centerActions"><button className="primary" onClick={()=>setJoined(true)}>Join Experience</button></div></>:<div className="phone"><h3>{mission.title}</h3><p>{mission.text}</p><div className="mission">{done?"✅ Completed":`Reward: ${mission.reward}`}</div><button className="primary" onClick={()=>setDone(true)}>{done?"Completed":"Complete Mission"}</button></div>}
   <div className="actions centerActions"><button onClick={()=>setView("runtime")}>Back</button><button onClick={()=>setView("memory")}>Memory</button></div>
 </section>
}
