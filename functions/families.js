// Shared domain contract; no client-supplied family assignment is trusted at join.
function normalizeFamilies(input){
 if(input==null||Array.isArray(input)&&input.length===0)return [];
 if(!Array.isArray(input)||input.length>20)throw new Error('Choose 1–20 families.');
 const ids=new Set();return input.map((f,i)=>{const id=String(f.id||`family-${i+1}`),name=String(f.name||'').trim().slice(0,80);const adults=Number(f.adults),children=Number(f.children),rooms=Number(f.rooms??1),ages=f.childrenAges||[];
 if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||ids.has(id)||!name)throw new Error('Each family needs a unique ID and a name.');ids.add(id);
 if(!Number.isInteger(adults)||adults<1||adults>12||!Number.isInteger(children)||children<0||children>8||!Number.isInteger(rooms)||rooms<1||rooms>8)throw new Error('Invalid family composition.');
 if(ages.length!==children||ages.some(x=>x===''||x==null||!Number.isInteger(Number(x))||Number(x)<0||Number(x)>17))throw new Error('Enter an age (0–17) for every child.');
 return {id,name,adults,children,rooms,childrenAges:ages.map(Number)};
 });
}
function totals(families){return families.reduce((s,f)=>({adults:s.adults+Number(f.adults||0),children:s.children+Number(f.children||0),rooms:s.rooms+Number(f.rooms??1),childrenAges:[...s.childrenAges,...(f.childrenAges||[])]}),{adults:0,children:0,rooms:0,childrenAges:[]})}
function familyBrief(families){return families.length?'Travel party consists of separate households. Do not treat them as one household or assign unrelated families to a room. Plan activities suitable for all ages. Accommodation requirements (search criteria, not verified availability): '+families.map(f=>`${f.name}: ${f.adults} adults + ${f.children} children (ages ${f.childrenAges.join(',')||'none'}), ${f.rooms} room(s) for this family`).join('; ')+'. Confirm occupancy and availability with the accommodation.':''}
function withFamilyRequest(data){const families=normalizeFamilies(data.families);if(!families.length)return data;const t=totals(families),brief=familyBrief(families);return {...data,families,...t,people:t.adults+t.children,prompt:`${data.prompt||''}\n${brief}\nRespond in the requested language (${data.lang||"he"}).`,peopleDetails:`${data.peopleDetails||''}\n${brief}`}}
function familyBookingUrl(family,location,checkin,checkout){const p=new URLSearchParams({ss:location||"",group_adults:String(family.adults),group_children:String(family.children),no_rooms:String(family.rooms||1)});if(checkin)p.set("checkin",checkin);if(checkout)p.set("checkout",checkout);for(const age of family.childrenAges||[])p.append("age",String(age));return "https://www.booking.com/searchresults.html?"+p.toString()}
module.exports={familyBookingUrl,normalizeFamilies,totals,familyBrief,withFamilyRequest};
