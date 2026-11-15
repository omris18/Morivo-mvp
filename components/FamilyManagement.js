"use client";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
import {tx} from "../lib/i18n";
import familyJourney from "../functions/familyJourney";
import coordination from "../functions/coordination";
import {subscribeFamilyInvites,subscribeAllProgress,subscribeAnswers,updateFamilyMission,updateExperienceRemote} from "../lib/morivoData";
import {subscribeMedia} from "../lib/mediaData";
import RouteMissionPanel from "./RouteMissionPanel";
import Memory from "./Memory";
export default function FamilyManagement(props){
 const {experience,familyId,user,isMaster,lang,setView}=props;
 const family=experience.families?.find(f=>f.id===familyId);
 const [tab,setTab]=useState("missions"),[selected,setSelected]=useState(null),[dirty,setDirty]=useState(false);
 const [invites,setInvites]=useState([]),[qr,setQr]=useState(""),[people,setPeople]=useState([]),[media,setMedia]=useState([]),[answers,setAnswers]=useState([]);
 const [preferences,setPreferences]=useState(experience.familyPreferences?.[familyId]||""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const owner=!!user?.uid&&(experience.ownerUid===user.uid||isMaster);
 const flow=coordination.journeyFlow(familyJourney.familyFlow(experience,familyId));
 const mission=flow.find(m=>m.id===selected)||flow[0];
 const invite=invites.find(x=>x.familyId===familyId);
 const link=invite&&typeof window!=="undefined"?`${window.location.origin}/?join=${encodeURIComponent(invite.code)}`:"";
 useEffect(()=>{if(!owner||!family)return;const subs=[subscribeFamilyInvites(experience.id,setInvites),subscribeAllProgress(experience.id,setPeople,familyId),subscribeMedia(experience.id,setMedia,familyId),subscribeAnswers(experience.id,setAnswers,familyId)];return()=>subs.forEach(unsub=>unsub())},[experience.id,familyId,owner]);
 useEffect(()=>{let alive=true;setQr("");if(link)QRCode.toDataURL(link,{width:200,margin:2}).then(url=>{if(alive)setQr(url)});return()=>{alive=false}},[link]);
 function change(action){if(dirty&&!window.confirm(tx(lang,"לוותר על השינויים שלא נשמרו?","Discard unsaved changes?")))return;setDirty(false);action()}
 async function savePreferences(){setBusy(true);setNotice("");try{await updateExperienceRemote(experience.id,{[`familyPreferences.${familyId}`]:preferences});setNotice(tx(lang,"ההעדפות נשמרו למשפחה הזו","Preferences saved for this family"))}catch(e){setNotice(e.message)}finally{setBusy(false)}}
 if(!owner||!family)return <section className="panel"><p>{tx(lang,"ניהול המשפחה זמין למנהל החוויה בלבד.","Family management is available to the organizer only.")}</p></section>;
 return <section className="familyManager" dir={props.dir}>
  <header className="familyManagerHead"><div><small>{experience.name}</small><h1>{family.name}</h1><p>{family.adults} {tx(lang,"מבוגרים","adults")} · {family.children} {tx(lang,"ילדים","children")}{family.childrenAges?.length?` · ${tx(lang,"גילאים","Ages")}: ${family.childrenAges.join(", ")}`:""}</p></div><button onClick={()=>change(()=>setView("runtime"))}>{tx(lang,"חזרה לניהול החוויה","Back to experience management")}</button></header>
  <div className="familyManagerTabs" role="tablist" aria-label={tx(lang,"ניהול המשפחה","Family management")}>{[["missions","משימות והעדפות","Missions & preferences"],["book","ספר ותמונות","Book & photos"],["invite","קוד ו־QR להצטרפות","Join code & QR"]].map(([id,he,en])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>change(()=>setTab(id))}>{tx(lang,he,en)}</button>)}</div>
  {tab==="missions"&&<div role="tabpanel"><div className="familyManagerPreferences"><label>{tx(lang,"העדפות ודגשים למשפחה","Family preferences")}<textarea value={preferences} maxLength={1500} rows={2} onChange={e=>setPreferences(e.target.value)} placeholder={tx(lang,"למשל: ילדים בגילאי 3 ו־7, פעילויות קצרות ומנוחה בצהריים","For example: ages 3 and 7, short activities and an afternoon break")}/></label><button disabled={busy} onClick={savePreferences}>{tx(lang,"שמירת העדפות","Save preferences")}</button><p role="status">{notice}</p></div><p>{tx(lang,"כאן עורכים או מחליפים את סוג ותוכן המשימה רק למשפחה הזו. המסלול המשותף והמשימות של שאר המשפחות נשארים כפי שהם. ההתקדמות הקיימת נשמרת.","Edit or replace the mission type and content for this family. Other families keep their missions. Existing progress is retained.")}</p><div className="familyManagerLayout"><nav aria-label={tx(lang,"משימות המשפחה","Family missions")}>{flow.map((m,i)=><button key={m.id} aria-pressed={mission?.id===m.id} onClick={()=>change(()=>setSelected(m.id))}><b>{i+1}. {m.title}</b>{experience.familyMissionOverrides?.[familyId]?.[m.id]&&<small>{tx(lang,"מותאם למשפחה","Customized")}</small>}</button>)}</nav>{mission&&<RouteMissionPanel key={mission.id} mission={mission} index={flow.findIndex(m=>m.id===mission.id)} flow={flow} people={people} media={media.filter(m=>!m.deleted)} answers={answers} lang={lang} onDirtyChange={setDirty} onSave={(original,edited)=>updateFamilyMission(experience.id,familyId,original,edited)}/>}</div></div>}
  {tab==="book"&&<div role="tabpanel"><p>{tx(lang,"תצוגה מקדימה למנהל בלבד עד סיום הטיול. כאן אפשר לערוך או להסיר תמונות כפולות.","Organizer preview until the trip ends. Edit or remove duplicate photos here.")}</p><Memory {...props} familyId={familyId}/></div>}
  {tab==="invite"&&<div role="tabpanel" className="familyManagerInvite"><h2>{tx(lang,"ההזמנה של המשפחה","Family invitation")}</h2><p>{tx(lang,"שתפו את הקישור או ה־QR עם בני המשפחה. כל אחד מצטרף בשמו לאותה משפחה.","Share this link or QR with the family. Each person joins under their own name.")}</p>{qr&&<img src={qr} width="200" height="200" alt={tx(lang,"קוד QR להצטרפות למשפחה","Family join QR code")}/>}<p>{tx(lang,"קוד המשפחה","Family code")}: <strong dir="ltr">{invite?.code||"…"}</strong></p><input readOnly value={link} dir="ltr" aria-label={tx(lang,"קישור המשפחה","Family link")}/><button disabled={!link} onClick={async()=>{try{await navigator.clipboard.writeText(link);setNotice(tx(lang,"הקישור הועתק","Link copied"))}catch{setNotice(tx(lang,"אפשר להעתיק את הקישור מהשדה","Copy the link from the field"))}}}>{tx(lang,"העתקת קישור","Copy link")}</button><p role="status">{notice}</p></div>}
 </section>;
}
