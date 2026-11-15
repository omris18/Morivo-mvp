const {isCoordinationMission}=require('./coordination');
function plainSummary(value,limit=180){
 const text=String(value||'')
  .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/gi,'$1')
  .replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi,'')
  .replace(/\b[\w.-]+\.(?:com|org|net|co\.il)(?:\/[^\s]*)?/gi,'')
  .replace(/\s+/g,' ').trim();
 if(text.length<=limit)return text;
 const head=text.slice(0,limit-1),space=head.lastIndexOf(' ');
 return head.slice(0,space>limit/2?space:head.length).trimEnd()+'…';
}
function missionSummary(m={},lang='en'){
 if(m.summary&&plainSummary(m.summary))return plainSummary(m.summary);
 if(isCoordinationMission(m))return lang==='he'
  ?(m.isAttractionsPoll?'בחרו את האטרקציות שמעניינות אתכם. המנהל יאשר את הבחירה הסופית.':'בחרו מקום לינה שמתאים לכם. האפשרויות והקישורים מופיעים בפרטי הבחירה.')
  :(m.isAttractionsPoll?'Choose the attractions you prefer. The organizer will approve the final selection.':'Choose suitable accommodation. Options and booking links are in the choice details.');
 const source=String(m.text||m.description||m.title||'');
 // The first meaningful paragraph is enough for a preview. Keep the complete instruction below.
 const first=source.split(/\n\s*\n/).map(s=>plainSummary(s)).find(Boolean)||plainSummary(m.title);
 return plainSummary(first);
}
module.exports={plainSummary,missionSummary};
