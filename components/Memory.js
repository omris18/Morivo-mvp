"use client";
import {useEffect,useState} from "react";
import { firebaseConfigured } from "../lib/firebase";
import { subscribeMedia } from "../lib/mediaData";
export default function Memory({experience,setView}){
 const [open,setOpen]=useState(false);const [media,setMedia]=useState([]);
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo"){setMedia([]);return;} return subscribeMedia(experience.id,setMedia)},[experience.id]);
 return <section className="grid2"><div className="panel"><div className="tag">Memory Engine · Live Media</div><h2>The experience ends. The story stays.</h2><div className={"book "+(open?"open":"")} onClick={()=>setOpen(!open)}><div className="cover"><small>Morivo Memory Book</small><h3>{experience.name}</h3><p>Memories made together</p></div><div className="spread memorySpread"><div><h3>Our Story</h3><p>{experience.story}</p></div><div className="realPhotoGrid">{media.slice(0,4).map(m=><img key={m.id} src={m.downloadURL} alt={m.missionTitle||"Memory"}/>)}{media.length===0&&<><span></span><span></span><span></span><span></span></>}</div></div></div><div className="actions"><button className="primary" onClick={()=>setOpen(!open)}>{open?"Close Book":"Open Book"}</button><button onClick={()=>setView("runtime")}>Back to Runtime</button></div></div><div className="panel"><div className="tag">Memory outputs</div><div className="mission">📖 Digital Memory Book · {media.length} real photos</div><div className="mission">🎥 Highlight Video</div><div className="mission">🗺 Journey Map Replay</div><div className="mission">🏆 Achievements</div><div className="mission">📦 Print-ready Album</div></div></section>
}
