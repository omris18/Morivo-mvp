"use client";
import {useEffect,useMemo,useState} from "react";
import { httpsCallable } from "firebase/functions";
import { firebaseConfigured, functions } from "../lib/firebase";
import { subscribeMedia } from "../lib/mediaData";
import { subscribeAnswers, subscribeAllProgress, subscribeExperience, updateExperienceRemote, ensureUser } from "../lib/morivoData";
import LinkifiedText from "./LinkifiedText";

function MediaThumb({m}){
 return m.contentType?.startsWith("video/")
  ? <video src={m.downloadURL} controls muted/>
  : <img src={m.downloadURL} alt={m.missionTitle||"Memory"}/>;
}

const ICONS={photo:"📸",video:"🎥",quiz:"❓",puzzle:"🧩",note:"📝",map:"📍",story:"📖",reward:"🏆"};

export default function Memory({experience,setExperience,setView,t,user,publicView,memoryId,dir}){
 const m2=t.memory;
 const [writing,setWriting]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [localExp,setLocalExp]=useState(null);
 const [publicLoaded,setPublicLoaded]=useState(false);
 const [media,setMedia]=useState([]),[answers,setAnswers]=useState([]),[progress,setProgress]=useState([]);

 useEffect(()=>{
  if(!publicView)return;
  if(!firebaseConfigured){setPublicLoaded(true);return}
  let alive=true,unsub=()=>{};
  ensureUser().catch(()=>{}).finally(()=>{
   if(!alive)return;
   unsub=subscribeExperience(memoryId,x=>{if(!alive)return;setLocalExp(x);setPublicLoaded(true)},()=>{if(alive){setLocalExp(null);setPublicLoaded(true)}});
  });
  return ()=>{alive=false;unsub()};
 },[publicView,memoryId]);

 const exp=publicView?(localExp||{}):experience;
 const isOwner=!!(user?.uid&&exp.ownerUid&&user.uid===exp.ownerUid);

 useEffect(()=>{if(!firebaseConfigured||!exp.id||exp.id==="thailand-demo"){setMedia([]);setAnswers([]);setProgress([]);return}
  const a=subscribeMedia(exp.id,setMedia),b=subscribeAnswers(exp.id,setAnswers),c=subscribeAllProgress(exp.id,setProgress);return()=>{a();b();c()}},[exp.id]);

 const flow=exp.flow||[];
 const chapters=useMemo(()=>flow.map(m=>({
   mission:m,
   photos:media.filter(x=>x.missionId===m.id),
   quotes:answers.filter(x=>x.missionId===m.id),
 })).filter(c=>c.photos.length||c.quotes.length),[flow,media,answers]);

 const finishers=progress.filter(p=>flow.length&&(p.currentMissionIndex||0)>=flow.length).length;
 const canWriteStory=firebaseConfigured&&exp.id&&exp.id!=="thailand-demo"&&chapters.length>0&&isOwner;
 const canShare=firebaseConfigured&&exp.id&&exp.id!=="thailand-demo"&&isOwner;
 const coverPhoto=media.find(m=>!m.contentType?.startsWith("video/"));
 const shareUrl=(typeof window!=="undefined"&&exp.id)?`${window.location.origin}${window.location.pathname}?memory=${exp.id}`:"";

 async function writeStory(){
   setWriting(true);
   try{
     const fn=httpsCallable(functions,"generateMemoryStory");
     const result=await fn({experienceId:exp.id});
     setExperience?.({...exp,memoryStory:result.data.story});
   }catch(e){alert(e.message)}finally{setWriting(false)}
 }

 async function setShared(value){
   setSharing(true);
   try{
     await updateExperienceRemote(exp.id,{memoryPublic:value});
     setExperience?.({...exp,memoryPublic:value});
     if(value){try{await navigator.clipboard.writeText(shareUrl);alert(m2.shareLinkCopied)}catch{window.prompt(m2.shareLinkPrompt,shareUrl)}}
   }catch(e){alert(e.message)}finally{setSharing(false)}
 }
 async function copyShareLink(){
   try{await navigator.clipboard.writeText(shareUrl);alert(m2.shareLinkCopied)}
   catch{window.prompt(m2.shareLinkPrompt,shareUrl)}
 }

 if(publicView&&!publicLoaded)return <section className="memoryBook memoryBookPublicState" dir={dir}><p>⏳ {m2.publicLoading}</p></section>;
 if(publicView&&!localExp)return <section className="memoryBook memoryBookPublicState" dir={dir}><p>⚠ {m2.publicNotFound}</p></section>;

 return <>
 <section className="memoryBook" dir={dir}>

  <div className="mbCover" style={coverPhoto?{backgroundImage:`url(${coverPhoto.downloadURL})`}:undefined}>
   <div className="mbCoverShade"></div>
   <div className="mbCoverFrame"></div>
   <div className="mbCoverContent">
    <span className="mbEyebrow">{m2.morivoMemoryBook}</span>
    <h1>{exp.name||t.studio.untitled}</h1>
    {exp.location&&<p className="mbSub">{exp.location}</p>}
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
   <p className="mbStoryText"><LinkifiedText text={exp.memoryStory||exp.story||m2.noStoryYet}/></p>
   {canWriteStory&&<button className="mbWriteBtn" disabled={writing} onClick={writeStory}>{writing?m2.writing:exp.memoryStory?m2.rewriteWithAI:m2.writeWithAI}</button>}
  </div>

  {chapters.length>0&&<div className="mbSection mbChapters">
   <div className="mbHeading">{m2.chapters}</div>
   {chapters.map(c=><div className="mbChapter" key={c.mission.id}>
    <h3>{ICONS[c.mission.type]||"✦"} {c.mission.title}</h3>
    {c.photos.length>0&&<div className="polaroidRow">{c.photos.map((p,i)=><div className="polaroid" key={p.id} style={{transform:`rotate(${(i%2?1:-1)*(2+i%3)}deg)`}}><MediaThumb m={p}/></div>)}</div>}
    {c.quotes.map(q=><blockquote className="mbQuote" key={q.id}>“{q.text}”<cite>— {q.participantName}</cite></blockquote>)}
   </div>)}
  </div>}

  {canShare&&<div className="mbSection mbShareSection">
   <div className="mbShare">
    <div className="mbHeading">{m2.shareTitle}</div>
    <p className="mbShareDesc">{m2.shareDesc}</p>
    {exp.memoryPublic?
     <div className="mbShareRow">
      <input readOnly value={shareUrl} onFocus={e=>e.target.select()}/>
      <button disabled={sharing} onClick={copyShareLink}>{m2.shareCopyLink}</button>
      <button disabled={sharing} onClick={()=>setShared(false)}>{m2.shareUnpublish}</button>
     </div>
     :<button className="mbShareBtn" disabled={sharing} onClick={()=>setShared(true)}>{m2.sharePublic}</button>}
   </div>
  </div>}
 </section>

 <div className="actions mbActions">
  <button className="primary" onClick={()=>window.print()}>{m2.exportPrint}</button>
  {!publicView&&<button onClick={()=>setView("runtime")}>{m2.backToRuntime}</button>}
 </div>
 {publicView&&<div className="mbPoweredBy">{m2.poweredBy}</div>}
 </>;
}
