import assert from "node:assert/strict";
import {buildRouteGroups} from "../lib/routeGroups.js";

// The regression this guards: a mission written for one destination whose actual text never
// repeats the city name (real beach/cafe names instead) must still group under that destination,
// not fall through to day-number grouping or get merged into an unrelated group that happens to
// share a word with the mission's text (e.g. the country name).
const experience={destinations:["Bangkok","Phuket","Manila"]};
const flow=[
 {id:"1",title:"Day 1 - Arrival",text:"Land at the airport and check into your hotel.",destination:"Bangkok"},
 {id:"2",title:"Day 2 - City walk",text:"Explore Wat Arun and grab lunch nearby.",destination:"Bangkok"},
 {id:"3",title:"Day 3 - Beach day",text:"Relax at Patong Beach in the afternoon.",destination:"Phuket"},
 {id:"4",title:"Day 4 - Island hop",text:"Boat trip to Phi Phi with the kids.",destination:"Phuket"},
 {id:"5",title:"Day 5 - Arrival",text:"Fly onward and settle in for the evening.",destination:"Manila"},
];
const groups=buildRouteGroups(experience,flow,false);
assert.equal(groups.length,3,"expected one group per destination, not a day-number fallback");
assert.deepEqual(groups.map(g=>g.destination),["Bangkok","Phuket","Manila"]);
assert.deepEqual(groups.map(g=>g.missions.length),[2,2,1]);
assert.deepEqual(groups[0].missions.map(({m})=>m.id),["1","2"]);
assert.deepEqual(groups[1].missions.map(({m})=>m.id),["3","4"]);

// A mission with no destination tag at all still falls back to text-matching against the
// experience's declared destination list, so older data (before this field existed) still works.
const untaggedFlow=[
 {id:"1",title:"Day 1",text:"Welcome to Bangkok, let's get started."},
 {id:"2",title:"Day 2",text:"A quiet day in Phuket by the water."},
];
const untaggedGroups=buildRouteGroups(experience,untaggedFlow,false);
assert.equal(untaggedGroups.length,2);
assert.deepEqual(untaggedGroups.map(g=>g.destination),["Bangkok","Phuket"]);

// A destination field that's really the whole trip's combined location string (comma-separated)
// must never become its own bogus stop - only a mission naming exactly one place counts.
const bogusFlow=[
 {id:"1",title:"Day 1",text:"Arrival.",destination:"Bangkok"},
 {id:"2",title:"Trip poll",text:"Vote for what to do.",destination:"Bangkok, Phuket, Manila"},
];
const bogusGroups=buildRouteGroups(experience,bogusFlow,false);
assert.ok(bogusGroups.every(g=>!g.destination.includes(",")),"a comma-joined destination string must never become its own stop");

// A mission that belongs to neither destination (no destination field, no text match) in a
// multi-destination trip falls back to day-number grouping - the regex behind that fallback
// must recognize a day-word in languages other than English/Hebrew too, since the AI can write
// a day-opener title in any of the 9 supported languages.
const mixedExperience={destinations:["Bangkok","Phuket"]};
const mixedFlow=[
 {id:"1",title:"Day 1 - Arrival",text:"Explore Bangkok streets.",destination:"Bangkok"},
 {id:"2",title:"Day 2 - Beach",text:"Relax in Phuket sun.",destination:"Phuket"},
 {id:"3",title:"Tag 3 - Zwischenstopp",text:"Kein Ortsname hier, nur ein freier Tag."},
];
const mixedGroups=buildRouteGroups(mixedExperience,mixedFlow,false);
const dayGroup=mixedGroups.find(g=>g.key==="day-3");
assert.ok(dayGroup,"a German 'Tag 3' title must still be recognized as day 3, not fall through to a bogus 'general' group");
assert.equal(dayGroup.label,"Day 3");

// Hotel/attraction choice missions (tagged isCoordination - see routeExtras.js) must form their
// own "Coordination" group, placed first, and must never be counted toward or merged into the
// destination/day grouping below them - a single-destination trip with a coordination section
// is still "single destination" for everything except that dedicated group.
const coordFlow=[
 {id:"hotel-1",title:"Where to Stay",text:"...",isCoordination:true},
 {id:"poll-1",title:"What should we do?",text:"...",isCoordination:true},
 {id:"1",title:"Day 1 - Arrival",text:"Explore Bangkok streets.",destination:"Bangkok",day:1},
 {id:"2",title:"Day 2 - Beach",text:"Relax in Phuket sun.",destination:"Phuket",day:2},
];
const coordGroups=buildRouteGroups({destinations:["Bangkok","Phuket"]},coordFlow,false);
assert.equal(coordGroups[0].key,"coordination","the coordination group must come first");
assert.deepEqual(coordGroups[0].missions.map(({m})=>m.id),["hotel-1","poll-1"]);
assert.equal(coordGroups.length,3,"coordination group plus the two real destination groups, not merged together");
assert.ok(!coordGroups[0].destination,"the coordination group must never be treated as a destination stop");

// Same guarantee for a single-destination trip: the coordination group splits off cleanly
// instead of forcing the whole flow into one combined "single" group.
const singleDestFlow=[
 {id:"hotel-1",title:"Where to Stay",text:"...",isCoordination:true},
 {id:"1",title:"Day 1",text:"Arrival.",destination:"Bangkok",day:1},
 {id:"2",title:"Day 2",text:"More Bangkok.",destination:"Bangkok",day:2},
];
const singleDestGroups=buildRouteGroups({destinations:["Bangkok"]},singleDestFlow,false);
assert.equal(singleDestGroups.length,2);
assert.equal(singleDestGroups[0].key,"coordination");
assert.equal(singleDestGroups[1].key,"single");
assert.deepEqual(singleDestGroups[1].missions.map(({m})=>m.id),["1","2"]);

console.log("Route grouping: explicit destination tags, text-matching fallback, comma-joined-destination guard, multi-language day fallback and coordination-section split all checked");
