"use client";
import {useEffect,useMemo,useState} from "react";
import { firebaseConfigured } from "../lib/firebase";
import { subscribeMedia } from "../lib/mediaData";
import { subscribeAnswers, subscribeAllProgress } from "../lib/morivoData";
function MediaThumb({m}){
 return m.contentType?.startsWith("video/")
  ? <video src={m.downloadURL} controls muted/>
  : <img src={m.downloadURL} alt={m.missionTitle||"Memory"}/>;
}
export default function Memory({experience,setView}){
 const [open,setOpen]=useState(false);
 const [media,setMedia]=useState([]),[answers,setAnswers]=useState([]),[progress,setProgress]=useState([]);
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo"){setMedia([]);setAnswers([]);setProgress([]);return}
  const a=subscribeMedia(experience.id,setMedia),b=subscribeAnswers(experience.id,setAnswers),c=subscribeAllProgress(experience.id,setProgress);return()=>{a();b();c()}},[experience.id]);

 const flow=experience.flow||[];
 const chapters=useMemo(()=>flow.map(m=>({
   mission:m,
   photos:media.filter(x=>x.missionId===m.id),
   quotes:answers.filter(x=>x.missionId===m.id),
 })).filter(c=>c.photos.length||c.quotes.length),[flow,media,answers]);

 const finishers=progress.filter(p=>flow.length&&(p.currentMissionIndex||0)>=flow.length).length;

 return <section className="grid2"><div className="panel"><div className="tag">Memory Engine · Live Media</div><h2>The experience ends. The story stays.</h2><div className={"book "+(open?"open":"")} onClick={()=>setOpen(!open)}><div className="cover"><small>Morivo Memory Book</small><h3>{experience.name}</h3><p>Memories made together</p></div><div className="spread memorySpread"><div><h3>Our Story</h3><p>{experience.story}</p></div><div className="realPhotoGrid">{media.slice(0,4).map(m=><MediaThumb m={m} key={m.id}/>)}{media.length===0&&<><span></span><span></span><span></span><span></span></>}</div></div></div><div className="actions"><button className="primary" onClick={()=>setOpen(!open)}>{open?"Close Book":"Open Book"}</button><button onClick={()=>setView("runtime")}>Back to Runtime</button></div>

 {chapters.length>0&&<div className="chapters"><div className="tag">Chapters</div>{chapters.map(c=><div className="chapter" key={c.mission.id}><h4>{c.mission.title}</h4>{c.photos.length>0&&<div className="chapterPhotos">{c.photos.map(p=><MediaThumb m={p} key={p.id}/>)}</div>}{c.quotes.map(q=><p className="chapterQuote" key={q.id}>"{q.text}" <small>— {q.participantName}</small></p>)}</div>)}</div>}
 </div>

 <div className="panel"><div className="tag">Memory outputs</div><div className="mission">📖 Digital Memory Book · {media.length} real photos, {answers.length} quotes</div><div className="mission">🏆 {finishers} finisher{finishers===1?"":"s"}</div><div className="mission">🎥 Highlight Video · coming soon</div><div className="mission">🗺 Journey Map Replay · coming soon</div><div className="mission">📦 Print-ready Album · coming soon</div></div></section>
}
