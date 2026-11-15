"use client";
import {useState} from "react";
import {editMemoryPhoto} from "../lib/mediaData";
import {tx} from "../lib/i18n";
function PhotoEditor({photo,experienceId,lang}){
 const [caption,setCaption]=useState(photo.caption||""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const L=(a,b)=>tx(lang,a,b);
 async function save(patch){setBusy(true);setError("");try{await editMemoryPhoto(experienceId,photo,patch)}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="memoryPhotoEditor">{photo.contentType?.startsWith('video/')?<video src={photo.downloadURL} controls/>:<img src={photo.downloadURL} alt={photo.caption||photo.missionTitle}/>}
 <small>{photo.participantName} · {photo.missionTitle}</small>
 <label>{L("כיתוב לתמונה","Photo caption")}<input value={caption} maxLength={500} onChange={e=>setCaption(e.target.value)}/></label>
 <div className="actions"><button disabled={busy} onClick={()=>save({caption})}>{L("שמירת כיתוב","Save caption")}</button><label className="familyPuzzleUpload">{L("החלפת תמונה","Replace photo")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)save({file:f});e.target.value=""}}/></label><button disabled={busy} onClick={()=>save({deleted:!photo.deleted})}>{photo.deleted?L("שחזור לספר","Restore to book"):L("הסרה מהספר","Remove from book")}</button></div>{photo.deleted&&<p>{L("התמונה הוסרה מהספר. אפשר לשחזר אותה.","Removed from the book. You can restore it.")}</p>}{error&&<p role="alert">{error}</p>}
 </div>
}
export default function MemoryPhotoManager({experienceId,photos,familyName,lang}){
 return <details className="memoryPhotoManager"><summary>{tx(lang,"ניהול תמונות","Manage photos")}{familyName?` · ${familyName}`:""} ({photos.length})</summary><p>{tx(lang,"עריכה והסרה כאן משפיעות רק על הספר של המשפחה שנבחרה.","Edits and removals affect only the selected family’s book.")}</p><div className="memoryPhotoEditorGrid">{photos.map(p=><PhotoEditor key={p.id} photo={p} experienceId={experienceId} lang={lang}/>)}</div></details>
}
