"use client";
import {useState} from "react";
import {tx} from '../lib/i18n';
import familiesDomain from '../functions/families';
export default function FamilyEditor({value=[],onChange,lang,disabled=false,onManageFamily}){
 const [selected,setSelected]=useState(value[0]?.id||"");
 const active=value.some(f=>f.id===selected)?selected:value[0]?.id;
 const label=(a,b)=>tx(lang,a,b),sum=familiesDomain.totals(value);
 function update(id,patch){onChange(value.map(f=>f.id===id?{...f,...patch}:f))}
 if(disabled&&onManageFamily)return <section className="familyEditor"><h3>{label("ניהול המשפחות","Manage families")}</h3><p>{label("בחרו משפחה לעריכת המשימות, התמונות וקוד ההצטרפות שלה.","Choose a family to manage its missions, photos and invitation.")}</p><div className="familyTabs">{value.map(f=><button type="button" key={f.id} onClick={()=>onManageFamily(f.id)}>{f.name} · {f.adults} + {f.children}</button>)}</div></section>;
 return <fieldset className="familyEditor" style={{border:'1px solid #b9c9dc',borderRadius:18,padding:18,margin:'16px 0'}}><legend>{label('המשפחות המשתתפות','Participating families')}</legend>
 <p>{label('לכל משפחה קישור משלה וספר עם הזיכרונות שלה.','Each family has its own invitation and memory book.')}</p>
 <div className="familyTabs">{value.map(f=><button type="button" className={active===f.id?"selected":""} key={f.id} onClick={()=>setSelected(f.id)}>{f.name||label("משפחה","Family")}</button>)}</div>
 {value.map((f,i)=>f.id!==active?null:<div key={f.id} style={{background:'#f1f5fb',color:'#18365d',padding:16,borderRadius:12,marginBottom:12}}><label>{label('שם המשפחה','Family name')}<input disabled={disabled} aria-label={`${label('שם משפחה','Family name')} ${i+1}`} value={f.name} maxLength={80} onChange={e=>update(f.id,{name:e.target.value})}/></label><div className="familyCounts">
 <label>{label('מבוגרים','Adults')}<input disabled={disabled} aria-label={`${label('מבוגרים במשפחה','Adults in family')} ${i+1}`} type="number" min="1" max="12" value={f.adults} onChange={e=>update(f.id,{adults:e.target.value})}/></label>
 <label>{label('ילדים','Children')}<input disabled={disabled} aria-label={`${label('ילדים במשפחה','Children in family')} ${i+1}`} type="number" min="0" max="8" value={f.children} onChange={e=>{const n=Math.max(0,Math.min(8,Number(e.target.value)||0));update(f.id,{children:n,childrenAges:Array.from({length:n},(_,j)=>f.childrenAges?.[j]??'')})}}/></label>
 <label>{label('חדרים למשפחה','Rooms for family')}<input disabled={disabled} type="number" min="1" max="8" value={f.rooms||1} onChange={e=>update(f.id,{rooms:e.target.value})}/></label></div>
 {f.childrenAges?.map((age,j)=><label key={j} style={{display:'inline-block',maxWidth:120,margin:6}}>{label('גיל ילד','Child age')} {j+1}<input disabled={disabled} aria-label={`${label('גיל ילד','Child age')} ${j+1}, ${f.name}`} type="number" min="0" max="17" value={age} onChange={e=>update(f.id,{childrenAges:f.childrenAges.map((x,k)=>k===j?e.target.value:x)})}/></label>)}
 {value.length>1&&<button disabled={disabled} type="button" onClick={()=>onChange(value.filter(x=>x.id!==f.id))}>{label('הסרת משפחה','Remove family')}</button>}</div>)}
 <button type="button" disabled={disabled||value.length>=20} onClick={()=>{const id=`f-${crypto.randomUUID()}`;onChange([...value,{id,name:label(`משפחה ${value.length+1}`,`Family ${value.length+1}`),adults:2,children:0,childrenAges:[],rooms:1}]);setSelected(id)}}>{label('הוספת משפחה','Add family')}</button>
 <p><b>{value.length} {label('משפחות','families')} · {sum.adults} {label('מבוגרים','adults')} · {sum.children} {label('ילדים','children')} · {sum.rooms} {label('חדרים','rooms')}</b></p><small>{label('הרכב החדרים הוא בקשת חיפוש. התאמה וזמינות יאומתו מול מקום האירוח.','Room composition is a search request; occupancy and availability must be confirmed with the property.')}</small></fieldset>
}
