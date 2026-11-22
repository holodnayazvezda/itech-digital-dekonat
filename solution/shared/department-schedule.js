import { curriculum, directoryPeople, groupDirectory } from "./university.js";
import { classesOn, weekOf } from "./timetable.js";
import catalog from "./room-catalog.json" with {type: "json"};
import { bookingRooms } from "./booking-catalog.js";

// The authored timetables and their exceptional exams keep their original rooms.
const demoRooms = new Set(weekOf("2026-11-20").flatMap(classesOn).map(event => event.room));
const classrooms = bookingRooms(catalog).filter(r => r.kind === "Аудитория" && !demoRooms.has(r.short));
const times = [
  ["09:00","10:30"], ["10:45","12:15"], ["12:30","14:00"], ["14:15","15:45"],
  ["16:00","17:30"], ["17:45","19:15"], ["19:30","21:00"],
];

// Allocate the programme classes once. A group meets on distinct days; teachers
// and classrooms may conduct only one class per period.
function makeWeek() {
  const week = Array.from({length:7},()=>[]);
  const roomUse = new Set(), teacherUse = new Set();
  let nextRoom = 0;
  function assignRoom(period, seats) {
    for (let offset = 0; offset < classrooms.length; offset++) {
      const index = (nextRoom + offset) % classrooms.length;
      const room = classrooms[index];
      if (room.capacity < seats || roomUse.has(room.short + ":" + period)) continue;
      nextRoom = (index + 1) % classrooms.length;
      roomUse.add(room.short + ":" + period);
      return room;
    }
    return null;
  }
  Object.values(groupDirectory).forEach((group, groupIndex) => {
    const groupDays = new Set(group.code === "АД-22" ? [5] : []);
    const courses = curriculum(group.program)[(group.course - 1) * 2];
    const instructors = group.teachers.filter(id => id.startsWith("faculty-"));
    instructors.forEach((id, courseIndex) => {
      const first = (groupIndex * 11 + courseIndex * 13) % 42;
      for (let shift=0; shift<42; shift++) {
        const period = (first + shift) % 42;
        const day = period % 6 + 1;
        if (groupDays.has(day) || teacherUse.has(id + ":" + period)) continue;
        const room = assignRoom(period, group.students.length);
        if (!room) continue;
        groupDays.add(day);
        teacherUse.add(id + ":" + period);
        const [time,end] = times[Math.floor(period / 6)];
        week[day].push({suffix:"-" + group.code + "-" + id, time, end,
          name:courses[courseIndex].subject, type:["Лекция","Практика","Семинар"][courseIndex],
          teacher:directoryPeople[id].name, room:room.short, group:group.code,
          building:room.building, floor:Number.isFinite(Number(room.floor)) ? Number(room.floor) : room.floor});
        return;
      }
      throw Error("Нет свободного слота для " + group.code);
    });
  });
  return week;
}
export const departmentWeek = makeWeek();
