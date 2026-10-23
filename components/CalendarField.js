"use client";
import {useEffect,useRef,useState} from "react";

function pad2(n){return String(n).padStart(2,"0")}
function toISO(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`}
function parseISO(s){if(!s)return null;const [y,m,d]=String(s).split("-").map(Number);if(!y||!m||!d)return null;return new Date(y,m-1,d)}
function startOfMonth(d){return new Date(d.getFullYear(),d.getMonth(),1)}
function addMonths(d,n){return new Date(d.getFullYear(),d.getMonth()+n,1)}
function sameDay(a,b){return !!a&&!!b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}

// A native <input type="date"> can't show a given month without also pre-filling a value - its
// picker always opens on "today" when empty, with no way to point it at a different month. That's
// exactly what broke the trip-dates step: picking a June start date left the (still empty) end
// date field opening on the real-world current month instead. This custom popover keeps the
// field genuinely empty until the organizer picks a day, while letting the displayed month follow
// the `min` prop (the trip's start date) instead of always defaulting to today.
export default function CalendarField({value,onChange,min,lang,dir,label,placeholder}){
 const locale=lang==="he"?"he-IL":(lang||"en-US");
 const [open,setOpen]=useState(false);
 const minDate=parseISO(min);
 const valueDate=parseISO(value);
 const [viewDate,setViewDate]=useState(()=>startOfMonth(valueDate||minDate||new Date()));
 const rootRef=useRef(null);

 useEffect(()=>{
  if(!value&&minDate)setViewDate(startOfMonth(minDate));
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[min]);

 useEffect(()=>{
  if(!open)return;
  function onDocClick(e){if(rootRef.current&&!rootRef.current.contains(e.target))setOpen(false)}
  function onKey(e){if(e.key==="Escape")setOpen(false)}
  document.addEventListener("mousedown",onDocClick);
  document.addEventListener("keydown",onKey);
  return ()=>{document.removeEventListener("mousedown",onDocClick);document.removeEventListener("keydown",onKey)};
 },[open]);

 function openPicker(){
  setViewDate(startOfMonth(valueDate||minDate||new Date()));
  setOpen(true);
 }

 const monthLabel=viewDate.toLocaleDateString(locale,{month:"long",year:"numeric"});
 const weekdayLabels=Array.from({length:7},(_,i)=>new Date(2024,0,7+i).toLocaleDateString(locale,{weekday:"narrow"}));
 const firstOfMonth=startOfMonth(viewDate);
 const startWeekday=firstOfMonth.getDay();
 const daysInMonth=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,0).getDate();
 const cells=[];
 for(let i=0;i<startWeekday;i++)cells.push(null);
 for(let d=1;d<=daysInMonth;d++)cells.push(new Date(viewDate.getFullYear(),viewDate.getMonth(),d));

 function pick(d){
  onChange(toISO(d));
  setOpen(false);
 }

 const displayText=valueDate?valueDate.toLocaleDateString(locale,{day:"2-digit",month:"2-digit",year:"numeric"}):"";

 return <div className="calendarField" ref={rootRef} dir={dir}>
  <button type="button" className="calendarTrigger" onClick={()=>open?setOpen(false):openPicker()} aria-haspopup="dialog" aria-expanded={open} aria-label={label}>
   <span className={displayText?"":"calendarPlaceholder"}>{displayText||placeholder||"—"}</span>
   <span className="calendarIcon" aria-hidden="true">📅</span>
  </button>
  {open&&<div className="calendarPopover" role="dialog" aria-label={label}>
   <div className="calendarPopoverHead">
    <button type="button" onClick={()=>setViewDate(v=>addMonths(v,-1))} aria-label={lang==="he"?"חודש קודם":"Previous month"}>‹</button>
    <strong>{monthLabel}</strong>
    <button type="button" onClick={()=>setViewDate(v=>addMonths(v,1))} aria-label={lang==="he"?"חודש הבא":"Next month"}>›</button>
   </div>
   <div className="calendarWeekdays">{weekdayLabels.map((w,i)=><span key={i}>{w}</span>)}</div>
   <div className="calendarGrid">
    {cells.map((d,i)=>{
     if(!d)return <span key={i} className="calendarCell calendarEmpty"/>;
     const disabled=!!minDate&&d<minDate;
     const selected=sameDay(d,valueDate);
     return <button type="button" key={i} disabled={disabled} className={"calendarCell"+(selected?" selected":"")+(disabled?" disabled":"")} onClick={()=>pick(d)}>{d.getDate()}</button>;
    })}
   </div>
  </div>}
 </div>;
}
