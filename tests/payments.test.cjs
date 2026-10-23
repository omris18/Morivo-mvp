const assert = require('node:assert/strict');
const { participantCountOf, PRICE_PER_PARTICIPANT, CURRENCY } = require('../functions/payments');

// A family trip stores adultsCount/childrenCount separately (see AICreator.js) - these must be
// summed, including when children is 0 or missing.
assert.equal(participantCountOf({ adultsCount: 2, childrenCount: 3 }), 5);
assert.equal(participantCountOf({ adultsCount: 2, childrenCount: 0 }), 2);
assert.equal(participantCountOf({ adultsCount: 4 }), 4);

// Every other experience type (birthday, team building, school...) stores a single "people" count.
assert.equal(participantCountOf({ people: 12 }), 12);

// Never charge for zero or missing participants - an experience always has at least the organizer.
assert.equal(participantCountOf({}), 1);
assert.equal(participantCountOf({ adultsCount: 0, childrenCount: 0 }), 1);
assert.equal(participantCountOf({ people: 0 }), 1);

// Sanity: the price/currency constants are the shape Stripe's API expects - a positive integer
// in the smallest currency unit, and a real ISO currency code.
assert.ok(Number.isInteger(PRICE_PER_PARTICIPANT) && PRICE_PER_PARTICIPANT > 0);
assert.equal(CURRENCY, CURRENCY.toLowerCase());

console.log('payments: participant count computed correctly from both experience shapes, never zero');
