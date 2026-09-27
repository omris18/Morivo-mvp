"use client";
import Memory from "./Memory";
import {missionLabels,participantHint} from "../lib/experienceGuidance";
import missionAnswers from "../functions/missionAnswers";
import journeyProgress from "../functions/journeyProgress";
import {useEffect,useRef,useState} from "react";
import jsQR from "jsqr";
import {firebaseConfigured} from "../lib/firebase";
import {joinExperienceByCode,joinExperienceByPersonalCode,subscribeExperience,subscribeMyProgress,initializeProgress,completeJourneyMission,saveMissionAnswer,subscribeMessages,translateExperienceRemote,subscribeLocationVotes,castLocationVote} from "../lib/morivoData";
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
 const [portalResolving,setPortalResolving]=useState(!!portal||!!deepLinkCode);
 const [portalError,setPortalError]=useState(null);
 const [coverMedia,setCoverMedia]=useState([]);
 const [prog,setProg]=useState({completedMissionIds:[],currentMissionIndex:0,points:0}),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[pct,setPct]=useState(0);
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
 useEffect(()=>{if(chromeless&&firebaseConfigured&&eid&&eid!=="thailand-demo")return subscribeMedia(eid,setCoverMedia)},[chromeless,eid]);
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
 const badges=computeBadges(prog,flow);
 useEffect(()=>{setQuizAnswer(null);setQuizFeedback(null);setQuizWrongAttempts(0);setNoteText("");setPuzzleAnswer("");setLocStatus(null);setQrVerified(false);stopScan()},[mission?.id]);
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
 async function complete(){if(!mission)return;if(experience.paused)return alert(p.pausedByOrganizer);const isMedia=mission.type==="photo"||mission.type==="video";if(isMedia&&!file)return alert(p.chooseFirst(mission.type));if(mission.type==="note"&&!noteText.trim())return alert(p.writeSomethingFirst);if(mission.type==="puzzle"&&!puzzleAnswer.trim())return alert(p.writeSomethingFirst);if(mission.type==="puzzle"&&mission.answer&&!missionAnswers.answerMatches(puzzleAnswer,mission.answer))return alert(p.wrongAnswer);if(mission.type==="map"&&(hasGpsCheckpoint||hasQrCheckpoint)&&!((hasGpsCheckpoint&&locStatus&&locStatus.within)||(hasQrCheckpoint&&qrVerified)))return alert(p.getCloserFirst);setBusy(true);try{
   if(isMedia&&firebaseConfigured)await uploadMissionPhoto({experienceId:eid,mission,file,participantName:name,onProgress:setPct});
   if(["note","puzzle"].includes(mission.type)&&firebaseConfigured)await saveMissionAnswer(eid,mission,mission.type==="note"?noteText.trim():puzzleAnswer.trim(),name);
   if(firebaseConfigured)await completeJourneyMission(eid,mission,idx,name);else setProg(pr=>({completedMissionIds:[...pr.completedMissionIds,mission.id],currentMissionIndex:idx+1,points:pr.points+(mission.points||100)}));
   setFile(null);setPct(0);setNoteText("");
 }catch(e){alert(e.message)}finally{setBusy(false)}}
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
 async function voteLocation(optionId){
  if(!mission||!firebaseConfigured)return;
  const myVoteDoc=locationVotes.find(v=>v.id===`${uid}_${mission.id}`);
  const current=myVoteDoc?.optionIds||[];
  const next=mission.isAttractionsPoll
   ?(current.includes(optionId)?current.filter(id=>id!==optionId):[...current,optionId])
   :[optionId];
  try{await castLocationVote(eid,mission.id,next,name)}catch(e){alert(e.message)}
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
 const portalBg=coverPhoto?`linear-gradient(180deg,rgba(5,11,19,.55),rgba(5,11,19,.92)),url(${coverPhoto.downloadURL})`:experienceGradient(experience.location||experience.type||experience.name);
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
 {finished?<div className="finishCard viewFade" key="finish"><div className="confetti">{Array.from({length:16}).map((_,i)=><span key={i}></span>)}</div><div className="finishIcon">🏆</div><h2>{p.journeyCompleteTitle}</h2><p>{p.journeyCompleteSub}</p>{badges.length>0&&<div className="badgeRow">{badges.map(b=><div className="badge" key={b.id} title={b.label}><span>{b.icon}</span><small>{b.label}</small></div>)}</div>}<button className="primary" onClick={()=>document.getElementById("finished-memory-book")?.scrollIntoView({behavior:"smooth"})}>{p.openMemoryBook}</button><div id="finished-memory-book" className="finishedMemoryBook"><Memory experience={experience} setExperience={setExperience} setView={setView} t={t} dir={dir} participantView/></div></div>:mission&&<div className="phone journeyPhone viewFade" key={mission.id}><div className="missionType">{missionLabels[lang==="he"?"he":"en"][mission.type]||mission.type}</div><h3>{mission.title}</h3><p className="participantInstruction">{participantHint(mission,lang)}</p><p><LinkifiedText text={mission.text}/></p>
 {mission.type==="photo"&&<label className="uploadBox"><span>{p.choosePhoto}</span><input type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
 {mission.type==="video"&&<label className="uploadBox"><span>{p.chooseVideo}</span><input type="file" accept="video/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
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
    if((decided&&decided.length)||!mission.options||!mission.options.length){
     return <div className="branchWaiting">⏳ {p.waitingForOrganizerDecision}</div>;
    }
    const myVoteIds=locationVotes.find(v=>v.id===`${uid}_${mission.id}`)?.optionIds||[];
    return <div className="locationPoll">
     {mission.options.map(o=>{
      const count=locationVotes.filter(v=>v.missionId===mission.id&&(v.optionIds||[]).includes(o.id)).length;
      const myVote=myVoteIds.includes(o.id);
      return <button key={o.id} type="button" className={"locationPollOption "+(myVote?"selected":"")} onClick={()=>voteLocation(o.id)}>
       <b>{o.name}</b>{o.why&&<span>{o.why}</span>}
       <small>{p.votesCount(count)}</small>
      </button>;
     })}
     <p className="locationPollHint">{p.locationPollHint}</p>
    </div>;
   })()}
 {mission.type!=="branch"&&!(mission.type==="story"&&mission.organizerDecides)&&<div className="mission">{p.reward}: {mission.reward||`${mission.points||100} pts`}</div>}
 {mission.type!=="branch"&&mission.type!=="quiz"&&!(mission.type==="story"&&mission.organizerDecides)&&<>{busy&&(mission.type==="photo"||mission.type==="video")&&<div className="uploadProgress"><div style={{width:`${pct}%`}}></div><span>{pct}%</span></div>}<button className="primary" disabled={busy||experience.paused} onClick={complete}>{busy?p.saving:p.completeContinue}</button></>}</div>}</>;

 const joinForm=<div className="participantJoin"><div className="participantJoinMark" aria-hidden="true"><span></span><span></span><span></span></div><div className="participantJoinEyebrow">MORIVO · EXPERIENCE</div><h2>{p.joinTitle}</h2><p className="joinInstructions">{lang==="he"?(code?"הקוד כבר מוכן. כתבו את השם שיופיע למארגן ולחצו על הצטרפות.":"קיבלתם קישור או קוד מהמארגן? הזינו שם וקוד כדי להתחיל. אין צורך ליצור חשבון."):(code?"Your code is ready. Enter the name the organizer should see, then join.":"Enter your name and the code from your organizer to get started. No account is needed.")}</p><label htmlFor="participant-name">{p.yourName}</label><input id="participant-name" autoComplete="name" value={name} placeholder={p.namePlaceholder} onChange={e=>setName(e.target.value)}/><label htmlFor="participant-code">{p.joinCode}</label><input id="participant-code" autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&join()}/><div className="actions centerActions"><button className="primary" disabled={joining} onClick={join}>{joining?p.joining:p.joinBtn}</button></div></div>;

 const portalLangSwitch=<div className="langSwitchGlobal portalLangSwitch">
   {COUNTRY_FLAGS.map(f=><button key={f.country} className={country===f.country?"active":""} onClick={()=>selectLang(f)} title={f.label} aria-label={f.label}><FlagIcon code={f.country}/></button>)}
  </div>;

 if(chromeless){
  return <div className="portalShell" dir={dir} style={{backgroundImage:portalBg}}><div className="portalCard">{portalLangSwitch}{!portal&&<div className="tag">{p.tag}</div>}{joined?joinedContent:joinForm}</div></div>;
 }

 return <section className="panel narrow" dir={dir}><div className="tag">{p.tag}</div>{joined?joinedContent:joinForm}
 <div className="actions centerActions"><button onClick={()=>setView("runtime")}>{p.organizerRuntime}</button></div></section>
}
