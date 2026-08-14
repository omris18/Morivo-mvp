"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import CreateExperience from "../components/CreateExperience";
import Studio from "../components/Studio";
import Runtime from "../components/Runtime";
import Participant from "../components/Participant";
import Memory from "../components/Memory";
import FirebaseStatus from "../components/FirebaseStatus";
import { firebaseConfigured } from "../lib/firebase";
import { ensureUser, subscribeExperiences, subscribeExperience } from "../lib/morivoData";

const DEMO={
 id:"thailand-demo", name:"Thailand Family Adventure", type:"Family Trip",
 location:"Thailand", people:18,
 story:"A family experience designed around shared missions and memories.",
 status:"draft",
 flow:[
  {id:"welcome",type:"story",title:"Welcome",text:"Your adventure starts here.",reward:"Welcome badge"},
  {id:"photo",type:"photo",title:"First Memory",text:"Capture one photo that includes everyone.",reward:"100 points"},
  {id:"branch",type:"branch",title:"Choose Your Path",text:"Adventure or relax?",reward:""},
  {id:"sunset",type:"photo",title:"Golden Hour",text:"Create one shared sunset memory.",reward:"Family badge"},
  {id:"memory",type:"story",title:"Final Memory",text:"Choose the moment you never want to forget.",reward:"Memory Book"},
 ]
};

export default function Home(){
 const [view,setView]=useState("dashboard");
 const [user,setUser]=useState(null);
 const [experiences,setExperiences]=useState([]);
 const [experience,setExperience]=useState({
    id: null,
    name: "",
    type: "",
    location: "",
    people: 0,
    story: "",
    flow: [],
    status: "draft",
    joinCode: ""
  });
  const [activeId,setActiveId]=useState(null);

 useEffect(()=>{
   if(!firebaseConfigured) return;
   let unsub=()=>{};
   ensureUser().then(u=>{
     setUser(u);
     unsub=subscribeExperiences(u.uid, rows=>setExperiences(rows));
   }).catch(console.error);
   return ()=>unsub();
 },[]);

 useEffect(()=>{
   if(!firebaseConfigured || !activeId) return;
   return subscribeExperience(activeId, remote=>{
     if(remote) setExperience(remote);
   });
 },[activeId]);

 function openExperience(exp){
   setExperience(exp);
   if(firebaseConfigured && exp.id && exp.id!=="thailand-demo") setActiveId(exp.id);
   setView("studio");
 }

 const props={experience,setExperience,setView,user,experiences,setExperiences,activeId,setActiveId,openExperience};
 const Screen=useMemo(()=>({
   dashboard:<Dashboard {...props}/>,
   create:<CreateExperience {...props}/>,
   studio:<Studio {...props}/>,
   runtime:<Runtime {...props}/>,
   participant:<Participant {...props}/>,
   memory:<Memory {...props}/>
 })[view],[view,experience,experiences,user,activeId]);

 return <div className="appShell">
   <Sidebar view={view} setView={setView}/>
   <main className="content">
     <FirebaseStatus/>
     {Screen}
   </main>
 </div>;
}
