"use client";
import {useState} from "react";
export default function Runtime({experience,setView}){
 const [people,setPeople]=useState([{name:"Omri",points:640},{name:"Tair",points:590},{name:"Maya",points:520},{name:"Ido",points:480}]);
 const [feed,setFeed]=useState(["Maya completed a photo mission","Team Sadeh unlocked a puzzle piece"]);
 return <section className="grid2">
   <div className="panel">
    <div className="tag">Morivo Runtime</div><h2>Run the experience live.</h2>
    <div className="join"><div><small>Join code</small><b>MORIVO26</b></div><button className="primary" onClick={()=>{setPeople([...people,{name:"New participant",points:0}]);setFeed(["New participant joined",...feed])}}>Simulate join</button></div>
    <h3>Participants</h3><div className="people">{people.map((p,i)=><div key={i}><b>{p.name}</b><span>{p.points} pts</span></div>)}</div>
    <h3>Live activity</h3><div className="feed">{feed.map((x,i)=><div key={i}>{x}</div>)}</div>
    <div className="actions"><button onClick={()=>setView("studio")}>Back to Studio</button><button className="primary" onClick={()=>setView("participant")}>Participant Mode</button></div>
   </div>
   <div className="panel"><div className="tag">Organizer preview</div><div className="phone"><h3>{experience.flow[1]?.title||"Mission"}</h3><p>{experience.flow[1]?.text}</p><div className="mission">Progress 64%</div></div></div>
 </section>
}
