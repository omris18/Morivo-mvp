"use client";
import {useEffect,useState} from "react";
import {showToast} from "../lib/toast";
import {tx} from "../lib/i18n";
export default function CelebrationPhotoPicker({file,onChange,lang}) {
 const he=lang==="he",[preview,setPreview]=useState("");
 useEffect(()=>{if(!file){setPreview("");return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 return <div className="celebrationPhotoPicker"><label>{tx(lang,"תמונת ילד/ת יום ההולדת (לבחירה)","Birthday child's photo (optional)")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f&&(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>10*1024*1024)){showToast(tx(lang,"בחרו JPG, PNG או WebP עד 10MB","Choose JPG, PNG or WebP up to 10 MB"));e.target.value="";return}onChange(f||null)}}/></label><small>{tx(lang,"בחרו תמונה שיש לכם רשות להשתמש בה. היא תוצג במסגרת חגיגית בחוויה, ללא שינוי הפנים וללא שליחה ליצירת AI.","Choose a photo you have permission to use. It appears in a festive frame, without changing the face or sending it to AI.")}</small>{preview&&<><img src={preview} alt={tx(lang,"תצוגת התמונה שנבחרה","Selected photo preview")}/><button type="button" onClick={()=>onChange(null)}>{tx(lang,"ביטול הבחירה","Clear selection")}</button></>}</div>;
}
