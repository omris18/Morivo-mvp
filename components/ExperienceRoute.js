"use client";
import {useEffect,useRef,useState} from "react";
import {generateExperienceArtworkRemote,uploadCelebrationPortrait,updateExperienceRemote} from "../lib/morivoData";
import {firebaseConfigured} from "../lib/firebase";
import artContext from "../functions/experienceArtContext";
import {getExperienceTheme,VISUAL_THEMES,missionDone,missionActive,journeyFinished} from "../lib/experienceVisuals";
import RouteMissionPanel from "./RouteMissionPanel";
import DestinationBackdrop from "./DestinationBackdrop";
import LinkifiedText from "./LinkifiedText";
const icons={photo:"📷",video:"▶",map:"⌖",quiz:"?",puzzle:"◇",note:"✎",story:"▤",reward:"✦"};
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
 const points=flow.map((m,i)=>({x:((Math.floor(i/2)%2===0?i%2:1-i%2)===0?25:75),y:90+Math.floor(i/2)*160}));
 const height=Math.max(310,Math.ceil(flow.length/2)*160+40);
 const path=points.map((p,i)=>i===0?`M ${p.x*10} ${p.y}`:`L ${p.x*10} ${p.y}`).join(" ");
 return <section className="experienceRoute" style={{"--route-accent":theme.accent}}>
  <div className="routeHeading"><div><span className="routeEyebrow">{he?"המסלול שלכם":"YOUR EXPERIENCE ROUTE"}</span><h3>{experience.location||experience.name||(he?"כל מסע מתחיל ברגע אחד":"Every journey starts with a moment")}</h3><p>{he?"תרשים התקדמות לפי סדר המשימות · אינו מפת ניווט":"Progress along your missions · schematic, not a navigation map"}</p></div>
   {onTheme&&<label className="routeThemePicker">{he?"סגנון המסלול":"Route style"}<select value={experience.visualTheme||"auto"} disabled={saving} onChange={async e=>{setSaving(true);setError("");try{await onTheme(e.target.value)}catch(e){setError(e.message)}finally{setSaving(false)}}}><option value="auto">{he?"התאמה אוטומטית ליעד":"Automatic by destination"}</option>{Object.entries(VISUAL_THEMES).map(([key,x])=><option key={key} value={key}>{he?x.he:x.en}</option>)}</select></label>}
  </div>
  {error&&<p role="alert">{error}</p>}
  {onSwap&&flow.length>1&&<div className="routeReorderHint"><span>{he?"גררו תחנה על תחנה אחרת כדי להחליף ביניהן, או בחרו החלפת מיקום בחלונית התחנה. במקלדת: Alt + חץ למעלה/למטה.":"Drag one stop onto another to swap, or use the stop panel. Keyboard: Alt + Up/Down."}</span><span role="status">{reordering?(he?"שומרים את הסדר…":"Saving order…"):orderNotice}</span></div>}
  {automatic&&<div className="routeArtStatus" role="status">{artReady?(he?"רקע AI אישי לפי שם החוויה והמיקום · איור להמחשה":"Personal AI background based on your experience · illustration"):artStatus==="loading"?(he?"יוצרים את הרקע האישי שלכם… בינתיים מוצגת תמונת הסגנון.":"Creating your personal background… showing the style image meanwhile."):artError||(!canGenerate?(he?"הרקע האישי ייווצר אחרי שמירת החוויה בידי המארגן.":"Your personal background will be created after the organizer saves the experience."):"")}{artStatus==="error"&&canGenerate&&<button type="button" onClick={generateBackground}>{he?"ניסיון נוסף":"Retry"}</button>}</div>}
  {theme.key==="celebration"&&onTheme&&<div className="routePortraitUpload"><label>{he?"שילוב תמונת ילד/ת יום ההולדת":"Add the birthday child's photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canGenerate||saving} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setSaving(true);setError("");try{await uploadCelebrationPortrait(experience.id,file)}catch(e){setError(e.message)}finally{setSaving(false)}}}/></label><small>{he?"תמונה לבחירתכם במסגרת חגיגית, ללא שינוי הפנים. השתמשו בתמונה שיש לכם רשות להציג.":"Your chosen photo in a festive frame, without changing the face. Use a photo you have permission to show."}</small>{experience.celebrationPortrait?.url&&<button type="button" disabled={saving} onClick={async()=>{setSaving(true);try{await updateExperienceRemote(experience.id,{celebrationPortrait:null})}catch(e){setError(e.message)}finally{setSaving(false)}}}>{he?"הסרת התמונה מהעיצוב":"Remove photo from design"}</button>}</div>}
  {flow.length?<div className="routeLayout">
   <div className="routeScroll"><div className="routeBoard" style={{height}}><DestinationBackdrop theme={theme}/><div className="routeVeil"/>
    <svg className="routePath" viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true"><path d={path}/></svg>
    {flow.map((m,i)=>{const completed=people.filter(p=>missionDone(p,m,i)).length,here=people.filter(p=>missionActive(p,m,flow)).length;return <button key={m.id} draggable={!!onSwap&&!reordering} disabled={reordering} onDragStart={e=>{e.dataTransfer.setData("text/plain",m.id);e.dataTransfer.effectAllowed="move";setDragging(m.id)}} onDragEnd={()=>setDragging(null)} onDragOver={e=>{if(onSwap&&dragging!==m.id){e.preventDefault();e.dataTransfer.dropEffect="move"}}} onDrop={e=>{e.preventDefault();const from=e.dataTransfer.getData("text/plain");if(flow.some(x=>x.id===from))swap(from,m.id).catch(()=>{})}} onKeyDown={e=>{if(onSwap&&e.altKey&&["ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();const other=flow[i+(e.key==="ArrowUp"?-1:1)];if(other)swap(m.id,other.id).catch(()=>{})}}} className={"routeStop "+(i===index?"selected":"")+(completed?" visited":"")+(dragging===m.id?" dragging":"")} style={{left:points[i].x+"%",top:points[i].y}} onClick={()=>selectMission(m.id)} aria-pressed={i===index} title={onSwap?(he?"לחיצה לניהול · גרירה להחלפת מיקום":"Click to manage · drag to swap"):undefined}><span className="routeStopNumber">{i+1}</span><span className="routeStopIcon" aria-hidden="true">{icons[m.type]||theme.motif}</span><strong>{m.title}</strong><small>{here?he?here+" בתחנה":here+" here":completed?he?completed+" השלימו":completed+" completed":he?"ממתינה":"Upcoming"}</small></button>})}
   </div></div>
   <div className="routeDetail">
    <RouteMissionPanel key={mission.id} mission={mission} index={index} flow={flow} people={people} media={media} answers={answers} onSave={onSaveMission} onSwap={onSwap?swap:undefined} onDirtyChange={setDirty} lang={lang}/>
    <button className="routeBookButton" onClick={onMemory}>{he?"פתיחת ספר הזיכרונות":"Open memory book"}</button>
    <small>{finished?he?finished+" משתתפים סיימו את המסע":finished+" participants finished":he?"הספר נאסף אוטומטית לאורך החוויה":"Your book is collected automatically throughout the experience"}</small>
   </div>
  </div>:<div className="routeEmpty"><DestinationBackdrop theme={theme}/><div><h3>{he?"המסלול שלכם עוד רגע מתחיל":"Your route is about to begin"}</h3><p>{he?"הוסיפו משימות לחוויה כדי לראות כאן תחנות, משתתפים וזיכרונות.":"Add missions to see your stops, participants and memories here."}</p><button onClick={onStudio}>{he?"בניית המסלול בסטודיו":"Build your route in Studio"}</button></div></div>}
 </section>;
}
