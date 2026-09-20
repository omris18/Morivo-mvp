"use client";
import {useEffect,useMemo,useState} from "react";
import QRCode from "qrcode";
import {firebaseConfigured} from "../lib/firebase";
import {subscribeEvents,subscribeParticipants,subscribeAllProgress,subscribeAnswers,sendOrganizerMessage,skipMissionForParticipant} from "../lib/morivoData";
import {subscribeMedia} from "../lib/mediaData";
const STUCK_MINUTES=3;
function minutesAgo(ts){ if(!ts?.toMillis)return null; return Math.floor((Date.now()-ts.toMillis())/60000); }
export default function Runtime({experience,setView,t}){
 const r=t.runtime;
 const [people,setPeople]=useState([]),[feed,setFeed]=useState([]),[media,setMedia]=useState([]),[progress,setProgress]=useState([]),[answers,setAnswers]=useState([]);
 const [qrDataUrl,setQrDataUrl]=useState(null);
 function messageEveryone(){
   if(!firebaseConfigured)return alert(r.connectFirebaseMsg);
   const text=window.prompt(r.sendMessagePrompt);
   if(text&&text.trim())sendOrganizerMessage(experience.id,text);
 }
 function skip(p){
   if(!firebaseConfigured)return alert(r.connectFirebaseCtrl);
   if(window.confirm(r.confirmSkip(p.name||p.participantName||"")))skipMissionForParticipant(experience.id,p.id,flow.length);
 }
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo"){setPeople([{id:"1",name:"Omri"},{id:"2",name:"Tair"},{id:"3",name:"Maya"}]);setProgress([{uid:"1",currentMissionIndex:4,points:640},{uid:"2",currentMissionIndex:3,points:590},{uid:"3",currentMissionIndex:2,points:520}]);return}
 const a=subscribeParticipants(experience.id,setPeople),b=subscribeEvents(experience.id,evs=>setFeed(evs.map(x=>x.text))),c=subscribeMedia(experience.id,setMedia),d=subscribeAllProgress(experience.id,setProgress),e=subscribeAnswers(experience.id,setAnswers);return()=>{a();b();c();d();e()}},[experience.id]);
 useEffect(()=>{if(!experience.joinCode){setQrDataUrl(null);return}const link=`${window.location.origin}${window.location.pathname}?join=${experience.joinCode}`;QRCode.toDataURL(link,{margin:1,width:160,color:{dark:"#050b13",light:"#ffffff"}}).then(setQrDataUrl).catch(()=>setQrDataUrl(null))},[experience.joinCode]);
 const flow=experience.flow||[],merged=useMemo(()=>people.map(p=>({...p,...(progress.find(x=>x.uid===p.id)||{})})),[people,progress]);
 const missionPerf=useMemo(()=>flow.map((m,i)=>{
   const doneCount=merged.filter(p=>(p.completedMissionIds||[]).includes(m.id)||i<(p.currentMissionIndex||0)).length;
   return {id:m.id,title:m.title,pct:merged.length?Math.round((doneCount/merged.length)*100):0};
 }),[flow,merged]);
 const completionRate=merged.length&&flow.length?Math.round((merged.filter(x=>(x.currentMissionIndex||0)>=flow.length).length/merged.length)*100):0;
 const avgPoints=merged.length?Math.round(merged.reduce((s,p)=>s+(p.points||0),0)/merged.length):0;
 const dropOff=useMemo(()=>missionPerf.length&&merged.length?missionPerf.reduce((worst,m)=>worst===null||m.pct<worst.pct?m:worst,null):null,[missionPerf,merged.length]);
 return <section><div className="panel"><div className="runtimeTitle"><div><div className="tag">{r.tag}</div><h2>{experience.name}</h2></div><div className="joinMini"><small>{r.joinCode}</small><b>{experience.joinCode||r.publishFirst}</b>{qrDataUrl&&<img className="joinQr" src={qrDataUrl} alt="Join QR code"/>}</div></div>
 <div className="runtimeStats"><div><b>{merged.length}</b><span>{r.participants}</span></div><div><b>{flow.length}</b><span>{r.missions}</span></div><div><b>{media.length}</b><span>{r.memories}</span></div><div><b>{merged.filter(x=>(x.currentMissionIndex||0)>=flow.length).length}</b><span>{r.finished}</span></div></div>
 {merged.length>0&&<div className="runtimeStats insightsRow"><div><b>{completionRate}%</b><span>{r.completionRate}</span></div><div><b>{avgPoints}</b><span>{r.avgPoints}</span></div>{dropOff&&<div><b>{dropOff.pct}%</b><span>{r.dropOffAt} · {dropOff.title}</span></div>}</div>}
 <h3>{r.liveJourneyMap}</h3>
 <div className="journeyTable"><div className="journeyTableHead"><span>{r.participant}</span>{flow.map((m,i)=><span key={m.id}>{i+1}</span>)}<span>{r.pointsCol}</span><span></span></div>{merged.map(p=>{
   const finished=(p.currentMissionIndex||0)>=flow.length;
   const mins=minutesAgo(p.updatedAt);
   const stuck=!finished&&mins!==null&&mins>=STUCK_MINUTES;
   return <div className={"journeyTableRow "+(stuck?"stuckRow":"")} key={p.id}><span><b>{p.name||p.participantName}</b>{mins!==null&&<small className="lastActive">{stuck?"⚠ ":""}{mins<1?r.justNow:r.minAgo(mins)}</small>}</span>{flow.map((m,i)=>{const done=(p.completedMissionIds||[]).includes(m.id)||i<(p.currentMissionIndex||0),active=i===(p.currentMissionIndex||0);return <span key={m.id} className={done?"cellDone":active?"cellActive":"cellLocked"}>{done?"✓":active?"●":"·"}</span>})}<span><b>{p.points||0}</b></span><span>{!finished&&<button className="skipBtn" onClick={()=>skip(p)}>⏭</button>}</span></div>
 })}</div>
 <div className="actions"><button onClick={()=>setView("studio")}>{r.studioBtn}</button><button onClick={messageEveryone}>{r.messageEveryone}</button><button className="primary" onClick={()=>setView("participant")}>{r.participantMode}</button></div></div>
 <div className="grid2" style={{marginTop:18}}><div className="panel"><div className="tag">{r.liveActivity}</div><div className="feed">{feed.map((x,i)=><div key={i}>{x}</div>)}</div></div><div className="panel"><div className="tag">{r.latestMemories}</div>{media.length?<div className="runtimeMedia">{media.slice(0,6).map(m=>m.contentType?.startsWith("video/")?<video key={m.id} src={m.downloadURL} muted/>:<img key={m.id} src={m.downloadURL} alt="memory"/>)}</div>:<p>{r.noPhotosYet}</p>}</div></div>
 {answers.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">{r.sharedMemories}</div><div className="feed">{answers.slice(0,8).map(a=><div key={a.id}><b>{a.participantName}</b> — {a.text}</div>)}</div></div>}
 {missionPerf.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">{r.missionPerformance}</div><div className="missionPerf">{missionPerf.map(m=><div className="missionPerfRow" key={m.id}><b>{m.title}</b><div className="missionPerfBar"><span style={{width:`${m.pct}%`}}></span></div><small>{m.pct}%</small></div>)}</div></div>}
 </section>
}
