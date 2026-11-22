import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseAtlas, indexPlaces, findPlaces, entranceRoute, entryFloor, routeMidpoint} from "../src/campus-map.js";
import {floorDirections} from "../src/campus-directions.js";
import {rooms} from "../shared/campus-data.js";

const raw = JSON.parse(readFileSync(new URL("../public/campus-map.json", import.meta.url), "utf8"));
const atlas = parseAtlas(raw), entries=indexPlaces(atlas);

test("каждая аудитория бронирования находится ровно на одном плане своего корпуса", ()=>{
  for (const room of rooms) {
    const hits=entries.filter(e=>e.place.code===room.short);
    assert.equal(hits.length,1,room.short);
    assert.equal(hits[0].building.name,room.building.name);
  }
});

test("поиск помещения принимает разные раскладки, формат номера, этаж и общие названия", ()=>{
  const first = query=>findPlaces(entries,query)[0].place.code;
  for(const query of ["б412","Б-412","B 412","аудитория 412"]) assert.equal(first(query),"Б-412");
  for(const query of ["Н205","H-205","N205","A-205","А205"]) assert.equal(first(query),"Н-205");
  const water=findPlaces(entries,"вода","water");
  assert.ok(water.length > 0);
  assert.equal(water.length,entries.filter(e=>e.place.kind==="water").length);
  assert.equal(findPlaces(entries,"главный корпус 4 этаж","water").length,1);
  assert.ok(findPlaces(entries,"туалет").every(e=>e.place.kind==="wc"));
  assert.equal(findPlaces(entries,"туалет").length,entries.filter(e=>e.place.kind==="wc").length);
  assert.equal(findPlaces(entries,"","student-office")[0].place.name,"Студенческий офис");
  assert.equal(findPlaces(entries,"неизвестный код").length,0);
});

test("пути ко всем демонстрационным местам начинаются у входа и заканчиваются на нужном этаже", ()=>{
  for(const {building,floor,place} of entries) {
    const route=entranceRoute(building,place);
    assert.ok(route?.length,place.id);
    const entry = entryFloor(building);
    assert.equal(route[0].floor,entry);
    assert.deepEqual(route[0].points[0],entry.nodes[building.entranceNode]);
    assert.equal(route.at(-1).floor,floor);
    assert.deepEqual(route.at(-1).points.at(-1),floor.nodes[place.node]);
    if(floor !== entry)assert.ok(route[0].exitVia, place.id);
  }
});

test("новая схема с криволинейными контурами и отрицательным этажом работает без графа", ()=>{
  const floor={id:"-1",name:"Цоколь",outline:"M0 0Q50 -50 100 0V95H0Z",places:[
    {id:"reading",name:"Читальня",anchor:[20,20],kind:"library",path:"M0 0Q20 5 30 10V45H0Z"}
  ]};
  const building={id:"island",name:"Остров",viewBox:[-10,-20,180,145],floors:[floor]};
  const items=indexPlaces(parseAtlas({version:1,buildings:[building]}));
  assert.equal(findPlaces(items,"читальня")[0].floor.id,"-1");
  assert.equal(entranceRoute(building,items[0].place),null);
});

test("ошибка геометрии или связи отклоняется при загрузке карты", ()=>{
  const bad=structuredClone(raw);
  bad.buildings[0].floors[0].places[0].anchor=[null];
  assert.throws(()=>parseAtlas(bad),/геометрию/);
  const broken=structuredClone(raw);
  broken.buildings[0].connections.push(["нет узла","1-entry"]);
  assert.throws(()=>parseAtlas(broken),/перехода/);
  const disconnected=structuredClone(raw.buildings[0]);disconnected.connections=[];
  assert.equal(entranceRoute(disconnected,disconnected.floors[2].places[0]),null);
});

test("поиск учитывает знак подземного этажа, стартовый этаж не зависит от порядка", () => {
  const floors = ["-1","1"].map(id => ({
    id, name:id+" этаж", outline:"M0 0h40v40H0Z", nodes:{["door"+id]:[10,10]},
    places:[{id:"reading"+id,name:"Читальня",kind:"library",anchor:[10,10],node:"door"+id}],
  }));
  const b = {id:"test",name:"Корпус",viewBox:[0,0,40,40],floors,entranceNode:"door1",footprint:floors[1].outline};
  const places = indexPlaces(parseAtlas({version:1, buildings:[b]}));
  for (const query of ["этаж -1","−1 этаж"]) assert.deepEqual(findPlaces(places,query).map(p=>p.floor.id),["-1"]);
  assert.equal(entryFloor(b),floors[1]);
  assert.equal(entryFloor({...b,entryFloor:"-1"}),floors[0]);
  assert.throws(()=>parseAtlas({version:1,buildings:[{...b,entryFloor:"M"}]}), /входной этаж/);
  assert.throws(()=>parseAtlas({version:1,buildings:[{...b,footprint:7}]}), /контур корпуса/);
});

test("число учебных аудиторий и контуры согласованы с этажностью корпусов", () => {
  const lastFullLevel = {main:4, modern:3};
  for (const building of atlas.buildings) {
    assert.ok(building.footprint);
    const roomCodes = new Set();
    for (const floor of building.floors) {
      const classrooms = floor.places.filter(p => p.kind === "class");
      for (const room of classrooms) {
        assert.ok(room.code && room.path, room.id);
        assert.ok(!roomCodes.has(room.code), room.code);
        roomCodes.add(room.code);
      }
      if (Number(floor.id) >= 1 && Number(floor.id) <= lastFullLevel[building.id]) {
        assert.ok(classrooms.length >= 40 && classrooms.length <= 50, building.id + "/" + floor.id);
      }
    }
    const top = building.floors.find(f => f.id === "5");
    assert.ok(top && top.outline !== building.footprint);
    const topRooms = top.places.filter(p=>p.kind==="class");
    assert.ok(topRooms.length > 0 && topRooms.length < 40);
  }
});

test("стрелка расположена на половине длины маршрута и смотрит к цели", () => {
  assert.deepEqual(routeMidpoint([[0,0],[0,0],[0,2],[8,2]]), {x:3,y:2,angle:0,length:10});
  assert.deepEqual(routeMidpoint([[8,2],[0,2],[0,0]]), {x:3,y:2,angle:180,length:10});
  assert.equal(routeMidpoint([[0,0],[0,0]]), null);
});

test("повороты и расстояния следуют графу этажа и масштабу плана", () => {
  const points = [[0, 0], [0, 0], [50, 0], [100, 0], [100, 40], [120, 40], [110, 40]];
  assert.deepEqual(floorDirections({points, building: {metersPerUnit: 0.1}}), [
    {kind: "straight", label: "Прямо", meters: 10},
    {kind: "right", label: "Направо", meters: 4},
    {kind: "left", label: "Налево", meters: 2},
    {kind: "turn-back", label: "Разворот", meters: 1},
  ]);
  assert.ok(floorDirections({points}).every(move => move.meters === null));
  assert.deepEqual(floorDirections({points: [[0, 0]]}), []);
  const unscaled = structuredClone(raw);
  unscaled.buildings[0].metersPerUnit = 0;
  assert.throws(() => parseAtlas(unscaled), /масштаб/);
});

test("маршрут между произвольными помещениями, обратно и через корпуса", async()=>{
  const {placeRoute,campusRoute}=await import("../src/campus-map.js");
  const from=entries.find(e=>e.place.code==="Б-108"),to=entries.find(e=>e.place.code==="Б-412");
  const forward=placeRoute(from.building,from.place,to.place),back=placeRoute(from.building,to.place,from.place);
  assert.ok(forward.length>1);
  assert.deepEqual(forward[0].points[0],from.floor.nodes[from.place.node]);
  assert.deepEqual(forward.at(-1).points.at(-1),to.floor.nodes[to.place.node]);
  assert.deepEqual(back.flatMap(s=>s.points),forward.flatMap(s=>s.points).reverse());
  const other=entries.find(e=>e.place.code==="Н-205");
  const cross=campusRoute(to,other);
  assert.equal(cross[0].building,to.building);
  assert.equal(cross.at(-1).building,other.building);
  assert.ok(cross.some(s=>s.transferTo?.includes("по улице")));
  assert.deepEqual(cross.at(-1).points.at(-1),other.floor.nodes[other.place.node]);
  assert.equal(campusRoute(null,other),null);
  assert.equal(placeRoute(from.building,{node:"missing"},to.place),null);
});
