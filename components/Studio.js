"use client";
import {useEffect,useState} from "react";
import { firebaseConfigured } from "../lib/firebase";
import { publishExperienceRemote, updateExperienceRemote } from "../lib/morivoData";

export default function Studio({experience,setExperience,setView}){
 const [selected,setSelected]=useState(experience.flow?.[0]?.id);
 const [saving,setSaving]=useState(false);
 const flow=experience.flow || [];
 const atom=flow.find(x=>x.id===selected)||flow[0]||null;

 useEffect(()=>{ if(!flow.find(x=>x.id===selected) && flow[0]) setSelected(flow[0].id)},[experience.id]);

 async function persist(next){
   setExperience(next);
   if(firebaseConfigured && next.id && !next.id.startsWith("local-") && next.id!=="thailand-demo"){
     setSaving(true); try{await updateExperienceRemote(next.id,{flow:next.flow,name:next.name,story:next.story})}finally{setSaving(false)}
   }
 }
 function patch(values){if(!atom)return;persist({...experience,flow:flow.map(x=>x.id===atom.id?{...x,...values}:x)})}
 function move(dir){if(!atom)return;const i=flow.findIndex(x=>x.id===atom.id),j=i+dir;if(j<0||j>=flow.length)return;const n=[...flow];[n[i],n[j]]=[n[j],n[i]];persist({...experience,flow:n})}
 function remove(){if(!atom)return;const n=flow.filter(x=>x.id!==atom.id);persist({...experience,flow:n});setSelected(n[0]?.id||null)}
 function add(type){const n={id:type+"-"+Date.now(),type,title:"New "+type,text:"",reward:"100 points",points:100};persist({...experience,flow:[...flow,n]});setSelected(n.id)}
 async function publish(){
   if(!firebaseConfigured){setExperience({...experience,status:"live",joinCode:"MORIVO26"});alert("Published in demo mode: MORIVO26");return}
   const code=await publishExperienceRemote(experience);setExperience({...experience,status:"live",joinCode:code});alert("Published. Join code: "+code);
 }
 return <section className="grid2">
  <div className="panel">
   <div className="tag">Morivo Studio · {saving?"Saving…":"Saved"}</div><h2>{experience.name}</h2>
   <div className="atomBar">{["photo","map","quiz","puzzle","reward","story","nfc"].map(t=><button key={t} onClick={()=>add(t)}>＋ {t}</button>)}</div>
   <div className="flow">{!flow.length&&<div className="emptyBuilder"><b>Your journey is empty.</b><span>Add the first mission from the Mission Library above.</span></div>}{flow.map((x,i)=><div key={x.id} className="flowWrap"><button className={"flowNode "+(x.id===selected?"selected":"")} onClick={()=>setSelected(x.id)}><small>{x.type}</small><b>{x.title}</b><span>{x.text}</span></button>{i<flow.length-1&&<div className="connector">→</div>}</div>)}</div>
   {atom&&{atom&&<div className="inspector"><label>Title</label><input value={atom.title} onChange={e=>patch({title:e.target.value})}/><label>Participant instruction</label><textarea value={atom.text} onChange={e=>patch({text:e.target.value})}/><label>Reward</label><input value={atom.reward||""} onChange={e=>patch({reward:e.target.value})}/><label>Points</label><input type="number" value={atom.points||100} onChange={e=>patch({points:+e.target.value})}/><div className="actions"><button onClick={()=>move(-1)}>↑ Move</button><button onClick={()=>move(1)}>↓ Move</button><button onClick={remove}>Delete</button></div></div>}
   <div className="actions"><button onClick={()=>setView("dashboard")}>Dashboard</button><button onClick={()=>setView("runtime")}>Runtime</button><button className="primary" onClick={publish}>Publish Experience</button></div>
  </div>
  <div className="panel"><div className="tag">Live participant preview</div>{atom&&{atom?<div className="phone"><h3>{atom.title}</h3><p>{atom.text}</p><div className="mission">{atom.reward?`Reward: ${atom.reward}`:"No reward"}</div><button className="primary">Complete Mission</button></div>}</div>
 </section>
}
