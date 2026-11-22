import { buildings, classesOn, offset, today, weekOf } from "./timetable.js";
import { directoryPeople } from "./university.js";
export const people = directoryPeople;
export { facultyDirectory } from "./university.js";
export { catalogue } from "./services.js";
const samples = weekOf(today).flatMap(classesOn);
export const rooms = [
  "Б-108",
  "Н-102",
  ...new Set(samples.map((e) => e.room)),
].map((short, i) => ({
  short,
  name: (i < 2 ? "Переговорная " : "Аудитория ") + short,
  kind: i < 2 ? "Переговорная" : "Аудитория",
  building: short[0] === "Б" ? buildings.main : buildings.modern,
  meta: i < 2 ? "6 мест · экран" : "32 места · проектор",
}));
for (const [code, building] of [
  ["Б", buildings.main],
  ["Н", buildings.modern],
]) {
  for (const [suffix, title, meta] of [
    ["120", "Проектный зал", "12 мест · доска"],
    ["122", "Студия", "8 мест · экран"],
  ]) {
    rooms.push({
      short: code + "-" + suffix,
      name: title + " " + code + "-" + suffix,
      kind: "Коворкинг",
      building,
      meta,
    });
  }
}
export const gym = {
  short: "Н-101",
  name: "Спортзал Н-101",
  kind: "Спортзал",
  building: buildings.modern,
  meta: "Индивидуальные занятия",
  capacity: 12,
};
rooms.push(gym);
export function gymSeatsLeft(date, start, end, reservations) {
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  let minimum = gym.capacity;
  for (let t = start; t < end; t += 30) {
    const groupSize =
      weekday >= 1 && weekday <= 5
        ? t >= 1080 && t < 1200
          ? 11
          : t >= 720 && t < 900
            ? 6
            : 0
        : 0;
    const reserved = reservations.filter(
      (r) =>
        r.short === gym.short &&
        r.date === date &&
        numberTime(r.time) < t + 30 &&
        numberTime(r.end) > t,
    ).length;
    minimum = Math.min(minimum, gym.capacity - groupSize - reserved);
  }
  return Math.max(0, minimum);
}
export const roomFund = (room) =>
  room.kind === "Спортзал"
    ? "Спортзал"
    : room.kind === "Аудитория"
      ? "Аудиторный фонд"
      : "Коворкинги";
export function roomActivities(date) {
  if (!date) return [];
  const classes = allClasses(date);
  if (!classes.length) return classes;
  const workshops = rooms
    .filter((r) => r.kind === "Коворкинг")
    .map((r, i) => ({
      room: r.short,
      date,
      time: i % 2 ? "15:00" : "10:00",
      end: i % 2 ? "16:30" : "12:00",
      name: i % 2 ? "Проектная мастерская" : "Работа над проектом",
      teacher: i % 2 ? "Группа АД-32" : "Группа АД-21",
    }));
  return [...classes, ...workshops];
}
export function allClasses(date) {
  const own = classesOn(date);
  if (!own.length) return [];
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const subjects = [
    "",
    "Статистика",
    "Анализ данных",
    "Статистика",
    "Иностранный язык",
    "Статистика",
    "История культуры",
  ];
  const base = samples.find((e) => e.name === subjects[weekday]);
  if (!base) return own;
  const time = weekday === 2 ? "18:00" : "16:00";
  const extra = {
    ...base,
    id: date + "-32-" + base.name,
    date,
    time,
    end: time === "18:00" ? "19:30" : "17:30",
    group: "АД-32",
  };
  if (date === "2026-11-28") extra.type = "Экзамен";
  return [...own, extra].sort((a, b) => a.time.localeCompare(b.time));
}
export function personalClasses(date, role, owner) {
  const person = people[owner];
  if (!person || person.role !== role) return [];
  if (role === "teacher")
    return allClasses(date).filter((e) => e.teacher === person.name);
  if (role === "student")
    return allClasses(date).filter((e) => e.group === person.unit);
  return [];
}
export function teachingDays(name) {
  const days = [];
  for (let d = "2026-09-01"; d <= "2026-12-28"; d = offset(d, 1)) {
    const events = allClasses(d).filter((e) => e.teacher === name);
    if (events.length) days.push({ date: d, events });
  }
  return days;
}
export const numberTime = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
export const timeText = (v) =>
  String(Math.floor(v / 60)).padStart(2, "0") +
  ":" +
  String(v % 60).padStart(2, "0");
export const statuses = {
  pending: "На рассмотрении",
  clarification: "Нужны сведения",
  approved: "Одобрена",
  rejected: "Отклонена",
  cancelled: "Отменена",
};
export const checkpoints = [
  ["Лабораторные работы", 27, 30],
  ["Проект", 28, 30],
  ["Экзамен", 37, 40],
];
