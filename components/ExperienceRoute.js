"use client";
import {Fragment,useEffect,useRef,useState} from "react";
import {generateExperienceArtworkRemote,uploadCelebrationPortrait,updateExperienceRemote} from "../lib/morivoData";
import {firebaseConfigured} from "../lib/firebase";
import artContext from "../functions/experienceArtContext";
import {getExperienceTheme,VISUAL_THEMES,missionDone,missionActive,journeyFinished} from "../lib/experienceVisuals";
import RouteMissionPanel from "./RouteMissionPanel";
import DestinationBackdrop from "./DestinationBackdrop";
import LinkifiedText from "./LinkifiedText";
const icons={photo:"📸",video:"🎬",map:"🗺️",quiz:"🧩",puzzle:"🔐",note:"✍️",story:"📖",reward:"🏆"};
export default function ExperienceRoute({experience,people=[],media=[],answers=[],onMemory,onStudio,onTheme,onSwap,onSaveMission,lang}){
 const he=lang==="he",flow=experience.flow||[],theme=getExperienceTheme(experience);
 const [selected,setSelected]=useState(experience.flow?.[0]?.id||null),[saving,setSaving]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(!flow.some(m=>m.id===selected))setSelected(flow[0]?.id||null)},[flow,selected]);
 const [artStatus,setArtStatus]=useState("idle"),[artError,setArtError]=useState("");
 const [reordering,setReordering]=useState(false),[dragging,setDragging]=useState(null),[dirty,setDirty]=useState(false),[orderNotice,setOrderNotice]=useState("");
 function selectMission(id){if(id===selected)return;if(dirty&&!window.confirm(he?"לעבור לתחנה אחרת ולוותר על השינויים שלא נשמרו?":"Discard unsaved changes and open another stop?"))return;setDirty(false);setSelected(id)}
 async function swap(a,b){if(!onSwap||a===b||reordering)return;setReordering(true);setError("");try{await onSwap(a,b);setOrderNotice(he?"סדר התחנות נשמר. ההתקדמות נשארה משויכת למשימות.":"Stop order saved. Progress stays linked to each mission.")}catch(e){setError(e.message);throw e}finally{setReordering(false);setDragging(null)}}
 const attempted=useRef("");
 const context=artContext.experienceArtContext(experience),automatic=!experience.visualTheme||experience.visualTheme==="auto";
 const artReady=experience.routeArtwork?.context===context&&experience.routeArtwork?.url;
 const canGenerate=!!onTheme&&firebaseConfigured&&experience.id&&!experience.id.startsWith("local-")&&experience.id!=="thailand-demo";
 async function generateBackground(){setArtStatus("loading");setArtError("");try{await generateExperienceArtworkRemote(experience.id);setArtStatus("ready")}catch(e){setArtStatus("error");setArtError(he?"לא הצלחנו ליצור את הרקע כרגע. מוצגת בינתיים תמונת הסגנון; אפשר לנסות שוב.":"Background creation failed. Showing the style image for now; you can retry.")}}
 useEffect(()=>{const key=experience.id+context;if(automatic&&canGenerate&&!artReady&&(experience.name||experience.location)&&attempted.current!==key){attempted.current=key;generateBackground()}},[automatic,canGenerate,context,artReady,experience.id]);
 const index=Math.max(0,flow.findIndex(m=>m.id===selected)),mission=flow[index];
 const finished=people.filter(p=>!p.pending&&journeyFinished(p,flow)).length;
 const groups=(()=>{
  const isThailand=/(תאילנד|thailand|פוקט|phuket)/i.test(String(`${experience.name||""} ${experience.location||""} ${experience.story||""}`));
  if(isThailand&&flow.length>=20){
   const buckets=[["פוקט",0,6],["קאו לאק",7,8],["קראבי",9,10],["קו סמוי",11,16],["פאטאיה",17,20],["בנגקוק",21,23],["חזרה לישראל",24,999]];
   return buckets.map(([label,a,b])=>({key:`thai-${label}`,label,destination:label,missions:flow.slice(a,Math.min(flow.length,b+1)).map((m,i)=>({m,i:a+i}))})).filter(g=>g.missions.length);
  }
  const explicit=Array.isArray(experience.destinations)?experience.destinations.map(String).filter(Boolean):[];
  const inferred=[...new Set(flow.flatMap(x=>{const t=String(`${x.title||""} ${x.text||""}`);return [...t.matchAll(/(?:להתארח|טיול|פארק|ב)(?:\s|-)?([א-ת]{3,})/g)].map(m=>m[1]);}))];
  const destinations=[...explicit,...inferred].filter((d,i,a)=>d&&a.findIndex(x=>x.toLocaleLowerCase()===d.toLocaleLowerCase())===i);
  const out=[]; flow.forEach((m,i)=>{
   const text=String(`${m.title||""} ${m.text||""} ${m.description||""}`).toLocaleLowerCase();
   const destination=String(m.destination||destinations.find(d=>String(d).split(/[,\s]+/).some(w=>w.length>2&&text.includes(w.toLocaleLowerCase())))||"").trim();
   const rawDay=m.day||m.dayNumber||((m.title||"").match(/(?:day|יום)\s*([0-9]+)/i)?.[1]);
   const key=destination?`destination-${destination}`:rawDay?`day-${rawDay}`:"general";
   let g=out.find(x=>x.key===key); if(!g){g={key,label:destination|| (rawDay?(he?`יום ${rawDay}`:`Day ${rawDay}`):(he?"משימות פתיחה":"Starting missions")),destination,missions:[]};out.push(g)} g.missions.push({m,i});
  }); return out;
 })();
 const nextIndex=flow.findIndex((m,i)=>people.some(p=>!p.pending&&missionActive(p,m,flow)));
 return <section className="experienceRoute" style={{"--route-accent":theme.accent}}>
  <div className="routeHeading"><div><span className="routeEyebrow">{he?"המסלול שלכם":"YOUR EXPERIENCE ROUTE"}</span><h3>{experience.location||experience.name||(he?"כל מסע מתחיל ברגע אחד":"Every journey starts with a moment")}</h3><p>{he?"תרשים התקדמות לפי סדר המשימות · אינו מפת ניווט":"Progress along your missions · schematic, not a navigation map"}</p></div>
   {onTheme&&<label className="routeThemePicker">{he?"סגנון המסלול":"Route style"}<select value={experience.visualTheme||"auto"} disabled={saving} onChange={async e=>{setSaving(true);setError("");try{await onTheme(e.target.value)}catch(e){setError(e.message)}finally{setSaving(false)}}}><option value="auto">{he?"התאמה אוטומטית ליעד":"Automatic by destination"}</option>{Object.entries(VISUAL_THEMES).map(([key,x])=><option key={key} value={key}>{he?x.he:x.en}</option>)}</select></label>}
  </div>
  {error&&<p role="alert">{error}</p>}
  {onSwap&&flow.length>1&&<div className="routeReorderHint"><span>{he?"גררו תחנה על תחנה אחרת כדי להחליף ביניהן, או בחרו החלפת מיקום בחלונית התחנה. במקלדת: Alt + חץ למעלה/למטה.":"Drag one stop onto another to swap, or use the stop panel. Keyboard: Alt + Up/Down."}</span><span role="status">{reordering?(he?"שומרים את הסדר…":"Saving order…"):orderNotice}</span></div>}
  {automatic&&<div className="routeArtStatus" role="status">{artReady?(he?"רקע AI אישי לפי שם החוויה והמיקום · איור להמחשה":"Personal AI background based on your experience · illustration"):artStatus==="loading"?(he?"יוצרים את הרקע האישי שלכם… בינתיים מוצגת תמונת הסגנון.":"Creating your personal background… showing the style image meanwhile."):artError||(!canGenerate?(he?"הרקע האישי ייווצר אחרי שמירת החוויה בידי המארגן.":"Your personal background will be created after the organizer saves the experience."):"")}{artStatus==="error"&&canGenerate&&<button type="button" onClick={generateBackground}>{he?"ניסיון נוסף":"Retry"}</button>}</div>}
  {theme.key==="celebration"&&onTheme&&<div className="routePortraitUpload"><label>{he?"שילוב תמונת ילד/ת יום ההולדת":"Add the birthday child's photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canGenerate||saving} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setSaving(true);setError("");try{await uploadCelebrationPortrait(experience.id,file)}catch(e){setError(e.message)}finally{setSaving(false)}}}/></label><small>{he?"תמונה לבחירתכם במסגרת חגיגית, ללא שינוי הפנים. השתמשו בתמונה שיש לכם רשות להציג.":"Your chosen photo in a festive frame, without changing the face. Use a photo you have permission to show."}</small>{experience.celebrationPortrait?.url&&<button type="button" disabled={saving} onClick={async()=>{setSaving(true);try{await updateExperienceRemote(experience.id,{celebrationPortrait:null})}catch(e){setError(e.message)}finally{setSaving(false)}}}>{he?"הסרת התמונה מהעיצוב":"Remove photo from design"}</button>}</div>}
  {flow.length?<div className="routeLayout">
   <div className="routeJourneyMap" aria-label={he?"מפת המסע לפי ימים ויעדים":"Journey map by days and destinations"}>
    <div className="routeMapLegend"><span><i className="legendDone">✓</i>{he?"הושלם":"Completed"}</span><span><i className="legendCurrent">●</i>{he?"מתבצע עכשיו":"In progress"}</span><span><i className="legendNext">→</i>{he?"המשימה הבאה":"Next"}</span></div>
    {groups.map(g=><section className="routeDayGroup" key={g.key}><header><span className="routeDayBadge">{g.label}</span>{g.destination&&<small>{g.destination}</small>}</header><div className="routeMissionCircles">{g.missions.map(({m,i},stopIndex)=><Fragment key={m.id}><button className={"routeMissionCircle "+(people.length>0&&people.every(p=>p.pending||missionDone(p,m,i)?true:false)?"isDone ":"")+(people.some(p=>!p.pending&&missionActive(p,m,flow))?"isCurrent ":"")+(!people.some(p=>!p.pending&&missionActive(p,m,flow))&&i===nextIndex?"isNext ":"")} onClick={()=>selectMission(m.id)} aria-pressed={i===index} title={m.title}><span className="circleNumber">{people.length>0&&people.every(p=>p.pending||missionDone(p,m,i))?"✓":i+1}</span><span className="circleIcon">{icons[m.type]||theme.motif}</span><b>{m.title}</b><small>{people.length>0&&people.every(p=>p.pending||missionDone(p,m,i))?(he?"הושלם":"Done"):people.some(p=>!p.pending&&missionActive(p,m,flow))?(he?"עכשיו":"Now"):i===nextIndex?(he?"הבא":"Next"):(he?"ממתינה":"Upcoming")}</small></button></Fragment>)}</div></section>)}
   </div>
   <div className="routeDetail">
    <RouteMissionPanel key={mission.id} mission={mission} index={index} flow={flow} people={people} media={media} answers={answers} onSave={onSaveMission} onSwap={onSwap?swap:undefined} onDirtyChange={setDirty} lang={lang}/>
    <button className="routeBookButton" onClick={onMemory}>{he?"פתיחת ספר הזיכרונות":"Open memory book"}</button>
    <small>{finished?he?finished+" משתתפים סיימו את המסע":finished+" participants finished":he?"הספר נאסף אוטומטית לאורך החוויה":"Your book is collected automatically throughout the experience"}</small>
   </div>
  </div>:<div className="routeEmpty"><DestinationBackdrop theme={theme}/><div><h3>{he?"המסלול שלכם עוד רגע מתחיל":"Your route is about to begin"}</h3><p>{he?"הוסיפו משימות לחוויה כדי לראות כאן תחנות, משתתפים וזיכרונות.":"Add missions to see your stops, participants and memories here."}</p><button onClick={onStudio}>{he?"בניית המסלול בסטודיו":"Build your route in Studio"}</button></div></div>}
 <style jsx global>{` .experienceRoute .routeJourneyMap{position:relative;overflow:hidden;background:linear-gradient(135deg,#f3fbf4,#fff8e9 52%,#eef5ff);border:1px solid #cfe3d6;border-radius:30px;box-shadow:0 18px 45px rgba(39,91,76,.12)} .experienceRoute .routeJourneyMap:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 15% 18%,rgba(251,190,94,.2),transparent 24%),radial-gradient(circle at 86% 80%,rgba(91,155,220,.16),transparent 28%);pointer-events:none} .experienceRoute .routeDayGroup{position:relative;z-index:1;padding:18px 0 25px}.experienceRoute .routeDayGroup+.routeDayGroup{border-top:1px dashed #c7ded1}.experienceRoute .routeMissionCircles{display:grid;grid-template-columns:repeat(4,minmax(105px,1fr));gap:14px}.experienceRoute .routeMissionCircle{width:100%;min-height:132px;border-radius:22px;background:rgba(255,255,255,.93);border:2px solid #d1e4d7;box-shadow:0 8px 18px rgba(38,91,73,.11)}experienceRoute .routeMissionCircle.isDone{background:#effbf2;border-color:#7fc995}.experienceRoute .routeMissionCircle.isCurrent{background:#fff0df;border-color:#ee994d;box-shadow:0 0 0 4px rgba(238,153,77,.2)}.experienceRoute .routeMissionCircle.isNext{background:#edf6ff;border-color:#76a9db}.experienceRoute .routeConnector{display:none}@media(max-width:700px){.experienceRoute .routeMissionCircles{grid-template-columns:repeat(2,minmax(110px,1fr))}.experienceRoute .routeMissionCircle:nth-of-type(4n):after{display:block}.experienceRoute .routeMissionCircle:nth-of-type(2n):after{display:none}} `}</style>
 </section>;
}
