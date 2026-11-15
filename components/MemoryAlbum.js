"use client";
import {useMemo,useState} from "react";
import {tx} from "../lib/i18n";
import {pieceAtGridIndex} from "../lib/familyPuzzle";
import {layoutFor,paginateAlbum,tearPolygon} from "../lib/memoryLayout";
import styles from "./MemoryAlbum.module.css";
export default function MemoryAlbum({chapters,lang,seed="morivo",canEdit=false,onSaveDesign,puzzle,puzzlePieces=new Set(),familyName}){
 const [page,setPage]=useState(0),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const selected=draft??seed;
 const pages=useMemo(()=>[...paginateAlbum(chapters),...(puzzle?.url?[{key:"family-puzzle-finale",puzzle:true}]:[])],[chapters,puzzle?.url]);
 const current=Math.min(page,Math.max(0,pages.length-1));
 const he=lang==="he";
 const label=(a,b)=>tx(lang,a,b);
 async function save(){setBusy(true);setMessage("");try{await onSaveDesign({version:1,seed:selected});setDraft(null);setMessage(label("העיצוב נשמר","Design saved"))}catch{setMessage(label("לא הצלחנו לשמור. העיצוב עדיין בתצוגה מקדימה; נסו שוב.","Could not save. Your preview is still here; try again."))}finally{setBusy(false)}}
 if(!pages.length)return <div className={styles.empty}>{label("הרגעים שלכם יופיעו כאן","Your memories will appear here")}</div>;
 return <div className={styles.album}>
  {canEdit&&<div className={styles.tools}>
   <button disabled={busy} onClick={()=>{setDraft(String(Date.now())+Math.random().toString(36).slice(2,6));setMessage("")}}>{label("עיצוב חדש","New design")}</button>
   <button disabled={busy||draft===null} onClick={save}>{busy?label("שומר…","Saving…"):label("שמירת העיצוב","Save design")}</button>
   {draft!==null&&<button disabled={busy} onClick={()=>{setDraft(null);setMessage("")}}>{label("חזרה לעיצוב השמור","Restore saved design")}</button>}
   <span role="status">{message||(draft!==null?label("תצוגה מקדימה · טרם נשמרה","Preview · not saved"):label("העיצוב השמור שלכם","Your saved design"))}</span>
  </div>}
  <div className={styles.pager}>
   <button disabled={current===0} onClick={()=>setPage(current-1)}>{he?"→":"←"} {label("הקודם","Previous")}</button>
   <span aria-live="polite">{label("כפולה","Spread")} {current+1} / {pages.length}</span>
   <button disabled={current===pages.length-1} onClick={()=>setPage(current+1)}>{label("הבא","Next")} {he?"←":"→"}</button>
  </div>
  {pages.map((ch,i)=>{if(ch.puzzle){const total=puzzle.totalPieces||8,cols=4,rows=Math.ceil(total/cols);return <article key={ch.key} className={`${styles.spread} ${styles.finale} ${i===current?styles.current:""}`} aria-label={label("התמונה שהרכבנו יחד","The picture we built together")}>
   <header className={styles.heading}><div><small>MORIVO / OUR FAMILY</small><h2>{label("התמונה שהרכבנו יחד","The picture we built together")}</h2>{familyName&&<p>{familyName}</p>}</div></header>
   <div className={styles.puzzleGrid} style={{gridTemplateColumns:`repeat(${cols},1fr)`,aspectRatio:`${cols}/${rows}`}}>{Array.from({length:total},(_,cell)=>{const piece=pieceAtGridIndex(puzzle.layout,total,cell),shown=puzzlePieces.has(piece),col=cell%cols,row=Math.floor(cell/cols);return <div key={cell} aria-label={`${piece}: ${shown?label("נחשף","revealed"):label("טרם נחשף","not yet revealed")}`} style={shown?{backgroundImage:`url(${puzzle.url})`,backgroundSize:`${cols*100}% ${rows*100}%`,backgroundPosition:`${col/(cols-1)*100}% ${rows>1?row/(rows-1)*100:0}%`}:{background:"#e5dfd2"}}>{!shown&&<span>✦</span>}</div>})}</div>
   <p>{puzzlePieces.size===total?label("כל משימה הוסיפה חלק. יחד יצרנו זיכרון שלם.","Each mission added a piece. Together we made a lasting memory."):`${puzzlePieces.size} / ${total} · ${label("הזיכרון שלנו ממשיך להתמלא","Our memory is still taking shape")}`}</p><footer className={styles.folio}><span>MORIVO</span><span>{label("שלנו, לתמיד","Ours, forever")}</span></footer></article>;}const layout=layoutFor(selected,ch.key,i,ch.photos.length);return <article key={ch.key} className={`${styles.spread} ${i===current?styles.current:""} ${styles['variant'+layout.variant]}`} data-layout={layout.variant} data-seed={selected} aria-label={ch.mission.title}>
   <header className={styles.heading}><span>{String(ch.index+1).padStart(2,"0")}</span><div><small>MORIVO / OUR MEMORIES</small><h2>{ch.mission.title}</h2>{ch.continuation&&<small>{label("המשך הסיפור","Our story, continued")}</small>}</div></header>
   <div className={`${styles.photos} ${styles['count'+ch.photos.length]}`}>
    {ch.photos.map((photo,j)=>{const effect=layout.photos[j];return <figure key={photo.id} className={`${styles.photo} ${effect.tape?styles.tape:""}`} style={{"--angle":`${effect.angle}deg`}}>
     <div className={styles.paper} style={effect.torn?{clipPath:tearPolygon(`${selected}:${photo.id}`)}:undefined}>
      {photo.contentType?.startsWith("video/")?<video controls preload="metadata" src={photo.downloadURL}/>:<a href={photo.downloadURL} target="_blank" rel="noopener noreferrer"><img loading="eager" src={photo.downloadURL} alt={photo.missionTitle||ch.mission.title}/></a>}
      {(photo.caption||photo.participantName)&&<figcaption>{photo.caption||photo.participantName}</figcaption>}
     </div></figure>})}
    {!ch.photos.length&&<div className={styles.textOnly}>{label("במילים שלנו","In our own words")}</div>}
   </div>
   <div className={styles.words}>{ch.quotes.map(q=><blockquote key={q.id}><p dir="auto">{q.text}</p>{q.participantName&&<cite>{q.participantName}</cite>}</blockquote>)}{!ch.quotes.length&&<p className={styles.quiet}>{label("רגע אחד. זיכרון שנשאר.","One moment. A lasting memory.")}</p>}</div>
   <footer className={styles.folio}><span>MORIVO</span><span>{String(i+1).padStart(2,"0")}</span></footer>
  </article>})}
 </div>
}
