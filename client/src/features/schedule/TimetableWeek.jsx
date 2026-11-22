import { eventTones as tones } from "./EventType.jsx";
import { eventType } from "./EventType.jsx";
import { printDate, today, overlaps } from "../../shared/domain/timetable.js";
import "./timetable.css";
import { minutes, eventLanes } from "./timetable-layout.js";
import { Fragment } from "react";
import { UserRound, MapPin } from "lucide-react";
import "@fontsource-variable/nunito/wght.css";
const roomLabel = event => [event.building?.short, event.room].filter(Boolean).join(" · ");
const eventStatus = event => event.cancelled ? "Отменена" : event.changed ? "Перенесена" : "";
const eventLabel = event => [event.time + "–" + event.end, event.name, event.teacher, roomLabel(event), eventStatus(event)].filter(Boolean).join(", ");
const shortName = name => {
  const [surname, ...rest] = name.split(" ");
  return surname + " " + rest.map(part => part[0] + ".").join("");
};
function openTimetableEvent(button, event, onEvent) {
  button.focus({
    preventScroll: true
  });
  onEvent(event);
}
export function TimetableAgenda({
  events,
  onEvent,
  role,
  label = "Расписание",
  showEnd = true,
  minute = null
}) {
  const active = events.filter(event => !event.cancelled);
  const next = minute === null ? undefined : active.find(event => event.kind !== "booking" && minutes(event.end) > minute);
  return <div className="timetable-agenda">
    {label && <div className="agenda-label">{label}</div>}
    {!events.length && <p className="timetable-empty">Занятий нет</p>}
    {events.map((event, index) => {
      const previous = events.slice(0, index).filter(item => !item.cancelled);
      const gap = previous.length && !event.cancelled ? minutes(event.time) - Math.max(...previous.map(item => minutes(item.end))) : 0;
      return <Fragment key={event.id}>
      {gap >= 30 && <div className="agenda-break"><span>{gap} мин</span><p>Перерыв между занятиями</p></div>}
      <button className="agenda-event" data-cancelled={event.cancelled || undefined} onClick={e => openTimetableEvent(e.currentTarget, event, onEvent)} style={{
          "--event-accent": tones[eventType(event)] || "#aab6cc"
        }} aria-label={eventLabel(event)}>
      <time><b>{event.time}</b><span>{event.end}</span></time>
      <span className="agenda-event-body"><small>{eventType(event)}</small><strong>{event.name}</strong>
        {eventStatus(event) && <span className="lesson-slot-status">{eventStatus(event)}</span>}
        {event === next && <span className="lesson-slot-status">{minutes(event.time) <= minute ? `Идёт сейчас · до ${event.end}` : `До начала · ${minutes(event.time) - minute} мин`}</span>}
        {(role === "teacher" ? event.group : event.teacher) && <span className="agenda-meta"><UserRound size={14} strokeWidth={1.7} aria-hidden="true" />{role === "teacher" ? event.group : shortName(event.teacher)}</span>}
        {roomLabel(event) && <span className="agenda-meta"><MapPin size={14} strokeWidth={1.7} aria-hidden="true" />{roomLabel(event)}</span>}
      </span>
      </button></Fragment>;
    })}
    {showEnd && !!active.length && <div className="agenda-finish"><span>{active.reduce((latest, event) => event.end > latest ? event.end : latest, active[0].end)}</span><p>Дальше занятий нет</p></div>}
  </div>;
}
export default function TimetableWeek({
  days,
  groups,
  onDay,
  onEvent,
  role,
  minute = null
}) {
  const all = days.flatMap(date => groups[date]);
  const start = Math.floor(Math.min(540, ...all.map(event => minutes(event.time))) / 60) * 60;
  const end = Math.ceil(Math.max(900, ...all.map(event => minutes(event.end))) / 60) * 60;
  const scale = 1.3,
    height = (end - start) * scale;
  const hours = Array.from({
    length: (end - start) / 60 + 1
  }, (_, index) => start + index * 60);
  const now = minute !== null && minute >= start && minute <= end ? [Math.floor(minute / 60), minute % 60].map(value => String(value).padStart(2, "0")).join(":") : "";
  return <>
    <div className="timetable-week" aria-label="Расписание недели по времени" style={{
      "--time-height": height + "px",
      "--hour-height": 60 * scale + "px",
      "--week-columns": days.length
    }}>
      <div className="timetable-corner">МСК</div>
      {days.map(date => <button className="timetable-day" key={date} onClick={() => onDay(date)} aria-label={printDate(date, {
        weekday: "long",
        day: "numeric",
        month: "long"
      })} aria-current={date === today() ? "date" : undefined}>
        <span>{date === today() ? "Сегодня" : printDate(date, {
            weekday: "short"
          })}</span><b>{Number(date.slice(-2))}</b>
      </button>)}
      <div className="timetable-hours" aria-hidden="true">{hours.map(hour => <span key={hour} style={{
          top: (hour - start) * scale
        }}>{String(hour / 60).padStart(2, "0")}:00</span>)}</div>
      {days.map(date => <div className="timetable-column" key={date} data-today={date === today()}>
        {eventLanes(groups[date]).map(({
          event,
          lane,
          lanes
        }) => {
          const conflict = !event.cancelled && groups[date].some(other => !other.cancelled && other.id !== event.id && overlaps(other, event));
          const duration = minutes(event.end) - minutes(event.time);
          const status = eventStatus(event);
          return <button className="timetable-event" key={event.id} aria-label={eventLabel(event) + (conflict ? ", совпадает по времени" : "")} title={eventLabel(event)} data-cancelled={event.cancelled || undefined} data-compact={duration < 60} data-overlap={lanes > 1} onClick={e => openTimetableEvent(e.currentTarget, event, onEvent)} style={{
            top: (minutes(event.time) - start) * scale + 3,
            height: Math.max(24, duration * scale - 6),
            left: `calc(${lane / lanes * 100}% + 5px)`,
            width: `calc(${100 / lanes}% - 10px)`,
            "--event-accent": tones[eventType(event)] || "#aab6cc"
          }}>
            <div className="week-event-top"><small className={status ? "timetable-event-kind timetable-event-status" : "timetable-event-kind"}>{status || eventType(event)}</small><time>{event.time}–{event.end}</time></div>
            <strong>{event.name}</strong>
            <div className="week-event-details">
              {(role === "teacher" ? event.group : event.teacher) && <span>{role === "teacher" ? event.group : shortName(event.teacher)}</span>}
              {roomLabel(event) && <span><MapPin size={11} strokeWidth={1.8} aria-hidden="true" />{roomLabel(event)}</span>}
            </div>
            {conflict && <i>Пересечение</i>}
          </button>;
        })}
        {date === today() && now && <div className="timetable-now" style={{
          top: (minute - start) * scale
        }}>
          <time dateTime={now} aria-label={"Текущее время " + now}>{now}</time>
        </div>}
      </div>)}
    </div>
    <div className="timetable-legend"><span style={{
        "--event-accent": tones["Лекция"]
      }}>Лекция</span><span style={{
        "--event-accent": tones["Практика"]
      }}>Практика</span><span style={{
        "--event-accent": tones["Бронь"]
      }}>Бронь</span><small>Время по Москве</small></div>
  </>;
}
