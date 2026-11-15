// Changing a trip's dates after it was created. Missions unlock by day counted from the start
// date (lib/experienceVisuals.js), and hotel suggestions carry the stay dates inside their
// booking links (functions/index.js), so both have to move together with the dates themselves.
const DAY_MS = 86400000;
const parse = iso => { const [y, m, d] = String(iso || "").split("-").map(Number); return y && m && d ? Date.UTC(y, m - 1, d) : NaN; };
const format = ms => new Date(ms).toISOString().slice(0, 10);

export function daysBetween(start, end) {
  const days = Math.round((parse(end) - parse(start)) / DAY_MS) + 1;
  return Number.isFinite(days) && days > 0 ? days : 0;
}

function rewriteStayDates(flow, oldStart, oldEnd, newStart, newEnd) {
  let json = JSON.stringify(flow || []);
  if (oldStart && newStart && oldStart !== newStart) json = json.split(`checkin=${oldStart}`).join(`checkin=${newStart}`);
  if (oldEnd && newEnd && oldEnd !== newEnd) json = json.split(`checkout=${oldEnd}`).join(`checkout=${newEnd}`);
  return JSON.parse(json);
}

// Moving the start date moves the whole trip: the end date shifts by the same number of days,
// so the trip keeps its length and every "day N" mission still falls inside it.
export function moveTripStart(experience, newStart) {
  const { startDate: oldStart, endDate: oldEnd } = experience;
  if (!Number.isFinite(parse(newStart))) return experience;
  const shifted = Number.isFinite(parse(oldStart)) && Number.isFinite(parse(oldEnd))
    ? format(parse(oldEnd) + (parse(newStart) - parse(oldStart)))
    : oldEnd && parse(oldEnd) >= parse(newStart) ? oldEnd : "";
  return { ...experience, startDate: newStart, endDate: shifted, flow: rewriteStayDates(experience.flow, oldStart, oldEnd, newStart, shifted) };
}

export function setTripEnd(experience, newEnd) {
  if (!Number.isFinite(parse(newEnd)) || (experience.startDate && parse(newEnd) < parse(experience.startDate))) return experience;
  return { ...experience, endDate: newEnd, flow: rewriteStayDates(experience.flow, null, experience.endDate, null, newEnd) };
}

// Date-only UI values must never pass through UTC (Israel midnight is the previous UTC day).
export function localDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
