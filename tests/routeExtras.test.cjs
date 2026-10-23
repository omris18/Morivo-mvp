const assert = require('node:assert/strict');
const { insertExtrasIntoFlow } = require('../functions/routeExtras');

// Hotel/attraction choice missions must land together as one "Coordination" block right after
// the trip's own opening mission - not scattered per-destination (the old, fragile text-matching
// approach that could splice a mission into an unrelated city's block - see git history) and not
// literally first (the opening mission still leads).
const flow = [
  { id: '1', title: 'Day 1 - Arrival', text: 'Land and check in.', destination: 'Bangkok', day: 1 },
  { id: '2', title: 'Day 7 - Beach day', text: 'Relax at the beach.', destination: 'Khao Lak', day: 7 },
  { id: '3', title: 'Day 13 - City walk', text: 'Explore the old town.', destination: 'Pattaya', day: 13 },
];
const hotelForPattaya = { id: 'hotel-1', type: 'story', title: 'Where to Stay', text: '...', destination: 'Pattaya' };
const poll = { id: 'poll-1', type: 'story', title: 'What should we do?', text: '...', destination: '' };
const result = insertExtrasIntoFlow(flow, [hotelForPattaya, poll]);

assert.equal(result.length, 5);
assert.deepEqual(result.map(m => m.id), ['1', 'hotel-1', 'poll-1', '2', '3'], 'extras must land together right after the opening mission, in the order given, not scattered per-destination');
assert.ok(result.find(m => m.id === 'hotel-1').isCoordination, 'every extra must be tagged isCoordination so the route map groups it into its own section');
assert.ok(result.find(m => m.id === 'poll-1').isCoordination);

// No extras - flow passes through unchanged.
assert.deepEqual(insertExtrasIntoFlow(flow, []), flow);

console.log('routeExtras: hotel/attraction missions land together as one tagged Coordination block right after the opener');
