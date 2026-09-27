"use client";
import {useEffect,useMemo,useState} from "react";
import {subscribeAllExperiences} from "../lib/masterData";
import {updateExperienceRemote,deleteExperienceRemote} from "../lib/morivoData";
import ExperienceCover from "./ExperienceCover";

export default function MasterDashboard({isMaster,openExperience,lang}) {
  const he=lang==="he";
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [search,setSearch]=useState(""),[filter,setFilter]=useState("all"),[page,setPage]=useState(1),[busy,setBusy]=useState(null);
  useEffect(()=>{
    setRows([]);setError("");setLoading(true);
    if(!isMaster){setLoading(false);return}
    return subscribeAllExperiences(data=>{setRows(data);setLoading(false)},()=>{setError(he?"לא ניתן לטעון את מרכז הניהול. בדקו שהתחברתם לחשבון המאסטר המאומת ונסו שוב.":"Could not load management. Sign in with the verified master account and try again.");setLoading(false)});
  },[isMaster,he]);
  useEffect(()=>setPage(1),[search,filter]);
  const filtered=useMemo(()=>rows.filter(x=>{
    const matches=filter==="all"||(filter==="paused"?x.paused:filter==="live"?x.status==="live"&&!x.paused:x.status!=="live"&&!x.paused);
    return matches&&[x.name,x.location,x.type,x.joinCode,x.ownerUid,x.id].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }),[rows,search,filter]);
  async function pause(x){setBusy(x.id);setError("");try{await updateExperienceRemote(x.id,{paused:!x.paused})}catch{setError(he?"השינוי לא נשמר. נסו שוב.":"Could not save. Please try again.")}finally{setBusy(null)}}
  async function remove(x){
    if(!window.confirm(he?`למחוק לצמיתות את "${x.name||"חוויה ללא שם"}"? זה יסיר אותה ואת כל מה שבתוכה - משתתפים, זיכרונות, הודעות, הצבעות. לא ניתן לבטל.`:`Permanently delete "${x.name||"Untitled experience"}"? This removes it and everything inside it - participants, memories, messages, votes. This cannot be undone.`))return;
    setBusy(x.id);setError("");
    try{await deleteExperienceRemote(x);setRows(rows=>rows.filter(r=>r.id!==x.id))}
    catch{setError(he?"המחיקה נכשלה. נסו שוב.":"Could not delete. Please try again.")}
    finally{setBusy(null)}
  }
  if(!isMaster)return <section className="panel"><h2>{he?"מרכז הניהול זמין למאסטר בלבד":"Master access required"}</h2></section>;
  const labels=he?{all:"כל החוויות",live:"פעילות",draft:"טיוטות",paused:"מושהות"}:{all:"All experiences",live:"Live",draft:"Drafts",paused:"Paused"};
  const counts={all:rows.length,live:rows.filter(x=>x.status==="live"&&!x.paused).length,draft:rows.filter(x=>x.status!=="live"&&!x.paused).length,paused:rows.filter(x=>x.paused).length};
  return <section className="masterPage">
    <header className="masterHero"><div><span className="masterBadge">MORIVO · MASTER</span><h1>{he?"כל החוויות. תמונה אחת מלאה.":"Every experience. One complete view."}</h1><p>{he?"מרכז השליטה שלך — מהרעיון הראשון ועד הזיכרון האחרון.":"Your control room — from the first idea to the last memory."}</p></div><div className="masterHeroArt" aria-hidden="true"><img src="/morivo-memories.svg" alt=""/><span>CREATE · LIVE · REMEMBER</span></div></header>
    <div className="masterStats">{Object.entries(labels).map(([key,label])=><button key={key} onClick={()=>setFilter(key)} aria-pressed={filter===key}><span>{label}</span><b>{loading?"—":counts[key]}</b><small>{he?"הצגת חוויות ←":"View experiences →"}</small></button>)}</div>
    <section className="masterCollection"><div className="masterCollectionHead"><div><span className="tag">{he?"מבט על כל המערכת":"ACROSS MORIVO"}</span><h2>{labels[filter]}</h2></div><label className="masterSearch"><span>{he?"חיפוש חוויה":"Find an experience"}</span><input type="search" placeholder={he?"שם, יעד, קוד או מזהה בעלים…":"Name, destination, code or owner ID…"} value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {error&&<p className="masterError" role="alert">{error}</p>}
    {loading?<p role="status">{he?"טוענים את החוויות…":"Loading experiences…"}</p>:<><p className="masterResults" aria-live="polite">{he?`${filtered.length} חוויות נמצאו`:`${filtered.length} experiences found`}</p><div className="masterExperienceGrid">{filtered.slice(0,page*18).map(x=><article className="masterExperienceCard" key={x.id}>
      <ExperienceCover experience={x}><span className={"experienceStatus "+(x.paused?"paused":x.status==="live"?"live":"draft")}>{x.paused?(he?"מושהית":"Paused"):x.status==="live"?(he?"פעילה":"Live"):(he?"טיוטה":"Draft")}</span><span className="experienceCoverPlace">{x.location||x.type||"MORIVO"}</span></ExperienceCover>
      <div className="masterCardBody"><h3>{x.name||(he?"חוויה ללא שם":"Untitled experience")}</h3><p>{x.flow?.length||0} {he?"תחנות במסע":"stops"}{x.joinCode&&<> · <span dir="ltr">{x.joinCode}</span></>}</p><details className="masterOwner"><summary>{he?"פרטי החוויה":"Experience details"}</summary><small>{he?"מזהה בעלים":"Owner ID"}: <b dir="ltr">{x.ownerUid||"—"}</b></small><small>{he?"מזהה חוויה":"Experience ID"}: <b dir="ltr">{x.id}</b></small></details><div className="masterCardActions"><button className="primary" onClick={()=>openExperience(x,"runtime")}>{he?"ניהול חי":"Live management"}</button><button onClick={()=>openExperience(x,"studio")}>{he?"עריכה":"Edit"}</button><button disabled={busy===x.id} onClick={()=>pause(x)}>{busy===x.id?"…":x.paused?(he?"חידוש":"Resume"):(he?"השהיה":"Pause")}</button><button className="danger" disabled={busy===x.id} onClick={()=>remove(x)}>{busy===x.id?"…":(he?"מחיקה":"Delete")}</button></div></div>
    </article>)}</div>{!filtered.length&&!error&&<div className="masterEmpty"><h3>{he?"אין חוויות בתצוגה הזאת":"No experiences in this view"}</h3><p>{he?"אפשר לשנות את החיפוש או לבחור מסנן אחר.":"Try another search or filter."}</p></div>}{filtered.length>page*18&&<button className="masterLoadMore" onClick={()=>setPage(p=>p+1)}>{he?"הצגת חוויות נוספות":"Show more experiences"}</button>}</>}
    </section>
  </section>;
}
