import {tx} from "../lib/i18n";
const URL_RE=/(https?:\/\/[^\s<>]+)/gi;
const IS_URL=/^https?:\/\//i;
function linkLabel(url,lang){
 try{const host=new URL(url).hostname.toLowerCase();return /(^|\.)booking\.com$/.test(host)?tx(lang,"בדיקת זמינות והזמנה ↗","Availability & booking ↗"):/google\.[a-z.]+$/.test(host)||host==='maps.app.goo.gl'?tx(lang,"פתיחה במפה ↗","Open map ↗"):tx(lang,"פרטים נוספים ↗","More details ↗")}catch{return tx(lang,"פתיחת קישור ↗","Open link ↗")}
}
export default function LinkifiedText({text,lang}){
 if(!text)return null;
 const language=lang||(/[\u0590-\u05ff]/.test(text)?'he':'en');
 return String(text).split('\n').map((line,li)=><span key={li}>{li>0&&<br/>}{line.split(URL_RE).map((part,i)=>IS_URL.test(part)?<a className="missionDetailLink" key={i} href={part.replace(/[.,;]+$/,'')} target="_blank" rel="noopener noreferrer">{linkLabel(part,language)}</a>:part)}</span>);
}
