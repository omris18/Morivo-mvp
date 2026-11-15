// Shared classification also recognizes logistics generated before isCoordination existed.
function isCoordinationMission(m={}) {
  return !!(m.isCoordination || m.isAttractionsPoll || m.isLocationPoll || m.isDestinationPoll || (m.organizerDecides && m.type==='story' && Number(m.points)===0));
}
function journeyFlow(flow=[]) { return flow.filter(m=>!isCoordinationMission(m)); }
module.exports={isCoordinationMission,journeyFlow};
