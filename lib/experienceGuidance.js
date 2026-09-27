export const missionLabels={he:{photo:"צילום",video:"סרטון",map:"נקודת הגעה",quiz:"חידון בחירה",puzzle:"חידה",note:"שאלה פתוחה",reward:"פרס",story:"סיפור והנחיה",branch:"בחירת מסלול"},en:{photo:"Photo",video:"Video",map:"Checkpoint",quiz:"Multiple choice",puzzle:"Riddle",note:"Open question",reward:"Reward",story:"Story & instructions",branch:"Choose a path"}};
export function guidanceState(experience={}){
  const selected=!!experience.id;
  const hasMissions=selected&&Array.isArray(experience.flow)&&experience.flow.length>0;
  const published=selected&&experience.status==="live"&&!!experience.joinCode;
  return {selected,hasMissions,published,paused:!!experience.paused,needsSelection:!selected};
}
export function participantHint(mission={},lang="en"){
 const he=lang==="he";
 if(mission.type==="branch"&&mission.organizerDecides)return he?"מחכים לבחירת המארגן. המסלול ימשיך אוטומטית אחרי ההחלטה.":"Wait for the organizer's choice. Your journey continues automatically after the decision.";
 if(mission.type==="story"&&mission.organizerDecides)return he?"לחצו על האפשרות המועדפת עליכם או הציעו הצעה משלכם. ההצבעה נשמרת, והמארגן יחליט מתי ממשיכים.":"Tap your preferred option or suggest your own. Your vote is saved; the organizer makes the final choice.";
 const hints={
  photo:["בחרו תמונה או צלמו, ואז לחצו על השלמה כדי להעלות אותה ולהמשיך.","Choose or take a photo, then complete the task to upload it and continue."],
  video:["בחרו או צלמו סרטון, ואז לחצו על השלמה. המתינו לסיום ההעלאה.","Choose or record a video, then complete the task. Wait for the upload to finish."],
  quiz:["לחצו על התשובה שבחרתם — היא נבדקת מיד. תשובה נכונה מעבירה לתחנה הבאה; טעות מאפשרת ניסיון נוסף ומפחיתה ניקוד.","Tap an answer to check it immediately. A correct answer moves you on; a wrong answer allows another try with fewer points."],
  puzzle:["כתבו את הפתרון לחידה ולחצו על השלמה כדי לבדוק אותו.","Enter the riddle's solution and complete the task to check it."],
  note:["כתבו במילים שלכם ולחצו על השלמה. זו תשובה אישית, ואין פתרון יחיד שצריך לנחש.","Write in your own words, then complete the task. There is no single correct personal answer."],
  branch:["לחצו על המסלול הרצוי — הבחירה מעבירה אתכם לתחנה המתאימה.","Choose a path to move to its next stop."],
  story:["קראו את ההנחיה, וכשתסיימו לחצו על השלמה כדי להמשיך.","Read the instructions, then complete the task when you are ready to continue."],
  reward:["זה הרגע לחגוג! לחצו על השלמה כדי להתקדם במסע.","Enjoy this moment! Complete the task to continue your journey."],
 };
 if(mission.type==="map")return he?(mission.qrCode?"סרקו את קוד התחנה. אם קיימת גם בדיקת מיקום, אפשר להשתמש באחת הדרכים, ואז ללחוץ על השלמה.":Number.isFinite(mission.lat)&&Number.isFinite(mission.lng)?"הגיעו לנקודה ולחצו על בדיקת המיקום. אחרי אישור ההגעה תוכלו להשלים.":"הגיעו למקום המתואר בהנחיה, ואז לחצו על השלמה."):(mission.qrCode?"Scan the stop's code. If a location check is also available, either method works; then complete the task.":Number.isFinite(mission.lat)&&Number.isFinite(mission.lng)?"Reach the stop and check your location. Once confirmed, complete the task.":"Reach the place in the instructions, then complete the task.");
 return (hints[mission.type]||hints.story)[he?0:1];
}
