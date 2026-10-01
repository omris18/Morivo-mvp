"use client";
import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import ExperienceRoute from "./ExperienceRoute";
import ExperienceShare from "./ExperienceShare";
import {journeyFinished,missionDone,missionActive} from "../lib/experienceVisuals";
import {unlockedPieces} from "../lib/familyPuzzle";
import {missionLabels} from "../lib/experienceGuidance";
import {reorderExperienceRemote,updateMissionRemote} from "../lib/morivoData";
import journeyProgress from "../functions/journeyProgress";
import QRCode from "qrcode";
import {firebaseConfigured} from "../lib/firebase";
import {subscribeEvents,subscribeParticipants,subscribeAllProgress,subscribeAnswers,sendOrganizerMessage,skipMissionForParticipant,awardBonusPoints,resetMissionForParticipant,updateExperienceRemote,addParticipantCode,subscribeParticipantCodes,removeParticipantCode,subscribeLocationVotes} from "../lib/morivoData";
import {subscribeMedia} from "../lib/mediaData";
import {writeNfcTag,nfcWriteSupported} from "../lib/nfc";
const STUCK_MINUTES=3;
function minutesAgo(ts){ if(!ts?.toMillis)return null; return Math.floor((Date.now()-ts.toMillis())/60000); }
export default function Runtime({experience,setExperience,setView,t,user,lang,isMaster=false}){
 const r=t.runtime;
 const [people,setPeople]=useState([]),[feed,setFeed]=useState([]),[media,setMedia]=useState([]),[progress,setProgress]=useState([]),[answers,setAnswers]=useState([]),[locationVotes,setLocationVotes]=useState([]),[pendingAttractionPicks,setPendingAttractionPicks]=useState({});
 const [decisionsModalOpen,setDecisionsModalOpen]=useState(false);
 useEffect(()=>{if(!decisionsModalOpen)return;const onKey=e=>{if(e.key==="Escape")setDecisionsModalOpen(false)};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[decisionsModalOpen]);
 const [qrDataUrl,setQrDataUrl]=useState(null);
 const [roster,setRoster]=useState([]),[rosterName,setRosterName]=useState(""),[addingRoster,setAddingRoster]=useState(false);
 const [writingCode,setWritingCode]=useState(null),[writeStatus,setWriteStatus]=useState("");
 const [generatingFor,setGeneratingFor]=useState(null);
 function personalLink(code){
   return `${window.location.origin}${window.location.pathname}?pcode=${code}`;
 }
 async function copyPersonalLink(code,name){
   const url=personalLink(code);
   try{
     await navigator.clipboard.writeText(url);
     alert(r.personalLinkCopied(name));
   }catch{
     window.prompt(r.personalLinkPrompt(name), url);
   }
 }
 async function addRoster(){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   if(!rosterName.trim())return;
   setAddingRoster(true);
   try{
     const name=rosterName.trim();
     const code=await addParticipantCode(experience.id, experience.ownerUid||user?.uid, name);
     setRosterName("");
     await copyPersonalLink(code,name);
   }
   catch(e){ alert(e.message); }
   finally{ setAddingRoster(false); }
 }
 async function removeRoster(entry){
   if(!window.confirm(r.confirmRemoveRoster(entry.name)))return;
   removeParticipantCode(entry.code).catch(e=>alert(e.message));
 }
 async function writeTag(entry){
   if(!nfcWriteSupported())return alert(r.nfcNotSupported);
   setWritingCode(entry.code);setWriteStatus(r.nfcWaiting);
   const url=`${window.location.origin}${window.location.pathname}?pcode=${entry.code}`;
   try{
     await writeNfcTag(url,{onStatus:(s)=>setWriteStatus(s==="writing"?r.nfcWriting:r.nfcWaiting)});
     alert(r.nfcWriteSuccess(entry.name));
   }catch(e){ alert(e.message); }
   finally{ setWritingCode(null);setWriteStatus(""); }
 }
 function messageEveryone(){
   if(!firebaseConfigured)return alert(r.connectFirebaseMsg);
   const text=window.prompt(r.sendMessagePrompt);
   if(text&&text.trim())sendOrganizerMessage(experience.id,text).catch(e=>alert(e.message));
 }
 function skip(p){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   if(window.confirm(r.confirmSkip(p.name||p.participantName||"")))skipMissionForParticipant(experience.id,p.id,flow.length).catch(e=>alert(e.message));
 }
 function bonus(p){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   awardBonusPoints(experience.id,p.id,50).catch(e=>alert(e.message));
 }
 function resetCell(p,m){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   if(window.confirm(r.confirmResetMission(p.name||p.participantName||"",m.title)))
     resetMissionForParticipant(experience.id,p.id,m.id).catch(e=>alert(e.message));
 }
 async function generateNfcForParticipant(p){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   const name=p.name||p.participantName||"";
   if(!name.trim())return;
   setGeneratingFor(p.id);
   try{
     const code=await addParticipantCode(experience.id, experience.ownerUid||user?.uid, name, p.id);
     await copyPersonalLink(code,name);
   }catch(e){ alert(e.message); }
   finally{ setGeneratingFor(null); }
 }
 async function copyJoinLink(){
   const url=`${window.location.origin}${window.location.pathname}?join=${experience.joinCode}`;
   try{
     await navigator.clipboard.writeText(url);
     alert(r.joinLinkCopied);
   }catch{
     window.prompt(r.joinLinkPrompt, url);
   }
 }
 function togglePause(){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   updateExperienceRemote(experience.id,{paused:!experience.paused}).catch(e=>alert(e.message));
 }
 function decideBranch(missionId,optionId){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   updateExperienceRemote(experience.id,{[`branchDecisions.${missionId}`]:optionId}).catch(e=>alert(e.message));
 }
 function decideLocation(missionId,optionIds){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   const patch={[`locationDecisions.${missionId}`]:optionIds};
   const mission=flow.find(m=>m.id===missionId);
   // A hotel-type decision (not an attractions multi-pick) names the winning option directly
   // on the mission, so the participant's stop card and popup can show the hotel + navigate
   // to it right away instead of only learning "the organizer decided" with no details.
   if(mission&&!mission.isAttractionsPoll&&optionIds?.length){
     const allOptions=[...(mission.options||[]),...customOptionsFor(missionId)];
     const chosen=allOptions.find(o=>o.id===optionIds[0]);
     if(chosen?.name)patch.flow=flow.map(m=>m.id===missionId?{...m,hotel:chosen.name}:m);
   }
   updateExperienceRemote(experience.id,patch).catch(e=>alert(e.message));
   setPendingAttractionPicks(prev=>{const next={...prev};delete next[missionId];return next});
 }
 function votersFor(missionId,optionId){
   return locationVotes.filter(v=>v.missionId===missionId&&(v.optionIds||[]).includes(optionId)).map(v=>v.participantName).filter(Boolean);
 }
 function formatVoters(names){
   if(!names.length)return r.noVotesYet;
   try{return new Intl.ListFormat(lang==="he"?"he":lang,{style:"long",type:"conjunction"}).format(names)}catch{return names.join(", ")}
 }
 function customOptionsFor(missionId){
   const seen=new Map();
   locationVotes.filter(v=>v.missionId===missionId&&v.customOption).forEach(v=>{if(!seen.has(v.customOption.id))seen.set(v.customOption.id,v.customOption)});
   return [...seen.values()];
 }
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo"){setPeople([]);setProgress([]);setFeed([]);setMedia([]);setAnswers([]);setLocationVotes([]);return}
 const a=subscribeParticipants(experience.id,setPeople),b=subscribeEvents(experience.id,evs=>setFeed(evs.map(x=>x.text))),c=subscribeMedia(experience.id,setMedia),d=subscribeAllProgress(experience.id,setProgress),e=subscribeAnswers(experience.id,setAnswers),f=subscribeLocationVotes(experience.id,setLocationVotes);return()=>{a();b();c();d();e();f()}},[experience.id]);
 useEffect(()=>{if(!experience.joinCode){setQrDataUrl(null);return}const link=`${window.location.origin}${window.location.pathname}?join=${experience.joinCode}`;QRCode.toDataURL(link,{margin:1,width:160,color:{dark:"#050b13",light:"#ffffff"}}).then(setQrDataUrl).catch(()=>setQrDataUrl(null))},[experience.joinCode]);
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo")return;return subscribeParticipantCodes(experience.id,setRoster,e=>alert(r.rosterLoadError(e.message)))},[experience.id]);
 const flow=experience.flow||[];
 const canManage=!experience.id||user?.uid===experience.ownerUid||isMaster;
 async function swapMissions(firstId,secondId){const order=flow.map(m=>m.id),a=order.indexOf(firstId),b=order.indexOf(secondId);if(a<0||b<0)return;[order[a],order[b]]=[order[b],order[a]];if(firebaseConfigured&&experience.id)await reorderExperienceRemote(experience.id,order,flow.map(m=>m.id));else setExperience(prev=>({...prev,flow:order.map(id=>prev.flow.find(m=>m.id===id))}));}
 async function saveMission(original,edited){if(firebaseConfigured&&experience.id)await updateMissionRemote(experience.id,original,edited);else setExperience(prev=>({...prev,flow:prev.flow.map(m=>m.id===original.id?{...edited,id:original.id}:m)}));}
 async function toggleStampByType(type){
  const matching=flow.filter(m=>m.type===type);
  const allOn=matching.length>0&&matching.every(m=>m.stamp);
  const nextFlow=flow.map(m=>m.type===type?{...m,stamp:!allOn}:m);
  if(firebaseConfigured&&experience.id)await updateExperienceRemote(experience.id,{flow:nextFlow}).catch(e=>alert(e.message));
  else setExperience(prev=>({...prev,flow:nextFlow}));
 }
 const merged=useMemo(()=>{
   const real=people.map(p=>journeyProgress.normalizeProgress({...p,...(progress.find(x=>x.uid===p.id)||{})},flow));
   const realNames=new Set(real.map(p=>p.name||p.participantName));
   const realIds=new Set(real.map(p=>p.id));
   const pending=roster.filter(entry=>entry.participantId?!realIds.has(entry.participantId):!realNames.has(entry.name)).map(entry=>({id:entry.code,name:entry.name,pending:true,points:0,currentMissionIndex:0,completedMissionIds:[]}));
   return [...real,...pending];
 },[people,progress,roster,flow]);
 const missionPerf=useMemo(()=>flow.map((m,i)=>{
   const doneCount=merged.filter(p=>missionDone(p,m,i)).length;
   return {id:m.id,title:m.title,pct:merged.length?Math.round((doneCount/merged.length)*100):0};
 }),[flow,merged]);
 const completionRate=merged.length&&flow.length?Math.round((merged.filter(x=>journeyFinished(x,flow)).length/merged.length)*100):0;
 const avgPoints=merged.length?Math.round(merged.reduce((s,p)=>s+(p.points||0),0)/merged.length):0;
 const dropOff=useMemo(()=>missionPerf.length&&merged.length?missionPerf.reduce((worst,m)=>worst===null||m.pct<worst.pct?m:worst,null):null,[missionPerf,merged.length]);
 const journeyGridStyle={gridTemplateColumns:`minmax(140px,1.5fr) repeat(${flow.length},42px) 70px 116px`,minWidth:`${140+flow.length*42+70+116+5*(flow.length+3)}px`};
 const organizerBranches=flow.filter(m=>m.type==="branch"&&m.organizerDecides);
 const locationPolls=flow.filter(m=>m.type==="story"&&m.organizerDecides);
 return <section className="runtimePage">
 <ExperienceShare experience={experience} lang={lang} setView={setView}/>
 {!people.length&&experience.status==="live"&&<p className="contextHint">{lang==="he"?"עדיין לא הצטרפו משתתפים. שתפו את הקישור שלמעלה; הרשימה תתעדכן אוטומטית כשיצטרפו.":"No participants yet. Share the link above; this view updates automatically when they join."}</p>}
 {locationPolls.length>0&&(()=>{
   const pendingCount=locationPolls.filter(m=>{const d=experience.locationDecisions?.[m.id];return !(d&&d.length)}).length;
   return <>
    <div className="panel routeDecisionsPanel">
     <div className="tag">{r.locationPollsTitle}</div>
     <p className="rosterHint">{pendingCount>0?r.pendingDecisionsCount(pendingCount):r.locationPollsHint}</p>
     <button type="button" className="primary" onClick={()=>setDecisionsModalOpen(true)}>{r.pollResultsButton}</button>
    </div>
    {decisionsModalOpen&&typeof document!=="undefined"&&createPortal(<div className="orgDecisionsOverlay" role="presentation" onClick={()=>setDecisionsModalOpen(false)}>
     <div className="orgDecisionsModal" role="dialog" aria-modal="true" aria-label={r.locationPollsTitle} onClick={e=>e.stopPropagation()}>
      <button type="button" className="orgDecisionsClose" aria-label={r.closeModal} onClick={()=>setDecisionsModalOpen(false)}>×</button>
      <div className="tag">{r.locationPollsTitle}</div>
      <p className="rosterHint">{r.locationPollsHint}</p>
      {locationPolls.map(m=>{
        const decided=experience.locationDecisions?.[m.id];
        const isDecided=!!(decided&&decided.length);
        if(m.isAttractionsPoll){
          const pending=pendingAttractionPicks[m.id]||decided||[];
          return <div className="orgDecisionRow" key={m.id}>
           <b>{m.title}</b>
           <div className="orgDecisionOptionList">{m.options.map(o=>{
             const picked=pending.includes(o.id);
             return <div className={"orgDecisionOptionRow "+(picked?"picked":"")} key={o.id}>
              <label className="orgDecisionCheck"><input type="checkbox" disabled={isDecided} checked={picked} onChange={()=>setPendingAttractionPicks(prev=>{
                const cur=prev[m.id]||decided||[];
                const next=cur.includes(o.id)?cur.filter(id=>id!==o.id):[...cur,o.id];
                return {...prev,[m.id]:next};
              })}/><b>{o.name}</b></label>
              <small>{formatVoters(votersFor(m.id,o.id))}</small>
             </div>;
           })}</div>
           {!isDecided&&<button type="button" className="primary" disabled={!pending.length} onClick={()=>decideLocation(m.id,pending)}>{r.confirmSelection}</button>}
           {isDecided&&<span className="orgDecisionConfirmed">✓ {r.confirmed}</span>}
          </div>;
        }
        const allOptions=[...(m.options||[]),...customOptionsFor(m.id)];
        if(!allOptions.length){
          return <div className="orgDecisionRow" key={m.id}>
           <b>{m.title}</b>
           <div className="orgDecisionOptions">
            <button type="button" className={isDecided?"primary":""} disabled={isDecided} onClick={()=>decideLocation(m.id,["confirmed"])}>{isDecided?`✓ ${r.confirmed}`:r.confirmDestination}</button>
           </div>
          </div>;
        }
        return <div className="orgDecisionRow" key={m.id}>
         <b>{m.title}</b>
         <div className="orgDecisionOptionList">{allOptions.map(o=>{
           const isPicked=decided?.[0]===o.id;
           return <div className={"orgDecisionOptionRow "+(isPicked?"picked":"")} key={o.id}>
            <div><b>{o.name}</b><small>{formatVoters(votersFor(m.id,o.id))}</small></div>
            <button type="button" className={isPicked?"primary":""} onClick={()=>decideLocation(m.id,[o.id])}>{isPicked?`✓ ${r.confirmed}`:r.confirmOption}</button>
           </div>;
         })}</div>
        </div>;
      })}
     </div>
    </div>,document.body)}
   </>;
 })()}
 {organizerBranches.length>0&&<div className="panel routeDecisionsPanel"><div className="tag">{r.routeDecisions}</div><p className="rosterHint">{r.routeDecisionsHint}</p>
  {organizerBranches.map(m=>{
    const decided=experience.branchDecisions?.[m.id];
    return <div className="orgDecisionRow" key={m.id}>
     <b>{m.title}</b>
     <div className="orgDecisionOptions">{(m.options||[]).map(o=>
       <button key={o.id} type="button" className={decided===o.id?"primary":""} onClick={()=>decideBranch(m.id,o.id)}>{o.label||"—"}</button>
     )}</div>
    </div>;
  })}
 </div>}
 <div className="panel"><div className="runtimeTitle"><div><div className="tag">{r.tag}</div><h2>{experience.name||t.studio.untitled}</h2>{experience.paused&&<span className="pausedTag">⏸ {r.paused}</span>}</div><div className="joinMini"><small>{r.joinCode}</small><b>{experience.joinCode||r.publishFirst}</b>{qrDataUrl&&<img className="joinQr" src={qrDataUrl} alt="Join QR code"/>}</div></div>
 <div className="runtimeStats"><div><b>{merged.length}</b><span>{r.participants}</span></div><div><b>{flow.length}</b><span>{r.missions}</span></div><div><b>{media.length}</b><span>{r.memories}</span></div><div><b>{merged.filter(x=>journeyFinished(x,flow)).length}</b><span>{r.finished}</span></div></div>
 {merged.length>0&&<div className="runtimeStats insightsRow"><div><b>{completionRate}%</b><span>{r.completionRate}</span></div><div><b>{avgPoints}</b><span>{r.avgPoints}</span></div>{dropOff&&<div><b>{dropOff.pct}%</b><span>{r.dropOffAt} · {dropOff.title}</span></div>}</div>}
 <ExperienceRoute experience={experience} people={merged} media={media} answers={answers} lang={lang} onMemory={()=>setView("memory")} onStudio={()=>setView("studio")} onSwap={canManage?swapMissions:undefined} onSaveMission={canManage?saveMission:undefined} onTheme={canManage?async value=>{if(experience.id)await updateExperienceRemote(experience.id,{visualTheme:value});setExperience(prev=>({...prev,visualTheme:value}))}:undefined}/>
 <details className="participantMatrix"><summary>{r.liveJourneyMap} · {r.participants}</summary>
 <div className="journeyTable"><div className="journeyTableHead" style={journeyGridStyle}><span>{r.participant}</span>{flow.map((m,i)=><span key={m.id}>{i+1}</span>)}<span>{r.pointsCol}</span><span></span></div>{merged.map(p=>{
   const finished=!p.pending&&journeyFinished(p,flow);
   const mins=p.pending?null:minutesAgo(p.updatedAt);
   const stuck=!p.pending&&!finished&&mins!==null&&mins>=STUCK_MINUTES;
   return <div className={"journeyTableRow "+(stuck?"stuckRow":"")+(p.pending?" pendingRow":"")} style={journeyGridStyle} key={p.id}><span><b>{p.name||p.participantName}</b>{mins!==null&&<small className="lastActive">{stuck?"⚠ ":""}{mins<1?r.justNow:r.minAgo(mins)}</small>}</span>{flow.map((m,i)=>{const done=missionDone(p,m,i),active=missionActive(p,m,flow),skipped=(p.skippedMissionIds||[]).includes(m.id),resettable=!p.pending&&(done||skipped);return <span key={m.id} className={(done?"cellDone":active?"cellActive":"cellLocked")+(resettable?" cellResettable":"")} onClick={resettable?()=>resetCell(p,m):undefined} title={resettable?r.resetMissionCellTitle:undefined}>{done?"✓":active?"●":skipped?"↷":"·"}</span>})}<span>{p.pending?<small className="pendingTag">{r.notJoinedYet}</small>:<b>{p.points||0}</b>}</span><span className="rowActionBtns">{!p.pending&&<>{!finished&&<button className="skipBtn" onClick={()=>skip(p)} title={r.skipTitle}>⏭</button>}<button className="bonusBtn" onClick={()=>bonus(p)} title={r.bonusTitle}>🎁</button><button disabled={generatingFor===p.id} onClick={()=>generateNfcForParticipant(p)} title={r.generateNfcTitle}>{generatingFor===p.id?"…":"📲"}</button></>}</span></div>
 })}</div></details>
 <div className="actions"><button onClick={()=>setView("studio")}>{r.studioBtn}</button><button onClick={togglePause}>{experience.paused?`▶ ${r.resumeBtn}`:`⏸ ${r.pauseBtn}`}</button><button onClick={messageEveryone}>{r.messageEveryone}</button>{experience.joinCode&&<button className="primary" onClick={copyJoinLink}>{r.participantMode}</button>}</div></div>
 <div className="grid2" style={{marginTop:18}}><div className="panel"><div className="tag">{r.liveActivity}</div><div className="feed">{feed.map((x,i)=><div key={i}>{x}</div>)}</div></div><div className="panel"><div className="tag">{r.latestMemories}</div>{media.length?<div className="runtimeMedia">{media.slice(0,6).map(m=>m.contentType?.startsWith("video/")?<video key={m.id} src={m.downloadURL} muted/>:<img key={m.id} src={m.downloadURL} alt="memory"/>)}</div>:<p>{r.noPhotosYet}</p>}</div></div>
 {answers.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">{r.sharedMemories}</div><div className="feed">{answers.slice(0,8).map(a=><div key={a.id}><b>{a.participantName}</b> — {a.text}</div>)}</div></div>}
 {missionPerf.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">{r.missionPerformance}</div><div className="missionPerf">{missionPerf.map(m=><div className="missionPerfRow" key={m.id}><b>{m.title}</b><div className="missionPerfBar"><span style={{width:`${m.pct}%`}}></span></div><small>{m.pct}%</small></div>)}</div></div>}
 {canManage&&flow.length>0&&(()=>{
   const labels=missionLabels[lang==="he"?"he":"en"];
   const typeIcons={photo:"📸",video:"🎬",map:"🗺️",quiz:"✅",puzzle:"🧩",note:"✍️",story:"📖",branch:"🔀"};
   const typesPresent=[...new Set(flow.map(m=>m.type))].filter(type=>type!=="branch");
   return typesPresent.length>0&&<div className="panel stampsPanel" style={{marginTop:18}}>
    <div className="tag">{lang==="he"?"חותמות דרכון":"Passport stamps"}</div>
    <p className="rosterHint">{lang==="he"?"יעדים בטיול מקבלים חותמת דרכון אוטומטית. אפשר גם לסמן כאן במהירות אילו סוגי משימות יקבלו חותמת, בלי להיכנס לעריכה של כל משימה בנפרד.":"Destinations in the trip earn a passport stamp automatically. You can also quickly choose here which mission types earn a stamp, without opening each mission's editor separately."}</p>
    <div className="stampTypeToggles">{typesPresent.map(type=>{
      const matching=flow.filter(m=>m.type===type);
      const allOn=matching.every(m=>m.stamp);
      const someOn=!allOn&&matching.some(m=>m.stamp);
      return <button type="button" key={type} className={"stampTypeChip"+(allOn?" on":someOn?" partial":"")} onClick={()=>toggleStampByType(type)}>
       <span>{typeIcons[type]||"⭐"}</span> {labels[type]||type} <small>{matching.length}</small>
      </button>;
    })}</div>
   </div>;
 })()}
 {experience.familyPuzzle?.url&&merged.filter(p=>!p.pending).length>0&&(()=>{
   const puzzleTotal=experience.familyPuzzle.totalPieces||8;
   return <div className="panel" style={{marginTop:18}}>
    <div className="tag">{t.participant.familyPuzzleTitle}</div>
    <p className="rosterHint">{lang==="he"?"כל משתתף מרכיב את הפאזל המשפחתי שלו בעצמו, לפי המשימות שהשלים.":"Each participant assembles their own family puzzle as they complete missions."}</p>
    <div className="missionPerf">{merged.filter(p=>!p.pending).map(p=>{
      const n=unlockedPieces(flow,p.completedMissionIds,puzzleTotal).size;
      const pct=puzzleTotal?Math.round(n/puzzleTotal*100):0;
      return <div className="missionPerfRow" key={p.id}><b>{p.name||p.participantName}</b><div className="missionPerfBar"><span style={{width:`${pct}%`}}></span></div><small>{t.participant.puzzlePiecesCount(n,puzzleTotal)}</small></div>;
    })}</div>
   </div>;
 })()}
 <div className="panel" style={{marginTop:18}}>
  <div className="tag">{r.roster} ({roster.length})</div>
  <p className="rosterHint">{lang==="he"?"לכל משתתף קישור אישי קבוע. גם מצטרפים דרך הקישור הכללי מופיעים כאן אוטומטית. העתיקו את הקישור או צרבו אותו על תג NFC — הוא מחזיר לאותו משתתף ולאותה התקדמות. אפשר גם להכין הזמנות מראש לפי שם.":"Every participant has a permanent personal link. People joining through the shared link appear here automatically. Copy or write their link to an NFC tag to resume the same journey. You can also prepare invitations by name."}</p>
  <div className="reviseBar"><input placeholder={r.rosterNamePlaceholder} value={rosterName} onChange={e=>setRosterName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRoster()} disabled={addingRoster}/><button disabled={addingRoster||!rosterName.trim()} onClick={addRoster}>{addingRoster?r.saving:r.rosterAdd}</button></div>
  {roster.length>0&&<div className="rosterList">{roster.map(entry=>
   <div className="rosterRow" key={entry.code}>
    <span className="rosterName">{entry.name}</span>
    <span className="rosterCode">{entry.code}</span>
    <span className="rosterActions">
     <button onClick={()=>copyPersonalLink(entry.code,entry.name)}>{r.rosterCopyLink}</button>
     <button disabled={writingCode===entry.code} onClick={()=>writeTag(entry)}>{writingCode===entry.code?writeStatus:r.rosterWriteNfc}</button>
     <button className="danger" onClick={()=>removeRoster(entry)}>{r.rosterRemove}</button>
    </span>
   </div>
  )}</div>}
 </div>
 </section>
}
