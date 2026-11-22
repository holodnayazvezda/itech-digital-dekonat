export const eventTones = {"Лекция":"#22d3ee","Практика":"#ff6a1f","Семинар":"#ff6a1f","Экзамен":"#a855f7","Зачёт":"#a855f7","Бронь":"#7795e8","Спорт":"#84cc16","Лабораторная":"#f43f5e","Мероприятие":"#f43f5e","Встреча":"#e6b244"};

export function eventType(event) {
  if (event.kind === "booking") return "Бронь";
  if (event.type === "Мероприятие" && event.name === "Совет факультета") return "Встреча";
  return event.type || "Событие";
}

export function EventType({type}) {
  return <span className="event-type" data-event-type={type}>{type}</span>;
}
