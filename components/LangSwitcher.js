"use client";
import {useEffect,useRef,useState} from "react";
import FlagIcon from "./FlagIcon";
import {COUNTRY_FLAGS} from "../lib/i18n";

export default function LangSwitcher({country,selectLang,label,className=""}){
 const [open,setOpen]=useState(false);
 const wrapRef=useRef(null);
 useEffect(()=>{
  if(!open)return;
  function onDocClick(e){ if(wrapRef.current&&!wrapRef.current.contains(e.target)) setOpen(false); }
  document.addEventListener("click",onDocClick);
  return ()=>document.removeEventListener("click",onDocClick);
 },[open]);
 const current=COUNTRY_FLAGS.find(f=>f.country===country)||COUNTRY_FLAGS[0];
 return <div className={"langSwitcherWrap "+className} ref={wrapRef}>
  <button type="button" className="langSwitcherTrigger" aria-label={label} aria-haspopup="true" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
   <FlagIcon code={current.country}/><span className="langSwitcherCaret" aria-hidden="true">▾</span>
  </button>
  {open&&<div className="langSwitcherPanel" role="menu">
   {COUNTRY_FLAGS.map(f=><button key={f.country} type="button" role="menuitem" className={country===f.country?"active":""} onClick={()=>{selectLang(f);setOpen(false)}} title={f.label} aria-label={f.label}><FlagIcon code={f.country}/></button>)}
  </div>}
 </div>;
}
