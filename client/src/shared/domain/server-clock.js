import { signal } from "@preact/signals-react";

const day = signal("");
const moment = signal(null);
let receivedAt = 0;
let epoch = 0;
let timezone = "Europe/Moscow";

const elapsed = () => performance.now() - receivedAt;
function parts(timestamp) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(timestamp).map(part => [part.type, part.value]));
}

export function advanceServerClock() {
  if (!epoch) return;
  const time = epoch + elapsed();
  const fields = parts(time);
  day.value = fields.year + "-" + fields.month + "-" + fields.day;
  moment.value = Number(fields.hour) * 60 + Number(fields.minute);
}

export function setServerClock(clock) {
  const timestamp = Date.parse(clock?.now);
  if (!Number.isFinite(timestamp) || clock?.timezone !== "Europe/Moscow") {
    throw new Error("Сервер вернул некорректное время.");
  }
  epoch = timestamp;
  receivedAt = performance.now();
  timezone = clock.timezone;
  advanceServerClock();
}

export const today = () => day.value;
export const serverMinute = () => moment.value;

export async function synchronizeClock() {
  const base = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
  const response = await fetch(base + "/api/campus/clock", {cache:"no-store", signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error("Не удалось получить время сервера.");
  setServerClock(await response.json());
}
