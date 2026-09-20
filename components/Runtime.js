"use client";
import {useEffect,useMemo,useState} from "react";
import QRCode from "qrcode";
import {firebaseConfigured} from "../lib/firebase";
import {subscribeEvents,subscribeParticipants,subscribeAllProgress,subscribeAnswers,sendOrganizerMessage,skipMissionForParticipant,awardBonusPoints,updateExperienceRemote,addParticipantCode,subscribeParticipantCodes,removeParticipantCode} from "../lib/morivoData";
import {subscribeMedia} from "../lib/mediaData";
import {writeNfcTag,nfcWriteSupported} from "../lib/nfc";
const STUCK_MINUTES=3;
function minutesAgo(ts){ if(!ts?.toMillis)return null; return Math.floor((Date.now()-ts.toMillis())/60000); }
export default function Runtime({experience,setView,t,user}){
 const r=t.runtime;
 const [people,setPeople]=useState([]),[feed,setFeed]=useState([]),[media,setMedia]=useState([]),[progress,setProgress]=useState([]),[answers,setAnswers]=useState([]);
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
 async function generateNfcForParticipant(p){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   const name=p.name||p.participantName||"";
   if(!name.trim())return;
   setGeneratingFor(p.id);
   try{
     const code=await addParticipantCode(experience.id, experience.ownerUid||user?.uid, name);
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
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo"){setPeople([{id:"1",name:"Omri"},{id:"2",name:"Tair"},{id:"3",name:"Maya"}]);setProgress([{uid:"1",currentMissionIndex:4,points:640},{uid:"2",currentMissionIndex:3,points:590},{uid:"3",currentMissionIndex:2,points:520}]);return}
 const a=subscribeParticipants(experience.id,setPeople),b=subscribeEvents(experience.id,evs=>setFeed(evs.map(x=>x.text))),c=subscribeMedia(experience.id,setMedia),d=subscribeAllProgress(experience.id,setProgress),e=subscribeAnswers(experience.id,setAnswers);return()=>{a();b();c();d();e()}},[experience.id]);
 useEffect(()=>{if(!experience.joinCode){setQrDataUrl(null);return}const link=`${window.location.origin}${window.location.pathname}?join=${experience.joinCode}`;QRCode.toDataURL(link,{margin:1,width:160,color:{dark:"#050b13",light:"#ffffff"}}).then(setQrDataUrl).catch(()=>setQrDataUrl(null))},[experience.joinCode]);
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo")return;return subscribeParticipantCodes(experience.id,setRoster,e=>alert(r.rosterLoadError(e.message)))},[experience.id]);
 const flow=experience.flow||[];
 const merged=useMemo(()=>{
   const real=people.map(p=>({...p,...(progress.find(x=>x.uid===p.id)||{})}));
   const realNames=new Set(real.map(p=>p.name||p.participantName));
   const pending=roster.filter(entry=>!realNames.has(entry.name)).map(entry=>({id:entry.code,name:entry.name,pending:true,points:0,currentMissionIndex:0,completedMissionIds:[]}));
   return [...real,...pending];
 },[people,progress,roster]);
 const missionPerf=useMemo(()=>flow.map((m,i)=>{
   const doneCount=merged.filter(p=>(p.completedMissionIds||[]).includes(m.id)||i<(p.currentMissionIndex||0)).length;
   return {id:m.id,title:m.title,pct:merged.length?Math.round((doneCount/merged.length)*100):0};
 }),[flow,merged]);
 const completionRate=merged.length&&flow.length?Math.round((merged.filter(x=>(x.currentMissionIndex||0)>=flow.length).length/merged.length)*100):0;
 const avgPoints=merged.length?Math.round(merged.reduce((s,p)=>s+(p.points||0),0)/merged.length):0;
 const dropOff=useMemo(()=>missionPerf.length&&merged.length?missionPerf.reduce((worst,m)=>worst===null||m.pct<worst.pct?m:worst,null):null,[missionPerf,merged.length]);
 const journeyGridStyle={gridTemplateColumns:`minmax(140px,1.5fr) repeat(${flow.length},42px) 70px 116px`,minWidth:`${140+flow.length*42+70+116+5*(flow.length+3)}px`};
 return <section><div className="panel"><div className="runtimeTitle"><div><div className="tag">{r.tag}</div><h2>{experience.name}</h2>{experience.paused&&<span className="pausedTag">⏸ {r.paused}</span>}</div><div className="joinMini"><small>{r.joinCode}</small><b>{experience.joinCode||r.publishFirst}</b>{qrDataUrl&&<img className="joinQr" src={qrDataUrl} alt="Join QR code"/>}</div></div>
 <div className="runtimeStats"><div><b>{merged.length}</b><span>{r.participants}</span></div><div><b>{flow.length}</b><span>{r.missions}</span></div><div><b>{media.length}</b><span>{r.memories}</span></div><div><b>{merged.filter(x=>(x.currentMissionIndex||0)>=flow.length).length}</b><span>{r.finished}</span></div></div>
 {merged.length>0&&<div className="runtimeStats insightsRow"><div><b>{completionRate}%</b><span>{r.completionRate}</span></div><div><b>{avgPoints}</b><span>{r.avgPoints}</span></div>{dropOff&&<div><b>{dropOff.pct}%</b><span>{r.dropOffAt} · {dropOff.title}</span></div>}</div>}
 <h3>{r.liveJourneyMap}</h3>
 <div className="journeyTable"><div className="journeyTableHead" style={journeyGridStyle}><span>{r.participant}</span>{flow.map((m,i)=><span key={m.id}>{i+1}</span>)}<span>{r.pointsCol}</span><span></span></div>{merged.map(p=>{
   const finished=!p.pending&&(p.currentMissionIndex||0)>=flow.length;
   const mins=p.pending?null:minutesAgo(p.updatedAt);
   const stuck=!p.pending&&!finished&&mins!==null&&mins>=STUCK_MINUTES;
   return <div className={"journeyTableRow "+(stuck?"stuckRow":"")+(p.pending?" pendingRow":"")} style={journeyGridStyle} key={p.id}><span><b>{p.name||p.participantName}</b>{mins!==null&&<small className="lastActive">{stuck?"⚠ ":""}{mins<1?r.justNow:r.minAgo(mins)}</small>}</span>{flow.map((m,i)=>{const done=!p.pending&&((p.completedMissionIds||[]).includes(m.id)||i<(p.currentMissionIndex||0)),active=!p.pending&&i===(p.currentMissionIndex||0);return <span key={m.id} className={done?"cellDone":active?"cellActive":"cellLocked"}>{done?"✓":active?"●":"·"}</span>})}<span>{p.pending?<small className="pendingTag">{r.notJoinedYet}</small>:<b>{p.points||0}</b>}</span><span className="rowActionBtns">{!p.pending&&<>{!finished&&<button className="skipBtn" onClick={()=>skip(p)} title={r.skipTitle}>⏭</button>}<button className="bonusBtn" onClick={()=>bonus(p)} title={r.bonusTitle}>🎁</button><button disabled={generatingFor===p.id} onClick={()=>generateNfcForParticipant(p)} title={r.generateNfcTitle}>{generatingFor===p.id?"…":"📲"}</button></>}</span></div>
 })}</div>
 <div className="actions"><button onClick={()=>setView("studio")}>{r.studioBtn}</button><button onClick={togglePause}>{experience.paused?`▶ ${r.resumeBtn}`:`⏸ ${r.pauseBtn}`}</button><button onClick={messageEveryone}>{r.messageEveryone}</button>{experience.joinCode&&<button className="primary" onClick={copyJoinLink}>{r.participantMode}</button>}</div></div>
 <div className="grid2" style={{marginTop:18}}><div className="panel"><div className="tag">{r.liveActivity}</div><div className="feed">{feed.map((x,i)=><div key={i}>{x}</div>)}</div></div><div className="panel"><div className="tag">{r.latestMemories}</div>{media.length?<div className="runtimeMedia">{media.slice(0,6).map(m=>m.contentType?.startsWith("video/")?<video key={m.id} src={m.downloadURL} muted/>:<img key={m.id} src={m.downloadURL} alt="memory"/>)}</div>:<p>{r.noPhotosYet}</p>}</div></div>
 {answers.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">{r.sharedMemories}</div><div className="feed">{answers.slice(0,8).map(a=><div key={a.id}><b>{a.participantName}</b> — {a.text}</div>)}</div></div>}
 {missionPerf.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">{r.missionPerformance}</div><div className="missionPerf">{missionPerf.map(m=><div className="missionPerfRow" key={m.id}><b>{m.title}</b><div className="missionPerfBar"><span style={{width:`${m.pct}%`}}></span></div><small>{m.pct}%</small></div>)}</div></div>}
 <div className="panel" style={{marginTop:18}}>
  <div className="tag">{r.roster} ({roster.length})</div>
  <p className="rosterHint">{r.rosterHint}</p>
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
