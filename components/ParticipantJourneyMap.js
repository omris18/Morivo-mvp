"use client";
import {buildRouteGroups} from "../lib/routeGroups";

const ROUTE_D="M92 60 C470 95, 500 180, 135 235 S95 390, 470 420 S500 585, 130 635 S115 760, 500 780";

function dayRangeText(missions,lang){
 const days=missions.map(({m})=>m.day).filter(Number.isFinite);
 if(!days.length)return "";
 const first=Math.min(...days),last=Math.max(...days);
 if(first===last)return lang==="he"?`יום ${first}`:`Day ${first}`;
 return lang==="he"?`ימים ${first}–${last}`:`Days ${first}–${last}`;
}

export default function ParticipantJourneyMap({experience,flow,prog,idx,finished,lang,p,onOpenMission}){
 const he=lang==="he";
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
 const mapHeight=Math.max(560,240+groups.length*155);
 return <div className="journeySvgMap" style={{minHeight:mapHeight}}>
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
    const openDefault=()=>onOpenMission(defaultMission,defaultMission.id===flow[idx]?.id&&!finished);
    return <div className={`mapStop ${state}`} key={g.key} style={{left:`${pos.x}%`,top:`${pos.y}%`}}>
     <div className="mapStopCard" role="button" tabIndex={0} onClick={openDefault} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDefault()}}}>
      {rangeText&&<span className="mapDayBadge">{rangeText}</span>}
      <div className="mapStopHead">
       <span className="mapStopIcon">📍</span>
       <div className="mapStopCopy"><strong>{g.label}</strong><small>{hotel||(he?"תחנה במסע":"A stop on the journey")}</small></div>
      </div>
      <div className="mapStopActions">
       {navHref&&<a className="mapMiniBtn" href={navHref} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>📍 {p.navigate}</a>}
       <button type="button" className="mapMiniBtn" onClick={e=>{e.stopPropagation();openDefault()}}>{p.openMission}</button>
      </div>
      <div className="destinationDays">
       {g.missions.map(({m,i})=>{
        const mDone=completedIds.includes(m.id);
        const isActive=!finished&&i===idx;
        const dayState=mDone?"done":isActive?"today":"future";
        return <button type="button" key={m.id} className={`destinationDay ${dayState}`} onClick={e=>{e.stopPropagation();onOpenMission(m,isActive)}} aria-label={m.title}>
         <span className="destinationDayDot">{m.day||i+1}{mDone&&<i className="destinationDayCheck">✓</i>}</span>
        </button>;
       })}
      </div>
     </div>
    </div>;
   })}
  </div>
  {points[activeGroupIndex]&&!finished&&<div className="mapPlane" style={{left:`${points[activeGroupIndex].x}%`,top:`${points[activeGroupIndex].y}%`}}>✈️</div>}
  <div className="mapLegend"><span className="done"><i></i>{he?"הושלם":"Done"}</span><span className="now"><i></i>{he?"עכשיו":"Now"}</span><span className="next"><i></i>{he?"עתידי":"Upcoming"}</span></div>
 </div>;
}
