import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {directoryPeople as people, faculties, programs, departments, groupDirectory, teachingGroups, curriculum} from "../shared/university.js";

test("кафедры и программы имеют руководителей, учебные планы и группы всех курсов", () => {
  for (const faculty of faculties) {
    assert.equal(people[faculty.dean].facultyId,faculty.id);
    for (const id of faculty.departments) {
      const d=departments[id];
      assert.equal(d.facultyId,faculty.id);
      assert.ok(d.staff.includes(d.chair));
      for (const staffId of d.staff) assert.equal(people[staffId].department,id);
      for (const program of d.programs) assert.ok(faculty.programs.includes(program));
    }
    for (const label of faculty.programs) {
      const program=programs[label];
      assert.equal(program.facultyId,faculty.id);
      assert.equal(curriculum(label).length,8);
      assert.equal(curriculum(label).flat().reduce((s,c)=>s+c.credits,0),240);
      assert.deepEqual(new Set(program.groups.map(code=>groupDirectory[code].course)),new Set([1,2,3,4]));
    }
  }
});

test("составы групп одинаковы в структуре, персоналиях и данных Python API", () => {
  const backend=JSON.parse(readFileSync(new URL("../server/assets/campus.json",import.meta.url), "utf8"));
  const allStudents=Object.values(people).filter(p=>p.role==="student");
  const memberships=Object.values(groupDirectory).flatMap(g=>g.students);
  assert.equal(new Set(memberships).size,memberships.length);
  assert.deepEqual(new Set(memberships),new Set(allStudents.map(p=>p.id)));
  assert.equal(new Set(Object.values(people).map(p=>p.number)).size,Object.keys(people).length);
  assert.deepEqual(teachingGroups,backend.teachingGroups);
  for (const g of Object.values(groupDirectory)) {
    assert.ok(g.teachers.length>=3 && g.students.length>=20);
    for (const id of g.teachers) {
      assert.equal(people[id].role,"teacher");
      assert.ok(teachingGroups[id].includes(g.code));
    }
    for (const id of g.students) {
      assert.equal(people[id].unit,g.code);
      assert.equal(backend.people[id].unit,g.code);
      assert.equal(backend.people[id].program,g.program);
    }
  }
  for (const day of backend.week) {
    for (const event of day.filter(e=>groupDirectory[e.group])) {
      assert.ok(groupDirectory[event.group].teachers.some(id=>people[id].name===event.teacher));
    }
  }
});

test("для занятий кафедр выделены свободные аудитории, преподаватели и группы", () => {
  const backend = JSON.parse(readFileSync(new URL("../server/assets/campus.json", import.meta.url), "utf8"));
  const map = JSON.parse(readFileSync(new URL("../public/campus-map.json",import.meta.url), "utf8"));
  const rooms = new Set(map.buildings.flatMap(b => b.floors.flatMap(f => f.places.filter(p => p.kind === "class").map(p => p.code))));
  for (const day of [...backend.week, ...Object.values(backend.exceptions)]) {
    for (const lesson of day.filter(event => event.suffix.includes("-faculty-"))) {
      assert.ok(rooms.has(lesson.room), lesson.room);
      assert.ok(!day.some(other => lesson !== other && lesson.time < other.end && other.time < lesson.end &&
        (lesson.room === other.room || lesson.teacher === other.teacher || lesson.group === other.group)), lesson.suffix);
    }
  }
});
