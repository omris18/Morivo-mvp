"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import coordination from "../functions/coordination";
import {castLocationVote} from "../lib/morivoData";
import {tx} from "../lib/i18n";
export default function CoordinationPanel({experience,uid,name,votes,lang}){
 const polls=(experience.flow||[]).filter(coordination.isCoordinationMission);
 const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[drafts,setDrafts]=useState({}),[notice,setNotice]=useState("");
 const opened=useRef(null),L=(he,en)=>tx(lang,he,en);
 const pending=polls.filter(m=>!experience.locationDecisions?.[m.id]?.length);
 useEffect(()=>{setDrafts({});setNotice("");setError("")},[experience.id,uid]);
 useEffect(()=>{if(uid&&polls.length&&opened.current!==experience.id){opened.current=experience.id;if(pending.length){setIndex(polls.findIndex(m=>m.id===pending[0].id));setOpen(true)}}},[uid,experience.id,polls.length,pending.length]);
 useEffect(()=>{if(!open)return;const key=e=>{if(e.key==='Escape'&&!busy)setOpen(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[open,busy]);
 if(!polls.length)return null;
 const poll=polls[Math.min(index,polls.length-1)];
 const ownVote=votes.find(v=>v.uid===uid&&v.missionId===poll.id);
 const own=ownVote?.optionIds||[];
 const draft=drafts[poll.id]||{ids:own,suggestion:""};
 const selected=draft.ids,suggestion=draft.suggestion;
 const decided=experience.locationDecisions?.[poll.id]||[];
 const extras=votes.filter(v=>v.missionId===poll.id&&v.customOption).map(v=>v.customOption);
 const options=[...new Map([...(poll.options||[]),...extras].map(o=>[o.id,o])).values()];
 const canSubmit=!busy&&!decided.length&&(selected.length>0||!!suggestion.trim());
 function updateDraft(patch){setDrafts(prev=>({...prev,[poll.id]:{...draft,...patch}}));setError("");setNotice("")}
 function choose(id){if(busy||decided.length)return;updateDraft({ids:poll.isAttractionsPoll?(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]):selected.includes(id)?[]:[id],...(!poll.isAttractionsPoll?{suggestion:""}:{})})}
 async function submit(){
  if(!canSubmit)return;
  setBusy(true);setError("");
  try{
   const custom=suggestion.trim()?{id:`custom-${Date.now()}`,name:suggestion.trim(),why:""}:options.find(o=>selected.includes(o.id)&&o.id.startsWith('custom-'))||null;
   const ids=suggestion.trim()?(poll.isAttractionsPoll?[...selected,custom.id]:[custom.id]):selected;
   await castLocationVote(experience.id,poll.id,ids,name,custom);
   setDrafts(prev=>({...prev,[poll.id]:{ids,suggestion:""}}));
   setNotice(L("הבחירה נשלחה למארגן לאישור.","Your choice was sent to the organizer for approval."));
   const next=polls.findIndex((m,i)=>i>index&&!experience.locationDecisions?.[m.id]?.length);
   if(next>=0)setIndex(next);else setOpen(false);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="coordinationBanner" aria-label={L("תיאום לפני הטיול","Before the trip")}>
  <div><b>{L("מתאמים את הטיול יחד","Plan the trip together")}</b><p>{pending.length?L("ההעדפות שלכם מחכות לאישור המנהל — ההצבעות אינן חלק מהמשימות.","Share your preferences for organizer approval. Polls are separate from the journey."):L("המנהל אישר את הבחירות. אפשר לצפות בהחלטות.","The organizer approved the choices. View the decisions.")}</p>{notice&&<p role="status">{notice}</p>}</div>
  <button onClick={()=>setOpen(true)}>{L("הצבעות והחלטות","Polls and decisions")}</button>
  {open&&typeof document!=="undefined"&&createPortal(<div className="missionPopupOverlay" onClick={()=>!busy&&setOpen(false)}><section className="missionPopupCard coordinationDialog" role="dialog" aria-modal="true" aria-label={L("תיאום לפני הטיול","Before the trip")} dir={lang==='he'?'rtl':'ltr'} onClick={e=>e.stopPropagation()}>
   <button className="missionPopupClose" disabled={busy} aria-label={L("סגירה","Close")} onClick={()=>setOpen(false)}>×</button>
   <small>{L("לפני שיוצאים לדרך · ללא ניקוד או חלקי פאזל","Before departure · no points or puzzle pieces")}</small><h2>{poll.title}</h2>
   <div className="coordinationTabs">{polls.map((m,i)=><button key={m.id} disabled={busy} aria-pressed={i===index} onClick={()=>{setIndex(i);setError("")}}>{m.title}{experience.locationDecisions?.[m.id]?.length?' ✓':''}</button>)}</div>
   <p>{decided.length?L("בחירת המנהל אושרה","Organizer choice approved"):poll.isAttractionsPoll?L("סמנו אפשרות אחת או יותר, ואז לחצו על אישור ושליחה.","Select one or more options, then confirm and send."):L("סמנו אפשרות אחת, ואז לחצו על אישור ושליחה.","Select one option, then confirm and send.")}</p>
   <div className="locationPoll">{options.map(o=><div key={o.id} className="coordinationOption"><button disabled={busy||!!decided.length} aria-pressed={selected.includes(o.id)} className={'locationPollOption '+(selected.includes(o.id)?'selected':'')} onClick={()=>choose(o.id)}><b>{o.name||o.label}</b>{o.why&&<span>{o.why}</span>}<small>{decided.includes(o.id)?L("✓ אושר על ידי המנהל","✓ Organizer approved"):selected.includes(o.id)?L("✓ נבחר","✓ Selected"):L("בחירה","Choose")}</small></button>{o.url&&<a href={o.url} target="_blank" rel="noopener noreferrer">{L("פרטים נוספים ↗","More details ↗")}</a>}</div>)}</div>
   {!decided.length&&<div className="coordinationSuggestion"><label htmlFor={`suggestion-${poll.id}`}>{L("אפשרות אחרת (לא חובה)","Another option (optional)")}</label><p id={`suggestion-help-${poll.id}`}>{poll.isAttractionsPoll?L("לא מצאתם את האטרקציה שרציתם? כתבו כאן הצעה משלכם. היא תישלח למארגן יחד עם הבחירות שסימנתם.","Missing an attraction? Suggest one here. It will be sent to the organizer with your selected options."):L("מעדיפים מלון שלא מופיע ברשימה? כתבו כאן את שמו. ההצעה תישלח למארגן במקום מלון מהרשימה.","Prefer a hotel that is not listed? Enter its name here. Your suggestion replaces a hotel selected above.")}</p><input id={`suggestion-${poll.id}`} aria-describedby={`suggestion-help-${poll.id}`} disabled={busy} value={suggestion} maxLength={100} placeholder={poll.isAttractionsPoll?L("שם האטרקציה או ההצעה שלכם","Attraction name or your suggestion"):L("שם המלון שאתם מציעים","Your suggested hotel name")} onChange={e=>updateDraft({suggestion:e.target.value,...(!poll.isAttractionsPoll&&e.target.value.trim()?{ids:[]}:{})})}/></div>}
   {error&&<p role="alert">{error}</p>}{decided.length?<button className="primary" onClick={()=>index<polls.length-1?setIndex(index+1):setOpen(false)}>{index<polls.length-1?L("להצבעה הבאה ←","Next poll →"):L("חזרה למסע","Back to journey")}</button>:<button type="button" className="coordinationSubmit" disabled={!canSubmit} onClick={submit}>{busy?L("שולחים…","Sending…"):L("אישור ושליחה","Confirm and send")}</button>}
   <style jsx>{`.coordinationSuggestion{text-align:start;margin:20px 0;padding:16px;border:1px solid #41465e;border-radius:14px}.coordinationSuggestion label{display:block;font-weight:700}.coordinationSuggestion p{font-size:14px;line-height:1.6;color:#c3c9d9}.coordinationSuggestion input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #767e96;background:#fff;color:#182334;font:inherit}.coordinationSubmit{display:block;width:100%;padding:14px 20px;margin-top:20px;border:0;border-radius:14px;background:#16834a;color:#fff;font:inherit;font-weight:800;cursor:pointer}.coordinationSubmit:hover:not(:disabled){background:#116b3c}.coordinationSubmit:disabled{background:#626977;color:#e2e4e8;cursor:not-allowed}.coordinationSubmit:focus-visible{outline:3px solid #86efac;outline-offset:3px}`}</style>
  </section></div>,document.body)}
 </section>
}
