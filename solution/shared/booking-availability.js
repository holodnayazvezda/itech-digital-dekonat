import { numberTime } from './campus-data.js';

export const normalizeRoomQuery=value=>String(value || '').toLowerCase().replaceAll('ё','е').replaceAll('b','б').replaceAll('p','п').replace(/[hn]/g,'н').replace(/[\s‐‑–—-]+/g,'');

export const bookingDurations = Array.from({ length: 8 }, (_, index) => (index + 1) * 30);
const hourLabels = ["", "час", "часа", "часа", "часа"];

export function bookingDurationLabel(duration) {
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return [hours && `${hours} ${hourLabels[hours]}`, minutes && `${minutes} минут`].filter(Boolean).join(" ");
}

export function availableRoomStarts(events,short,duration) {
  if(!short || !Number.isInteger(duration) || duration<30 || duration>240 || duration%30) return [];
  return Array.from({length:26},(_,i)=>540+i*30).filter(start=>start+duration<=1320 && !events.some(event=>
    (event.room || event.short)===short && numberTime(event.time)<start+duration && numberTime(event.end)>start
  ));
}
