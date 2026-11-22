import test from "node:test";
import assert from "node:assert/strict";
import { eventLanes } from "../src/timetable-layout.js";

test("пересекающиеся занятия занимают разные колонки, следующая группа снова полную ширину",()=>{
  const events=[{id:"a",time:"09:00",end:"10:00"},{id:"b",time:"09:30",end:"10:30"},{id:"c",time:"10:00",end:"11:00"},{id:"d",time:"11:00",end:"12:00"}];
  assert.deepEqual(eventLanes(events).map(({event,lane,lanes})=>[event.id,lane,lanes]),[["a",0,2],["b",1,2],["c",0,2],["d",0,1]]);
});
test("вложенные и одновременные события остаются доступны без наложений",()=>{
  const result=eventLanes([{id:"a",time:"09:00",end:"12:00"},{id:"b",time:"09:00",end:"10:00"},{id:"c",time:"09:30",end:"11:00"}]);
  assert.equal(result.length,3);
  assert.equal(new Set(result.map(row=>row.lane)).size,3);
  assert.ok(result.every(row=>row.lanes===3));
});
test("сортировка не меняет исходные события, соседние занятия не считаются пересечением",()=>{
  const events=[{id:"b",time:"10:00",end:"11:00"},{id:"a",time:"09:00",end:"10:00"}];
  assert.deepEqual(eventLanes(events).map(({event,lanes})=>[event.id,lanes]),[["a",1],["b",1]]);
  assert.deepEqual(events.map(event=>event.id),["b","a"]);
  assert.deepEqual(eventLanes([]),[]);
});
