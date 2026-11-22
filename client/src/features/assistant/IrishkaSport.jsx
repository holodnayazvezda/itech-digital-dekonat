import { useState } from "react";
import { ArrowRight, Dumbbell, MapPin } from "lucide-react";
import { printDate } from "../../shared/domain/timetable.js";
import { ReplyAction, ReplyPanelHeading } from "./IrishkaActions.jsx";
import "./irishka-sport.css";
const dateFormat = {
  weekday: "short",
  day: "numeric",
  month: "long"
};
const currentBooking = ({
  status
}) => status === "pending" || status === "approved";
const slotKey = ({
  sport,
  date,
  time
}) => [sport, date, time].join("/");
function SessionTime({
  session
}) {
  return <span className="irishka-sport-time">
    {printDate(session.date, dateFormat)} · {session.time}–{session.end}
    {session.venue && ` · ${session.venue}`}
  </span>;
}
export default function IrishkaSport({
  block,
  bookings = [],
  onBook,
  onAsk,
  onAction,
  actionHref
}) {
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");
  const active = bookings.filter(currentBooking);
  const upcoming = new Map();
  for (const item of block.upcoming) {
    const record = bookings.find(booking => booking.id === item.id);
    if (currentBooking(record || item)) upcoming.set(slotKey(item), {
      ...item,
      status: record?.status || item.status
    });
  }
  for (const session of block.sessions) {
    const record = active.find(booking => slotKey(booking) === slotKey(session));
    if (record) upcoming.set(slotKey(session), {
      ...session,
      status: record.status
    });
  }
  const sessions = block.sessions.filter(session => !upcoming.has(slotKey(session)));
  async function enroll(session) {
    if (sending) return;
    setSending(slotKey(session));
    setError("");
    try {
      await onBook(session);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setSending("");
    }
  }
  return <section className="irishka-sport irishka-reply-panel" aria-label="Запись на спорт">
    <ReplyPanelHeading icon={Dumbbell}>{sessions.length ? "Ближайшие занятия" : "Спорт"}</ReplyPanelHeading>
    {!!upcoming.size && <div className="irishka-sport-upcoming" aria-live="polite">
      {[...upcoming.values()].map(session => <div className="irishka-sport-row" key={slotKey(session)}>
        <div><strong>{session.name}</strong><SessionTime session={session} /></div>
        <small className="irishka-sport-status">{session.status === "approved" ? "Запись подтверждена" : "Заявка на рассмотрении"}</small>
      </div>)}
      <button type="button" className="irishka-action-chip" disabled={!onAsk} onClick={() => onAsk("Построй маршрут на мою ближайшую тренировку")}>
        <MapPin size={15} aria-hidden="true" />Маршрут на тренировку
      </button>
    </div>}
    {sessions.map(session => <div className="irishka-sport-row" key={slotKey(session)}>
      <div><strong>{session.name}</strong><SessionTime session={session} /></div>
      <button type="button" className="irishka-action-chip" disabled={!!sending || !onBook} aria-label={`Записаться: ${session.name}, ${session.date} в ${session.time}`} onClick={() => void enroll(session)}>
        {sending === slotKey(session) ? "Отправляем…" : "Записаться"}
      </button>
    </div>)}
    {!!sessions.length && <small className="irishka-sport-note">Заявку на запись подтверждает деканат.</small>}
    {error && <p role="alert" className="irishka-sport-error">{error}</p>}
    <footer className="irishka-reply-actions">
      <ReplyAction action="sports" onAction={onAction} actionHref={actionHref}>Все занятия<ArrowRight size={14} aria-hidden="true" /></ReplyAction>
    </footer>
  </section>;
}
