export const moveIn = "Заселение в общежитие";
export function currentMoveIn(records) {
  return records.find(record => record.name === moveIn && ["pending", "clarification"].includes(record.status));
}

export function moveInStatus(record) {
  return record.status === "clarification" ? "Деканат запросил уточнение по заселению" : "Заявка на заселение рассматривается";
}

export const buildings = [
  {
    id: "north", name: "Дом студентов · Северный", short: "Северный",
    address: "Москва, улица Удальцова, 73",
    commandant: "Лебедева Марина Викторовна", phone: "+7 (495) 000-21-01", extension: "21-01",
    office: "101", hours: "Пн, ср, пт · 10:00–13:00",
    reception: "Комната 102 · круглосуточно", laundry: "Комната 014 · 08:00–22:00",
  },
  {
    id: "park", name: "Дом студентов · Парковый", short: "Парковый",
    address: "Москва, улица Лобачевского, 48/87",
    commandant: "Соколов Илья Андреевич", phone: "+7 (495) 000-22-04", extension: "22-04",
    office: "104", hours: "Вт, чт · 14:00–18:00",
    reception: "Вестибюль, 1 этаж · круглосуточно", laundry: "Комната 012 · 08:00–22:00",
  },
];
