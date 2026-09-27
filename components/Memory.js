"use client";
import {useEffect,useMemo,useState} from "react";
import { httpsCallable } from "firebase/functions";
import { firebaseConfigured, functions } from "../lib/firebase";
import { subscribeMedia } from "../lib/mediaData";
import { subscribeAnswers, subscribeAllProgress, subscribeExperience, updateExperienceRemote, ensureUser } from "../lib/morivoData";
import MemoryAlbum from "./MemoryAlbum";
import DestinationBackdrop from "./DestinationBackdrop";
import {getExperienceTheme,buildMemoryChapters,journeyFinished} from "../lib/experienceVisuals";
import LinkifiedText from "./LinkifiedText";

function MediaThumb({m}){
 return m.contentType?.startsWith("video/")
  ? <video src={m.downloadURL} controls muted/>
  : <img src={m.downloadURL} alt={m.missionTitle||"Memory"}/>;
}

const ICONS={photo:"📸",video:"🎥",quiz:"❓",puzzle:"🧩",note:"📝",map:"📍",story:"📖",reward:"🏆"};

export default function Memory({experience,setExperience,setView,t,user,publicView,memoryId,dir,participantView=false}){
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
 const he=dir==="rtl";
 const theme=getExperienceTheme(exp);
 const chapters=useMemo(()=>buildMemoryChapters(flow,media,answers,progress,he?"עוד רגעים מהמסע":"More moments from the journey"),[flow,media,answers,progress,he]);
 const finishers=progress.filter(p=>journeyFinished(p,flow)).length;
 const allFinished=participantView||finishers>0;
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

 return <div className="memoryPage" dir={dir}>
 <div className="mbToolbar">
  <span className="mbToolbarLabel">{m2.morivoMemoryBook}</span>
  <div className="actions mbActions">
   {!publicView&&!participantView&&<button onClick={()=>setView("runtime")}>{m2.backToRuntime}</button>}
   <button className="primary" onClick={()=>window.print()}>{m2.exportPrint}</button>
  </div>
 </div>
 <div className="albumAutoStatus">{allFinished?(he?"רגעים שהשלמנו · ספר הזיכרונות שלכם מוכן":"Completed moments · your memory book is ready"):(he?"ספר חי · הרגעים שלכם נאספים כאן אוטומטית":"A living book · your moments are collected automatically")}</div>
 <section className="memoryBook" dir={dir}>

  <div className="mbCover" style={coverPhoto?{backgroundImage:`url(${coverPhoto.downloadURL})`}:undefined}>
   {!coverPhoto&&<DestinationBackdrop theme={theme}/>}
   {!coverPhoto&&<span className="bookCoverIllustration">{he?"איור בהשראת היעד":"Destination-inspired illustration"}</span>}
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

  <div className={"mbSection mbStory "+(!exp.memoryStory&&!exp.story?"mbStoryEmpty":"")}>
   <div className="mbHeading">{m2.ourStory}</div>
   <p className="mbStoryText"><LinkifiedText text={exp.memoryStory||exp.story||m2.noStoryYet}/></p>
   {canWriteStory&&<button className="mbWriteBtn" disabled={writing} onClick={writeStory}>{writing?m2.writing:exp.memoryStory?m2.rewriteWithAI:m2.writeWithAI}</button>}
  </div>

  <MemoryAlbum chapters={chapters} theme={theme} he={he}/>

  {canShare&&<div className="mbSection mbShareSection">
   <div className="mbShare">
    <div className="mbHeading">{m2.shareTitle}</div>
    <p className="mbShareDesc">{m2.shareDesc}</p>
    {exp.memoryPublic?
     <div className="mbShareRow">
      <input aria-label={m2.shareTitle} dir="ltr" readOnly value={shareUrl} onFocus={e=>e.target.select()}/>
      <button disabled={sharing} onClick={copyShareLink}>{m2.shareCopyLink}</button>
      <button disabled={sharing} onClick={()=>setShared(false)}>{m2.shareUnpublish}</button>
     </div>
     :<button className="mbShareBtn" disabled={sharing} onClick={()=>setShared(true)}>{m2.sharePublic}</button>}
   </div>
  </div>}
 </section>

 {publicView&&<div className="mbPoweredBy">{m2.poweredBy}</div>}
 </div>;
}
