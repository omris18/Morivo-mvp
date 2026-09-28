import artContext from "../functions/experienceArtContext";
import journeyProgress from "../functions/journeyProgress";
export const VISUAL_THEMES = {
 thailand:{he:"תאילנד",en:"Thailand",scene:0,accent:"#197f75",motif:"✦"},
 greece:{he:"יוון",en:"Greece",scene:1,accent:"#236ca0",motif:"◈"},
 israel:{he:"ישראל",en:"Israel",scene:2,accent:"#9a713d",motif:"✧"},
 nature:{he:"טבע והרפתקאות",en:"Nature & adventure",scene:null,accent:"#3f795b",motif:"✦"},
 celebration:{he:"חגיגה",en:"Celebration",scene:null,accent:"#b86366",motif:"✶"},
 learning:{he:"גילוי ולמידה",en:"Discovery & learning",scene:null,accent:"#7468a0",motif:"◇"},
 journey:{he:"מסע אישי",en:"Your journey",scene:null,accent:"#267b83",motif:"✧"}
};
export function getExperienceTheme(exp={}){
 const decorate=(key,automatic=false)=>({key,...VISUAL_THEMES[key],image:automatic&&exp.routeArtwork?.context===artContext.experienceArtContext(exp)?exp.routeArtwork.url:`/route-${key}.svg`,portrait:key==="celebration"?exp.celebrationPortrait?.url:null});
 if(VISUAL_THEMES[exp.visualTheme])return decorate(exp.visualTheme);
 const place=[exp.location,exp.name].filter(Boolean).join(" ").toLowerCase();
 const destinations=[
 ["thailand",/thailand|phuket|bangkok|krabi|samui|khao lak|תאילנד|פוקט|בנגקוק|קראבי|קוסמוי/],
 ["greece",/greece|greek|athens|crete|santorini|rhodes|corfu|יוון|אתונה|כרתים|סנטוריני|רודוס/],
 ["israel",/israel|jerusalem|tel aviv|galilee|eilat|haifa|negev|ישראל|ירושלים|תל אביב|גליל|אילת|חיפה|נגב|גולן/]
 ];
 for(const [key,re] of destinations)if(re.test(place))return decorate(key,true);
 const kind=String(exp.type||"").toLowerCase();
 const key=/birthday|mitzvah|celebration|יום הולדת|מצווה|חגיגה/.test(kind)?"celebration":/school|museum|בית ספר|מוזיאון/.test(kind)?"learning":/hike|nature|camp|טבע|שטח/.test(kind+" "+place)?"nature":"journey";
 return decorate(key,true);
}
export function missionDone(progress,mission,index){return !progress.pending&&((progress.completedMissionIds||[]).includes(mission.id)||(progress.progressVersion!==2&&Number(progress.currentMissionIndex||0)>index));}
export function missionActive(progress,mission,flow=[]){return !progress.pending&&flow[journeyProgress.currentMissionIndex(progress,flow)]?.id===mission.id;}
export function journeyFinished(progress,flow=[]){return !progress.pending&&flow.length>0&&journeyProgress.normalizeProgress(progress,flow).journeyEnded;}
// Mirrors the day-number fallback buildRouteGroups already uses for the route map: an explicit
// day/dayNumber field wins (an organizer can set one in Studio), otherwise fall back to the
// "Day N" / "יום N" every AI-generated day-opener title carries.
export function missionDayNumber(m){
 if(Number.isFinite(m?.day))return m.day;
 if(Number.isFinite(m?.dayNumber))return m.dayNumber;
 const match=String(m?.title||"").match(/(?:day|יום)\s*([0-9]+)/i);
 return match?Number(match[1]):null;
}
// A trip's day 1 is its startDate itself, day 2 is startDate+1, and so on - missions should
// become completable once their own calendar day begins, not simply once the previous mission
// is done (a fast participant could otherwise blow through the whole trip in one sitting).
export function missionUnlockDate(startDate,mission){
 const day=missionDayNumber(mission);
 if(!startDate||!Number.isFinite(day))return null;
 const d=new Date(startDate+"T00:00:00");
 if(Number.isNaN(d.getTime()))return null;
 d.setDate(d.getDate()+(day-1));
 return d;
}
export function isMissionDayLocked(startDate,mission){
 const unlock=missionUnlockDate(startDate,mission);
 if(!unlock)return false;
 const today=new Date();today.setHours(0,0,0,0);
 return unlock.getTime()>today.getTime();
}
export function missionMapUrl(m={}){
 const lat=m.lat??m.latitude, lng=m.lng??m.longitude;
 if(lat!==null&&lat!==undefined&&lat!==""&&lng!==null&&lng!==undefined&&lng!==""&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lng))<=180)return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(lat+","+lng);
 const location=typeof m.location==="string"?m.location:typeof m.address==="string"?m.address:"";
 return location.trim()?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(location):null;
}
export function buildMemoryChapters(flow=[],media=[],answers=[],progress=[],extraTitle="More memories"){
 const known=new Set(flow.map(m=>m.id));
 const groups=flow.map((mission,index)=>({mission,index,photos:media.filter(x=>x.missionId===mission.id),quotes:answers.filter(x=>x.missionId===mission.id),done:progress.some(p=>missionDone(p,mission,index))})).filter(x=>x.photos.length||x.quotes.length||x.done);
 const loosePhotos=media.filter(x=>!known.has(x.missionId)),looseQuotes=answers.filter(x=>!known.has(x.missionId));
 if(loosePhotos.length||looseQuotes.length)groups.push({mission:{id:"collected-memories",title:extraTitle,type:"story"},index:flow.length,photos:loosePhotos,quotes:looseQuotes,done:false});
 return groups.flatMap(g=>Array.from({length:Math.max(1,Math.ceil(g.photos.length/4),Math.ceil(g.quotes.length/2))},(_,page)=>({...g,page,key:g.mission.id+"-"+page,photos:g.photos.slice(page*4,page*4+4),quotes:g.quotes.slice(page*2,page*2+2)})));
}
