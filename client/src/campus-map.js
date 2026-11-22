// Coordinates are in the floor's SVG coordinate system. Node IDs are building-wide.
export const placeKinds = {
  class: "Аудитория", work: "Коворкинг", office: "Служба", food: "Питание",
  library: "Библиотека", water: "Питьевая вода", wc: "Санузел",
  lift: "Лифт", stairs: "Лестница", entrance: "Вход", sport: "Спорт", service: "Сервис", cloakroom: "Гардероб",
};

const searchTerms = {
  wc: "туалет уборная wc", water: "кулер фонтанчик вода", food: "столовая кафе еда буфет",
  lift: "лифты", office: "службы", class: "аудитория ауд кабинет", work: "коворкинги переговорные",
};

const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const bounds = value => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)
  && value[2] > 0 && value[3] > 0;

function requireMap(condition, message) {
  if (!condition) throw new Error(message);
}

function validAliases(value) {
  return value == null || (Array.isArray(value) && value.every(alias => typeof alias === "string"));
}

function unique(value, set, label) {
  requireMap(typeof value === "string" && value.trim() && !set.has(value), "Проверьте идентификатор " + label);
  set.add(value);
}

export function parseAtlas(data) {
  requireMap(data?.version === 1 && Array.isArray(data.buildings) && data.buildings.length, "Нужна карта версии 1 с корпусами");
  const buildings = new Set(), ids = new Set();
  for (const building of data.buildings) {
    unique(building.id, buildings, "корпуса");
    requireMap(typeof building.name === "string" && building.name && validAliases(building.aliases) && bounds(building.viewBox) && Array.isArray(building.floors) && building.floors.length, "У корпуса отсутствует план");
    requireMap(building.footprint == null || (typeof building.footprint === "string" && building.footprint.trim()), "Проверьте общий контур корпуса");
    requireMap(building.metersPerUnit === undefined || (Number.isFinite(building.metersPerUnit)
      && building.metersPerUnit > 0), "Укажите положительный масштаб плана");
    const nodes = new Set(), levels = new Set();
    for (const floor of building.floors) {
      unique(floor.id, levels, "этажа");
      requireMap((floor.shortLabel == null || ["string","number"].includes(typeof floor.shortLabel)) && typeof floor.name === "string" && floor.name && typeof floor.outline === "string" && floor.outline && Array.isArray(floor.places)
        && (!floor.viewBox || bounds(floor.viewBox)), "Нужны контур и список помещений этажа");
      for (const [id, coords] of Object.entries(floor.nodes || {})) {
        unique(id, nodes, "узла маршрута");
        requireMap(point(coords), "Неверные координаты узла");
      }
      for (const place of floor.places) {
        unique(place.id, ids, "места");
        requireMap(validAliases(place.aliases) && ["code","label","kind","zone","equipment"].every(key =>
          place[key] == null || typeof place[key] === "string"), "Проверьте код, категорию и подписи места " + place.id);
        requireMap(typeof place.name === "string" && place.name && point(place.anchor)
          && (!place.path || typeof place.path === "string") && (!place.node || Object.hasOwn(floor.nodes || {}, place.node)), "Проверьте название, геометрию и узел места");
      }
      for (const pair of floor.links || []) {
        requireMap(Array.isArray(pair) && pair.length === 2 && pair.every(id => Object.hasOwn(floor.nodes || {}, id)), "Неизвестный узел этажа");
      }
    }
    requireMap(building.entryFloor == null || levels.has(building.entryFloor), "Неизвестный входной этаж");
    requireMap(!building.entranceNode || nodes.has(building.entranceNode), "Неизвестный узел входа");
    for (const pair of building.connections || [])
      requireMap(Array.isArray(pair) && (pair.length === 2 || (pair.length === 3 && typeof pair[2] === "string")) && pair.slice(0,2).every(id => nodes.has(id)), "Неизвестный узел перехода");
  }
  return data;
}

export function entryFloor(building) {
  return building.floors.find(f => f.id === building.entryFloor)
    || building.floors.find(f => building.entranceNode && Object.hasOwn(f.nodes || {}, building.entranceNode))
    || building.floors[0];
}

export function indexPlaces(atlas) {
  return atlas.buildings.flatMap(building => building.floors.flatMap(floor =>
    floor.places.map(place => ({ building, floor, place }))));
}

export function normalise(value) {
  return String(value ?? "").toLocaleLowerCase("ru").replaceAll("ё", "е")
    .replace(/\b(?:b)(?=[\s-]*\d)/gu, "б").replace(/\b[hn](?=[\s-]*\d)/gu, "н")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function findPlaces(entries, query = "", category = "") {
  // Extract signed levels before normalisation strips punctuation from room codes.
  const text = String(query).toLocaleLowerCase("ru").replace(/[−–—]/g, "-");
  const level = text.match(/(?:^|\s)(?:этаж\s+(-?\d+)|(-?\d+)(?:-?й)?\s+этаж)(?=\s|$)/u);
  const remainder = normalise(level ? text.replace(level[0], " ") : text);
  const terms = remainder.replace(/([бн])\s+(п?\d)/gu, "$1$2").split(" ").filter(Boolean);
  return entries.filter(({place, building, floor}) => {
    if (level && floor.id !== (level[1] || level[2])) return false;
    if (category === "student-office" && !(place.kind === "office" && /студенческий офис|студофис/i.test(place.name + " " + place.label))) return false;
    if (category && category !== "student-office" && place.kind !== category) return false;
    const code = normalise(place.code).replaceAll(" ", "");
    const searchable = normalise([place.name, place.label, place.code, code, placeKinds[place.kind], searchTerms[place.kind], place.zone,
      building.name, ...(building.aliases || []), floor.name, ...(place.aliases || [])].filter(Boolean).join(" "));
    return terms.every(term => searchable.includes(term));
  }).sort((a, b) => {
    const exact = item => item.place.code && normalise(item.place.code).replaceAll(" ", "") === terms.join("");
    return Number(Boolean(exact(b))) - Number(Boolean(exact(a)));
  });
}

// Floor geometry is immutable; cache a bounded number of origin trees per building.
const routesByBuilding = new WeakMap();
function originPaths(building, start) {
  const graph = new Map();
  for (const floor of building.floors) {
    for (const [id, coords] of Object.entries(floor.nodes || {}))
      graph.set(id, { floor, coords, edges: [] });
  }
  const transfer = new Map();
  const join = ([from, to, label]) => {
    const a = graph.get(from), b = graph.get(to);
    const distance = a.floor === b.floor ? Math.hypot(a.coords[0] - b.coords[0], a.coords[1] - b.coords[1]) : 50;
    if (label) { transfer.set(from+"\0"+to,label); transfer.set(to+"\0"+from,label); }
    a.edges.push([to, distance]);
    b.edges.push([from, distance]);
  };
  for (const floor of building.floors) (floor.links || []).forEach(join);
  (building.connections || []).forEach(join);
  if (!graph.has(start)) return {graph,transfer,prev:new Map()};
  const pending = new Set(graph.keys()), dist = new Map([[start, 0]]), prev = new Map();
  while (pending.size) {
    let current, best = Infinity;
    for (const id of pending) if ((dist.get(id) ?? Infinity) < best) {
      current = id; best = dist.get(id);
    }
    if (!current) break;
    pending.delete(current);
    for (const [to, cost] of graph.get(current).edges) {
      if (best + cost < (dist.get(to) ?? Infinity)) {
        dist.set(to, best + cost); prev.set(to, current);
      }
    }
  }
  return {graph, transfer, prev};
}

function nodeRoute(building, start, place) {
  if (!place?.node || !start) return null;
  let origins = routesByBuilding.get(building);
  if (!origins) { origins = new Map(); routesByBuilding.set(building, origins); }
  let paths = origins.get(start);
  if (!paths) {
    paths = originPaths(building, start);
    if (origins.size >= 8) origins.delete(origins.keys().next().value);
    origins.set(start, paths);
  }
  const {graph, transfer, prev} = paths;
  if (!graph.has(start) || !graph.has(place.node) || (place.node !== start && !prev.has(place.node))) return null;
  const path = [];
  for (let at=place.node; at !== undefined; at=prev.get(at)) path.unshift(at);
  const steps = [];
  for (const [i, id] of path.entries()) {
    const {floor, coords}=graph.get(id);
    if (steps.at(-1)?.floor !== floor) {
      const via=transfer.get(path[i-1]+"\0"+id);
      if(steps.length) steps.at(-1).exitVia=via;
      steps.push({floor, points: [], entryVia:via});
    }
    steps.at(-1).points.push(coords);
  }
  return steps;
}

export function entranceRoute(building, place) {
  return nodeRoute(building, building.entranceNode, place);
}

export function placeRoute(building, from, to) {
  return nodeRoute(building, from?.node, to);
}

export function campusRoute(from, to) {
  if (!from || !to) return null;
  if (from.building === to.building) {
    return placeRoute(from.building, from.place, to.place)?.map(step=>({...step,building:from.building})) || null;
  }
  const exit = placeRoute(from.building, from.place, {node:from.building.entranceNode});
  const arrival = entranceRoute(to.building, to.place);
  if (!exit || !arrival) return null;
  const first = exit.map(step=>({...step,building:from.building}));
  const second = arrival.map(step=>({...step,building:to.building}));
  first.at(-1).exitVia = "Выход из " + from.building.name;
  first.at(-1).transferTo = "Далее по улице к " + to.building.name + ". Внешний участок на схеме не показан.";
  second[0].entryVia = "Вход в " + to.building.name;
  return [...first, ...second];
}

export function routeMidpoint(points) {
  const segments = [];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const dx = points[i][0] - x, dy = points[i][1] - y;
    const distance = Math.hypot(dx, dy);
    if (!distance) continue;
    segments.push({x, y, dx, dy, distance});
    length += distance;
  }
  let remaining = length / 2;
  for (const {x, y, dx, dy, distance} of segments) {
    if (remaining <= distance) {
      const t = remaining / distance;
      return {x:x + dx*t, y:y + dy*t, angle:Math.atan2(dy, dx)*180/Math.PI, length};
    }
    remaining -= distance;
  }
  return null;
}
