"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import coordination from "../functions/coordination";
import {castLocationVote} from "../lib/morivoData";
import {tx} from "../lib/i18n";
export default function CoordinationPanel({experience,uid,name,votes,lang}){
 const polls=(experience.flow||[]).filter(coordination.isCoordinationMission);
 const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[suggestion,setSuggestion]=useState("");
 const opened=useRef(null),L=(he,en)=>tx(lang,he,en);
 const pending=polls.filter(m=>!experience.locationDecisions?.[m.id]?.length);
 useEffect(()=>{if(uid&&polls.length&&opened.current!==experience.id){opened.current=experience.id;if(pending.length){setIndex(polls.findIndex(m=>m.id===pending[0].id));setOpen(true)}}},[uid,experience.id,polls.length,pending.length]);
 useEffect(()=>{if(!open)return;const key=e=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[open]);
 if(!polls.length)return null;
 const poll=polls[Math.min(index,polls.length-1)];
 const own=votes.find(v=>v.uid===uid&&v.missionId===poll.id)?.optionIds||[];
 const decided=experience.locationDecisions?.[poll.id]||[];
 const extras=votes.filter(v=>v.missionId===poll.id&&v.customOption).map(v=>v.customOption);
 const options=[...new Map([...(poll.options||[]),...extras].map(o=>[o.id,o])).values()];
 async function vote(id,custom){setBusy(true);setError("");try{const next=poll.isAttractionsPoll?(own.includes(id)?own.filter(x=>x!==id):[...own,id]):[id];await castLocationVote(experience.id,poll.id,next,name,custom||null);setSuggestion("")}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="coordinationBanner" aria-label={L("תיאום לפני הטיול","Before the trip")}>
  <div><b>{L("מתאמים את הטיול יחד","Plan the trip together")}</b><p>{pending.length?L("ההעדפות שלכם מחכות לאישור המנהל — ההצבעות אינן חלק מהמשימות.","Share your preferences for organizer approval. Polls are separate from the journey."):L("המנהל אישר את הבחירות. אפשר לצפות בהחלטות.","The organizer approved the choices. View the decisions.")}</p></div>
  <button onClick={()=>setOpen(true)}>{L("הצבעות והחלטות","Polls and decisions")}</button>
  {open&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" onClick={()=>setOpen(false)}><section className="missionPopupCard coordinationDialog" role="dialog" aria-modal="true" aria-label={L("תיאום לפני הטיול","Before the trip")} dir={lang==='he'?'rtl':'ltr'} onClick={e=>e.stopPropagation()}>
   <button className="missionPopupClose" aria-label={L("סגירה","Close")} onClick={()=>setOpen(false)}>×</button>
   <small>{L("לפני שיוצאים לדרך · ללא ניקוד או חלקי פאזל","Before departure · no points or puzzle pieces")}</small><h2>{poll.title}</h2>
   <div className="coordinationTabs">{polls.map((m,i)=><button key={m.id} aria-pressed={i===index} onClick={()=>{setIndex(i);setError("");setSuggestion("")}}>{m.title}{experience.locationDecisions?.[m.id]?.length?' ✓':''}</button>)}</div>
   <p>{decided.length?L("בחירת המנהל אושרה","Organizer choice approved"):poll.isAttractionsPoll?L("אפשר לבחור כמה אפשרויות. הבחירה נשמרת מיד.","Choose several options. Votes save immediately."):L("בחרו אפשרות אחת. הבחירה נשמרת מיד.","Choose one option. Your vote saves immediately.")}</p>
   <div className="locationPoll">{options.map(o=><div key={o.id} className="coordinationOption"><button disabled={busy||!!decided.length} aria-pressed={own.includes(o.id)} className={'locationPollOption '+(own.includes(o.id)?'selected':'')} onClick={()=>vote(o.id,o.id.startsWith('custom-')?o:null)}><b>{o.name||o.label}</b>{o.why&&<span>{o.why}</span>}<small>{decided.includes(o.id)?L("✓ אושר על ידי המנהל","✓ Organizer approved"):own.includes(o.id)?L("✓ הבחירה שלכם נשמרה","✓ Your vote is saved"):L("בחירה","Choose")}</small></button>{o.url&&<a href={o.url} target="_blank" rel="noopener noreferrer">{L("פרטים נוספים ↗","More details ↗")}</a>}</div>)}</div>
   {!decided.length&&!poll.isAttractionsPoll&&<div className="locationPollSuggest"><input aria-label={L("הצעה משלכם","Your suggestion")} value={suggestion} maxLength={100} onChange={e=>setSuggestion(e.target.value)}/><button disabled={busy||!suggestion.trim()} onClick={()=>{const o={id:`custom-${Date.now()}`,name:suggestion.trim(),why:""};vote(o.id,o)}}>{L("שליחת הצעה","Suggest")}</button></div>}
   {error&&<p role="alert">{error}</p>}<button className="primary" onClick={()=>index<polls.length-1?setIndex(index+1):setOpen(false)}>{index<polls.length-1?L("להצבעה הבאה ←","Next poll →"):L("חזרה למסע","Back to journey")}</button>
  </section></div>,document.body)}
 </section>
}
