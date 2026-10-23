const assert = require('node:assert/strict');
const { insertExtrasIntoFlow } = require('../functions/routeExtras');

// The exact regression this guards: a destination-tagged extra (a hotel mission) must be
// spliced next to ITS OWN destination's missions using the explicit destination field, never by
// guessing from title/text word-matching, which could match an unrelated earlier mission that
// happens to share a word and make a later city look like it comes first in the route map.
const flow = [
  { id: '1', title: 'Day 1 - Arrival', text: 'Land and check in.', destination: 'Bangkok', day: 1 },
  { id: '2', title: 'Day 7 - Beach day', text: 'Relax at the beach, far from the Bangkok crowds.', destination: 'Khao Lak', day: 7 },
  { id: '3', title: 'Day 13 - City walk', text: 'Explore the old town.', destination: 'Pattaya', day: 13 },
];
const hotelForPattaya = { id: 'hotel-1', type: 'story', title: 'Where to Stay', text: '...', destination: 'Pattaya' };
const result = insertExtrasIntoFlow(flow, [hotelForPattaya]);
assert.equal(result.length, 4);
// Must land next to its OWN destination (Pattaya, index 2 in the original flow), not near
// Khao Lak's mission even though that mission's text happens to mention "Bangkok" - the exact
// false-positive word-matching scenario that scrambled the route map's stop order in production.
const insertedIndex = result.findIndex((m) => m.id === 'hotel-1');
assert.equal(insertedIndex, 2, 'the Pattaya hotel mission must be inserted right before Pattaya\'s own mission, not word-matched into an earlier city');

// A whole-trip extra with no destination (the multi-destination attractions poll) must land
// near the start, never appended after every other mission (including a trip's closing mission).
const closingFlow = [
  { id: '1', title: 'Day 1 - Arrival', text: 'Welcome.', destination: 'Bangkok', day: 1 },
  { id: '2', title: 'Day 2 - More', text: 'More stuff.', destination: 'Bangkok', day: 2 },
  { id: '3', title: 'Trip complete!', text: 'You did it.', type: 'reward' },
];
const poll = { id: 'poll-1', type: 'story', title: 'What should we do?', text: '...', destination: '' };
const withPoll = insertExtrasIntoFlow(closingFlow, [poll]);
assert.equal(withPoll.findIndex((m) => m.id === 'poll-1'), 1, 'a destination-less whole-trip extra must land near the start, not after the closing mission');

console.log('routeExtras: destination-tagged extras insert next to their own city, whole-trip extras land near the start');
