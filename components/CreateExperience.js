"use client";
import {useState} from "react";
export default function CreateExperience({setExperience,setView}){
 const [form,setForm]=useState({name:"Thailand Family Adventure",type:"Family Trip",location:"Thailand",people:18,story:"Family of five. Kids aged 7, 7 and 9. Grandma and grandpa are joining. We love surprises and photo missions."});
 const [thinking,setThinking]=useState(false);
 function create(){
   setThinking(true);
   setTimeout(()=>{
    setExperience({...form,id:"exp-"+Date.now(),status:"draft",flow:[
      {id:"welcome",type:"story",title:"Welcome",text:"A personal opening that sets the tone.",reward:"Welcome badge"},
      {id:"photo",type:"photo",title:"First Memory",text:"Capture one photo that includes everyone.",reward:"100 points"},
      {id:"checkpoint",type:"map",title:"Hidden Checkpoint",text:"Reach the secret location.",reward:"Puzzle piece"},
      {id:"sunset",type:"photo",title:"Golden Hour",text:"Create one shared sunset memory.",reward:"Family badge"},
      {id:"memory",type:"story",title:"Final Memory",text:"Choose the moment you never want to forget.",reward:"Memory Book"},
    ]});
    setView("studio");
   },2200)
 }
 return <section className="grid2">
   <div className="panel">
    <div className="tag">Create with Morivo AI</div><h2>Tell me about them.</h2>
    <label>Experience name</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
    <label>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Family Trip</option><option>Birthday</option><option>Team Building</option><option>School</option><option>Museum</option></select>
    <label>Location</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
    <label>Participants</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:+e.target.value})}/>
    <label>Describe the people and experience</label><textarea value={form.story} onChange={e=>setForm({...form,story:e.target.value})}/>
    <div className="actions"><button onClick={()=>setView("dashboard")}>Cancel</button><button className="primary" onClick={create}>Create Experience ✨</button></div>
   </div>
   <div className="panel thinking">
    {thinking?<><div className="spinner"></div><h3>Morivo is building your experience…</h3><p>Understanding people → creating missions → preparing memories</p></>:<>
      <div className="tag">Preview</div><div className="phone"><h3>{form.name}</h3><p>{form.location}</p><div className="mission">📸 Photo missions</div><div className="mission">🧩 Puzzle rewards</div><div className="mission">📖 Memory Book</div></div>
    </>}
   </div>
 </section>
}
