import { readFileSync, writeFileSync } from "node:fs";
import { allClasses, roomActivities, rooms, gym } from "../src/shared/domain/campus-data.js";
import { weekOf } from "../src/shared/domain/timetable.js";
import { directoryPeople, programNames, teachingGroups, transferRequirements } from "../src/shared/domain/university.js";

import { services } from "../src/shared/domain/services.js";

const file = new URL("../../server/assets/campus.json", import.meta.url);
const previous = readFileSync(file, "utf8");
const data = JSON.parse(previous);
data.services = services;
// The API only needs public identity, cohort membership and the study programme.
data.people = Object.fromEntries(Object.values(directoryPeople).map(person => {
  const { id, name, unit, role, program, course } = person;
  return [id, { id, name, unit, role, program, course }];
}));
data.teachingGroups = teachingGroups;
function dayLessons(date) {
  return allClasses(date).map(({id, date:_, ...lesson}) => ({...lesson, suffix:id.slice(date.length)}));
}
data.week = weekOf("2026-11-20").map(dayLessons);
for (const date of Object.keys(data.exceptions)) data.exceptions[date] = dayLessons(date);
for (const date of Object.keys(data.activities)) data.activities[date] = roomActivities(date).map(({room,time,end}) => [room,time,end]);
data.rooms = rooms;
data.gym = gym || data.gym;
function checklist(person) {
  return Object.fromEntries(programNames.filter(name => name !== person.program)
    .map(name => [name, transferRequirements(name, person)]));
}
data.transfers = Object.fromEntries(["student", "friend"].map(id => [id, checklist(directoryPeople[id])]));
data.transferTemplates = Object.fromEntries(programNames.map(program => [
  program, Object.fromEntries([1, 2, 3, 4].map(course => [course, checklist({program, course})])),
]));
const output = JSON.stringify(data, null, 1) + "\n";
if (output !== previous) writeFileSync(file, output);

// Keep the API's static catalogues independent of frontend source paths.
const {copyFileSync} = await import("node:fs");
for (const name of ["demo-access.json", "search-names.json"])
  copyFileSync(new URL("../src/shared/domain/" + name, import.meta.url), new URL("../../server/assets/" + name, import.meta.url));
copyFileSync(new URL("../public/campus-map.json", import.meta.url), new URL("../../server/assets/campus-map.json", import.meta.url));
copyFileSync(new URL("../src/shared/domain/sports-catalog.json", import.meta.url), new URL("../../server/assets/sports.json", import.meta.url));
