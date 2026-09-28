"use client";
import Memory from "./Memory";
import {missionLabels,participantHint} from "../lib/experienceGuidance";
import missionAnswers from "../functions/missionAnswers";
import journeyProgress from "../functions/journeyProgress";
import {useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import ParticipantJourneyMap from "./ParticipantJourneyMap";
import jsQR from "jsqr";
import {firebaseConfigured} from "../lib/firebase";
import {joinExperienceByCode,joinExperienceByPersonalCode,subscribeExperience,subscribeMyProgress,initializeProgress,completeJourneyMission,saveMissionAnswer,subscribeMessages,translateExperienceRemote,subscribeLocationVotes,castLocationVote} from "../lib/morivoData";
import {uploadMissionPhoto,subscribeMedia} from "../lib/mediaData";
import {computeBadges} from "../lib/badges";
import LinkifiedText from "./LinkifiedText";
import {distanceMeters,getCurrentPosition} from "../lib/geo";
import {enablePushNotifications,pushSupported} from "../lib/push";
import {experienceGradient} from "../lib/theme";
import LangSwitcher from "./LangSwitcher";
import {isStampMission} from "../lib/stampMissions";
import {unlockedPieces,gridIndexForPiece,pieceAtGridIndex} from "../lib/familyPuzzle";
import {isMissionDayLocked,missionUnlockDate} from "../lib/experienceVisuals";
function formatStopDate(dateStr,lang){
 try{ return new Intl.DateTimeFormat(lang==="he"?"he-IL":lang,{day:"numeric",month:"short"}).format(new Date(dateStr+"T00:00:00")); }
 catch{ return dateStr; }
}
function popupMeta(m,lang){
 const parts=[m.location||m.destination,m.date?formatStopDate(m.date,lang):null].filter(Boolean);
 return parts.join(" · ");
}
function navUrl(m){
 if(Number.isFinite(m.lat)&&Number.isFinite(m.lng))return `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
 if(m.hotel)return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([m.hotel,m.destination||m.location].filter(Boolean).join(", "))}`;
 return null;
}
const stampIcons={photo:"📸",video:"🎬",map:"🗺️",quiz:"✅",puzzle:"🧩",note:"✍️",story:"📖",branch:"🧭"};
export default function Participant({experience,setExperience,setView,setActiveId,deepLinkCode,t,lang,setLang,country,selectLang,dir,portal,portalCode,chromeless}){
 const p=t.participant;
 const [code,setCode]=useState(deepLinkCode||experience.joinCode||""),[name,setName]=useState(""),[joined,setJoined]=useState(false),[eid,setEid]=useState(experience.id),[uid,setUid]=useState("");
 const [portalResolving,setPortalResolving]=useState(!!portal||!!deepLinkCode);
 const [portalError,setPortalError]=useState(null);
 const [coverMedia,setCoverMedia]=useState([]);
 const [prog,setProg]=useState({completedMissionIds:[],currentMissionIndex:0,points:0}),[files,setFiles]=useState([]),[busy,setBusy]=useState(false),[pct,setPct]=useState(0),[uploadNotice,setUploadNotice]=useState("");
 const [revisitMission,setRevisitMission]=useState(null);
 const [revisitFiles,setRevisitFiles]=useState([]),[revisitBusy,setRevisitBusy]=useState(false),[revisitPct,setRevisitPct]=useState(0),[revisitNotice,setRevisitNotice]=useState("");
 const [joining,setJoining]=useState(false);
 const [quizAnswer,setQuizAnswer]=useState(null);
 const [quizFeedback,setQuizFeedback]=useState(null);
 const [quizWrongAttempts,setQuizWrongAttempts]=useState(0);
 const [noteText,setNoteText]=useState("");
 const [puzzleAnswer,setPuzzleAnswer]=useState("");
 const [locStatus,setLocStatus]=useState(null);
 const [qrVerified,setQrVerified]=useState(false);
 const [scanning,setScanning]=useState(false);
 const scanningRef=useRef(false),videoRef=useRef(null),canvasRef=useRef(null),streamRef=useRef(null);
 const [bump,setBump]=useState(false);
 const [messages,setMessages]=useState([]),[dismissed,setDismissed]=useState([]);
 const [pushState,setPushState]=useState("idle");
 const [translated,setTranslated]=useState(null);
 const [locationVotes,setLocationVotes]=useState([]);
 const [suggestText,setSuggestText]=useState("");
 const [missionPopupOpen,setMissionPopupOpen]=useState(false);
 const [passportOpen,setPassportOpen]=useState(false);
 const [albumOpen,setAlbumOpen]=useState(false);
 const [helpOpen,setHelpOpen]=useState(false);
 function goHome(){
  const current=document.querySelector(".mapStop.current");
  (current||document.querySelector(".journeySvgMap"))?.scrollIntoView({behavior:"smooth",block:"center"});
 }
 const [viewingMission,setViewingMission]=useState(null);
 useEffect(()=>{if(deepLinkCode)setCode(deepLinkCode)},[deepLinkCode]);
 function acceptIdentity(result){
  setName(result.name);setUid(result.uid);setEid(result.experienceId);setActiveId(result.experienceId);setJoined(true);
  setPersonalCode(result.personalCode);
  const url=new URL(window.location.href);
  url.searchParams.delete("join");url.searchParams.set("pcode",result.personalCode);
  window.history.replaceState(window.history.state,"",url.toString());
 }
 const [personalCode,setPersonalCode]=useState(portalCode||"");
 const [linkCopied,setLinkCopied]=useState(false);
 const [resolveAttempt,setResolveAttempt]=useState(0);
 useEffect(()=>{
  if(!portalCode&&!deepLinkCode)return;
  if(!firebaseConfigured){setPortalError(p.needsFirebasePortal);setPortalResolving(false);return}
  let alive=true;
  setPortalResolving(true);setPortalError(null);
  const resolve=portalCode?joinExperienceByPersonalCode(portalCode):joinExperienceByCode(deepLinkCode);
  resolve.then(result=>{if(alive&&!result.needsName)acceptIdentity(result)})
   .catch(e=>{if(alive)setPortalError(e.message)})
   .finally(()=>{if(alive)setPortalResolving(false)});
  return ()=>{alive=false};
 },[portalCode,deepLinkCode,resolveAttempt]);
 async function copyMyLink(){
  try{await navigator.clipboard.writeText(window.location.href);setLinkCopied(true)}
  catch{window.prompt(lang==="he"?"הקישור האישי שלכם":"Your personal link",window.location.href)}
 }
 useEffect(()=>{if(firebaseConfigured&&joined&&eid&&eid!=="thailand-demo")return subscribeExperience(eid,x=>x&&setExperience(x))},[eid,joined]);
 useEffect(()=>{if(firebaseConfigured&&joined&&eid&&eid!=="thailand-demo")return subscribeMedia(eid,setCoverMedia)},[joined,eid]);
 useEffect(()=>{if(firebaseConfigured&&joined&&eid&&uid){initializeProgress(eid,uid);return subscribeMyProgress(eid,uid,setProg)}},[joined,eid,uid]);
 useEffect(()=>{if(firebaseConfigured&&joined&&eid)return subscribeMessages(eid,setMessages)},[joined,eid]);
 useEffect(()=>{if(firebaseConfigured&&joined&&eid)return subscribeLocationVotes(eid,setLocationVotes)},[joined,eid]);
 useEffect(()=>{
  setTranslated(null);
  if(!firebaseConfigured||!joined||!eid||eid==="thailand-demo")return;
  if(experience.lang===lang)return;
  let alive=true;
  translateExperienceRemote(eid,lang).then(result=>{if(alive&&result)setTranslated(result)}).catch(e=>{if(alive)console.error("Translation failed:",e)});
  return ()=>{alive=false};
 },[joined,eid,lang,experience.lang,experience.updatedAt?.seconds,experience.updatedAt?.nanoseconds]);
 const latestMessage=messages.find(m=>!dismissed.includes(m.id));
 const experienceName=translated?.name||experience.name;
 const rawFlow=(experience.flow||[]).map(missionAnswers.normalizeMission);
 const flow=translated?rawFlow.map(m=>missionAnswers.normalizeMission({...m,...translated.flow.find(x=>x.id===m.id),...(m.responseMode==="open"?{type:"note",responseMode:"open"}:{})})):rawFlow;
 const rawIdx=journeyProgress.currentMissionIndex(prog,flow);
 // A branch mission can jump the participant straight past the end of the array (skipping
 // whatever missions their path didn't take), so "finished" has to mean "position is past the
 // last mission", not "every mission in the array got completed" - that second definition
 // would never trigger once a path leaves some missions unvisited.
 const finished=flow.length>0&&rawIdx>=flow.length;
 const idx=Math.min(rawIdx,Math.max(flow.length-1,0)), mission=finished?null:flow[idx];
 // The state machine can already point at day 2's mission the moment day 1's missions are
 // done - that's fine for tracking progress, but the participant shouldn't be able to act on
 // it before day 2 actually starts. This never blocks the completion itself (handled in the
 // popup below and in complete()), just gates the interactive form vs. a "opens on X" notice.
 const missionDayLocked=mission?isMissionDayLocked(experience.startDate,mission):false;
 const missionUnlocksOn=missionDayLocked?missionUnlockDate(experience.startDate,mission):null;
 const badges=computeBadges(prog,flow);
 const earnedStamps=flow.filter(m=>isStampMission(m)&&(prog.completedMissionIds||[]).includes(m.id));
 const puzzleTotal=experience.familyPuzzle?.totalPieces||8;
 const unlockedPuzzlePieces=useMemo(()=>unlockedPieces(flow,prog.completedMissionIds,puzzleTotal),[flow,prog.completedMissionIds,puzzleTotal]);
 const [flyingPiece,setFlyingPiece]=useState(null);
 const [confettiKey,setConfettiKey]=useState(0);
 const prevUnlockedRef=useRef(new Set());
 useEffect(()=>{
  const newlyUnlocked=[...unlockedPuzzlePieces].filter(n=>!prevUnlockedRef.current.has(n));
  prevUnlockedRef.current=unlockedPuzzlePieces;
  if(newlyUnlocked.length&&experience.familyPuzzle?.url){
   setFlyingPiece(newlyUnlocked[0]);
   setConfettiKey(k=>k+1);
   const t=setTimeout(()=>setFlyingPiece(null),1200);
   return ()=>clearTimeout(t);
  }
 },[unlockedPuzzlePieces,experience.familyPuzzle?.url]);
 useEffect(()=>{setQuizAnswer(null);setQuizFeedback(null);setQuizWrongAttempts(0);setNoteText("");setPuzzleAnswer("");setLocStatus(null);setQrVerified(false);setSuggestText("");setMissionPopupOpen(false);setFiles([]);setUploadNotice("");stopScan()},[mission?.id]);
 useEffect(()=>{setRevisitFiles([]);setRevisitNotice("");setRevisitPct(0)},[revisitMission?.id]);
 const branchResolvingRef=useRef(false);
 const locationPollResolvingRef=useRef(false);
 useEffect(()=>{branchResolvingRef.current=false;locationPollResolvingRef.current=false},[mission?.id]);
 useEffect(()=>{
  if(!mission||mission.type!=="branch"||!mission.organizerDecides||busy)return;
  const decidedOptionId=experience.branchDecisions?.[mission.id];
  if(!decidedOptionId||branchResolvingRef.current)return;
  const option=(mission.options||[]).find(o=>o.id===decidedOptionId);
  if(!option)return;
  branchResolvingRef.current=true;
  chooseBranch(option);
 },[mission,experience.branchDecisions,busy]);
 useEffect(()=>{
  if(!mission||mission.type!=="story"||!mission.organizerDecides||busy)return;
  const decided=experience.locationDecisions?.[mission.id];
  if(!decided||!decided.length||locationPollResolvingRef.current)return;
  locationPollResolvingRef.current=true;
  completeLocationPoll();
 },[mission,experience.locationDecisions,busy]);
 useEffect(()=>()=>stopScan(),[]);
 const hasGpsCheckpoint=mission&&Number.isFinite(mission.lat)&&Number.isFinite(mission.lng);
 const hasQrCheckpoint=mission&&!!mission.qrCode;
 async function checkLocation(){setLocStatus("checking");try{const {lat,lng}=await getCurrentPosition();const d=distanceMeters(lat,lng,mission.lat,mission.lng);setLocStatus({distance:d,within:d<=(mission.radius||150)})}catch(e){alert(e.message);setLocStatus(null)}}
 function stopScan(){scanningRef.current=false;setScanning(false);streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null}
 function tick(){
  if(!scanningRef.current)return;
  const video=videoRef.current,canvas=canvasRef.current;
  if(video&&canvas&&video.readyState===video.HAVE_ENOUGH_DATA){
   canvas.width=video.videoWidth;canvas.height=video.videoHeight;
   const ctx=canvas.getContext("2d");
   ctx.drawImage(video,0,0,canvas.width,canvas.height);
   const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
   const code=jsQR(imageData.data,imageData.width,imageData.height);
   if(code&&code.data&&mission&&code.data===mission.qrCode){setQrVerified(true);stopScan();return}
  }
  requestAnimationFrame(tick);
 }
 async function startScan(){
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
   streamRef.current=stream;
   videoRef.current.srcObject=stream;
   await videoRef.current.play();
   scanningRef.current=true;setScanning(true);
   requestAnimationFrame(tick);
  }catch(e){alert(e.message)}
 }
 useEffect(()=>{if(!prog.points)return;setBump(true);const timer=setTimeout(()=>setBump(false),450);return()=>clearTimeout(timer)},[prog.points]);
 async function join(){
  if(joining)return;
  if(!name.trim())return alert(p.enterNameFirst);
  if(!code.trim())return alert(p.enterCodeFirst);
  setJoining(true);
  try{
   if(firebaseConfigured){
    const withTimeout=(promise)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(p.joinTimedOut)),20000))]);
    const result=await withTimeout(joinExperienceByCode(code,name.trim()));
    acceptIdentity(result);
   }else setUid("demo");
   setJoined(true);
  }catch(e){alert(e.message)}finally{setJoining(false)}
 }
 async function enableNotifications(){setPushState("asking");try{await enablePushNotifications(eid,uid);setPushState("on")}catch(e){alert(e.message);setPushState("idle")}}
 // Shared by the active mission's uploader and the revisit popup: caps a batch at 15 files
 // and silently drops (with a notice) anything whose sanitized name matches a photo this
 // participant already uploaded for this mission, so the same shot never lands twice.
 function stageFiles(fileList,targetMission,current,setCurrent,setNotice){
  const sanitize=n=>n.replace(/[^\w.\-]+/g,"_");
  const existingNames=new Set(coverMedia.filter(x=>x.missionId===targetMission.id&&x.uid===uid).map(x=>x.fileName));
  const pendingNames=new Set(current.map(f=>sanitize(f.name)));
  const notices=[];
  const accepted=[];
  for(const f of fileList){
   const safe=sanitize(f.name);
   if(existingNames.has(safe)){notices.push(p.photoAlreadyExists(f.name));continue}
   if(pendingNames.has(safe))continue;
   pendingNames.add(safe);
   accepted.push(f);
  }
  let merged=[...current,...accepted];
  if(merged.length>15){merged=merged.slice(0,15);notices.push(p.photoLimitNotice)}
  setCurrent(merged);
  setNotice(notices.join(" "));
 }
 async function uploadBatch(targetMission,batch,onOverallProgress){
  for(let i=0;i<batch.length;i++){
   await uploadMissionPhoto({experienceId:eid,mission:targetMission,file:batch[i],participantName:name,onProgress:filePct=>onOverallProgress(Math.round(((i+filePct/100)/batch.length)*100))});
  }
 }
 async function complete(){if(!mission)return;if(missionDayLocked)return alert(p.missionDayLockedHint(missionUnlocksOn?formatStopDate(missionUnlocksOn.toISOString().slice(0,10),lang):""));if(experience.paused)return alert(p.pausedByOrganizer);const isMedia=mission.type==="photo"||mission.type==="video";if(isMedia&&!files.length)return alert(p.chooseFirst(mission.type));if(mission.type==="note"&&!noteText.trim())return alert(p.writeSomethingFirst);if(mission.type==="puzzle"&&!puzzleAnswer.trim())return alert(p.writeSomethingFirst);if(mission.type==="puzzle"&&mission.answer&&!missionAnswers.answerMatches(puzzleAnswer,mission.answer))return alert(p.wrongAnswer);if(mission.type==="map"&&(hasGpsCheckpoint||hasQrCheckpoint)&&!((hasGpsCheckpoint&&locStatus&&locStatus.within)||(hasQrCheckpoint&&qrVerified)))return alert(p.getCloserFirst);setBusy(true);try{
   if(isMedia&&firebaseConfigured)await uploadBatch(mission,files,setPct);
   if(["note","puzzle"].includes(mission.type)&&firebaseConfigured)await saveMissionAnswer(eid,mission,mission.type==="note"?noteText.trim():puzzleAnswer.trim(),name);
   if(firebaseConfigured)await completeJourneyMission(eid,mission,idx,name);else setProg(pr=>({completedMissionIds:[...pr.completedMissionIds,mission.id],currentMissionIndex:idx+1,points:pr.points+(mission.points||100)}));
   setConfettiKey(k=>k+1);
   setFiles([]);setPct(0);setNoteText("");setUploadNotice("");
 }catch(e){alert(e.message)}finally{setBusy(false)}}
 async function uploadMoreForRevisit(){
  if(!revisitMission||!revisitFiles.length||revisitBusy)return;
  setRevisitBusy(true);
  try{
   await uploadBatch(revisitMission,revisitFiles,setRevisitPct);
   setRevisitFiles([]);setRevisitPct(0);setRevisitNotice(p.morePhotosUploaded);
  }catch(e){alert(e.message)}finally{setRevisitBusy(false)}
 }
 async function chooseBranch(option){
  if(!mission||busy)return;
  if(experience.paused)return alert(p.pausedByOrganizer);
  const target=option.next?flow.findIndex(m=>m.id===option.next):flow.length;
  const nextIndex=target<0?flow.length:target;
  setBusy(true);
  try{
   if(firebaseConfigured)await completeJourneyMission(eid,mission,idx,name,{nextMissionId:option.next||null});
   else setProg(pr=>({completedMissionIds:[...pr.completedMissionIds,mission.id],currentMissionIndex:nextIndex,points:pr.points+(mission.points||0)}));
  }catch(e){alert(e.message)}finally{setBusy(false)}
 }
 async function completeLocationPoll(){
  if(!mission||busy)return;
  setBusy(true);
  try{
   if(firebaseConfigured)await completeJourneyMission(eid,mission,idx,name);
   else setProg(pr=>({completedMissionIds:[...pr.completedMissionIds,mission.id],currentMissionIndex:idx+1,points:pr.points+(mission.points||0)}));
  }catch(e){alert(e.message)}finally{setBusy(false)}
 }
 async function voteLocation(optionId,customOption){
  if(!mission||!firebaseConfigured)return;
  const myVoteDoc=locationVotes.find(v=>v.id===`${uid}_${mission.id}`);
  const current=myVoteDoc?.optionIds||[];
  const next=mission.isAttractionsPoll
   ?(current.includes(optionId)?current.filter(id=>id!==optionId):[...current,optionId])
   :[optionId];
  try{await castLocationVote(eid,mission.id,next,name,customOption||null)}catch(e){alert(e.message)}
 }
 function customOptionsFor(missionId){
  const seen=new Map();
  locationVotes.filter(v=>v.missionId===missionId&&v.customOption).forEach(v=>{if(!seen.has(v.customOption.id))seen.set(v.customOption.id,v.customOption)});
  return [...seen.values()];
 }
 async function suggestCustomHotel(){
  const text=suggestText.trim();
  if(!mission||!text)return;
  const customOption={id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:text.slice(0,100),why:""};
  await voteLocation(customOption.id,customOption);
  setSuggestText("");
 }
 async function evaluateQuiz(opt){
  if(!mission||busy||quizFeedback)return;
  if(experience.paused)return alert(p.pausedByOrganizer);
  setQuizAnswer(opt);
  const isCorrect=!mission.answer||missionAnswers.answerMatches(opt,mission.answer);
  if(!isCorrect){
   setQuizFeedback("wrong");
   setQuizWrongAttempts(n=>n+1);
   setTimeout(()=>{setQuizFeedback(null);setQuizAnswer(null)},900);
   return;
  }
  setQuizFeedback("correct");
  setConfettiKey(k=>k+1);
  setBusy(true);
  const penaltyMultiplier=Math.pow(0.9,quizWrongAttempts);
  const effectivePoints=Math.max(10,Math.round((mission.points||100)*penaltyMultiplier));
  setTimeout(async()=>{
   try{
    if(firebaseConfigured){
     await saveMissionAnswer(eid,mission,opt,name);
     await completeJourneyMission(eid,{...mission,points:effectivePoints},idx,name);
    }else setProg(pr=>({completedMissionIds:[...pr.completedMissionIds,mission.id],currentMissionIndex:idx+1,points:pr.points+effectivePoints}));
   }catch(e){alert(e.message)}finally{setBusy(false);setQuizFeedback(null);setQuizAnswer(null)}
  },650);
 }
 if(portalResolving){
  return <div className="portalShell" dir={dir} style={{backgroundImage:experienceGradient(portalCode)}}><div className="portalLoading">⏳ {p.portalResolving}</div></div>;
 }
 if(portalError){
  return <div className="portalShell" dir={dir} style={{backgroundImage:experienceGradient(portalCode)}}><div className="portalLoading">⚠ {portalError}<div><button onClick={()=>setResolveAttempt(x=>x+1)}>{lang==="he"?"ניסיון נוסף":"Try again"}</button></div></div></div>;
 }
 const coverPhoto=coverMedia.find(m=>!m.contentType?.startsWith("video/"));
 const cartoonBg=experience.celebrationPortrait?.useAsBackground&&experience.celebrationPortrait?.cartoonUrl;
 const portalBg=cartoonBg?`linear-gradient(180deg,rgba(5,11,19,.55),rgba(5,11,19,.92)),url(${cartoonBg})`:coverPhoto?`linear-gradient(180deg,rgba(5,11,19,.55),rgba(5,11,19,.92)),url(${coverPhoto.downloadURL})`:experienceGradient(experience.location||experience.type||experience.name);
 const completedCount=(prog.completedMissionIds||[]).length;
 const progressPct=flow.length?Math.round((completedCount/flow.length)*100):0;
 const joinedContent=<>
 {personalCode&&<div className="participantPersonalLink"><p>{lang==="he"?"זה הקישור האישי שלכם — רענון או פתיחה מחדש מחזירים לאותה התקדמות. הקישור זמין גם אצל המארגן לתג NFC. שמרו אותו לעצמכם.":"This is your personal link. Refresh or reopen it to resume your progress. Your organizer has the same link for your NFC tag. Keep it private."}</p><code>{personalCode}</code><button onClick={copyMyLink}>{linkCopied?(lang==="he"?"הקישור הועתק":"Link copied"):(lang==="he"?"העתקת הקישור האישי":"Copy my personal link")}</button></div>}

 {chromeless&&<div className="journeyGreeting"><h2>{p.welcomeGreeting(name)}</h2><p>{experienceName}</p></div>}
 <div className="participantHeader"><div><small>{experienceName}</small><h2>{finished?p.journeyComplete:p.missionOf(idx+1,flow.length)}</h2></div><div className={"pointsBadge "+(bump?"bump":"")}>{prog.points||0}<small>PTS</small></div></div>
 {firebaseConfigured&&pushSupported&&pushState!=="on"&&<button className="pushEnable" disabled={pushState==="asking"} onClick={enableNotifications}>🔔 {pushState==="asking"?p.asking:p.enableNotifications}</button>}
 {latestMessage&&<div className="orgMessage"><span>📣 {latestMessage.text}</span><button onClick={()=>setDismissed(d=>[...d,latestMessage.id])}>✕</button></div>}
 {experience.paused&&!finished&&<div className="pausedBanner">⏸ {p.pausedByOrganizer}</div>}
 <div className="journeyProgressBar"><div className="journeyProgressFill" style={{width:`${progressPct}%`}}></div></div>
 <ParticipantJourneyMap experience={experience} flow={flow} prog={prog} idx={idx} finished={finished} lang={lang} p={p} missionDayLocked={missionDayLocked} onOpenMission={(m,isActive)=>{
   if(isActive){setMissionPopupOpen(true);return}
   const doneAlready=(prog.completedMissionIds||[]).includes(m.id);
   if(doneAlready&&(m.type==="photo"||m.type==="video")){setRevisitMission(m);return}
   setViewingMission(m);
 }}/>
 {chromeless&&!!experience.startDate&&(experience.adultsCount>0||experience.childrenCount>0)&&<div className="familyPassport">
  <div className="journeySectionTitle">{p.familyPassportTitle}</div>
  <div className="familyIcons">
   {Array.from({length:experience.adultsCount||0}).map((_,i)=><span key={"a"+i}>🧑</span>)}
   {Array.from({length:experience.childrenCount||0}).map((_,i)=><span key={"c"+i}>🧒</span>)}
  </div>
 </div>}
 {chromeless&&(experience.flights||[]).length>0&&<div className="flightsSection">
  <div className="journeySectionTitle">{p.ourFlightsTitle}</div>
  {experience.flights.map(f=>{
   const dirLabel={outbound:p.flightOutbound,return:p.flightReturn,internal:p.flightInternal}[f.direction]||f.direction;
   return <div className="flightItem" key={f.id}>
    <b>{f.flightNumber}</b>
    <span>{f.date?formatStopDate(f.date,lang):""}{f.time?" · "+f.time:""}</span>
    <small className={"flightDirTag "+f.direction}>{dirLabel}</small>
   </div>;
  })}
 </div>}
 {chromeless&&<button type="button" className="printJourneyBtn noPrint" onClick={()=>window.print()}>🖨 {p.downloadJourneyPdf}</button>}
 {finished&&<div className="finishCard viewFade" key="finish"><div className="confetti">{Array.from({length:16}).map((_,i)=><span key={i}></span>)}</div><div className="finishIcon">🏆</div><h2>{p.journeyCompleteTitle}</h2><p>{p.journeyCompleteSub}</p>{badges.length>0&&<div className="badgeRow">{badges.map(b=><div className="badge" key={b.id} title={b.label}><span>{b.icon}</span><small>{b.label}</small></div>)}</div>}<button className="primary" onClick={()=>document.getElementById("finished-memory-book")?.scrollIntoView({behavior:"smooth"})}>{p.openMemoryBook}</button><div id="finished-memory-book" className="finishedMemoryBook"><Memory experience={experience} setExperience={setExperience} setView={setView} t={t} dir={dir} participantView/></div></div>}
 {chromeless&&typeof document!=="undefined"&&createPortal(<nav className="participantBottomNav">
  <button type="button" className="navBtn" onClick={goHome}>🏠<span>{p.navHome}</span></button>
  <button type="button" className="navBtn" onClick={()=>setPassportOpen(true)}>🛂<span>{p.navPassport}</span></button>
  <button type="button" className="navBtn" onClick={()=>setAlbumOpen(true)}>🖼️<span>{p.navPhotos}</span></button>
  <button type="button" className="navBtn" onClick={()=>setHelpOpen(true)}>❓<span>{p.navHelp}</span></button>
 </nav>,document.body)}
 {passportOpen&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" role="presentation" onClick={()=>setPassportOpen(false)}><div className="missionPopupCard passportCard" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button type="button" className="missionPopupClose" aria-label={lang==="he"?"סגירה":"Close"} onClick={()=>setPassportOpen(false)}>×</button>
  <div className="passportCrest">🛂</div>
  <div className="missionPopupMeta">{p.passportKicker}</div>
  <h3>{experienceName}</h3>
  <div className="passportStampsHead"><span>{p.passportStampsTitle}</span><small>{p.stampsCount(earnedStamps.length)}</small></div>
  {earnedStamps.length===0
   ? <p className="passportEmpty">{p.passportEmptyHint}</p>
   : <div className="passportStampGrid">{earnedStamps.map(m=><div className="passportStamp" key={m.id}><span className="passportStampIcon">{stampIcons[m.type]||"⭐"}</span><b>{m.day?(lang==="he"?`יום ${m.day}`:`Day ${m.day}`):m.title}</b></div>)}</div>}
  {badges.length>0&&<div className="badgeRow">{badges.map(b=><div className="badge" key={b.id} title={b.label}><span>{b.icon}</span><small>{b.label}</small></div>)}</div>}
  {experience.familyPuzzle?.url&&(()=>{
    const cols=4,rows=Math.ceil(puzzleTotal/cols);
    return <div className="familyPuzzleSection">
     <div className="passportStampsHead"><span>{p.familyPuzzleTitle}</span><small>{p.puzzlePiecesCount(unlockedPuzzlePieces.size,puzzleTotal)}</small></div>
     <div className="familyPuzzleGrid" style={{gridTemplateColumns:`repeat(${cols},1fr)`,aspectRatio:`${cols}/${rows}`}}>
      {Array.from({length:puzzleTotal},(_,gridIdx)=>gridIdx).map(gridIdx=>{
       const n=pieceAtGridIndex(experience.familyPuzzle.layout,puzzleTotal,gridIdx);
       const col=gridIdx%cols,row=Math.floor(gridIdx/cols);
       const unlocked=unlockedPuzzlePieces.has(n);
       return <div className={"puzzleTile "+(unlocked?"":"locked")} key={gridIdx}>
        <div className="puzzleTileImage" style={{backgroundImage:`url(${experience.familyPuzzle.url})`,backgroundSize:`${cols*100}% ${rows*100}%`,backgroundPosition:`${cols>1?col/(cols-1)*100:0}% ${rows>1?row/(rows-1)*100:0}%`}}/>
        {!unlocked&&<div className="puzzleLock">🔒</div>}
       </div>;
      })}
     </div>
     {unlockedPuzzlePieces.size===puzzleTotal&&<p className="puzzleCompleteText">{p.puzzleCompleteText}</p>}
    </div>;
   })()}
 </div></div>,document.body)}
 {flyingPiece&&experience.familyPuzzle?.url&&typeof document!=="undefined"&&createPortal((()=>{
   const cols=4,rows=Math.ceil(puzzleTotal/cols);
   const gridIdx=gridIndexForPiece(experience.familyPuzzle.layout,puzzleTotal,flyingPiece);
   const col=gridIdx%cols,row=Math.floor(gridIdx/cols);
   return <div className="puzzleFlyPiece" style={{backgroundImage:`url(${experience.familyPuzzle.url})`,backgroundSize:`${cols*100}% ${rows*100}%`,backgroundPosition:`${cols>1?col/(cols-1)*100:0}% ${rows>1?row/(rows-1)*100:0}%`}}/>;
 })(),document.body)}
 {confettiKey>0&&<Confetti key={confettiKey}/>}
 {albumOpen&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" role="presentation" onClick={()=>setAlbumOpen(false)}><div className="missionPopupCard albumCard" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button type="button" className="missionPopupClose" aria-label={lang==="he"?"סגירה":"Close"} onClick={()=>setAlbumOpen(false)}>×</button>
  <h3>{p.albumTitle}</h3>
  {(()=>{const mine=coverMedia.filter(m=>m.uid===uid);return mine.length===0
   ? <p className="passportEmpty">{p.albumEmpty}</p>
   : <div className="albumGrid">{mine.map(m=><a key={m.id} href={m.downloadURL} target="_blank" rel="noopener noreferrer" className="albumThumb">{m.contentType?.startsWith("video/")?<video src={m.downloadURL} muted/>:<img src={m.downloadURL} alt={m.missionTitle||""}/>}</a>)}</div>;})()}
 </div></div>,document.body)}
 {helpOpen&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" role="presentation" onClick={()=>setHelpOpen(false)}><div className="missionPopupCard" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button type="button" className="missionPopupClose" aria-label={lang==="he"?"סגירה":"Close"} onClick={()=>setHelpOpen(false)}>×</button>
  <div className="passportCrest">❓</div>
  <h3>{p.helpTitle}</h3>
  <p className="participantInstruction">{p.helpText1}</p>
  <p className="participantInstruction">{p.helpText2}</p>
  <p className="participantInstruction">{p.helpText3}</p>
  <button className="primary" onClick={()=>setHelpOpen(false)}>{p.helpGotIt}</button>
 </div></div>,document.body)}
 {missionPopupOpen&&mission&&!finished&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" role="presentation" onClick={()=>setMissionPopupOpen(false)}><div className="missionPopupCard" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button type="button" className="missionPopupClose" aria-label={lang==="he"?"סגירה":"Close"} onClick={()=>setMissionPopupOpen(false)}>×</button>{mission.day?<div className="missionPopupBadge">{mission.day}</div>:null}{popupMeta(mission,lang)&&<div className="missionPopupMeta">{popupMeta(mission,lang)}</div>}<div className="missionType">{missionLabels[lang==="he"?"he":"en"][mission.type]||mission.type}</div><h3>{mission.title}</h3><p className="participantInstruction">{participantHint(mission,lang)}</p><p><LinkifiedText text={mission.text}/></p>{mission.hotel&&<div className="journeyStopHotel">🏨 {mission.hotel}</div>}{navUrl(mission)&&<a className="journeyNavigateBtn" href={navUrl(mission)} target="_blank" rel="noopener noreferrer">🧭 {p.navigate}</a>}
 {missionDayLocked&&<div className="dayLockedNotice">🔒 {p.missionDayLockedHint(missionUnlocksOn?formatStopDate(missionUnlocksOn.toISOString().slice(0,10),lang):"")}</div>}
 {!missionDayLocked&&<>
 {(mission.type==="photo"||mission.type==="video")&&<div className="uploadChoiceGrid">
  <label className="uploadChoiceCard"><input type="file" accept={mission.type==="photo"?"image/*":"video/*"} multiple onChange={e=>{stageFiles([...e.target.files],mission,files,setFiles,setUploadNotice);e.target.value=""}}/><span className="uploadChoiceIcon">🖼️</span><b>{p.chooseFromGallery}</b><small>{p.chooseFromGalleryHint}</small></label>
  <label className="uploadChoiceCard"><input type="file" accept={mission.type==="photo"?"image/*":"video/*"} capture="environment" onChange={e=>{stageFiles([...e.target.files],mission,files,setFiles,setUploadNotice);e.target.value=""}}/><span className="uploadChoiceIcon">📷</span><b>{p.takeNewMedia}</b><small>{p.takeNewMediaHint}</small></label>
 </div>}
 {(mission.type==="photo"||mission.type==="video")&&files.length>0&&<ul className="uploadStagedList">{files.map((f,i)=><li key={f.name+i}><span>✓ {f.name}</span><button type="button" onClick={()=>setFiles(files.filter((_,x)=>x!==i))} aria-label={lang==="he"?"הסרה":"Remove"}>×</button></li>)}</ul>}
 {(mission.type==="photo"||mission.type==="video")&&uploadNotice&&<div className="uploadNotice">{uploadNotice}</div>}
 {(mission.type==="photo"||mission.type==="video")&&<small className="uploadLimitNote">{p.uploadLimitNote}</small>}
 {mission.type==="quiz"&&<>
 <div className={"choiceGrid "+(quizFeedback==="wrong"?"quizShake":"")}>{(mission.options||[]).map(opt=><button key={opt} type="button" aria-pressed={quizAnswer===opt} disabled={busy||!!quizFeedback} className={quizAnswer===opt?"selected "+(quizFeedback||""):""} onClick={()=>evaluateQuiz(opt)}>{opt}</button>)}</div>
 {quizFeedback==="wrong"&&<div className="quizFeedbackMsg wrong">✗ {p.wrongAnswer}</div>}
 {quizFeedback==="correct"&&<div className="quizFeedbackMsg correct">✓ {p.correctAnswer}</div>}
 {quizWrongAttempts>0&&!quizFeedback&&<div className="quizPenaltyHint">{p.pointsReduced(Math.round((1-Math.pow(0.9,quizWrongAttempts))*100))}</div>}
</>}{mission.type==="map"&&<>
 {hasGpsCheckpoint&&<div className="mapMock gpsReal">📍<span>{locStatus==="checking"?p.checkingLocation:locStatus?.within?p.arrived:locStatus?p.metersAway(Math.round(locStatus.distance)):p.getToCheckpoint}</span><button type="button" disabled={locStatus==="checking"} onClick={checkLocation}>{p.checkMyLocation}</button></div>}
 {hasQrCheckpoint&&<div className="qrScanBox">
  {qrVerified&&<div className="qrVerifiedMsg">✅ {p.qrVerified}</div>}
  <video ref={videoRef} playsInline muted className="qrVideo" style={{display:scanning?"block":"none"}}></video>
  <canvas ref={canvasRef} style={{display:"none"}}></canvas>
  {!qrVerified&&(scanning?<button type="button" onClick={stopScan}>{p.stopScanning}</button>:<button type="button" onClick={startScan}>📷 {p.scanQrCode}</button>)}
 </div>}
 {!hasGpsCheckpoint&&!hasQrCheckpoint&&<div className="mapMock">📍<span>{p.locationCheckpoint}</span></div>}
</>}{mission.type==="puzzle"&&<div className="puzzleBox">🧩<input value={puzzleAnswer} placeholder={p.puzzleAnswerPlaceholder} onChange={e=>setPuzzleAnswer(e.target.value)}/></div>}
 {mission.type==="note"&&<><textarea className="noteInput" maxLength={2000} placeholder={p.writeMemory} value={noteText} onChange={e=>setNoteText(e.target.value)}/></>}
 {mission.type==="branch"&&(mission.organizerDecides
  ? <div className="branchWaiting">⏳ {p.waitingForOrganizerDecision}</div>
  : <div className="branchChoices">{(mission.options||[]).map(o=><button key={o.id} type="button" className="branchChoiceBtn" disabled={busy||experience.paused} onClick={()=>chooseBranch(o)}>{o.label}</button>)}</div>)}
 {mission.type==="story"&&mission.organizerDecides&&(()=>{
    const decided=experience.locationDecisions?.[mission.id];
    if(decided&&decided.length){
     return <div className="branchWaiting">⏳ {p.waitingForOrganizerDecision}</div>;
    }
    if(mission.isAttractionsPoll){
     const myVoteIds=locationVotes.find(v=>v.id===`${uid}_${mission.id}`)?.optionIds||[];
     return <div className="locationPoll">
      {(mission.options||[]).map(o=>{
       const count=locationVotes.filter(v=>v.missionId===mission.id&&(v.optionIds||[]).includes(o.id)).length;
       const myVote=myVoteIds.includes(o.id);
       return <button key={o.id} type="button" className={"locationPollOption "+(myVote?"selected":"")} onClick={()=>voteLocation(o.id)}>
        <b>{o.name}</b>{o.why&&<span>{o.why}</span>}
        <div className="locationPollOptionFooter">{o.url&&<a className="locationPollLink" href={o.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>🔗 {p.viewOption}</a>}<small>{p.votesCount(count)}</small></div>
       </button>;
      })}
      <p className="locationPollHint">{p.locationPollHint}</p>
     </div>;
    }
    // Hotel-type mission (a poll, or the organizer's own already-chosen pick above) - participants
    // can always vote for a listed option or add their own suggestion; the organizer reviews
    // everything (including write-ins) and makes the final call in Runtime.
    const myVoteIds=locationVotes.find(v=>v.id===`${uid}_${mission.id}`)?.optionIds||[];
    const allOptions=[...(mission.options||[]),...customOptionsFor(mission.id)];
    return <div className="locationPoll">
     {allOptions.map(o=>{
      const count=locationVotes.filter(v=>v.missionId===mission.id&&(v.optionIds||[]).includes(o.id)).length;
      const myVote=myVoteIds.includes(o.id);
      return <button key={o.id} type="button" className={"locationPollOption "+(myVote?"selected":"")} onClick={()=>voteLocation(o.id,o.id.startsWith("custom-")?o:undefined)}>
       <b>{o.name}</b>{o.why&&<span>{o.why}</span>}
       <div className="locationPollOptionFooter">{o.url&&<a className="locationPollLink" href={o.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>🔗 {p.viewOption}</a>}<small>{p.votesCount(count)}</small></div>
      </button>;
     })}
     <div className="locationPollSuggest">
      <input value={suggestText} maxLength={100} placeholder={p.suggestYourOwn} onChange={e=>setSuggestText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&suggestCustomHotel()}/>
      <button type="button" disabled={!suggestText.trim()} onClick={suggestCustomHotel}>{p.suggestButton}</button>
     </div>
     <p className="locationPollHint">{p.locationPollHint}</p>
    </div>;
   })()}
 {mission.type!=="branch"&&!(mission.type==="story"&&mission.organizerDecides)&&<div className="mission">{p.reward}: {mission.reward||`${mission.points||100} pts`}</div>}
 {mission.type!=="branch"&&mission.type!=="quiz"&&!(mission.type==="story"&&mission.organizerDecides)&&<>{busy&&(mission.type==="photo"||mission.type==="video")&&<div className="uploadProgress"><div style={{width:`${pct}%`}}></div><span>{pct}%</span></div>}<button className="primary" disabled={busy||experience.paused} onClick={complete}>{busy?p.saving:p.completeContinue}</button></>}
 </>}</div></div>,document.body)}
 {revisitMission&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" role="presentation" onClick={()=>setRevisitMission(null)}><div className="missionPopupCard" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button type="button" className="missionPopupClose" aria-label={lang==="he"?"סגירה":"Close"} onClick={()=>setRevisitMission(null)}>×</button>{revisitMission.day?<div className="missionPopupBadge">{revisitMission.day}</div>:null}{popupMeta(revisitMission,lang)&&<div className="missionPopupMeta">{popupMeta(revisitMission,lang)}</div>}<div className="missionType">{missionLabels[lang==="he"?"he":"en"][revisitMission.type]||revisitMission.type}</div><h3>{revisitMission.title}</h3><div className="missionPopupStatus done">✓ {p.missionDoneHint}</div><p className="participantInstruction">{p.revisitUploadHint}</p>{revisitMission.hotel&&<div className="journeyStopHotel">🏨 {revisitMission.hotel}</div>}{navUrl(revisitMission)&&<a className="journeyNavigateBtn" href={navUrl(revisitMission)} target="_blank" rel="noopener noreferrer">🧭 {p.navigate}</a>}
  <div className="uploadChoiceGrid">
   <label className="uploadChoiceCard"><input type="file" accept={revisitMission.type==="photo"?"image/*":"video/*"} multiple onChange={e=>{stageFiles([...e.target.files],revisitMission,revisitFiles,setRevisitFiles,setRevisitNotice);e.target.value=""}}/><span className="uploadChoiceIcon">🖼️</span><b>{p.chooseFromGallery}</b><small>{p.chooseFromGalleryHint}</small></label>
   <label className="uploadChoiceCard"><input type="file" accept={revisitMission.type==="photo"?"image/*":"video/*"} capture="environment" onChange={e=>{stageFiles([...e.target.files],revisitMission,revisitFiles,setRevisitFiles,setRevisitNotice);e.target.value=""}}/><span className="uploadChoiceIcon">📷</span><b>{p.takeNewMedia}</b><small>{p.takeNewMediaHint}</small></label>
  </div>
  {revisitFiles.length>0&&<ul className="uploadStagedList">{revisitFiles.map((f,i)=><li key={f.name+i}><span>✓ {f.name}</span><button type="button" onClick={()=>setRevisitFiles(revisitFiles.filter((_,x)=>x!==i))} aria-label={lang==="he"?"הסרה":"Remove"}>×</button></li>)}</ul>}
  {revisitNotice&&<div className="uploadNotice">{revisitNotice}</div>}
  {revisitBusy&&<div className="uploadProgress"><div style={{width:`${revisitPct}%`}}></div><span>{revisitPct}%</span></div>}
  <button className="primary" disabled={revisitBusy||!revisitFiles.length} onClick={uploadMoreForRevisit}>{revisitBusy?p.saving:p.uploadMorePhotos}</button>
  <small className="uploadLimitNote">{p.uploadLimitNote}</small>
 </div></div>,document.body)}
 {viewingMission&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" role="presentation" onClick={()=>setViewingMission(null)}><div className="missionPopupCard" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button type="button" className="missionPopupClose" aria-label={lang==="he"?"סגירה":"Close"} onClick={()=>setViewingMission(null)}>×</button>{viewingMission.day?<div className="missionPopupBadge">{viewingMission.day}</div>:null}{popupMeta(viewingMission,lang)&&<div className="missionPopupMeta">{popupMeta(viewingMission,lang)}</div>}<div className="missionType">{missionLabels[lang==="he"?"he":"en"][viewingMission.type]||viewingMission.type}</div><h3>{viewingMission.title}</h3><p><LinkifiedText text={viewingMission.text}/></p>{viewingMission.hotel&&<div className="journeyStopHotel">🏨 {viewingMission.hotel}</div>}{navUrl(viewingMission)&&<a className="journeyNavigateBtn" href={navUrl(viewingMission)} target="_blank" rel="noopener noreferrer">🧭 {p.navigate}</a>}<div className={"missionPopupStatus "+((prog.completedMissionIds||[]).includes(viewingMission.id)?"done":"locked")}>{(prog.completedMissionIds||[]).includes(viewingMission.id)?`✓ ${p.missionDoneHint}`:`🔒 ${p.missionLockedHint}`}</div></div></div>,document.body)}
 </>;

 const joinForm=<div className="participantJoin"><div className="participantJoinMark" aria-hidden="true"><span></span><span></span><span></span></div><div className="participantJoinEyebrow">MORIVO · EXPERIENCE</div><h2>{p.joinTitle}</h2><p className="joinInstructions">{lang==="he"?(code?"הקוד כבר מוכן. כתבו את השם שיופיע למארגן ולחצו על הצטרפות.":"קיבלתם קישור או קוד מהמארגן? הזינו שם וקוד כדי להתחיל. אין צורך ליצור חשבון."):(code?"Your code is ready. Enter the name the organizer should see, then join.":"Enter your name and the code from your organizer to get started. No account is needed.")}</p><label htmlFor="participant-name">{p.yourName}</label><input id="participant-name" autoComplete="name" value={name} placeholder={p.namePlaceholder} onChange={e=>setName(e.target.value)}/><label htmlFor="participant-code">{p.joinCode}</label><input id="participant-code" autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&join()}/><div className="actions centerActions"><button className="primary" disabled={joining} onClick={join}>{joining?p.joining:p.joinBtn}</button></div></div>;

 const portalLangSwitch=<LangSwitcher country={country} selectLang={selectLang} label={lang==="he"?"שינוי שפה":"Change language"} className="portalLangSwitch"/>;

 if(chromeless){
  return <div className="portalShell" dir={dir} style={{backgroundImage:portalBg}}><div className="portalCard">{portalLangSwitch}{!portal&&<div className="tag">{p.tag}</div>}{joined?joinedContent:joinForm}</div></div>;
 }

 return <section className="panel narrow" dir={dir}><div className="tag">{p.tag}</div>{joined?joinedContent:joinForm}
 <div className="actions centerActions"><button onClick={()=>setView("runtime")}>{p.organizerRuntime}</button></div></section>
}

function Confetti(){
 const pieces=useMemo(()=>Array.from({length:26},(_,i)=>({
  left:Math.random()*100,
  delay:Math.random()*0.25,
  duration:1+Math.random()*0.6,
  rotate:Math.random()*360,
  color:["#7c3aed","#ec4899","#f97316","#22c55e","#3b82f6","#efc186"][i%6],
 })),[]);
 return typeof document!=="undefined"?createPortal(<div className="confettiLayer" aria-hidden="true">
  {pieces.map((c,i)=><span key={i} className="confettiPiece" style={{left:`${c.left}%`,animationDelay:`${c.delay}s`,animationDuration:`${c.duration}s`,background:c.color,transform:`rotate(${c.rotate}deg)`}}/>)}
 </div>,document.body):null;
}
