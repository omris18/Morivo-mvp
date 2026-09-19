"use client";
import {useEffect,useMemo,useState} from "react";
import { httpsCallable } from "firebase/functions";
import { firebaseConfigured, functions } from "../lib/firebase";
import { subscribeMedia } from "../lib/mediaData";
import { subscribeAnswers, subscribeAllProgress } from "../lib/morivoData";
import LinkifiedText from "./LinkifiedText";

function MediaThumb({m}){
 return m.contentType?.startsWith("video/")
  ? <video src={m.downloadURL} controls muted/>
  : <img src={m.downloadURL} alt={m.missionTitle||"Memory"}/>;
}

const ICONS={photo:"📸",video:"🎥",quiz:"❓",puzzle:"🧩",note:"📝",map:"📍",story:"📖",reward:"🏆"};

export default function Memory({experience,setExperience,setView,t}){
 const m2=t.memory;
 const [writing,setWriting]=useState(false);
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
 const canWriteStory=firebaseConfigured&&experience.id&&experience.id!=="thailand-demo"&&chapters.length>0;
 const coverPhoto=media.find(m=>!m.contentType?.startsWith("video/"));

 async function writeStory(){
   setWriting(true);
   try{
     const fn=httpsCallable(functions,"generateMemoryStory");
     const result=await fn({experienceId:experience.id});
     setExperience?.({...experience,memoryStory:result.data.story});
   }catch(e){alert(e.message)}finally{setWriting(false)}
 }

 return <section className="memoryBook">

  <div className="mbCover" style={coverPhoto?{backgroundImage:`url(${coverPhoto.downloadURL})`}:undefined}>
   <div className="mbCoverShade"></div>
   <div className="mbCoverContent">
    <span className="mbEyebrow">{m2.morivoMemoryBook}</span>
    <h1>{experience.name||t.studio.untitled}</h1>
    {experience.location&&<p className="mbSub">{experience.location}</p>}
   </div>
  </div>

  {flow.length>0&&<div className="mbSection mbTimeline">
   <div className="mbHeading">{m2.theJourney}</div>
   <div className="timelineRail">
    {flow.map((m,i)=>{
     const done=chapters.some(c=>c.mission.id===m.id);
     return <div className={"timelineNode "+(done?"done":"")} key={m.id}>
      <span className="timelineDot">{ICONS[m.type]||"✦"}</span>
      <small>{m.title}</small>
      {i<flow.length-1&&<i className="timelineLine"></i>}
     </div>;
    })}
   </div>
  </div>}

  <div className="mbSection mbStats">
   <div className="statTileMB"><b>{media.length}</b><small>{m2.photosVideos}</small></div>
   <div className="statTileMB"><b>{answers.length}</b><small>{m2.quotes}</small></div>
   <div className="statTileMB"><b>{finishers}</b><small>{m2.finishers}</small></div>
   <div className="statTileMB"><b>{flow.length}</b><small>{m2.missions}</small></div>
  </div>

  <div className="mbSection mbStory">
   <div className="mbHeading">{m2.ourStory}</div>
   <p className="mbStoryText"><LinkifiedText text={experience.memoryStory||experience.story||m2.noStoryYet}/></p>
   {canWriteStory&&<button className="mbWriteBtn" disabled={writing} onClick={writeStory}>{writing?m2.writing:experience.memoryStory?m2.rewriteWithAI:m2.writeWithAI}</button>}
  </div>

  {chapters.length>0&&<div className="mbSection mbChapters">
   <div className="mbHeading">{m2.chapters}</div>
   {chapters.map(c=><div className="mbChapter" key={c.mission.id}>
    <h3>{ICONS[c.mission.type]||"✦"} {c.mission.title}</h3>
    {c.photos.length>0&&<div className="polaroidRow">{c.photos.map((p,i)=><div className="polaroid" key={p.id} style={{transform:`rotate(${(i%2?1:-1)*(2+i%3)}deg)`}}><MediaThumb m={p}/></div>)}</div>}
    {c.quotes.map(q=><blockquote className="mbQuote" key={q.id}>“{q.text}”<cite>— {q.participantName}</cite></blockquote>)}
   </div>)}
  </div>}

  <div className="actions mbActions">
   <button className="primary" onClick={()=>window.print()}>{m2.exportPrint}</button>
   <button onClick={()=>setView("runtime")}>{m2.backToRuntime}</button>
  </div>
 </section>;
}
