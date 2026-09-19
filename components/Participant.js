"use client";
import {useEffect,useState} from "react";
import {firebaseConfigured} from "../lib/firebase";
import {ensureUser,joinExperienceByCode,subscribeExperience,subscribeMyProgress,initializeProgress,completeJourneyMission} from "../lib/morivoData";
import {uploadMissionPhoto} from "../lib/mediaData";
export default function Participant({experience,setExperience,setView,setActiveId}){
 const [code,setCode]=useState(experience.joinCode||""),[name,setName]=useState("Guest"),[joined,setJoined]=useState(false),[eid,setEid]=useState(experience.id),[uid,setUid]=useState("");
 const [prog,setProg]=useState({completedMissionIds:[],currentMissionIndex:0,points:0}),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[pct,setPct]=useState(0);
 const [quizAnswer,setQuizAnswer]=useState(null);
 const [bump,setBump]=useState(false);
 useEffect(()=>{if(firebaseConfigured&&eid&&eid!=="thailand-demo")return subscribeExperience(eid,x=>x&&setExperience(x))},[eid]);
 useEffect(()=>{if(firebaseConfigured&&joined&&eid&&uid){initializeProgress(eid,uid);return subscribeMyProgress(eid,uid,setProg)}},[joined,eid,uid]);
 const flow=experience.flow||[], idx=Math.min(prog.currentMissionIndex||0,Math.max(flow.length-1,0)), mission=flow[idx], finished=flow.length>0&&(prog.completedMissionIds||[]).length>=flow.length;
 useEffect(()=>{setQuizAnswer(null)},[idx]);
 useEffect(()=>{if(!prog.points)return;setBump(true);const t=setTimeout(()=>setBump(false),450);return()=>clearTimeout(t)},[prog.points]);
 async function join(){try{if(firebaseConfigured){const u=await ensureUser();setUid(u.uid);const id=await joinExperienceByCode(code,name);setEid(id);setActiveId(id)}else setUid("demo");setJoined(true)}catch(e){alert(e.message)}}
 async function complete(){if(!mission)return;if(mission.type==="photo"&&!file)return alert("Choose a photo first");if(mission.type==="quiz"&&!quizAnswer)return alert("Choose an answer first");setBusy(true);try{
   if(mission.type==="photo"&&firebaseConfigured)await uploadMissionPhoto({experienceId:eid,mission,file,participantName:name,onProgress:setPct});
   if(firebaseConfigured)await completeJourneyMission(eid,mission,idx,name);else setProg(p=>({completedMissionIds:[...p.completedMissionIds,mission.id],currentMissionIndex:idx+1,points:p.points+(mission.points||100)}));
   setFile(null);setPct(0);setQuizAnswer(null);
 }catch(e){alert(e.message)}finally{setBusy(false)}}
 return <section className="panel narrow"><div className="tag">Participant Journey</div>{!joined?<><h2>Join an experience.</h2><label>Your name</label><input value={name} onChange={e=>setName(e.target.value)}/><label>Join code</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><div className="actions centerActions"><button className="primary" onClick={join}>Join Experience</button></div></>:<>
 <div className="participantHeader"><div><small>{experience.name}</small><h2>{finished?"Journey complete":`Mission ${idx+1} of ${flow.length}`}</h2></div><div className={"pointsBadge "+(bump?"bump":"")}>{prog.points||0}<small>PTS</small></div></div>
 <div className="journeyRail">{flow.map((m,i)=>{const done=(prog.completedMissionIds||[]).includes(m.id),active=!finished&&i===idx;return <div className={"journeyDot "+(done?"done":active?"active":"locked")} key={m.id}><span>{done?"✓":active?i+1:"🔒"}</span><small>{m.title}</small></div>})}</div>
 {finished?<div className="finishCard viewFade" key="finish"><div className="finishIcon">🏆</div><h2>Experience complete.</h2><p>Your memories are waiting.</p><button className="primary" onClick={()=>setView("memory")}>Open Memory Book</button></div>:mission&&<div className="phone journeyPhone viewFade" key={mission.id}><div className="missionType">{mission.type}</div><h3>{mission.title}</h3><p>{mission.text}</p>
 {mission.type==="photo"&&<label className="uploadBox"><span>📸 Choose a photo</span><input type="file" accept="image/*" capture="environment" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
 {mission.type==="quiz"&&<div className="choiceGrid">{["A","B","C"].map(opt=><button key={opt} className={quizAnswer===opt?"selected":""} onClick={()=>setQuizAnswer(opt)}>{opt}</button>)}</div>}{mission.type==="map"&&<div className="mapMock">📍<span>Location checkpoint</span></div>}{mission.type==="puzzle"&&<div className="puzzleMock">🧩</div>}
 {busy&&mission.type==="photo"&&<div className="uploadProgress"><div style={{width:`${pct}%`}}></div><span>{pct}%</span></div>}<div className="mission">Reward: {mission.reward||`${mission.points||100} points`}</div><button className="primary" disabled={busy} onClick={complete}>{busy?"Saving…":"Complete & Continue"}</button></div>}</>}
 <div className="actions centerActions"><button onClick={()=>setView("runtime")}>Organizer Runtime</button></div></section>
}