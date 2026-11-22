import { buildings, classesOn, offset, weekOf } from "./timetable.js";
import { departmentWeek } from "./department-schedule.js";
import catalog from "./room-catalog.json" with { type: "json" };
import { bookingRooms } from "./booking-catalog.js";
import { directoryPeople } from "./university.js";
export const people = directoryPeople;
export { facultyDirectory } from "./university.js";
export { catalogue } from "./services.js";
const samples = weekOf("2026-11-20").flatMap(classesOn);
export const rooms = bookingRooms(catalog);
export const roomBuildings = [...new Set(rooms.map(room => room.building))];
export const gym = rooms.find(room => room.short === "Н-101");
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
export function roomActivities(date, changes = []) {
  if (!date) return [];
  const classes = publishedClasses(date, changes).filter(lesson => !lesson.cancelled);
  if (!allClasses(date).length) return classes;
  const workshops = ["Б-120", "Б-122", "Н-120", "Н-122"].map(room => {
    const studio = room.endsWith("122");
    return {
      room, date,
      time: studio ? "15:00" : "10:00", end: studio ? "16:30" : "12:00",
      name: studio ? "Проектная мастерская" : "Работа над проектом",
      teacher: studio ? "Группа АД-32" : "Группа АД-21",
    };
  });
  return [...classes, ...workshops];
}
const semesterDays = new Map();
export function allClasses(date) {
  if (semesterDays.has(date)) return semesterDays.get(date);
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
  const facultyEvents =
    weekday === 5
      ? [
          {
            ...base,
            id: date + "-dean-seminar",
            date,
            time: "10:30",
            end: "12:00",
            name: "Аналитический практикум",
            type: "Семинар",
            teacher: people["dean-data"].name,
            group: "АД-22",
            room: "Б-310",
            floor: 3,
            building: buildings.main,
          },
          {
            ...base,
            id: date + "-dean-council",
            date,
            time: "15:00",
            end: "16:00",
            name: "Совет факультета",
            type: "Мероприятие",
            teacher: people["dean-data"].name,
            group: "Совет факультета",
            room: "Б-310",
            floor: 3,
            building: buildings.main,
          },
        ]
      : [];
  const others = departmentWeek[weekday].map(({suffix, ...lesson}) => ({...lesson, id:date + suffix, date}));
  const events = [...own, extra, ...facultyEvents, ...others].sort((a, b) => a.time.localeCompare(b.time));
  semesterDays.set(date, events);
  return events;
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
export function publishedClasses(date, changes = []) {
  const originalIds = new Set(changes.map(change => change.lesson.id));
  return [
    ...allClasses(date).filter(event => !originalIds.has(event.id)),
    ...changes.map(change => change.lesson).filter(event => event.date === date),
  ].sort((a, b) => a.time.localeCompare(b.time));
}
export function teachingDays(name, changes = []) {
  const days = [];
  for (let d = "2026-09-01"; d <= "2026-12-28"; d = offset(d, 1)) {
    const events = publishedClasses(d, changes).filter((e) => e.teacher === name && !e.cancelled);
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
