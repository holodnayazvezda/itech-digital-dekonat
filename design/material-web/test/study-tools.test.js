import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { electiveStore } from "../elective-store.js";
import { calendarFile } from "../calendar-export.js";
test("смена курса освобождает место, повтор запроса не занимает второе", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const store = electiveStore(db);
    store.choose("a", "research", "");
    assert.equal(store.choose("a", "research", ""), false);
    assert.throws(() => store.choose("b", "research", ""), { status: 409 });
    assert.throws(() => store.choose("a", "viz", ""), { status: 409 });
    assert.throws(() => store.choose("a", "writing", "research"), {
      status: 409,
    });
    assert.equal(store.state("a").selected, "research");
    assert.equal(store.state("b").selected, "");
    store.choose("a", "viz", "research");
    store.choose("b", "research", "");
    assert.equal(store.state("a").remaining.research, 0);
  } finally {
    db.close();
  }
});
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
