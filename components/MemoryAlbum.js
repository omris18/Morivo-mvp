"use client";
import {useState} from "react";
import DestinationBackdrop from "./DestinationBackdrop";
import LinkifiedText from "./LinkifiedText";
export default function MemoryAlbum({chapters,theme,he}){
 const [page,setPage]=useState(0);
 const current=Math.min(page,Math.max(0,chapters.length-1));
 if(!chapters.length)return <div className="albumEmpty"><h3>{he?"העמודים מחכים לרגעים שלכם":"The pages are waiting for your moments"}</h3><p>{he?"תמונות, תשובות ומשימות שהושלמו יהפכו כאן אוטומטית לפרקי הספר.":"Photos, answers and completed missions automatically become chapters here."}</p></div>;
 return <div className="memoryAlbum">
  <div className="albumControls"><button disabled={current===0} onClick={()=>setPage(current-1)}>{he?"הקודם":"Previous"}</button><span aria-live="polite">{he?"כפולה":"Spread"} {current+1} / {chapters.length}</span><button disabled={current===chapters.length-1} onClick={()=>setPage(current+1)}>{he?"הבא":"Next"}</button></div>
  {chapters.map((chapter,i)=><article className={"albumSpread "+(i===current?"isCurrent":"")} key={chapter.key} aria-label={chapter.mission.title}>
   <div className={"albumPhotos "+(chapter.photos.length===1?"singlePhoto":"")}>
    {chapter.photos.length?chapter.photos.map(photo=><figure key={photo.id}>{photo.contentType?.startsWith("video/")?<video controls preload="metadata" src={photo.downloadURL}/>:<a href={photo.downloadURL} target="_blank" rel="noopener noreferrer"><img loading="lazy" src={photo.downloadURL} alt={photo.missionTitle||chapter.mission.title}/></a>}<figcaption>{photo.participantName||""}</figcaption></figure>):<div className="albumIllustration"><DestinationBackdrop theme={theme}/><span>{he?"אווירת המסע":"Journey illustration"}</span></div>}
   </div>
   <div className="albumWords"><span className="albumChapterNumber">{String(chapter.index+1).padStart(2,"0")}</span><div className="mbHeading">{he?"פרק במסע שלנו":"A CHAPTER IN OUR JOURNEY"}{chapter.page>0?(he?" · המשך":" · continued"):""}</div><h2>{chapter.mission.title}</h2>
    {chapter.mission.location&&typeof chapter.mission.location==="string"&&<p>{chapter.mission.location}</p>}
    {chapter.quotes.map(q=><blockquote key={q.id}><LinkifiedText text={q.text||""}/><cite>{q.participantName}</cite></blockquote>)}
    {!chapter.quotes.length&&chapter.mission.text&&<div className="albumMission"><small>{he?"המשימה שלנו":"Our mission"}</small><p><LinkifiedText text={chapter.mission.text}/></p></div>}
    {chapter.done&&<span className="albumStamp">✓ {he?"רגע שהשלמנו יחד":"A moment completed together"}</span>}
    <span className="albumPageNumber">MORIVO · {i+1}</span>
   </div>
  </article>)}
 </div>;
}
