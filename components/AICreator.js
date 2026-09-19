"use client";
import {useEffect,useMemo,useState} from "react";
import {httpsCallable} from "firebase/functions";
import {firebaseConfigured,functions} from "../lib/firebase";
import {createExperienceRemote,ensureUser} from "../lib/morivoData";

const COPY={
 en:{tag:"Morivo AI",title:"Describe the experience. Morivo builds the journey.",desc:"Tell us who it is for, where it happens and what you want them to feel.",prompt:"Describe your experience",type:"Experience type",location:"Location",duration:"Duration",people:"Participants",build:"Build my experience",blank:"Start blank instead",thinking:["Understanding the people…","Finding the story…","Designing the route…","Creating missions…","Balancing rewards…","Assembling your experience…"],ready:"Your first draft is ready."},
 he:{tag:"Morivo AI",title:"תארו את החוויה. Morivo יבנה את המסע.",desc:"ספרו לנו למי החוויה, איפה היא מתקיימת ומה הייתם רוצים שהם ירגישו.",prompt:"תיאור החוויה",type:"סוג החוויה",location:"מיקום",duration:"משך",people:"משתתפים",build:"בנו לי חוויה",blank:"התחלה מחוויה ריקה",thinking:["לומד את האנשים…","מוצא את הסיפור…","מתכנן את המסלול…","יוצר משימות…","מאזן תגמולים…","מרכיב את החוויה…"],ready:"הטיוטה הראשונה מוכנה."}
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
 const [lang,setLang]=useState("en"),[form,setForm]=useState({prompt:"",type:"",location:"",duration:"",people:""}),[building,setBuilding]=useState(false),[step,setStep]=useState(0);
 const t=COPY[lang];
 useEffect(()=>{if(!building)return;const id=setInterval(()=>setStep(x=>Math.min(x+1,t.thinking.length-1)),900);return()=>clearInterval(id)},[building,lang]);
 async function build(){
  if(!form.prompt.trim())return alert(lang==="he"?"כתבו כמה מילים על החוויה":"Describe the experience first");
  setBuilding(true);setStep(0);
  const minWait=new Promise(r=>setTimeout(r,Math.max(4200,t.thinking.length*700)));
  let flow,name,usedAI=false;
  if(firebaseConfigured){
   try{
    await ensureUser();
    const generate=httpsCallable(functions,"generateExperience");
    const result=await generate({prompt:form.prompt,type:form.type,location:form.location,duration:form.duration,people:form.people,lang});
    flow=result.data.flow;name=result.data.name;usedAI=true;
   }catch(e){console.error("AI generation failed, falling back to the draft generator",e)}
  }
  if(!flow){
   flow=generateDraft(form);
   name=form.prompt.trim().split(/[.!?\n]/)[0].slice(0,48)||"New Experience";
  }
  await minWait;
  const data={name,type:form.type,location:form.location,people:Number(form.people||0),story:form.prompt,flow,status:"draft",aiGenerated:usedAI};
  try{
   if(firebaseConfigured){
    const u=user||await ensureUser(),id=await createExperienceRemote(u.uid,data);
    setExperience({...data,id,ownerUid:u.uid});setActiveId(id);
   }else setExperience({...data,id:"local-"+Date.now()});
   setView("studio");
  }catch(e){alert(e.message);setBuilding(false)}
 }
 if(building)return <section className={"aiThinking "+(lang==="he"?"rtl":"")} dir={lang==="he"?"rtl":"ltr"}>
   <div className="thinkingWorld">
    <div className="route route1"></div><div className="route route2"></div>
    <div className="orb orb1">✦</div><div className="orb orb2">📍</div><div className="orb orb3">📸</div><div className="orb orb4">🧩</div><div className="orb orb5">📖</div>
    <div className="bookBuild"><span></span><span></span><span></span></div>
   </div>
   <div className="thinkingCopy"><div className="tag">{t.tag}</div><h1>{t.thinking[step]}</h1><p>{form.prompt}</p><div className="thinkingSteps">{t.thinking.map((x,i)=><i className={i<=step?"on":""} key={x}></i>)}</div></div>
  </section>;
 return <section className={"aiCreate grid2 "+(lang==="he"?"rtl":"")} dir={lang==="he"?"rtl":"ltr"}>
  <div className="panel">
   <div className="aiTop"><div className="tag">{t.tag}</div><div className="langSwitch"><button className={lang==="en"?"active":""} onClick={()=>setLang("en")}>EN</button><button className={lang==="he"?"active":""} onClick={()=>setLang("he")}>עברית</button></div></div>
   <h1>{t.title}</h1><p>{t.desc}</p>
   <label>{t.prompt}</label><textarea className="aiPrompt" value={form.prompt} onChange={e=>setForm({...form,prompt:e.target.value})}/>
   <div className="fieldRow"><div><label>{t.type}</label><input value={form.type} onChange={e=>setForm({...form,type:e.target.value})}/></div><div><label>{t.location}</label><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></div></div>
   <div className="fieldRow"><div><label>{t.duration}</label><input value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></div><div><label>{t.people}</label><input type="number" value={form.people} onChange={e=>setForm({...form,people:e.target.value})}/></div></div>
   <div className="actions"><button onClick={()=>setView("create")}>{t.blank}</button><button className="primary aiBuildButton" onClick={build}>✦ {t.build}</button></div>
  </div>
  <div className="panel aiPromise"><div className="constellation"><span>📍</span><span>📸</span><span>❓</span><span>🧩</span><span>🏆</span><span>📖</span></div><h2>One description.<br/>A complete journey.</h2><p>Morivo turns context into chapters, missions, rewards and memories — then opens everything in Studio for you to edit.</p></div>
 </section>
}
