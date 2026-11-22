export { today } from "./server-clock.js";
export const buildings = {
  main: {
    name: "Корпус B",
    short: "корп. B",
    address: "Университетская аллея, 14",
    image: "services/campus-main-view.png",
    alt: "Светлый каменный корпус с центральным входом и закруглённым крылом, вид справа",
  },
  modern: {
    name: "Корпус A",
    short: "корп. A",
    address: "Университетская аллея, 12",
    image: "services/campus-modern-view.png",
    alt: "Современный кирпичный учебный корпус со стеклянным атриумом",
  },
};

const subjects = {
  data: ["Анализ данных", "Лекция", "Лесова Вера Андреевна", "Б-412"],
  project: ["Проектный семинар", "Практика", "Рощин Марк Игоревич", "Н-318"],
  history: ["История культуры", "Лекция", "Мирова Лина Олеговна", "Б-240"],
  lang: ["Иностранный язык", "Практика", "Белова Анна Сергеевна", "Н-205"],
  stats: ["Статистика", "Практика", "Лесова Вера Андреевна", "Б-205"],
  law: ["Международное право", "Лекция", "Берестов Иван Павлович", "Б-310"],
  sport: ["Волейбол", "Спорт", "Зорин Илья Романович", "Н-110"],
};
const pattern = [
  [],
  [
    ["lang", "09:00", "10:30"],
    ["stats", "10:40", "12:10"],
    ["law", "14:00", "15:30"],
    ["sport", "20:30", "22:00"],
  ],
  [
    ["history", "10:00", "11:30"],
    ["data", "11:40", "13:10"],
    ["project", "16:00", "17:30"],
  ],
  [
    ["stats", "09:00", "10:30"],
    ["law", "10:40", "12:10"],
    ["lang", "12:20", "13:50"],
  ],
  [
    ["data", "10:00", "11:30"],
    ["project", "11:40", "13:10"],
    ["sport", "20:30", "22:00"],
  ],
  [
    ["data", "10:00", "11:30"],
    ["project", "11:40", "12:20"],
    ["history", "14:00", "15:30"],
  ],
  [["lang", "10:30", "12:00"]],
];
export function overlaps(a, b) {
  return !a.cancelled && !b.cancelled && a.date === b.date && a.time < b.end && b.time < a.end;
}
export function dateOf(key) {
  return new Date(key + "T12:00:00Z");
}
const iso = (d) => d.toISOString().slice(0, 10);
export function offset(key, days) {
  const d = dateOf(key);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
export function monthStep(key, n) {
  const d = dateOf(key);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
}
export function printDate(key, opts) {
  return dateOf(key).toLocaleDateString("ru-RU", { timeZone: "UTC", ...opts });
}
export function weekOf(key) {
  const first = offset(key, -((dateOf(key).getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => offset(first, i));
}
export function monthOf(key) {
  const first = monthStep(key, 0),
    last = offset(monthStep(key, 1), -1),
    start = weekOf(first)[0],
    end = weekOf(last)[6];
  const days = [];
  for (let d = start; d <= end; d = offset(d, 1)) days.push(d);
  return days;
}
export function classesOn(date) {
  if (date < "2026-09-01" || date > "2026-12-28") return [];
  return pattern[dateOf(date).getUTCDay()].map(([key, time, end]) => {
    const [name, usualType, teacher, room] = subjects[key];
    const type =
      date === "2026-11-24" && key === "history" ? "Экзамен" : usualType;
    return {
      id: date + "-" + key,
      date,
      time,
      end,
      name,
      type,
      teacher,
      room,
      group: "АД-21",
      building: room.startsWith("Б") ? buildings.main : buildings.modern,
      floor: Number(room[2]),
    };
  });
}
