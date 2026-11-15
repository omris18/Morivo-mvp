"use client";
import {useEffect,useMemo,useState} from "react";
import { httpsCallable } from "firebase/functions";
import { firebaseConfigured, functions } from "../lib/firebase";
import { subscribeMedia } from "../lib/mediaData";
import { subscribeFamilyBook, saveFamilyBook, subscribeAnswers, subscribeAllProgress, subscribeExperience, updateExperienceRemote, ensureUser } from "../lib/morivoData";
import MemoryPhotoManager from "./MemoryPhotoManager";
import coordination from "../functions/coordination";
import {unlockedPieces,puzzleCompletedIds} from "../lib/familyPuzzle";
import MemoryAlbum from "./MemoryAlbum";
import DestinationBackdrop from "./DestinationBackdrop";
import {getExperienceTheme,buildMemoryChapters,journeyFinished} from "../lib/experienceVisuals";
import LinkifiedText from "./LinkifiedText";
import {showToast} from "../lib/toast";
import {tx} from "../lib/i18n";

function MediaThumb({m}){
 return m.contentType?.startsWith("video/")
  ? <video src={m.downloadURL} controls muted/>
  : <img src={m.downloadURL} alt={m.missionTitle||"Memory"}/>;
}

const ICONS={photo:"📸",video:"🎥",quiz:"❓",puzzle:"🧩",note:"📝",map:"📍",story:"📖",reward:"🏆"};

export default function Memory({experience,setExperience,setView,t,user,publicView,memoryId,dir,participantView=false,isMaster=false,lang,familyId:participantFamilyId=null}){
 const m2=t.memory;
 const [writing,setWriting]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [localExp,setLocalExp]=useState(null);
 const [publicLoaded,setPublicLoaded]=useState(false);
 const [rawMedia,setMedia]=useState([]),[rawAnswers,setAnswers]=useState([]),[rawProgress,setProgress]=useState([]);

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
 const isOwner=!!(user?.uid&&exp.ownerUid&&(user.uid===exp.ownerUid||isMaster));

 const [selectedFamily,setSelectedFamily]=useState("");
 const [familyBook,setFamilyBook]=useState({});
 const grouped=!!exp.families?.length;
 const familyId=grouped?(isOwner?(exp.families.find(f=>f.id===selectedFamily)?.id||exp.families[0].id):participantFamilyId):null;
 const family=exp.families?.find(f=>f.id===familyId);
 const book=grouped?(familyBook._familyId===familyId?familyBook:{}):exp;
 const familyMedia=grouped?rawMedia.filter(m=>m.familyId===familyId):rawMedia;
 const media=familyMedia.filter(m=>!m.deleted);
 const answers=grouped?rawAnswers.filter(m=>m.familyId===familyId):rawAnswers;
 const progress=grouped?rawProgress.filter(m=>m.familyId===familyId):rawProgress;
 useEffect(()=>{
  setMedia([]);setAnswers([]);setProgress([]);setFamilyBook({});
  if(!firebaseConfigured||!exp.id||exp.id==="thailand-demo"||(grouped&&!familyId))return;
  const a=subscribeMedia(exp.id,setMedia,familyId),b=subscribeAnswers(exp.id,setAnswers,familyId),c=subscribeAllProgress(exp.id,setProgress,familyId);
  const d=familyId?subscribeFamilyBook(exp.id,familyId,b=>setFamilyBook({...b,_familyId:familyId})):()=>{};
  return()=>{a();b();c();d()};
 },[exp.id,familyId,grouped]);

 const flow=coordination.journeyFlow(exp.flow||[]);
 const puzzle=grouped?book.familyPuzzle:exp.familyPuzzle;
 const puzzlePieces=unlockedPieces(flow,puzzleCompletedIds(exp.flow||[],progress),puzzle?.totalPieces||8);
 const he=dir==="rtl";
 const theme=getExperienceTheme(exp);
 const chapters=useMemo(()=>buildMemoryChapters(flow,media,answers,progress,tx(lang,"עוד רגעים מהמסע","More moments from the journey")),[flow,media,answers,progress,he]);
 const finishers=progress.filter(p=>journeyFinished(p,flow)).length;
 const allFinished=participantView||finishers>0;
 const canWriteStory=firebaseConfigured&&exp.id&&exp.id!=="thailand-demo"&&chapters.length>0&&isOwner;
 const canShare=!grouped&&firebaseConfigured&&exp.id&&exp.id!=="thailand-demo"&&isOwner;
 const coverPhoto=media.find(m=>!m.contentType?.startsWith("video/"));
 const shareUrl=(typeof window!=="undefined"&&exp.id)?`${window.location.origin}${window.location.pathname}?memory=${exp.id}`:"";

 async function saveMemoryDesign(design){
   if(familyId){await saveFamilyBook(exp.id,familyId,{memoryDesign:design});return}
   await updateExperienceRemote(exp.id,{memoryDesign:design});
   setExperience?.({...exp,memoryDesign:design});
 }

 async function writeStory(){
   setWriting(true);
   try{
     const fn=httpsCallable(functions,"generateMemoryStory");
     const result=await fn({experienceId:exp.id,...(familyId?{familyId}:{})});
     if(familyId)setFamilyBook(b=>({...b,memoryStory:result.data.story}));else setExperience?.({...exp,memoryStory:result.data.story});
   }catch(e){showToast(e.message)}finally{setWriting(false)}
 }

 async function setShared(value){
   setSharing(true);
   try{
     await updateExperienceRemote(exp.id,{memoryPublic:value});
     setExperience?.({...exp,memoryPublic:value});
     if(value){try{await navigator.clipboard.writeText(shareUrl);showToast(m2.shareLinkCopied,"success")}catch{window.prompt(m2.shareLinkPrompt,shareUrl)}}
   }catch(e){showToast(e.message)}finally{setSharing(false)}
 }
 async function copyShareLink(){
   try{await navigator.clipboard.writeText(shareUrl);showToast(m2.shareLinkCopied,"success")}
   catch{window.prompt(m2.shareLinkPrompt,shareUrl)}
 }

 if(publicView&&!publicLoaded)return <section className="memoryBook memoryBookPublicState" dir={dir}><p>⏳ {m2.publicLoading}</p></section>;
 if(publicView&&!localExp)return <section className="memoryBook memoryBookPublicState" dir={dir}><p>⚠ {m2.publicNotFound}</p></section>;

 return <div className="memoryPage" dir={dir}>
 <div className="mbToolbar">
  {grouped&&isOwner&&<label>{tx(lang,"הספר של המשפחה","Family book")}<select value={familyId||""} onChange={e=>setSelectedFamily(e.target.value)}>{exp.families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
  <span className="mbToolbarLabel">{m2.morivoMemoryBook}</span>
  <div className="actions mbActions">
   {!publicView&&!participantView&&<button onClick={()=>setView("runtime")}>{m2.backToRuntime}</button>}
   <button className="primary" onClick={()=>window.print()}>{m2.exportPrint}</button>
  </div>
 </div>
 <div className="albumAutoStatus">{allFinished?(tx(lang,"רגעים שהשלמנו · ספר הזיכרונות שלכם מוכן","Completed moments · your memory book is ready")):(tx(lang,"ספר חי · הרגעים שלכם נאספים כאן אוטומטית","A living book · your moments are collected automatically"))}</div>
 <section className="memoryBook" dir={dir}>

  <div className="mbCover" style={coverPhoto?{backgroundImage:`url(${coverPhoto.downloadURL})`}:undefined}>
   {!coverPhoto&&<DestinationBackdrop theme={theme}/>}
   {!coverPhoto&&<span className="bookCoverIllustration">{tx(lang,"איור בהשראת היעד","Destination-inspired illustration")}</span>}
   <div className="mbCoverShade"></div>
   <div className="mbCoverFrame"></div>
   <div className="mbCoverContent">
    <span className="mbEyebrow">{m2.morivoMemoryBook}</span>
    <h1>{exp.name||t.studio.untitled}</h1>{family&&<h2>{family.name}</h2>}
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


  <div className={"mbSection mbStory "+(!book.memoryStory&&!book.story?"mbStoryEmpty":"")}>
   <div className="mbHeading">{m2.ourStory}</div>
   <p className="mbStoryText"><LinkifiedText text={book.memoryStory||m2.noStoryYet}/></p>
   {canWriteStory&&<button className="mbWriteBtn" disabled={writing} onClick={writeStory}>{writing?m2.writing:book.memoryStory?m2.rewriteWithAI:m2.writeWithAI}</button>}
  </div>

  {isOwner&&<MemoryPhotoManager key={`photos:${exp.id}:${familyId}`} experienceId={exp.id} photos={familyMedia} familyName={family?.name} lang={lang}/>}
  <MemoryAlbum puzzle={puzzle} puzzlePieces={puzzlePieces} familyName={family?.name} key={`album:${exp.id}:${familyId||"all"}`} chapters={chapters} theme={theme} lang={lang} seed={book.memoryDesign?.seed||`${exp.id}:${familyId||"all"}`} canEdit={isOwner&&firebaseConfigured} onSaveDesign={saveMemoryDesign}/>

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
