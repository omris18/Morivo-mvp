"use client";
import {guidanceState} from "../lib/experienceGuidance";
export default function ScreenGuidance({view,experience,setView,lang,experiences=[]}){
 const he=lang==="he",state=guidanceState(experience);
 const requiresExperience=["studio","runtime","memory"].includes(view);
 const steps=he?[["ai","יוצרים חוויה"],["studio","עורכים ומפרסמים"],["runtime","מזמינים ומנהלים"],["memory","שומרים זיכרונות"]]:[["ai","Create"],["studio","Edit & publish"],["runtime","Invite & manage"],["memory","Keep memories"]];
 const copy={
 dashboard:he?["מתחילים כאן","יוצרים חוויה חדשה עם AI, או פותחים חוויה קיימת מהרשימה כדי לערוך ולנהל אותה."]:["Start here","Create a new experience with AI, or open an existing one below to edit and manage it."],
 ai:he?["מרעיון לחוויה, צעד אחר צעד","ממלאים שלושה שלבים קצרים, בודקים את התוכנית שה־AI מציע ומאשרים יצירה. אחר כך אפשר לערוך בסטודיו לפני הפרסום."]:["From an idea to an experience","Complete three short steps, review the AI's plan and approve it. You can edit the result in the studio before publishing."],
 studio:state.published?(he?["עורכים חוויה פעילה","לחצו על תחנה כדי לערוך אותה. השינויים נשמרים ומתעדכנים אצל המשתתפים מיד — אין צורך לפרסם שוב."]:["Editing a live experience","Select a stop to edit it. Saved changes update for participants immediately; you do not need to publish again."]):he?["כאן מכינים את החוויה למשתתפים","לחצו על תחנה כדי לערוך אותה. השינויים נשמרים אוטומטית. בדקו את הסדר וההנחיות, ואז פרסמו לקבלת קישור הצטרפות."]:["Get your experience ready","Select a stop to edit it. Changes save automatically. Check the order and instructions, then publish to get a join link."],
 runtime:state.published?(he?["החוויה בידיים שלכם",state.paused?"החוויה מושהית. המשתתפים לא יכולים להשלים משימות עד שתלחצו על חידוש בניהול החי.":"שתפו את קישור ההצטרפות. לחצו על תחנה לצפייה במשתתפים או לעריכה; החלפת מיקומים משנה את סדר התחנות."]:["You're in control",state.paused?"This experience is paused. Participants can continue after you resume it in live management.":"Share the join link. Select a stop to see participants or edit it; swapping positions changes the route order."]):(he?["עוד רגע יוצאים לדרך","החוויה עדיין לא פורסמה. עברו לסטודיו, בדקו את התחנות ולחצו על פרסום — אז יופיע קישור למשתתפים."]:["Almost ready to go","This experience isn't published yet. Review its stops in the studio and publish it to get a participant link."]),
 memory:he?["כל הרגעים מתאספים לספר","התמונות והתשובות שנשלחו במהלך החוויה מופיעות כאן. לוחצים על ייצוא להדפסה ושומרים כ־PDF בחלון ההדפסה."]:["Your moments become a book","Photos and answers shared during the experience appear here. Choose print/export, then save as PDF in the print dialog."],
 master:he?["מבט על כל החוויות במערכת","חפשו לפי שם, יעד או קוד. בכל כרטיס אפשר לפתוח עריכה או ניהול חי. השהיה עוצרת את התקדמות המשתתפים עד לחידוש."]:["All experiences in one place","Search by name, destination or code. Open editing or live management from any card. Pausing stops participant progress until resumed."],
 };
 if(!copy[view])return null;
 const missing=requiresExperience&&state.needsSelection;
 const [title,body]=missing?(he?["קודם בוחרים חוויה","כדי לראות את המסך הזה, פתחו חוויה מלוח הבקרה או צרו חוויה חדשה."]:["Choose an experience first","Open an experience from the dashboard or create a new one to use this screen."]):copy[view];
 function jump(id){const el=document.getElementById(id);el?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?"auto":"smooth",block:"center"});el?.focus({preventScroll:true})}
 return <section className={"screenGuidance "+(missing?"guidanceEmpty":"")} aria-label={he?"הכוונה למסך":"Screen guidance"}>
  {view!=="master"&&<nav className="experienceSteps" aria-label={he?"שלבי העבודה":"Experience workflow"}>{steps.map(([id,label],i)=><button key={id} aria-current={view===id?"step":undefined} onClick={()=>setView(id)}><span>{i+1}</span>{label}</button>)}</nav>}
  <div className="guidanceBody"><div><span className="guidanceEyebrow">{he?"מה עושים עכשיו?":"WHAT'S NEXT?"}</span><h2 id="screen-guide-title" tabIndex={-1}>{title}</h2><p>{body}</p></div><div className="guidanceActions">
  {missing?<><button className="guidePrimary" onClick={()=>setView(experiences.length?"dashboard":"ai")}>{experiences.length?(he?"בחירת חוויה":"Choose experience"):(he?"יצירת חוויה":"Create experience")}</button>{!!experiences.length&&<button onClick={()=>setView("ai")}>{he?"יצירת חוויה חדשה":"Create a new experience"}</button>}</>:
   view==="dashboard"?<button className="guidePrimary" onClick={()=>setView("ai")}>{he?"מתחילים ליצור":"Start creating"}</button>:
   view==="studio"?<button className="guidePrimary" onClick={()=>state.published?setView("runtime"):jump("publish-experience")}>{state.published?(he?"לשיתוף וניהול חי":"Invite & manage"):(he?"לפרסום החוויה":"Go to publishing")}</button>:
   view==="runtime"?<button className="guidePrimary" onClick={()=>state.published?jump("experience-share"):setView("studio")}>{state.published?(he?"לקישור ההצטרפות":"Get join link"):(he?"לבדיקה ופרסום בסטודיו":"Review & publish in studio")}</button>:
   view==="memory"?<button onClick={()=>setView("runtime")}>{he?"חזרה לניהול החוויה":"Back to live management"}</button>:null}
  </div></div>
  {!missing&&<details className="guidanceHelp"><summary>{he?"איך זה עובד? הסבר קצר":"How does it work? Quick guide"}</summary><ol>{(he?["יוצרים: מתארים למי החוויה, איפה ומה רוצים לעשות.","עורכים ומפרסמים: בודקים את המשימות ומקבלים קישור הצטרפות.","מנהלים: שולחים את הקישור ורואים מי הגיע לכל תחנה ומה הושלם.","שומרים: התמונות והתשובות נאספות לספר הזיכרונות."]:["Create: describe who it's for, where and what you'd like to do.","Edit & publish: review missions and get the join link.","Manage: send the link and follow progress at each stop.","Keep: photos and answers are collected in the memory book."]).map(x=><li key={x}>{x}</li>)}</ol></details>}
 </section>;
}
