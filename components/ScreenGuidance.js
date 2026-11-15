"use client";
import {guidanceState} from "../lib/experienceGuidance";
import {tx} from "../lib/i18n";
export default function ScreenGuidance({view,experience,setView,startAICreate,lang,experiences=[]}){
 const he=lang==="he",state=guidanceState(experience);
 const requiresExperience=["studio","runtime","memory"].includes(view);
 const steps=[["ai",tx(lang,"יוצרים חוויה","Create")],["studio",tx(lang,"עורכים ומפרסמים","Edit & publish")],["runtime",tx(lang,"מזמינים ומנהלים","Invite & manage")],["memory",tx(lang,"שומרים זיכרונות","Keep memories")]];
 const copy={
 dashboard:[tx(lang,"מתחילים כאן","Start here"),tx(lang,"יוצרים חוויה חדשה עם AI, או פותחים חוויה קיימת מהרשימה כדי לערוך ולנהל אותה.","Create a new experience with AI, or open an existing one below to edit and manage it.")],
 ai:[tx(lang,"מרעיון לחוויה, צעד אחר צעד","From an idea to an experience"),tx(lang,"ממלאים שלושה שלבים קצרים, בודקים את התוכנית שה־AI מציע ומאשרים יצירה. אחר כך אפשר לערוך בסטודיו לפני הפרסום.","Complete three short steps, review the AI's plan and approve it. You can edit the result in the studio before publishing.")],
 studio:state.published?([tx(lang,"עורכים חוויה פעילה","Editing a live experience"),tx(lang,"לחצו על תחנה כדי לערוך אותה. השינויים נשמרים ומתעדכנים אצל המשתתפים מיד — אין צורך לפרסם שוב.","Select a stop to edit it. Saved changes update for participants immediately; you do not need to publish again.")]):[tx(lang,"כאן מכינים את החוויה למשתתפים","Get your experience ready"),tx(lang,"לחצו על תחנה כדי לערוך אותה. השינויים נשמרים אוטומטית. בדקו את הסדר וההנחיות, ואז פרסמו לקבלת קישור הצטרפות.","Select a stop to edit it. Changes save automatically. Check the order and instructions, then publish to get a join link.")],
 runtime:state.published?[tx(lang,"החוויה בידיים שלכם","You're in control"),state.paused?tx(lang,"החוויה מושהית. המשתתפים לא יכולים להשלים משימות עד שתלחצו על חידוש בניהול החי.","This experience is paused. Participants can continue after you resume it in live management."):tx(lang,"שתפו את קישור ההצטרפות. לחצו על תחנה לצפייה במשתתפים או לעריכה; החלפת מיקומים משנה את סדר התחנות.","Share the join link. Select a stop to see participants or edit it; swapping positions changes the route order.")]:([tx(lang,"עוד רגע יוצאים לדרך","Almost ready to go"),tx(lang,"החוויה עדיין לא פורסמה. עברו לסטודיו, בדקו את התחנות ולחצו על פרסום — אז יופיע קישור למשתתפים.","This experience isn't published yet. Review its stops in the studio and publish it to get a participant link.")]),
 memory:[tx(lang,"כל הרגעים מתאספים לספר","Your moments become a book"),tx(lang,"התמונות והתשובות שנשלחו במהלך החוויה מופיעות כאן. לוחצים על ייצוא להדפסה ושומרים כ־PDF בחלון ההדפסה.","Photos and answers shared during the experience appear here. Choose print/export, then save as PDF in the print dialog.")],
 master:[tx(lang,"מבט על כל החוויות במערכת","All experiences in one place"),tx(lang,"חפשו לפי שם, יעד או קוד. בכל כרטיס אפשר לפתוח עריכה או ניהול חי. השהיה עוצרת את התקדמות המשתתפים עד לחידוש.","Search by name, destination or code. Open editing or live management from any card. Pausing stops participant progress until resumed.")],
 };
 if(!copy[view])return null;
 const missing=requiresExperience&&state.needsSelection;
 const [title,body]=missing?([tx(lang,"קודם בוחרים חוויה","Choose an experience first"),tx(lang,"כדי לראות את המסך הזה, פתחו חוויה מלוח הבקרה או צרו חוויה חדשה.","Open an experience from the dashboard or create a new one to use this screen.")]):copy[view];
 function jump(id){const el=document.getElementById(id);el?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?"auto":"smooth",block:"center"});el?.focus({preventScroll:true})}
 return <section className={"screenGuidance "+(missing?"guidanceEmpty":"")} aria-label={tx(lang,"הכוונה למסך","Screen guidance")}>
  {view!=="master"&&<nav className="experienceSteps" aria-label={tx(lang,"שלבי העבודה","Experience workflow")}>{steps.map(([id,label],i)=><button key={id} aria-current={view===id?"step":undefined} onClick={()=>setView(id)}><span>{i+1}</span>{label}</button>)}</nav>}
  <div className="guidanceBody"><div><span className="guidanceEyebrow">{tx(lang,"מה עושים עכשיו?","WHAT'S NEXT?")}</span><h2 id="screen-guide-title" tabIndex={-1}>{title}</h2><p>{body}</p></div><div className="guidanceActions">
  {missing?<><button className="guidePrimary" onClick={()=>experiences.length?setView("dashboard"):startAICreate()}>{experiences.length?(tx(lang,"בחירת חוויה","Choose experience")):(tx(lang,"יצירת חוויה","Create experience"))}</button>{!!experiences.length&&<button onClick={startAICreate}>{tx(lang,"יצירת חוויה חדשה","Create a new experience")}</button>}</>:
   view==="dashboard"?<button className="guidePrimary" onClick={startAICreate}>{tx(lang,"מתחילים ליצור","Start creating")}</button>:
   view==="studio"?<button className="guidePrimary" onClick={()=>state.published?setView("runtime"):jump("publish-experience")}>{state.published?(tx(lang,"לשיתוף וניהול חי","Invite & manage")):(tx(lang,"לפרסום החוויה","Go to publishing"))}</button>:
   view==="runtime"?<button className="guidePrimary" onClick={()=>state.published?jump("experience-share"):setView("studio")}>{state.published?(tx(lang,"לקישור ההצטרפות","Get join link")):(tx(lang,"לבדיקה ופרסום בסטודיו","Review & publish in studio"))}</button>:
   view==="memory"?<button onClick={()=>setView("runtime")}>{tx(lang,"חזרה לניהול החוויה","Back to live management")}</button>:null}
  </div></div>
  {!missing&&<details className="guidanceHelp"><summary>{tx(lang,"איך זה עובד? הסבר קצר","How does it work? Quick guide")}</summary><ol>{([tx(lang,"יוצרים: מתארים למי החוויה, איפה ומה רוצים לעשות.","Create: describe who it's for, where and what you'd like to do."),tx(lang,"עורכים ומפרסמים: בודקים את המשימות ומקבלים קישור הצטרפות.","Edit & publish: review missions and get the join link."),tx(lang,"מנהלים: שולחים את הקישור ורואים מי הגיע לכל תחנה ומה הושלם.","Manage: send the link and follow progress at each stop."),tx(lang,"שומרים: התמונות והתשובות נאספות לספר הזיכרונות.","Keep: photos and answers are collected in the memory book.")]).map(x=><li key={x}>{x}</li>)}</ol></details>}
 </section>;
}
