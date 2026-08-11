"use client";
import { useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Dashboard from "../components/Dashboard";
import CreateExperience from "../components/CreateExperience";
import Studio from "../components/Studio";
import Runtime from "../components/Runtime";
import Participant from "../components/Participant";
import Memory from "../components/Memory";

export default function Home(){
  const [view,setView]=useState("dashboard");
  const [experience,setExperience]=useState({
    id:"thailand-demo",
    name:"Thailand Family Adventure",
    type:"Family Trip",
    location:"Thailand",
    people:18,
    story:"A family experience designed around shared missions and memories.",
    status:"draft",
    flow:[
      {id:"welcome",type:"story",title:"Welcome",text:"Your adventure starts here.",reward:"Welcome badge"},
      {id:"photo",type:"photo",title:"First Memory",text:"Capture one photo that includes everyone.",reward:"100 points"},
      {id:"branch",type:"branch",title:"Choose Your Path",text:"Adventure or relax?",reward:""},
      {id:"sunset",type:"photo",title:"Golden Hour",text:"Create one shared sunset memory.",reward:"Family badge"},
      {id:"memory",type:"story",title:"Final Memory",text:"Choose the moment you never want to forget.",reward:"Memory Book"},
    ]
  });
  const props={experience,setExperience,setView};
  const Screen=useMemo(()=>({
    dashboard:<Dashboard {...props}/>,
    create:<CreateExperience {...props}/>,
    studio:<Studio {...props}/>,
    runtime:<Runtime {...props}/>,
    participant:<Participant {...props}/>,
    memory:<Memory {...props}/>
  })[view],[view,experience]);
  return <div className="appShell">
    <Sidebar view={view} setView={setView}/>
    <main className="content">{Screen}</main>
  </div>;
}
