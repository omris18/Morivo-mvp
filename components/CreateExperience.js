"use client";
import {useState} from "react";
import { firebaseConfigured } from "../lib/firebase";
import { createExperienceRemote, ensureUser } from "../lib/morivoData";

export default function CreateExperience({setExperience,setView,user,setActiveId}){
 const [form,setForm]=useState({name:"",type:"",location:"",people:"",story:""});
 const [thinking,setThinking]=useState(false);
 async function create(){
   setThinking(true);
   const data={...form,people:Number(form.people||0),flow:[]};
   try{
     if(firebaseConfigured){
       const u=user || await ensureUser();
       const id=await createExperienceRemote(u.uid,data);
       setExperience({...data,id,ownerUid:u.uid,status:"draft"});
       setActiveId(id);
     }else{
       setExperience({...data,id:"local-"+Date.now(),status:"draft"});
     }
     setTimeout(()=>setView("studio"),900);
   }catch(e){console.error(e);alert(e.message)}finally{setThinking(false)}
 }
 return <section className="grid2">
  <div className="panel">
   <div className="tag">Create with Morivo AI</div><h2>Tell me about them.</h2>
   <label>Experience name</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <label>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value=""></option><option>Family Trip</option><option>Birthday</option><option>Team Building</option><option>School</option><option>Museum</option></select>
   <label>Location</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
   <label>Participants</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:+e.target.value})}/>
   <label>Describe the people and experience</label><textarea value={form.story} onChange={e=>setForm({...form,story:e.target.value})}/>
   <div className="actions"><button onClick={()=>setView("dashboard")}>Cancel</button><button className="primary" onClick={create} disabled={thinking}>{thinking?"Building…":"Create Blank Experience"}</button></div>
  </div>
  <div className="panel thinking">
    {thinking ? <>
      <div className="spinner"></div>
      <h3>Morivo is building your experience…</h3>
      <p>Creating your blank experience.</p>
    </> : <div className="phone blankPreview">
      {form.name && <h3>{form.name}</h3>}
      {form.location && <p>{form.location}</p>}
    </div>}
   </div>
 </section>
}
