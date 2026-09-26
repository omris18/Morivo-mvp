"use client";
import {useEffect,useRef,useState} from "react";
import jsQR from "jsqr";
import {firebaseConfigured} from "../lib/firebase";
import {ensureUser,joinExperienceByCode,joinExperienceByPersonalCode,subscribeExperience,subscribeMyProgress,initializeProgress,completeJourneyMission,saveMissionAnswer,subscribeMessages,translateExperienceRemote} from "../lib/morivoData";
import {uploadMissionPhoto,subscribeMedia} from "../lib/mediaData";
import {computeBadges} from "../lib/badges";
import LinkifiedText from "./LinkifiedText";
import {distanceMeters,getCurrentPosition} from "../lib/geo";
import {enablePushNotifications,pushSupported} from "../lib/push";
import {experienceGradient} from "../lib/theme";
import {COUNTRY_FLAGS} from "../lib/i18n";
import FlagIcon from "./FlagIcon";
function formatStopDate(dateStr,lang){
 try{ return new Intl.DateTimeFormat(lang==="he"?"he-IL":lang,{day:"numeric",month:"short"}).format(new Date(dateStr+"T00:00:00")); }
 catch{ return dateStr; }
}
export default function Participant({experience,setExperience,setView,setActiveId,deepLinkCode,t,lang,setLang,country,selectLang,dir,portal,portalCode,chromeless}){
 const p=t.participant;
 const [code,setCode]=useState(deepLinkCode||experience.joinCode||""),[name,setName]=useState(""),[joined,setJoined]=useState(false),[eid,setEid]=useState(experience.id),[uid,setUid]=useState("");
 const [portalResolving,setPortalResolving]=useState(!!portal);
 const [portalError,setPortalError]=useState(null);
 const [coverMedia,setCoverMedia]=useState([]);
 const [prog,setProg]=useState({completedMissionIds:[],currentMissionIndex:0,points:0}),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[pct,setPct]=useState(0);
 const [joining,setJoining]=useState(false);
 const [quizAnswer,setQuizAnswer]=useState(null);
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
 useEffect(()=>{if(deepLinkCode)setCode(deepLinkCode)},[deepLinkCode]);
 useEffect(()=>{
  if(!portal||!portalCode)return;
  if(!firebaseConfigured){setPortalError(p.needsFirebasePortal);setPortalResolving(false);return}
  let alive=true;
  joinExperienceByPersonalCode(portalCode).then(result=>{
   if(!alive)return;
   setName(result.name);setUid(result.uid);setEid(result.experienceId);setActiveId(result.experienceId);setJoined(true);
   if(result.renamedFrom)alert(p.identityReused(result.renamedFrom,result.name));
  }).catch(e=>{if(alive)setPortalError(e.message)}).finally(()=>{if(alive)setPortalResolving(false)});
  return ()=>{alive=false};
 },[portal,portalCode]);
 useEffect(()=>{if(firebaseConfigured&&eid&&eid!=="thailand-demo")return subscribeExperience(eid,x=>x&&setExperience(x))},[eid]);
 useEffect(()=>{if(chromeless&&firebaseConfigured&&eid&&eid!=="thailand-demo")return subscribeMedia(eid,setCoverMedia)},[chromeless,eid]);
 useEffect(()=>{if(firebaseConfigured&&joined&&eid&&uid){initializeProgress(eid,uid);return subscribeMyProgress(eid,uid,setProg)}},[joined,eid,uid]);
 useEffect(()=>{if(firebaseConfigured&&joined&&eid)return subscribeMessages(eid,setMessages)},[joined,eid]);
 useEffect(()=>{
  setTranslated(null);
  if(!firebaseConfigured||!joined||!eid||eid==="thailand-demo")return;
  if(experience.lang===lang)return;
  let alive=true;
  translateExperienceRemote(eid,lang).then(result=>{if(alive&&result)setTranslated(result)}).catch(e=>{if(alive)console.error("Translation failed:",e)});
  return ()=>{alive=false};
 },[joined,eid,lang,experience.lang]);
 const latestMessage=messages.find(m=>!dismissed.includes(m.id));
 const experienceName=translated?.name||experience.name;
 const rawFlow=experience.flow||[];
 const flow=translated?rawFlow.map(m=>translated.flow.find(x=>x.id===m.id)||m):rawFlow;
 const idx=Math.min(prog.currentMissionIndex||0,Math.max(flow.length-1,0)), mission=flow[idx], finished=flow.length>0&&(prog.completedMissionIds||[]).length>=flow.length;
 const badges=computeBadges(prog,flow);
 useEffect(()=>{setQuizAnswer(null);setNoteText("");setPuzzleAnswer("");setLocStatus(null);setQrVerified(false);stopScan()},[idx]);
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
    const u=await withTimeout(ensureUser());
    setUid(u.uid);
    const result=await withTimeout(joinExperienceByCode(code,name.trim()));
    setEid(result.experienceId);setActiveId(result.experienceId);
    if(result.renamedFrom)alert(p.identityReused(result.renamedFrom,name.trim()));
   }else setUid("demo");
   setJoined(true);
  }catch(e){alert(e.message)}finally{setJoining(false)}
 }
 async function enableNotifications(){setPushState("asking");try{await enablePushNotifications(eid,uid);setPushState("on")}catch(e){alert(e.message);setPushState("idle")}}
 async function complete(){if(!mission)return;if(experience.paused)return alert(p.pausedByOrganizer);const isMedia=mission.type==="photo"||mission.type==="video";if(isMedia&&!file)return alert(p.chooseFirst(mission.type));if(mission.type==="quiz"&&!quizAnswer)return alert(p.chooseAnswerFirst);if(mission.type==="note"&&!noteText.trim())return alert(p.writeSomethingFirst);if(mission.type==="puzzle"&&mission.answer&&puzzleAnswer.trim().toLowerCase()!==String(mission.answer).trim().toLowerCase())return alert(p.wrongAnswer);if(mission.type==="map"&&(hasGpsCheckpoint||hasQrCheckpoint)&&!((hasGpsCheckpoint&&locStatus&&locStatus.within)||(hasQrCheckpoint&&qrVerified)))return alert(p.getCloserFirst);setBusy(true);try{
   if(isMedia&&firebaseConfigured)await uploadMissionPhoto({experienceId:eid,mission,file,participantName:name,onProgress:setPct});
   if(mission.type==="note"&&firebaseConfigured)await saveMissionAnswer(eid,mission,noteText.trim(),name);
   if(firebaseConfigured)await completeJourneyMission(eid,mission,idx,name);else setProg(pr=>({completedMissionIds:[...pr.completedMissionIds,mission.id],currentMissionIndex:idx+1,points:pr.points+(mission.points||100)}));
   setFile(null);setPct(0);setQuizAnswer(null);setNoteText("");
 }catch(e){alert(e.message)}finally{setBusy(false)}}
 if(portal&&portalResolving){
  return <div className="portalShell" dir={dir} style={{backgroundImage:experienceGradient(portalCode)}}><div className="portalLoading">⏳ {p.portalResolving}</div></div>;
 }
 if(portal&&portalError){
  return <div className="portalShell" dir={dir} style={{backgroundImage:experienceGradient(portalCode)}}><div className="portalLoading">⚠ {portalError}</div></div>;
 }
 const coverPhoto=coverMedia.find(m=>!m.contentType?.startsWith("video/"));
 const portalBg=coverPhoto?`linear-gradient(180deg,rgba(5,11,19,.55),rgba(5,11,19,.92)),url(${coverPhoto.downloadURL})`:experienceGradient(experience.location||experience.type||experience.name);
 const completedCount=(prog.completedMissionIds||[]).length;
 const progressPct=flow.length?Math.round((completedCount/flow.length)*100):0;
 const joinedContent=<>
 {chromeless&&<div className="journeyGreeting"><h2>{p.welcomeGreeting(name)}</h2><p>{experienceName}</p></div>}
 <div className="participantHeader"><div><small>{experienceName}</small><h2>{finished?p.journeyComplete:p.missionOf(idx+1,flow.length)}</h2></div><div className={"pointsBadge "+(bump?"bump":"")}>{prog.points||0}<small>PTS</small></div></div>
 {firebaseConfigured&&pushSupported&&pushState!=="on"&&<button className="pushEnable" disabled={pushState==="asking"} onClick={enableNotifications}>🔔 {pushState==="asking"?p.asking:p.enableNotifications}</button>}
 {latestMessage&&<div className="orgMessage"><span>📣 {latestMessage.text}</span><button onClick={()=>setDismissed(d=>[...d,latestMessage.id])}>✕</button></div>}
 {experience.paused&&!finished&&<div className="pausedBanner">⏸ {p.pausedByOrganizer}</div>}
 <div className="journeyProgressBar"><div className="journeyProgressFill" style={{width:`${progressPct}%`}}></div></div>
 <div className="journeyMap">{flow.map((m,i)=>{
   const done=(prog.completedMissionIds||[]).includes(m.id),active=!finished&&i===idx;
   const hasNav=active&&Number.isFinite(m.lat)&&Number.isFinite(m.lng);
   return <div className={"journeyStop "+(done?"done":active?"active":"locked")} key={m.id}>
    <div className="journeyStopDot">{done?"✓":active?"★":i+1}</div>
    <div className="journeyStopCard">
     {(m.day||m.date)&&<div className="journeyStopMeta">{m.day?p.dayBadge(m.day):""}{m.day&&m.date?" · ":""}{m.date?formatStopDate(m.date,lang):""}</div>}
     <b>{m.title}</b>
     {m.hotel&&<div className="journeyStopHotel">🏨 {m.hotel}</div>}
     {hasNav&&<a className="journeyNavigateBtn" href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`} target="_blank" rel="noopener noreferrer">🧭 {p.navigate}</a>}
    </div>
   </div>;
 })}</div>
 {chromeless&&(experience.adultsCount>0||experience.childrenCount>0)&&<div className="familyPassport">
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
 {finished?<div className="finishCard viewFade" key="finish"><div className="confetti">{Array.from({length:16}).map((_,i)=><span key={i}></span>)}</div><div className="finishIcon">🏆</div><h2>{p.journeyCompleteTitle}</h2><p>{p.journeyCompleteSub}</p>{badges.length>0&&<div className="badgeRow">{badges.map(b=><div className="badge" key={b.id} title={b.label}><span>{b.icon}</span><small>{b.label}</small></div>)}</div>}<button className="primary" onClick={()=>setView("memory")}>{p.openMemoryBook}</button></div>:mission&&<div className="phone journeyPhone viewFade" key={mission.id}><div className="missionType">{mission.type}</div><h3>{mission.title}</h3><p><LinkifiedText text={mission.text}/></p>
 {mission.type==="photo"&&<label className="uploadBox"><span>{p.choosePhoto}</span><input type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
 {mission.type==="video"&&<label className="uploadBox"><span>{p.chooseVideo}</span><input type="file" accept="video/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
 {mission.type==="quiz"&&<div className="choiceGrid">{["A","B","C"].map(opt=><button key={opt} className={quizAnswer===opt?"selected":""} onClick={()=>setQuizAnswer(opt)}>{opt}</button>)}</div>}{mission.type==="map"&&<>
 {hasGpsCheckpoint&&<div className="mapMock gpsReal">📍<span>{locStatus==="checking"?p.checkingLocation:locStatus?.within?p.arrived:locStatus?p.metersAway(Math.round(locStatus.distance)):p.getToCheckpoint}</span><button type="button" disabled={locStatus==="checking"} onClick={checkLocation}>{p.checkMyLocation}</button></div>}
 {hasQrCheckpoint&&<div className="qrScanBox">
  {qrVerified&&<div className="qrVerifiedMsg">✅ {p.qrVerified}</div>}
  <video ref={videoRef} playsInline muted className="qrVideo" style={{display:scanning?"block":"none"}}></video>
  <canvas ref={canvasRef} style={{display:"none"}}></canvas>
  {!qrVerified&&(scanning?<button type="button" onClick={stopScan}>{p.stopScanning}</button>:<button type="button" onClick={startScan}>📷 {p.scanQrCode}</button>)}
 </div>}
 {!hasGpsCheckpoint&&!hasQrCheckpoint&&<div className="mapMock">📍<span>{p.locationCheckpoint}</span></div>}
</>}{mission.type==="puzzle"&&<div className="puzzleBox">🧩<input value={puzzleAnswer} placeholder={p.puzzleAnswerPlaceholder} onChange={e=>setPuzzleAnswer(e.target.value)}/></div>}
 {mission.type==="note"&&<textarea className="noteInput" placeholder={p.writeMemory} value={noteText} onChange={e=>setNoteText(e.target.value)}/>}
 {busy&&(mission.type==="photo"||mission.type==="video")&&<div className="uploadProgress"><div style={{width:`${pct}%`}}></div><span>{pct}%</span></div>}<div className="mission">{p.reward}: {mission.reward||`${mission.points||100} pts`}</div><button className="primary" disabled={busy||experience.paused} onClick={complete}>{busy?p.saving:p.completeContinue}</button></div>}</>;

 const joinForm=<div className="participantJoin"><div className="participantJoinMark" aria-hidden="true"><span></span><span></span><span></span></div><div className="participantJoinEyebrow">MORIVO · EXPERIENCE</div><h2>{p.joinTitle}</h2><label htmlFor="participant-name">{p.yourName}</label><input id="participant-name" autoComplete="name" value={name} placeholder={p.namePlaceholder} onChange={e=>setName(e.target.value)}/><label htmlFor="participant-code">{p.joinCode}</label><input id="participant-code" autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&join()}/><div className="actions centerActions"><button className="primary" disabled={joining} onClick={join}>{joining?p.joining:p.joinBtn}</button></div></div>;

 const portalLangSwitch=<div className="langSwitchGlobal portalLangSwitch">
   {COUNTRY_FLAGS.map(f=><button key={f.country} className={country===f.country?"active":""} onClick={()=>selectLang(f)} title={f.label} aria-label={f.label}><FlagIcon code={f.country}/></button>)}
  </div>;

 if(chromeless){
  return <div className="portalShell" dir={dir} style={{backgroundImage:portalBg}}><div className="portalCard">{portalLangSwitch}{!portal&&<div className="tag">{p.tag}</div>}{joined?joinedContent:joinForm}</div></div>;
 }

 return <section className="panel narrow" dir={dir}><div className="tag">{p.tag}</div>{joined?joinedContent:joinForm}
 <div className="actions centerActions"><button onClick={()=>setView("runtime")}>{p.organizerRuntime}</button></div></section>
}
