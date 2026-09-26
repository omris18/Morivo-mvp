"use client";
import {useEffect,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {firebaseConfigured,functions} from "../lib/firebase";
import {createExperienceRemote,ensureUser} from "../lib/morivoData";

const TYPE_OPTIONS={
 en:["Family Trip","Birthday","Team Building","School","Museum"],
 he:["טיול משפחתי","יום הולדת","גיבוש צוות","בית ספר","מוזיאון"]
};
const DURATION_OPTIONS={
 en:["30 minutes","1 hour","2-3 hours","Half day (4-5 hours)","Full day"],
 he:["30 דקות","שעה","2-3 שעות","חצי יום (4-5 שעות)","יום שלם"]
};

function daysBetween(start,end){
 if(!start||!end)return 0;
 const diff=Math.round((new Date(end+"T00:00:00")-new Date(start+"T00:00:00"))/86400000)+1;
 return diff>0?diff:0;
}
function generateDraft(f){
 const subject=f.prompt.trim()||"your experience";
 const loc=f.location.trim();
 return [
  {id:"story-"+Date.now(),type:"story",title:"The Beginning",text:`Open ${subject}${loc?` in ${loc}`:""} with a personal moment that brings everyone into the story.`,reward:"First chapter unlocked",points:50},
  {id:"photo-"+(Date.now()+1),type:"photo",title:"Capture the Moment",text:"Take one photo that could only belong to this group and this experience.",reward:"Memory captured",points:100},
  {id:"map-"+(Date.now()+2),type:"map",title:"Find the Next Chapter",text:`Reach a meaningful checkpoint${loc?` in ${loc}`:""} and discover what comes next.`,reward:"Route unlocked",points:120},
  {id:"quiz-"+(Date.now()+3),type:"quiz",title:"How Well Do You Know Each Other?",text:"Answer a playful question about the people sharing this experience.",reward:"Team bonus",points:100},
  {id:"puzzle-"+(Date.now()+4),type:"puzzle",title:"Piece of the Story",text:"Complete the challenge to reveal another piece of your shared story.",reward:"Puzzle piece",points:150},
  {id:"photo-"+(Date.now()+5),type:"photo",title:"The Unexpected One",text:"Capture something surprising, funny or beautiful that nobody planned.",reward:"Hidden memory",points:120},
  {id:"story-"+(Date.now()+6),type:"story",title:"One Thing to Remember",text:"Choose the moment from this experience you never want to forget.",reward:"Memory Book chapter",points:160}
 ];
}

export default function AICreator({setExperience,setView,setActiveId,user,lang,t,dir}){
 const a=t.aiCreator;
 const [form,setForm]=useState({prompt:"",type:"",location:"",duration:"",startDate:"",endDate:"",people:"",peopleDetails:"",hotelBooked:false,interests:[]}),[building,setBuilding]=useState(false),[step,setStep]=useState(0);
 const isFamilyTrip=form.type===TYPE_OPTIONS.en[0]||form.type===TYPE_OPTIONS.he[0];
 const tripDays=isFamilyTrip?daysBetween(form.startDate,form.endDate):0;
 function toggleInterest(key){
  setForm(f=>({...f,interests:f.interests.includes(key)?f.interests.filter(x=>x!==key):[...f.interests,key]}));
 }
 useEffect(()=>{if(!building)return;const id=setInterval(()=>setStep(x=>Math.min(x+1,a.thinking.length-1)),900);return()=>clearInterval(id)},[building,lang]);
 async function build(){
  if(!form.prompt.trim())return alert(a.describeFirst);
  if(!firebaseConfigured)return alert(a.needsFirebase);
  setBuilding(true);setStep(0);
  const minWait=new Promise(r=>setTimeout(r,Math.max(4200,a.thinking.length*700)));
  let flow,name,usedAI=false,aiError=null;
  try{
   await ensureUser();
   const generate=httpsCallable(functions,"generateExperience");
   const needsHotel=isFamilyTrip&&!form.hotelBooked;
   const result=await generate({prompt:form.prompt,type:form.type,location:form.location,duration:isFamilyTrip?(tripDays?`${tripDays} days`:""):form.duration,startDate:isFamilyTrip?form.startDate:null,endDate:isFamilyTrip?form.endDate:null,people:form.people,peopleDetails:form.peopleDetails,lang,multiDay:isFamilyTrip,needsHotel,interests:isFamilyTrip?form.interests:[]});
   flow=result.data.flow;name=result.data.name;usedAI=true;
  }catch(e){
   console.error("AI generation failed, falling back to the draft generator",e);
   aiError=`${e.code||"error"}: ${e.message||e}`;
  }
  if(!flow){
   flow=generateDraft(form);
   name=form.prompt.trim().split(/[.!?\n]/)[0].slice(0,48)||"New Experience";
  }
  await minWait;
  const data={name,type:form.type,location:form.location,people:Number(form.people||0),story:form.prompt,flow,status:"draft",aiGenerated:usedAI,lang,...(isFamilyTrip&&form.startDate?{startDate:form.startDate}:{}),...(isFamilyTrip&&form.endDate?{endDate:form.endDate}:{})};
  try{
   const u=user||await ensureUser(),id=await createExperienceRemote(u.uid,data);
   setExperience({...data,id,ownerUid:u.uid});setActiveId(id);
   setView("studio");
   if(aiError)alert(a.aiFailedNote+aiError);
  }catch(e){alert(e.message);setBuilding(false)}
 }
 if(building)return <section className="aiThinking" dir={dir}>
   <div className="thinkingWorld">
    <svg className="thinkingLines" viewBox="0 0 600 540" preserveAspectRatio="none">
     <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stopColor="#efc186" stopOpacity="0"/>
       <stop offset="50%" stopColor="#5fcdf8" stopOpacity=".9"/>
       <stop offset="100%" stopColor="#7d5cff" stopOpacity="0"/>
      </linearGradient>
     </defs>
     <path className="flowLine fl1" d="M78,127 Q220,190 300,270"/>
     <path className="flowLine fl2" d="M165,382 Q245,320 300,270"/>
     <path className="flowLine fl3" d="M293,72 Q297,175 300,270"/>
     <path className="flowLine fl4" d="M432,382 Q365,320 300,270"/>
     <path className="flowLine fl5" d="M503,138 Q395,205 300,270"/>
    </svg>
    <div className="coreGlowWrap" style={{transform:`scale(${(0.85+step*0.06).toFixed(2)})`}}><div className="coreGlow"></div></div>
    <div className="orb orb1">📍</div><div className="orb orb2">📸</div><div className="orb orb3">🧩</div><div className="orb orb4">🏆</div><div className="orb orb5">📖</div>
    <div className="bookBuild"><span></span><span></span><span></span></div>
   </div>
   <div className="thinkingCopy"><div className="tag">{a.tag}</div><h1>{a.thinking[step]}</h1><p>{form.prompt}</p><div className="thinkingSteps">{a.thinking.map((x,i)=><i className={i<=step?"on":""} key={x}></i>)}</div></div>
  </section>;
 return <section className="aiCreate grid2" dir={dir}>
  <div className="panel">
   <div className="aiTop"><div className="tag">{a.tag}</div></div>
   <h1>{a.title}</h1><p>{a.desc}</p>
   <label>{a.prompt}</label><textarea className="aiPrompt" value={form.prompt} onChange={e=>setForm({...form,prompt:e.target.value})}/>
   <div className="fieldRow"><div><label>{a.type}</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value=""></option>{TYPE_OPTIONS[lang].map(x=><option key={x} value={x}>{x}</option>)}</select></div><div><label>{a.location}</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div></div>
   {isFamilyTrip?
    <div className="fieldRow"><div><label>{a.startDate}</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value,endDate:form.endDate&&form.endDate<e.target.value?"":form.endDate})}/></div><div><label>{a.endDate}</label><input type="date" min={form.startDate||undefined} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></div></div>
    :<div className="fieldRow"><div><label>{a.duration}</label><select value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}><option value=""></option>{DURATION_OPTIONS[lang].map(x=><option key={x} value={x}>{x}</option>)}</select></div><div><label>{a.people}</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/></div></div>}
   {isFamilyTrip&&<div className="fieldRow"><div><label>{a.days}</label><div className="tripLengthDisplay">{tripDays?a.tripLength(tripDays):"—"}</div></div><div><label>{a.people}</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/></div></div>}
   <label>{a.peopleDetails}</label><textarea className="peopleDetailsInput" placeholder={a.peopleDetailsPlaceholder} value={form.peopleDetails} onChange={e=>setForm({...form,peopleDetails:e.target.value})}/>
   {isFamilyTrip&&<label className="hotelCheck"><input type="checkbox" checked={form.hotelBooked} onChange={e=>setForm({...form,hotelBooked:e.target.checked})}/> {a.hotel}</label>}
   {isFamilyTrip&&<div className="interestsField"><label>{a.interests}</label><div className="chipRow">{Object.keys(a.interestOptions).map(key=><button type="button" key={key} className={"chip "+(form.interests.includes(key)?"selected":"")} onClick={()=>toggleInterest(key)}>{a.interestOptions[key]}</button>)}</div></div>}
   <div className="actions"><button onClick={()=>setView("create")}>{a.blank}</button><button className="primary aiBuildButton" onClick={build}>✦ {a.build}</button></div>
  </div>
  <div className="panel aiPromise"><div className="constellation">
    <svg className="constellationLines" viewBox="0 0 100 100" preserveAspectRatio="none">
     <defs>
      <linearGradient id="constLineGrad" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stopColor="#efc186" stopOpacity="0"/>
       <stop offset="50%" stopColor="#5fcdf8" stopOpacity=".95"/>
       <stop offset="100%" stopColor="#7d5cff" stopOpacity="0"/>
      </linearGradient>
     </defs>
     <path className="constLine cl1" vectorEffect="non-scaling-stroke" d="M15,28 Q25,20 35,14"/>
     <path className="constLine cl2" vectorEffect="non-scaling-stroke" d="M35,14 Q52,12 70,10"/>
     <path className="constLine cl3" vectorEffect="non-scaling-stroke" d="M35,14 Q44,24 53,32"/>
     <path className="constLine cl4" vectorEffect="non-scaling-stroke" d="M53,32 Q70,30 86,28"/>
     <path className="constLine cl5" vectorEffect="non-scaling-stroke" d="M70,10 Q84,9 95,10"/>
     <path className="constLine cl6" vectorEffect="non-scaling-stroke" d="M86,28 Q92,18 95,10"/>
    </svg>
    <span>📍</span><span>📸</span><span>❓</span><span>🧩</span><span>🏆</span><span>📖</span>
   </div><h2>{a.promiseTitle1}<br/>{a.promiseTitle2}</h2><p>{a.promiseDesc}</p></div>
 </section>
}
