"use client";
import {useState} from "react";
export default function Memory({experience,setView}){
 const [open,setOpen]=useState(false);
 return <section className="grid2">
   <div className="panel">
    <div className="tag">Memory Engine</div><h2>The experience ends. The story stays.</h2>
    <div className={"book "+(open?"open":"")} onClick={()=>setOpen(!open)}>
      <div className="cover"><small>Morivo Memory Book</small><h3>{experience.name}</h3><p>Memories made together</p></div>
      <div className="spread"><h3>Our Story</h3><p>{experience.story}</p><div className="photoGrid"><span></span><span></span><span></span><span></span></div></div>
    </div>
    <div className="actions"><button className="primary" onClick={()=>setOpen(!open)}>{open?"Close Book":"Open Book"}</button><button onClick={()=>setView("dashboard")}>Finish Demo</button></div>
   </div>
   <div className="panel"><div className="tag">Memory outputs</div><div className="mission">📖 Digital Memory Book</div><div className="mission">🎥 Highlight Video</div><div className="mission">🗺 Journey Map Replay</div><div className="mission">🏆 Achievements</div></div>
 </section>
}
