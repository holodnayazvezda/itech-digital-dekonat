const today = "2026-11-20";
import test from "node:test";
import assert from "node:assert/strict";
import { people, personalClasses } from "../shared/campus-data.js";
import { overlaps, weekOf } from "../shared/timetable.js";

test("отменённая пара не занимает интервал в расписании и бронировании", () => {
  const lesson = { date: today, time: "10:00", end: "11:30" };
  const booking = { date: today, time: "10:30", end: "11:00" };
  assert.equal(overlaps(booking, lesson), true);
  assert.equal(overlaps(booking, { ...lesson, cancelled: true }), false);
});

test("студенты видят пары своей группы, преподаватель — обе группы", () => {
  assert.deepEqual(
    personalClasses(today, "student", "student").map((e) => e.name),
    ["Анализ данных", "Проектный семинар", "История культуры"],
  );
  assert.deepEqual(
    personalClasses(today, "student", "friend").map((e) => e.name),
    ["Статистика"],
  );
  assert.deepEqual(
    personalClasses(today, "teacher", "teacher").map((e) => e.group),
    ["АД-21", "АД-32"],
  );
});

test("каждый календарь выбирает занятия по владельцу в течение недели", () => {
  for (const person of Object.values(people)) {
    const week = weekOf(today).flatMap((day) =>
      personalClasses(day, person.role, person.id),
    );
    if (person.role === "teacher") {
      assert.ok(week.length);
      assert.ok(week.every((event) => event.teacher === person.name));
    } else if (person.role === "student") {
      assert.ok(week.length);
      assert.ok(week.every((event) => event.group === person.unit));
    } else {
      assert.deepEqual(week, []);
    }
  }
  assert.deepEqual(personalClasses(today, "student", "rector"), []);
});
