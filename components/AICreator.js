"use client";
import {useEffect,useMemo,useState} from "react";
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
const DAY_OPTIONS={
 en:["1 day","2 days","3 days","4 days","5 days","6 days","7 days","8-14 days","15+ days"],
 he:["יום אחד","יומיים","3 ימים","4 ימים","5 ימים","6 ימים","שבוע (7 ימים)","8-14 ימים","15+ ימים"]
};

const COPY={
 en:{tag:"Morivo AI",title:"Describe the experience. Morivo builds the journey.",desc:"Tell us who it is for, where it happens and what you want them to feel.",prompt:"Describe your experience",type:"Experience type",location:"Location",duration:"Duration",days:"Trip length",people:"Participants",hotel:"Already booked a hotel?",build:"Build my experience",blank:"Start blank instead",thinking:["Understanding the people…","Finding the story…","Designing the route…","Creating missions…","Balancing rewards…","Assembling your experience…"],ready:"Your first draft is ready."},
 he:{tag:"Morivo AI",title:"תארו את החוויה. Morivo יבנה את המסע.",desc:"ספרו לנו למי החוויה, איפה היא מתקיימת ומה הייתם רוצים שהם ירגישו.",prompt:"תיאור החוויה",type:"סוג החוויה",location:"מיקום",duration:"משך",days:"אורך הטיול",people:"משתתפים",hotel:"כבר הזמנתם מלון?",build:"בנו לי חוויה",blank:"התחלה מחוויה ריקה",thinking:["לומד את האנשים…","מוצא את הסיפור…","מתכנן את המסלול…","יוצר משימות…","מאזן תגמולים…","מרכיב את החוויה…"],ready:"הטיוטה הראשונה מוכנה."}
};

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

export default function AICreator({setExperience,setView,setActiveId,user}){
 const [lang,setLang]=useState("en"),[form,setForm]=useState({prompt:"",type:"",location:"",duration:"",people:"",hotelBooked:false}),[building,setBuilding]=useState(false),[step,setStep]=useState(0);
 const t=COPY[lang];
 const isFamilyTrip=form.type===TYPE_OPTIONS.en[0]||form.type===TYPE_OPTIONS.he[0];
 useEffect(()=>{if(!building)return;const id=setInterval(()=>setStep(x=>Math.min(x+1,t.thinking.length-1)),900);return()=>clearInterval(id)},[building,lang]);
 async function build(){
  if(!form.prompt.trim())return alert(lang==="he"?"כתבו כמה מילים על החוויה":"Describe the experience first");
  if(!firebaseConfigured)return alert(lang==="he"?"AI אמיתי דורש חיבור ל-Firebase. כרגע האפליקציה במצב Demo (בדקי את המשתנים ב-Vercel/.env.local).":"Real AI requires a Firebase connection. The app is currently in Demo mode (check your Vercel/.env.local environment variables).");
  setBuilding(true);setStep(0);
  const minWait=new Promise(r=>setTimeout(r,Math.max(4200,t.thinking.length*700)));
  let flow,name,usedAI=false,aiError=null;
  try{
   await ensureUser();
   const generate=httpsCallable(functions,"generateExperience");
   const needsHotel=isFamilyTrip&&!form.hotelBooked;
   const result=await generate({prompt:form.prompt,type:form.type,location:form.location,duration:form.duration,people:form.people,lang,multiDay:isFamilyTrip,needsHotel});
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
  const data={name,type:form.type,location:form.location,people:Number(form.people||0),story:form.prompt,flow,status:"draft",aiGenerated:usedAI};
  try{
   const u=user||await ensureUser(),id=await createExperienceRemote(u.uid,data);
   setExperience({...data,id,ownerUid:u.uid});setActiveId(id);
   setView("studio");
   if(aiError)alert((lang==="he"?"שימו לב: ה-AI האמיתי לא הגיב, נוצרה טיוטה גנרית במקום.\n\nסיבת הכשל: ":"Note: the real AI didn't respond, a generic placeholder draft was used instead.\n\nFailure reason: ")+aiError);
  }catch(e){alert(e.message);setBuilding(false)}
 }
 if(building)return <section className={"aiThinking "+(lang==="he"?"rtl":"")} dir={lang==="he"?"rtl":"ltr"}>
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
   <div className="thinkingCopy"><div className="tag">{t.tag}</div><h1>{t.thinking[step]}</h1><p>{form.prompt}</p><div className="thinkingSteps">{t.thinking.map((x,i)=><i className={i<=step?"on":""} key={x}></i>)}</div></div>
  </section>;
 return <section className={"aiCreate grid2 "+(lang==="he"?"rtl":"")} dir={lang==="he"?"rtl":"ltr"}>
  <div className="panel">
   <div className="aiTop"><div className="tag">{t.tag}</div><div className="langSwitch"><button className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button><button className={lang==="he"?"active":""} onClick={()=>setLang("he")}>עברית</button></div></div>
   <h1>{t.title}</h1><p>{t.desc}</p>
   <label>{t.prompt}</label><textarea className="aiPrompt" value={form.prompt} onChange={e=>setForm({...form,prompt:e.target.value})}/>
   <div className="fieldRow"><div><label>{t.type}</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value=""></option>{TYPE_OPTIONS[lang].map(x=><option key={x} value={x}>{x}</option>)}</select></div><div><label>{t.location}</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div></div>
   <div className="fieldRow"><div><label>{isFamilyTrip?t.days:t.duration}</label><select value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}><option value=""></option>{(isFamilyTrip?DAY_OPTIONS:DURATION_OPTIONS)[lang].map(x=><option key={x} value={x}>{x}</option>)}</select></div><div><label>{t.people}</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/></div></div>
   {isFamilyTrip&&<label className="hotelCheck"><input type="checkbox" checked={form.hotelBooked} onChange={e=>setForm({...form,hotelBooked:e.target.checked})}/> {t.hotel}</label>}
   <div className="actions"><button onClick={()=>setView("create")}>{t.blank}</button><button className="primary aiBuildButton" onClick={build}>✦ {t.build}</button></div>
  </div>
  <div className="panel aiPromise"><div className="constellation"><span>📍</span><span>📸</span><span>❓</span><span>🧩</span><span>🏆</span><span>📖</span></div><h2>One description.<br/>A complete journey.</h2><p>Morivo turns context into chapters, missions, rewards and memories — then opens everything in Studio for you to edit.</p></div>
 </section>
}
