"use client";
import {useEffect,useMemo,useState} from "react";
import QRCode from "qrcode";
import {firebaseConfigured} from "../lib/firebase";
import {subscribeEvents,subscribeParticipants,subscribeAllProgress,subscribeAnswers,sendOrganizerMessage,skipMissionForParticipant} from "../lib/morivoData";
import {subscribeMedia} from "../lib/mediaData";
const STUCK_MINUTES=3;
function minutesAgo(ts){ if(!ts?.toMillis)return null; return Math.floor((Date.now()-ts.toMillis())/60000); }
export default function Runtime({experience,setView}){
 const [people,setPeople]=useState([]),[feed,setFeed]=useState([]),[media,setMedia]=useState([]),[progress,setProgress]=useState([]),[answers,setAnswers]=useState([]);
 const [qrDataUrl,setQrDataUrl]=useState(null);
 function messageEveryone(){
   if(!firebaseConfigured)return alert("Connect Firebase to send live messages.");
   const text=window.prompt("Send a hint or message to everyone currently in this experience:");
   if(text&&text.trim())sendOrganizerMessage(experience.id,text);
 }
 function skip(p){
   if(!firebaseConfigured)return alert("Connect Firebase to control live missions.");
   if(window.confirm(`Skip ${p.name||p.participantName||"this participant"} to the next mission?`))skipMissionForParticipant(experience.id,p.id,flow.length);
 }
 useEffect(()=>{if(!firebaseConfigured||!experience.id||experience.id==="thailand-demo"){setPeople([{id:"1",name:"Omri"},{id:"2",name:"Tair"},{id:"3",name:"Maya"}]);setProgress([{uid:"1",currentMissionIndex:4,points:640},{uid:"2",currentMissionIndex:3,points:590},{uid:"3",currentMissionIndex:2,points:520}]);return}
 const a=subscribeParticipants(experience.id,setPeople),b=subscribeEvents(experience.id,r=>setFeed(r.map(x=>x.text))),c=subscribeMedia(experience.id,setMedia),d=subscribeAllProgress(experience.id,setProgress),e=subscribeAnswers(experience.id,setAnswers);return()=>{a();b();c();d();e()}},[experience.id]);
 useEffect(()=>{if(!experience.joinCode){setQrDataUrl(null);return}const link=`${window.location.origin}${window.location.pathname}?join=${experience.joinCode}`;QRCode.toDataURL(link,{margin:1,width:160,color:{dark:"#050b13",light:"#ffffff"}}).then(setQrDataUrl).catch(()=>setQrDataUrl(null))},[experience.joinCode]);
 const flow=experience.flow||[],merged=useMemo(()=>people.map(p=>({...p,...(progress.find(x=>x.uid===p.id)||{})})),[people,progress]);
 const missionPerf=useMemo(()=>flow.map((m,i)=>{
   const doneCount=merged.filter(p=>(p.completedMissionIds||[]).includes(m.id)||i<(p.currentMissionIndex||0)).length;
   return {id:m.id,title:m.title,pct:merged.length?Math.round((doneCount/merged.length)*100):0};
 }),[flow,merged]);
 return <section><div className="panel"><div className="runtimeTitle"><div><div className="tag">Morivo Runtime · Journey Control</div><h2>{experience.name}</h2></div><div className="joinMini"><small>JOIN CODE</small><b>{experience.joinCode||"Publish first"}</b>{qrDataUrl&&<img className="joinQr" src={qrDataUrl} alt="Join QR code"/>}</div></div>
 <div className="runtimeStats"><div><b>{merged.length}</b><span>Participants</span></div><div><b>{flow.length}</b><span>Missions</span></div><div><b>{media.length}</b><span>Memories</span></div><div><b>{merged.filter(x=>(x.currentMissionIndex||0)>=flow.length).length}</b><span>Finished</span></div></div><h3>Live Journey Map</h3>
 <div className="journeyTable"><div className="journeyTableHead"><span>Participant</span>{flow.map((m,i)=><span key={m.id}>{i+1}</span>)}<span>Points</span><span></span></div>{merged.map(p=>{
   const finished=(p.currentMissionIndex||0)>=flow.length;
   const mins=minutesAgo(p.updatedAt);
   const stuck=!finished&&mins!==null&&mins>=STUCK_MINUTES;
   return <div className={"journeyTableRow "+(stuck?"stuckRow":"")} key={p.id}><span><b>{p.name||p.participantName}</b>{mins!==null&&<small className="lastActive">{stuck?"⚠ ":""}{mins<1?"just now":`${mins}m ago`}</small>}</span>{flow.map((m,i)=>{const done=(p.completedMissionIds||[]).includes(m.id)||i<(p.currentMissionIndex||0),active=i===(p.currentMissionIndex||0);return <span key={m.id} className={done?"cellDone":active?"cellActive":"cellLocked"}>{done?"✓":active?"●":"·"}</span>})}<span><b>{p.points||0}</b></span><span>{!finished&&<button className="skipBtn" onClick={()=>skip(p)}>⏭</button>}</span></div>
 })}</div>
 <div className="actions"><button onClick={()=>setView("studio")}>Studio</button><button onClick={messageEveryone}>📣 Message Everyone</button><button className="primary" onClick={()=>setView("participant")}>Participant Mode</button></div></div>
 <div className="grid2" style={{marginTop:18}}><div className="panel"><div className="tag">Live Activity</div><div className="feed">{feed.map((x,i)=><div key={i}>{x}</div>)}</div></div><div className="panel"><div className="tag">Latest Memories</div>{media.length?<div className="runtimeMedia">{media.slice(0,6).map(m=><img key={m.id} src={m.downloadURL} alt="memory"/>)}</div>:<p>No photos yet.</p>}</div></div>
 {answers.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">Shared Memories & Quotes</div><div className="feed">{answers.slice(0,8).map(a=><div key={a.id}><b>{a.participantName}</b> — {a.text}</div>)}</div></div>}
 {missionPerf.length>0&&<div className="panel" style={{marginTop:18}}><div className="tag">Mission Performance</div><div className="missionPerf">{missionPerf.map(m=><div className="missionPerfRow" key={m.id}><b>{m.title}</b><div className="missionPerfBar"><span style={{width:`${m.pct}%`}}></span></div><small>{m.pct}%</small></div>)}</div></div>}
 </section>
}