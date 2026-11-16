const {totals}=require('./families');
function cleanUrl(value){return String(value||'').replace(/&amp;/gi,'&').replace(/[)\]}>.,;]+$/,'')}
function bookingUrl(value,experience={},familyId=null){
 const cleaned=cleanUrl(value);let url;
 try{url=new URL(cleaned)}catch{return value}
 if(!/(^|\.)booking\.com$/i.test(url.hostname))return value;
 // Old Booking links may use semicolons instead of ampersands.
 url.search=url.search.replace(/;/g,'&');
 const p=url.searchParams;
 const family=experience.families?.find(f=>f.id===familyId);
 // Explicit family links remain family-scoped in the organizer's overall view.
 const taggedFamily=experience.families?.find(f=>f.id===p.get('morivo_family'));
 const legacyFamily=experience.families?.find(f=>String(f.adults)===p.get('group_adults')&&String(f.children)===p.get('group_children')&&String(f.rooms||1)===p.get('no_rooms')&&JSON.stringify((f.childrenAges||[]).map(Number).sort((a,b)=>a-b))===JSON.stringify(p.getAll('age').map(Number).sort((a,b)=>a-b)));
 const party=family||taggedFamily||legacyFamily||(experience.families?.length?totals(experience.families):Number(experience.adultsCount)>0?{adults:experience.adultsCount,children:experience.childrenCount||0,childrenAges:experience.childrenAges||[],rooms:experience.rooms||Math.max(1,Math.ceil((Number(experience.adultsCount)+Number(experience.childrenCount||0))/4))}:null);
 p.delete('morivo_family');
 if(experience.startDate&&experience.endDate){
  for(const key of [...p.keys()])if(/^(checkin|checkout)(_|$)/.test(key)||['selected_date','length_of_stay','nflt_date'].includes(key))p.delete(key);
  p.set('checkin',experience.startDate);p.set('checkout',experience.endDate);
 }
 if(party){
  for(const key of [...p.keys()])if(/^(age(\[\d*\])?|room\d+|req_adults|req_children|req_age|selected_room|all_sr_blocks|highlighted_blocks|sr_pri_blocks)$/.test(key))p.delete(key);
  p.set('group_adults',String(party.adults));p.set('group_children',String(party.children));p.set('no_rooms',String(party.rooms||1));
  for(const age of (party.childrenAges||[]).slice(0,Number(party.children)))p.append('age',String(age));
 }
 if((url.pathname==='/'||/^\/index\./.test(url.pathname))&&!p.has('dest_id')){url.pathname='/searchresults.html';if(!p.get('ss'))p.set('ss',experience.location||'')}
 return url.toString();
}
module.exports={bookingUrl,cleanUrl};
