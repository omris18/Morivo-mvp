"use client";
import {useState} from "react";
import { firebaseConfigured } from "../lib/firebase";
import { createExperienceRemote, ensureUser } from "../lib/morivoData";

export default function CreateExperience({setExperience,setView,user,setActiveId,t}){
 const [form,setForm]=useState({name:"",type:"",location:"",people:"",story:""});
 const [thinking,setThinking]=useState(false);
 const c=t.create;
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
   <div className="tag">{c.tag}</div><h2>{c.title}</h2>
   <label>{c.name}</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <label>{c.type}</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value=""></option><option>{c.typeFamilyTrip}</option><option>{c.typeBirthday}</option><option>{c.typeTeamBuilding}</option><option>{c.typeSchool}</option><option>{c.typeMuseum}</option></select>
   <label>{c.location}</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
   <label>{c.participants}</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:+e.target.value})}/>
   <label>{c.describe}</label><textarea value={form.story} onChange={e=>setForm({...form,story:e.target.value})}/>
   <div className="actions"><button onClick={()=>setView("dashboard")}>{c.cancel}</button><button className="primary" onClick={create} disabled={thinking}>{thinking?c.building:c.createBlank}</button></div>
  </div>
  <div className="panel thinking">
    {thinking ? <>
      <div className="spinner"></div>
      <h3>{c.buildingTitle}</h3>
      <p>{c.buildingSub}</p>
    </> : <div className="phone blankPreview">
      {form.name && <h3>{form.name}</h3>}
      {form.location && <p>{form.location}</p>}
    </div>}
   </div>
 </section>
}
