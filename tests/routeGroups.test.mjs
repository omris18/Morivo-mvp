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

console.log("Route grouping: explicit destination tags, text-matching fallback and comma-joined-destination guard all checked");
