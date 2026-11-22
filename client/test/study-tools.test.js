import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarFile,
  csvFile,
  exportRows,
} from "../src/features/schedule/calendar-export.js";
test("экспорт сохраняет московское время, UTF-8 и разделители iCalendar", () => {
  const event = {
    id: "пример",
    name: "Курс, семинар; часть 1\n" + "аналитика ".repeat(20),
    date: "2026-11-20",
    time: "10:00",
    end: "11:30",
    room: "Б-412",
    type: "Лекция",
  };
  const ics = calendarFile([event], new Date("2026-11-20T07:00:00Z"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART:20261120T070000Z"));
  assert.ok(ics.includes("DTEND:20261120T083000Z"));
  assert.ok(
    ics
      .replaceAll("\r\n ", "")
      .includes("SUMMARY:Курс\\, семинар\\; часть 1\\nаналитика "),
  );
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
});
test("период и типы событий выгружаются независимо от открытого календаря", () => {
  const params = {
    date: "2026-11-20",
    role: "student",
    owner: "friend",
    lessons: true,
    rooms: false,
    bookings: [],
  };
  const day = exportRows({ ...params, period: "День" }),
    week = exportRows({ ...params, period: "Неделя" }),
    month = exportRows({ ...params, period: "Месяц" });
  assert.ok(
    day.length && day.length < week.length && week.length < month.length,
  );
  assert.ok(
    month.every((e) => e.group === "АД-32" && e.date.startsWith("2026-11")),
  );
  const booking = {
    id: "b",
    owner: "friend",
    status: "approved",
    date: params.date,
    time: "12:00",
    end: "13:00",
    name: 'Зал "А"',
    short: "Н-102",
  };
  const rows = exportRows({
    ...params,
    period: "День",
    lessons: false,
    rooms: true,
    bookings: [
      booking,
      { ...booking, owner: "student" },
      { ...booking, status: "pending" },
    ],
  });
  assert.deepEqual(
    rows.map((e) => e.id),
    ["b"],
  );
  assert.match(csvFile(rows), /Зал ""А""/);
});
test("границы произвольного периода включают последний день и ограничены семестром", () => {
  const p = {
    date: "2026-11-20",
    role: "student",
    owner: "student",
    lessons: true,
    rooms: false,
    bookings: [],
  };
  const range = exportRows({
    ...p,
    period: "Свой период",
    start: p.date,
    end: p.date,
  });
  assert.deepEqual(range, exportRows({ ...p, period: "День" }));
  assert.deepEqual(
    exportRows({
      ...p,
      period: "Свой период",
      start: "2026-12-01",
      end: p.date,
    }),
    [],
  );
  assert.ok(exportRows({ ...p, period: "Семестр" }).length > range.length);
});
