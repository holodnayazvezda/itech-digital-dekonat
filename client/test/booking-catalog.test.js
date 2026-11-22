const today = "2026-11-20";
import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {bookingCatalogFromMap} from "../src/shared/domain/booking-catalog.js";
import {rooms, allClasses, roomActivities} from "../src/shared/domain/campus-data.js";
import {groupDirectory} from "../src/shared/domain/university.js";
import {weekOf} from "../src/shared/domain/timetable.js";
import catalog from "../src/shared/domain/room-catalog.json" with { type: "json" };

const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const server = load("../../server/assets/campus.json");
const byCode = new Map(rooms.map(room => [room.short, room]));

test("карта, компактный каталог и допустимые брони API совпадают по этажам и вместимости", () => {
  assert.deepEqual(bookingCatalogFromMap(load("../public/campus-map.json")), catalog);
  assert.deepEqual(rooms, server.rooms);
  assert.equal(byCode.size, rooms.length);
  assert.ok(rooms.every(r => r.floor && r.floorName && r.capacity > 0));
});

test("кафедральные занятия распределены по подходящим аудиториям и занимают те же слоты на сервере", () => {
  const used = new Set();
  for (const [index, date] of weekOf(today).entries()) {
    const day = allClasses(date);
    assert.deepEqual(day.map(({id, date:_, ...lesson})=>({...lesson,suffix:id.slice(date.length)})), server.week[index]);
    if (server.activities[date]) assert.deepEqual(roomActivities(date).map(({room,time,end})=>[room,time,end]), server.activities[date]);
    for (const lesson of day.filter(e => e.id.includes("-faculty-"))) {
      const room = byCode.get(lesson.room);
      assert.ok(room.capacity >= groupDirectory[lesson.group].students.length, lesson.room);
      assert.equal(String(lesson.floor), room.floor);
      used.add(lesson.room);
    }
  }
  assert.ok(used.size > 100);
});
