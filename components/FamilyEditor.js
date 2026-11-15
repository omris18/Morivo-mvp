"use client";
import {tx} from '../lib/i18n';
import familiesDomain from '../functions/families';
export default function FamilyEditor({value=[],onChange,lang,disabled=false}){
 const label=(a,b)=>tx(lang,a,b),sum=familiesDomain.totals(value);
 function update(id,patch){onChange(value.map(f=>f.id===id?{...f,...patch}:f))}
 return <fieldset disabled={disabled} style={{border:'1px solid #b9c9dc',borderRadius:18,padding:18,margin:'16px 0'}}><legend>{label('המשפחות המשתתפות','Participating families')}</legend>
 <p>{label('לכל משפחה קישור משלה וספר עם הזיכרונות שלה.','Each family has its own invitation and memory book.')}</p>
 {value.map((f,i)=><div key={f.id} style={{background:'#f1f5fb',color:'#18365d',padding:16,borderRadius:12,marginBottom:12}}><label>{label('שם המשפחה','Family name')}<input aria-label={`${label('שם משפחה','Family name')} ${i+1}`} value={f.name} maxLength={80} onChange={e=>update(f.id,{name:e.target.value})}/></label><div className="fieldRow">
 <label>{label('מבוגרים','Adults')}<input aria-label={`${label('מבוגרים במשפחה','Adults in family')} ${i+1}`} type="number" min="1" max="12" value={f.adults} onChange={e=>update(f.id,{adults:e.target.value})}/></label>
 <label>{label('ילדים','Children')}<input aria-label={`${label('ילדים במשפחה','Children in family')} ${i+1}`} type="number" min="0" max="8" value={f.children} onChange={e=>{const n=Math.max(0,Math.min(8,Number(e.target.value)||0));update(f.id,{children:n,childrenAges:Array.from({length:n},(_,j)=>f.childrenAges?.[j]??'')})}}/></label>
 <label>{label('חדרים למשפחה','Rooms for family')}<input type="number" min="1" max="8" value={f.rooms||1} onChange={e=>update(f.id,{rooms:e.target.value})}/></label></div>
 {f.childrenAges?.map((age,j)=><label key={j} style={{display:'inline-block',maxWidth:120,margin:6}}>{label('גיל ילד','Child age')} {j+1}<input aria-label={`${label('גיל ילד','Child age')} ${j+1}, ${f.name}`} type="number" min="0" max="17" value={age} onChange={e=>update(f.id,{childrenAges:f.childrenAges.map((x,k)=>k===j?e.target.value:x)})}/></label>)}
 {value.length>1&&<button type="button" onClick={()=>onChange(value.filter(x=>x.id!==f.id))}>{label('הסרת משפחה','Remove family')}</button>}</div>)}
 <button type="button" disabled={value.length>=20} onClick={()=>onChange([...value,{id:`f-${crypto.randomUUID()}`,name:label(`משפחה ${value.length+1}`,`Family ${value.length+1}`),adults:2,children:0,childrenAges:[],rooms:1}])}>{label('הוספת משפחה','Add family')}</button>
 <p><b>{value.length} {label('משפחות','families')} · {sum.adults} {label('מבוגרים','adults')} · {sum.children} {label('ילדים','children')} · {sum.rooms} {label('חדרים','rooms')}</b></p><small>{label('הרכב החדרים הוא בקשת חיפוש. התאמה וזמינות יאומתו מול מקום האירוח.','Room composition is a search request; occupancy and availability must be confirmed with the property.')}</small></fieldset>
}
