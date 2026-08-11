"use client";
import {useState} from "react";
export default function Studio({experience,setExperience,setView}){
 const [selected,setSelected]=useState(experience.flow[0]?.id);
 const flow=experience.flow;
 const atom=flow.find(x=>x.id===selected)||flow[0];
 function patch(values){setExperience({...experience,flow:flow.map(x=>x.id===atom.id?{...x,...values}:x)})}
 function add(type){
   const n={id:type+"-"+Date.now(),type,title:"New "+type,text:"Describe what participants should do.",reward:""};
   setExperience({...experience,flow:[...flow,n]});setSelected(n.id)
 }
 function remove(){if(flow.length<2)return;const next=flow.filter(x=>x.id!==atom.id);setExperience({...experience,flow:next});setSelected(next[0].id)}
 return <section className="grid2">
   <div className="panel">
    <div className="tag">Morivo Studio</div><h2>{experience.name}</h2>
    <div className="atomBar">{["photo","map","quiz","puzzle","reward","story","nfc"].map(t=><button key={t} onClick={()=>add(t)}>＋ {t}</button>)}</div>
    <div className="flow">{flow.map((x,i)=><div key={x.id} className="flowWrap"><button className={"flowNode "+(x.id===selected?"selected":"")} onClick={()=>setSelected(x.id)}><small>{x.type}</small><b>{x.title}</b><span>{x.text}</span></button>{i<flow.length-1&&<div className="connector">→</div>}</div>)}</div>
    <div className="inspector">
      <label>Title</label><input value={atom.title} onChange={e=>patch({title:e.target.value})}/>
      <label>Participant instruction</label><textarea value={atom.text} onChange={e=>patch({text:e.target.value})}/>
      <label>Reward</label><input value={atom.reward||""} onChange={e=>patch({reward:e.target.value})}/>
      <div className="actions"><button onClick={remove}>Delete atom</button><button className="primary" onClick={()=>setView("runtime")}>Open Runtime</button></div>
    </div>
   </div>
   <div className="panel">
     <div className="tag">Live participant preview</div>
     <div className="phone"><h3>{atom.title}</h3><p>{atom.text}</p><div className="mission">{atom.reward?`Reward: ${atom.reward}`:"No reward"}</div><button className="primary">Complete Mission</button></div>
   </div>
 </section>
}
