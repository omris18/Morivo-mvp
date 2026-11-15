const {isCoordinationMission}=require('./coordination');
function familyFlow(experience={},familyId){
 const flow=experience.flow||[],overrides=experience.familyMissionOverrides?.[familyId]||{};
 return flow.map(m=>isCoordinationMission(m)?m:({...m,...overrides[m.id],id:m.id}));
}
function dateKey(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}
function bookReleased(experience={},progress=[],now=new Date()){
 if(experience.endDate)return /^\d{4}-\d{2}-\d{2}$/.test(experience.endDate)&&dateKey(now)>experience.endDate;
 return progress.length>0&&progress.every(p=>p.journeyEnded===true);
}
module.exports={familyFlow,bookReleased,dateKey};
