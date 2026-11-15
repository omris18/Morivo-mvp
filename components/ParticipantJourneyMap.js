"use client";

import {buildRouteGroups,dayRangeText} from "../lib/routeGroups";
import {routeLabels} from "../lib/i18n";
import {tx,txf} from "../lib/i18n";

const ROUTE_D="M92 60 C470 95, 500 180, 135 235 S95 390, 470 420 S500 585, 130 635 S115 760, 500 780";
const typeIcons={photo:"📸",video:"🎬",map:"🗺️",quiz:"✅",puzzle:"🧩",note:"✍️",story:"📖",branch:"🔀"};

export default function ParticipantJourneyMap({experience,flow,prog,idx,finished,lang,p,missionDayLocked,onOpenMission}){
 const he=lang==="he";
 const L=routeLabels(lang);
 const rawGroups=buildRouteGroups(experience,flow,lang);
 // The coordination group (hotel/attraction choice missions - see buildRouteGroups) isn't a
 // physical place, so it's kept out of the single/multi-destination counting below (a trip with
 // one real destination plus a coordination section is still a "single destination" trip for
 // this map), then placed back as its own first stop so those missions stay reachable here -
 // this map is the only way participants open a mission at all (see Participant.js).
 const coordinationGroup=rawGroups.find(g=>g.key==="coordination");
 const destinationGroups=rawGroups.filter(g=>g.key!=="coordination");
 const singleDestination=destinationGroups.length<=1&&destinationGroups[0];
 // A trip with only one real destination shouldn't merge every mission into a single card -
 // it still gets the same curved multi-stop map, just with each mission as its own stop along
 // the route and the shared destination named once, at the top, instead of on every cube.
 const expandedGroups=singleDestination
  ? destinationGroups[0].missions.map(({m,i})=>({key:m.id,label:m.title,destination:destinationGroups[0].destination,missions:[{m,i}]}))
  : destinationGroups;
 const groups=coordinationGroup?[coordinationGroup,...expandedGroups]:expandedGroups;
 const destinationLabel=singleDestination?(destinationGroups[0].label||experience.location||experience.name||""):"";
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
 function showMission(event,m,i,isActive){onOpenMission(m,isActive)}
 return <div className="journeySvgMap" style={{minHeight:mapHeight}}>
  <div className="mapTitle"><div><strong>{singleDestination?destinationLabel:L.movingBetweenStops}</strong><small>{statusText}</small></div><span>🗺️</span></div>
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
    const stopCaption=g.key==="coordination"?L.coordinationCaption:L.journeyStop;
    const defaultMission=(g.missions.find(({i})=>i===idx)||g.missions[0]).m;
    const defaultIndex=flow.findIndex(m=>m.id===defaultMission.id),defaultActive=defaultMission.id===flow[idx]?.id&&!finished;
    const openDefault=e=>showMission(e,defaultMission,defaultIndex,defaultActive);
    return <div className={`mapStop ${state}`} key={g.key} style={{left:`${pos.x}%`,top:`${pos.y}%`}}>
     <div className="mapStopCard" role="button" tabIndex={0} onClick={openDefault} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDefault(e)}}}>
      {rangeText&&<span className="mapDayBadge">{rangeText}</span>}
      <div className="mapStopHead">
       <span className="mapStopIcon">{g.key==="coordination"?"🧭":g.missions.length===1?(typeIcons[g.missions[0].m.type]||"📍"):"📍"}</span>
       <div className="mapStopCopy"><strong>{g.label}</strong><small>{hotel||stopCaption}</small></div>
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
         <span className="destinationDayDot">{isActive&&missionDayLocked?"🔒":(i+1)}{mDone&&<i className="destinationDayCheck">✓</i>}{typeIcons[m.type]&&<i className="destinationDayType">{typeIcons[m.type]}</i>}</span>
        </button>;
       })}
      </div>
     </div>
    </div>;
   })}
  </div>
  {points[activeGroupIndex]&&!finished&&<div className="mapPlane" style={{left:`${points[activeGroupIndex].x}%`,top:`${points[activeGroupIndex].y}%`}}>✈️</div>}
  <div className="mapLegend"><span className="done"><i></i>{tx(lang,"הושלם","Done")}</span><span className="now"><i></i>{tx(lang,"עכשיו","Now")}</span><span className="next"><i></i>{tx(lang,"עתידי","Upcoming")}</span></div>

 </div>;
}
