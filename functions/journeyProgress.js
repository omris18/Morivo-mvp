function normalizeProgress(progress = {}, flow = []) {
  const completedMissionIds = [...new Set(progress.completedMissionIds || [])];
  const legacyIndex = Math.max(0,Number(progress.currentMissionIndex) || 0);
  const skippedMissionIds = [...new Set(progress.skippedMissionIds || (progress.progressVersion === 2 ? [] : flow.slice(0,legacyIndex).filter(m=>!completedMissionIds.includes(m.id)).map(m=>m.id)))];
  const journeyEnded = progress.progressVersion === 2 ? !!progress.journeyEnded : flow.length > 0 && (legacyIndex >= flow.length || flow.every(m=>completedMissionIds.includes(m.id)||skippedMissionIds.includes(m.id)));
  const fallback = flow.find(m=>!completedMissionIds.includes(m.id)&&!skippedMissionIds.includes(m.id));
  const currentMissionId = journeyEnded ? null : progress.progressVersion === 2 ? (flow.some(m=>m.id===progress.currentMissionId) ? progress.currentMissionId : fallback?.id || null) : flow[legacyIndex]?.id || fallback?.id || null;
  return {...progress,progressVersion:2,completedMissionIds,skippedMissionIds,currentMissionId,currentMissionIndex:currentMissionId ? flow.findIndex(m=>m.id===currentMissionId) : flow.length,journeyEnded:journeyEnded || (flow.length>0&&!currentMissionId)};
}
function currentMissionIndex(progress,flow) {return normalizeProgress(progress,flow).currentMissionIndex;}
function advanceProgress(progress,flow,missionId,{skip=false,branchTarget,awardedPoints}={}) {
  const p=normalizeProgress(progress,flow),index=flow.findIndex(m=>m.id===missionId);
  if(index<0)throw new Error('This mission was removed. Refresh the experience.');
  if(p.currentMissionId!==missionId) {
    if(p.completedMissionIds.includes(missionId)||p.skippedMissionIds.includes(missionId))return p;
    throw new Error('The active mission changed. Please refresh before continuing.');
  }
  const completed=new Set(p.completedMissionIds),skipped=new Set(p.skippedMissionIds);
  const already=completed.has(missionId);
  if(skip)skipped.add(missionId);else completed.add(missionId);
  let next;
  if(branchTarget!==undefined) {
    const target=branchTarget===null?flow.length:flow.findIndex(m=>m.id===branchTarget);
    if(target<0)throw new Error('The selected route no longer exists. Refresh the experience.');
    for(let i=index+1;i<target;i++)if(!completed.has(flow[i].id))skipped.add(flow[i].id);
    next=flow[target];
    if(target===flow.length)for(const m of flow)if(!completed.has(m.id))skipped.add(m.id);
  } else next=flow.find(m=>!completed.has(m.id)&&!skipped.has(m.id));
  const maximum=Math.max(0,Math.min(500,Number(flow[index].points??100)||0));
  const earned=Number.isFinite(Number(awardedPoints))?Math.max(0,Math.min(maximum,Number(awardedPoints))):maximum;
  return {...p,completedMissionIds:[...completed],skippedMissionIds:[...skipped],currentMissionId:next?.id||null,currentMissionIndex:next?flow.findIndex(m=>m.id===next.id):flow.length,journeyEnded:!next,points:(p.points||0)+(skip||already?0:earned),lastMissionId:missionId,lastMissionTitle:flow[index].title||''};
}
function reorderProgress(progress,oldFlow,newFlow) {
  const p=normalizeProgress(progress,oldFlow);
  return {...p,currentMissionIndex:p.currentMissionId?newFlow.findIndex(m=>m.id===p.currentMissionId):newFlow.length};
}
module.exports={normalizeProgress,currentMissionIndex,advanceProgress,reorderProgress};
