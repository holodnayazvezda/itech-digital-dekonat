import catalogue from './sports-catalog.json' with {type:'json'};
import {numberTime} from './campus-data.js';
import {offset} from './timetable.js';
export const sports=catalogue;
export const sportCategories=[...new Set(sports.map(s=>s.category))];
export function sportSlots(sport,date) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return [];
  const day=new Date(date+'T12:00:00+03:00').getUTCDay() || 7;
  return sport.weekdays.includes(day)?sport.starts:[];
}
export function nextSportDate(sport,date) {
  return Array.from({length:7},(_,i)=>offset(date,i)).find(d=>sportSlots(sport,d).length) || date;
}
export function sportSeatsLeft(sport,date,start,reservations) {
  const end=start+sport.duration;
  const occupied=reservations.filter(r=>r.short===sport.short && r.date===date && numberTime(r.time)<end && numberTime(r.end)>start).length;
  return Math.max(0,sport.capacity-occupied);
}
