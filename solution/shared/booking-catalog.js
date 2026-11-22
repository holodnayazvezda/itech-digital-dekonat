import { buildings } from "./timetable.js";

const seatsWord = new Intl.PluralRules("ru");
const seatLabels = { one: "место", few: "места", many: "мест", other: "места" };

// Retain booking data only. Floor polygons and route graphs stay in the static atlas.
export function bookingCatalogFromMap(atlas) {
  const codes = new Set();
  return atlas.buildings.map(building => ({
    id: building.id,
    name: building.name,
    floors: building.floors.map(floor => ({
      id: floor.id,
      name: floor.name,
      rooms: floor.places
        .filter(p => p.code && p.bookable !== false && ["class", "work", "sport"].includes(p.kind))
        .map(p => {
          if (codes.has(p.code)) throw Error("Повторный код помещения: " + p.code);
          codes.add(p.code);
          const room = { code: p.code, name: p.name, kind: p.kind };
          if (p.seats !== undefined) {
            if (!Number.isInteger(p.seats) || p.seats < 1) throw Error("Некорректная вместимость: " + p.code);
            room.seats = p.seats;
          }
          if (p.equipment) room.equipment = p.equipment;
          return room;
        })
        .sort((a, b) => a.code.localeCompare(b.code, "ru", {numeric:true})),
    })).filter(f => f.rooms.length),
  })).filter(b => b.floors.length);
}

export function bookingRooms(catalog) {
  return catalog.flatMap(b => {
    const building = { short: b.name, image: "", alt: "", ...buildings[b.id], name: b.name };
    return b.floors.flatMap(f => f.rooms.map(p => {
      // Individual-capacity admission is a separate service for this demo gym.
      const individual = p.code === "Н-101" && p.kind === "sport";
      let kind = "Аудитория", defaultSeats = 32, equipment = "проектор";
      if (individual) {
        kind = "Спортзал"; defaultSeats = 12;
      } else if (p.kind === "work") {
        kind = p.name === "Переговорная" ? "Переговорная" : "Коворкинг";
        defaultSeats = kind === "Переговорная" ? 6 : p.name === "Студия" ? 8 : 12;
        equipment = p.name === "Проектный зал" ? "доска" : "экран";
      }
      const capacity = p.seats ?? defaultSeats;
      return {
        short: p.code, name: p.name + " " + p.code, kind, building, floor: f.id, floorName: f.name, capacity,
        meta: individual ? "Индивидуальные занятия" :
          capacity + " " + seatLabels[seatsWord.select(capacity)] + " · " + (p.equipment || equipment),
      };
    }));
  });
}
