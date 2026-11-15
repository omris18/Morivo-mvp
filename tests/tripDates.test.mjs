import assert from "node:assert/strict";
import {daysBetween, moveTripStart, setTripEnd, localDateKey} from "../lib/tripDates.js";

assert.equal(daysBetween("2026-06-01", "2026-06-07"), 7);
assert.equal(daysBetween("2026-06-01", "2026-06-01"), 1);
assert.equal(daysBetween("2026-06-07", "2026-06-01"), 0);
assert.equal(daysBetween("", "2026-06-01"), 0);

const link = "https://www.booking.com/searchresults.html?ss=Athens&checkin=2026-06-01&checkout=2026-06-07&group_adults=2";
const trip = { name: "Greece", startDate: "2026-06-01", endDate: "2026-06-07", flow: [
  { id: "a", day: 1, text: `Where to stay: ${link}`, options: [{ id: "o1", label: "Hotel", link }] },
  { id: "b", day: 3, text: "Photo at the port" },
]};

// Moving the start moves the whole trip, across a month boundary, and keeps its length.
const later = moveTripStart(trip, "2026-06-28");
assert.equal(later.startDate, "2026-06-28");
assert.equal(later.endDate, "2026-07-04");
assert.equal(daysBetween(later.startDate, later.endDate), 7);
assert.ok(later.flow[0].text.includes("checkin=2026-06-28&checkout=2026-07-04"));
assert.ok(later.flow[0].options[0].link.includes("checkin=2026-06-28&checkout=2026-07-04"));
assert.equal(later.flow[1].text, "Photo at the port");
assert.equal(later.flow[1].day, 3);
// The original is untouched.
assert.equal(trip.startDate, "2026-06-01");
assert.ok(trip.flow[0].text.includes("checkin=2026-06-01"));

// Changing only the end date changes the length and the checkout in the links.
const longer = setTripEnd(trip, "2026-06-10");
assert.equal(longer.startDate, "2026-06-01");
assert.equal(daysBetween(longer.startDate, longer.endDate), 10);
assert.ok(longer.flow[0].text.includes("checkin=2026-06-01&checkout=2026-06-10"));
// An end before the start, or a bad date, changes nothing.
assert.equal(setTripEnd(trip, "2026-05-20"), trip);
assert.equal(moveTripStart(trip, "not-a-date"), trip);

// An experience that never had dates can be given a start date.
const dated = moveTripStart({ name: "Birthday", flow: [{ id: "x", text: "Cake" }] }, "2026-09-12");
assert.equal(dated.startDate, "2026-09-12");
assert.equal(dated.endDate, "");
// A start with no previous start keeps a still-valid end and drops one that is now too early.
assert.equal(moveTripStart({ endDate: "2026-09-20", flow: [] }, "2026-09-12").endDate, "2026-09-20");
assert.equal(moveTripStart({ endDate: "2026-09-01", flow: [] }, "2026-09-12").endDate, "");
console.log("tripDates: moving the start shifts the whole trip and its booking links; the end date changes the length");

process.env.TZ='Asia/Jerusalem';
assert.equal(localDateKey(new Date('2026-12-06T00:00:00')),'2026-12-06');
assert.equal(localDateKey(new Date('2026-03-27T00:00:00')),'2026-03-27');
process.env.TZ='America/Los_Angeles';
assert.equal(localDateKey(new Date('2026-12-06T00:00:00')),'2026-12-06');
console.log('Calendar dates retain Dec 6 in Israel and US timezones, including DST boundary');
