"use client";
import {useState} from "react";
import { firebaseConfigured } from "../lib/firebase";
import { createExperienceRemote, ensureUser } from "../lib/morivoData";

export default function CreateExperience({setExperience,setView,user,setActiveId,t,lang}){
 const [form,setForm]=useState({name:"",type:"",location:"",people:"",story:""});
 const [thinking,setThinking]=useState(false);
 const c=t.create;
 async function create(){
   setThinking(true);
   const data={...form,people:Number(form.people||0),flow:[],lang};
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
 return <section className="grid2 manualCreate">
  <div className="panel manualCreateForm">
   <div className="tag">{c.createBlank}</div><h2>{c.title}</h2>
   <label htmlFor="create-name">{c.name}</label><input id="create-name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <label htmlFor="create-type">{c.type}</label><select id="create-type" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value=""></option><option>{c.typeFamilyTrip}</option><option>{c.typeBirthday}</option><option>{c.typeTeamBuilding}</option><option>{c.typeSchool}</option><option>{c.typeMuseum}</option></select>
   <div className="fieldRow">
    <div><label htmlFor="create-location">{c.location}</label><input id="create-location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div>
    <div><label htmlFor="create-people">{c.participants}</label><input id="create-people" type="number" min="0" value={form.people} onChange={e=>setForm({...form,people:+e.target.value})}/></div>
   </div>
   <label htmlFor="create-story">{c.describe}</label><textarea id="create-story" value={form.story} onChange={e=>setForm({...form,story:e.target.value})}/>
   <div className="actions"><button onClick={()=>setView("dashboard")}>{c.cancel}</button><button className="primary" onClick={create} disabled={thinking}>{thinking?c.building:c.createBlank}</button></div>
  </div>
  <div className="panel manualCreatePreview">
   <div className="tag">{t.studio.liveParticipantPreview}</div>
   {thinking ? <div className="manualCreateLoading" role="status"><div className="manualRoute" aria-hidden="true"><i></i><i></i><i></i></div><h3>{c.buildingTitle}</h3><p>{c.buildingSub}</p></div> :
    <div className="phone blankPreview">
     <div className="manualPreviewBrand">Morivo</div>
     <div className="manualRoute" aria-hidden="true"><i></i><i></i><i></i></div>
     {form.type&&<div className="manualPreviewType">{form.type}</div>}
     <h3 className={form.name?"":"manualPlaceholder"}>{form.name||t.studio.untitled}</h3>
     {(form.location||Number(form.people)>0)&&<div className="manualPreviewMeta">{form.location&&<span>{form.location}</span>}{Number(form.people)>0&&<span>{form.people} · {c.participants}</span>}</div>}
     {form.story&&<p className="manualPreviewStory">{form.story}</p>}
     <div className="manualPreviewEnd" aria-hidden="true"><span></span><i>✦</i><span></span></div>
    </div>}
  </div>
 </section>
}
