"use client";
import {useEffect,useState} from "react";
import {createPortal} from "react-dom";

const items=["dashboard","ai","studio","runtime","memory"];
const icons={
 dashboard:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-13h6V4h-6v3Z"/></svg>,
 ai:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.5 5.2L18 9l-4.5 1.8L12 16l-1.5-5.2L6 9l4.5-1.8L12 2Zm7 12 .8 2.7L22 18l-2.2 1.3L19 22l-.8-2.7L16 18l2.2-1.3L19 14ZM5 13l.9 3.1L9 17.5l-3.1 1.4L5 22l-.9-3.1L1 17.5l3.1-1.4L5 13Z"/></svg>,
 studio:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h10v2H4V5Zm0 6h16v2H4v-2Zm0 6h7v2H4v-2Zm13-13 3 3-3 3V4Zm-3 12 3 3-3 3v-6Z"/></svg>,
 runtime:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>,
 memory:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1Zm2 14h10V5H6v12.2c.3-.1.7-.2 1-.2Zm2-9h6v2H9V8Zm0 4h5v2H9v-2Z"/></svg>
};
export default function Sidebar({view,setView,t,isMaster=false,lang}){
 const [expanded,setExpanded]=useState(false);
 const [mounted,setMounted]=useState(false);
 useEffect(()=>{setMounted(true)},[]);
 const navItems=items.map(id=>({id,icon:icons[id],label:t.nav[id]}));
 if(isMaster)navItems.push({id:"master",icon:"◈",label:lang==="he"?"ניהול מערכת":"Master console",master:true});
 function go(id){setView(id);setExpanded(false)}
 return <>
   <aside className="sidebar">
     <div className="brandLockup"><img className="brandIcon" src="/morivo-icon.svg" alt=""/><div><span className="brandWordmark">Morivo</span><div className="tag">{t.brandTag}</div></div></div>
     <nav>{items.map(id=>
       <button key={id} onClick={()=>setView(id)} className={view===id?"active":""}>
        <span className="navIcon">{icons[id]}</span><span>{t.nav[id]}</span>
       </button>
     )}{isMaster&&<button onClick={()=>setView("master")} className={"masterNav "+(view==="master"?"active":"")}><span className="navIcon" aria-hidden="true">◈</span><span>{lang==="he"?"ניהול מערכת":"Master console"}</span><small>MASTER</small></button>}</nav>
     <div className="sidebarJourney"><div className="journeyLine"></div><small>CREATE · LIVE · REMEMBER</small></div>
   </aside>
   {mounted&&createPortal(<>
     <div className="mobileNavRail" role="navigation" aria-label={t.brandTag}>
       {navItems.map(item=><button key={item.id} type="button" className={"mobileNavIcon "+(view===item.id?"active":"")} title={item.label} aria-label={item.label} onClick={()=>go(item.id)}>
        {typeof item.icon==="string"?item.icon:<span className="navIcon">{item.icon}</span>}
       </button>)}
       <button type="button" className="mobileNavExpand" aria-haspopup="true" aria-expanded={expanded} aria-label={lang==="he"?"מקרא סמלים":"Icon legend"} onClick={()=>setExpanded(e=>!e)}>ⓘ</button>
     </div>
     {expanded&&<div className="mobileNavOverlay" role="presentation" onClick={()=>setExpanded(false)}>
       <div className="mobileNavLegend" role="menu" onClick={e=>e.stopPropagation()}>
        {navItems.map(item=><button key={item.id} type="button" role="menuitem" className={view===item.id?"active":""} onClick={()=>go(item.id)}>
         <span className="navIcon">{typeof item.icon==="string"?item.icon:item.icon}</span><span>{item.label}</span>
        </button>)}
       </div>
     </div>}
   </>,document.body)}
 </>;
}
