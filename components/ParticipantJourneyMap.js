"use client";
import {useRef,useState} from "react";
import {buildRouteGroups} from "../lib/routeGroups";

const ROUTE_D="M92 60 C470 95, 500 180, 135 235 S95 390, 470 420 S500 585, 130 635 S115 760, 500 780";
const typeIcons={photo:"📸",video:"🎬",map:"🗺️",quiz:"✅",puzzle:"🧩",note:"✍️",story:"📖",branch:"🔀"};

function dayRangeText(missions,lang){
 const days=missions.map(({m})=>m.day).filter(Number.isFinite);
 if(!days.length)return "";
 const first=Math.min(...days),last=Math.max(...days);
 if(first===last)return lang==="he"?`יום ${first}`:`Day ${first}`;
 return lang==="he"?`ימים ${first}–${last}`:`Days ${first}–${last}`;
}

export default function ParticipantJourneyMap({experience,flow,prog,idx,finished,lang,p,missionDayLocked,onOpenMission}){
 const he=lang==="he";
 const mapRef=useRef(null);
 const [popup,setPopup]=useState(null);
 const rawGroups=buildRouteGroups(experience,flow,he);
 const singleDestination=rawGroups.length<=1&&rawGroups[0];
 // A trip with only one real destination shouldn't merge every mission into a single card -
 // it still gets the same curved multi-stop map, just with each mission as its own stop along
 // the route and the shared destination named once, at the top, instead of on every cube.
 const groups=singleDestination
  ? rawGroups[0].missions.map(({m,i})=>({key:m.id,label:m.title,destination:rawGroups[0].destination,missions:[{m,i}]}))
  : rawGroups;
 const destinationLabel=singleDestination?(rawGroups[0].label||experience.location||experience.name||""):"";
 // Stops are placed at evenly spaced heights (never following the curve's raw y), so two
 // stops can never land close enough to overlap regardless of how the decorative path winds.
 // X alternates left/right for the same "winding road" look without any collision risk.
 const n=groups.length;
 const points=groups.map((_,i)=>{
  const t=n<=1?0.5:i/(n-1);
  const y=12+t*76;
  const x=n<=1?50:(i%2===0?38:62);
  return {x,y};
 });
 const completedIds=prog.completedMissionIds||[];
 const activeGroupIndex=finished?groups.length:groups.findIndex(g=>g.missions.some(({i})=>i===idx));
 const progress=groups.length<=1?(finished?1:0):Math.max(0,Math.min(1,(finished?groups.length-1:activeGroupIndex)/Math.max(1,groups.length-1)));
 const statusText=finished?p.journeyComplete:p.missionOf(idx+1,flow.length);
 const mapHeight=Math.max(560,150+groups.length*105);
 function showMission(event,m,i,isActive){
  const map=mapRef.current?.getBoundingClientRect(),anchor=event.currentTarget.getBoundingClientRect();
  if(!map)return;
  const width=Math.min(270,map.width-20),half=width/2;
  const left=Math.max(half+10,Math.min(map.width-half-10,anchor.left-map.left+anchor.width/2));
  const below=anchor.bottom-map.top+10;
  const top=below+175<map.height?below:Math.max(72,anchor.top-map.top-180);
  setPopup({m,i,isActive,left,top,width});
 }
 return <div ref={mapRef} className="journeySvgMap" style={{minHeight:mapHeight}} onClick={e=>{if(e.target===e.currentTarget)setPopup(null)}}>
  <div className="mapTitle"><div><strong>{singleDestination?destinationLabel:(he?"מתקדמים בין היעדים":"Moving between stops")}</strong><small>{statusText}</small></div><span>🗺️</span></div>
  <svg className="routeSvg" viewBox="0 0 600 820" preserveAspectRatio="none" aria-hidden="true">
   <defs><linearGradient id="participantProgressGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="55%" stopColor="#ec4899"/><stop offset="100%" stopColor="#f97316"/></linearGradient></defs>
   <path className="routePath" d={ROUTE_D}/>
   <path className="routeDash" d={ROUTE_D}/>
   <path className="routeProgress" pathLength="1" style={{strokeDashoffset:1-progress}} d={ROUTE_D}/>
  </svg>
  <div className="mapStopsLayer">
   {groups.map((g,gi)=>{
    const pos=points[gi];
    const done=g.missions.every(({m})=>completedIds.includes(m.id));
    const current=!finished&&g.missions.some(({i})=>i===idx);
    const state=done?"completed":current?"current":"future";
    const hotel=g.missions.map(({m})=>m.hotel).find(Boolean);
    const gpsMission=g.missions.find(({m})=>Number.isFinite(m.lat)&&Number.isFinite(m.lng))?.m;
    const navHref=gpsMission?`https://www.google.com/maps/search/?api=1&query=${gpsMission.lat},${gpsMission.lng}`:hotel?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hotel,g.destination||g.label].filter(Boolean).join(", "))}`:null;
    const rangeText=dayRangeText(g.missions,lang);
    const defaultMission=(g.missions.find(({i})=>i===idx)||g.missions[0]).m;
    const defaultIndex=flow.findIndex(m=>m.id===defaultMission.id),defaultActive=defaultMission.id===flow[idx]?.id&&!finished;
    const openDefault=e=>showMission(e,defaultMission,defaultIndex,defaultActive);
    return <div className={`mapStop ${state}`} key={g.key} style={{left:`${pos.x}%`,top:`${pos.y}%`}}>
     <div className="mapStopCard" role="button" tabIndex={0} onClick={openDefault} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDefault(e)}}}>
      {rangeText&&<span className="mapDayBadge">{rangeText}</span>}
      <div className="mapStopHead">
       <span className="mapStopIcon">{g.missions.length===1?(typeIcons[g.missions[0].m.type]||"📍"):"📍"}</span>
       <div className="mapStopCopy"><strong>{g.label}</strong><small>{hotel||(he?"תחנה במסע":"A stop on the journey")}</small></div>
      </div>
      <div className="mapStopActions">
       {navHref&&<a className="mapMiniBtn" href={navHref} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>📍 {p.navigate}</a>}
       <button type="button" className="mapMiniBtn" onClick={e=>{e.stopPropagation();openDefault(e)}}>{p.openMission}</button>
      </div>
      <div className="destinationDays">
       {g.missions.map(({m,i})=>{
        const mDone=completedIds.includes(m.id);
        const isActive=!finished&&i===idx;
        const dayState=mDone?"done":isActive?(missionDayLocked?"locked":"today"):"future";
        return <button type="button" key={m.id} className={`destinationDay ${dayState}`} onClick={e=>{e.stopPropagation();showMission(e,m,i,isActive)}} aria-label={m.title}>
         <span className="destinationDayDot">{isActive&&missionDayLocked?"🔒":(m.day||i+1)}{mDone&&<i className="destinationDayCheck">✓</i>}{typeIcons[m.type]&&<i className="destinationDayType">{typeIcons[m.type]}</i>}</span>
        </button>;
       })}
      </div>
     </div>
    </div>;
   })}
  </div>
  {points[activeGroupIndex]&&!finished&&<div className="mapPlane" style={{left:`${points[activeGroupIndex].x}%`,top:`${points[activeGroupIndex].y}%`}}>✈️</div>}
  {popup&&<div className="participantMapMissionPopup" style={{left:popup.left,top:popup.top,width:popup.width}} role="dialog" aria-label={popup.m.title} onClick={e=>e.stopPropagation()}>
   <button type="button" className="participantMapMissionClose" onClick={()=>setPopup(null)} aria-label={he?"סגירה":"Close"}>×</button>
   <div className="participantMapMissionMeta"><span>{typeIcons[popup.m.type]||"✨"}</span><small>{he?`משימה ${popup.i+1}`:`Mission ${popup.i+1}`}</small></div>
   <strong>{popup.m.title}</strong>
   <p>{popup.m.text||popup.m.description||""}</p>
   <div className={`participantMapMissionStatus ${completedIds.includes(popup.m.id)?"done":popup.isActive?"current":"locked"}`}>{completedIds.includes(popup.m.id)?`✓ ${p.missionDoneHint}`:popup.isActive?(he?"המשימה הנוכחית":"Current mission"):`🔒 ${p.missionLockedHint}`}</div>
   <button type="button" className="participantMapMissionOpen" onClick={()=>{setPopup(null);onOpenMission(popup.m,popup.isActive)}}>{popup.isActive?p.openMission:(he?"הצגת פרטי המשימה":"View mission details")}</button>
  </div>}
  <div className="mapLegend"><span className="done"><i></i>{he?"הושלם":"Done"}</span><span className="now"><i></i>{he?"עכשיו":"Now"}</span><span className="next"><i></i>{he?"עתידי":"Upcoming"}</span></div>
  <style jsx>{`.participantMapMissionPopup{position:absolute;z-index:30;transform:translateX(-50%);padding:14px;border:1px solid rgba(82,123,109,.28);border-radius:20px;background:#fffdf7;color:#243f3a;box-shadow:0 20px 45px rgba(24,61,52,.3);text-align:start}.participantMapMissionPopup:before{content:"";position:absolute;top:-7px;left:calc(50% - 7px);width:14px;height:14px;transform:rotate(45deg);background:#fffdf7;border-left:1px solid rgba(82,123,109,.28);border-top:1px solid rgba(82,123,109,.28)}.participantMapMissionClose{position:absolute;top:5px;inset-inline-end:8px;border:0;background:transparent;color:#60746f;font-size:22px;line-height:1}.participantMapMissionMeta{display:flex;align-items:center;gap:7px;padding-inline-end:24px}.participantMapMissionMeta span{font-size:22px}.participantMapMissionMeta small{font-size:10px;font-weight:900;color:#df7137}.participantMapMissionPopup>strong{display:block;margin:6px 0 4px;font-size:14px}.participantMapMissionPopup p{display:-webkit-box;margin:0 0 9px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3;font-size:11px;line-height:1.45}.participantMapMissionStatus{margin-bottom:9px;font-size:10px;font-weight:900}.participantMapMissionStatus.done{color:#238657}.participantMapMissionStatus.current{color:#d65f20}.participantMapMissionStatus.locked{color:#718079}.participantMapMissionOpen{width:100%;padding:8px 10px;border:0;border-radius:999px;background:#e8754e;color:#fff;font-size:11px;font-weight:900}`}</style>
 </div>;
}
