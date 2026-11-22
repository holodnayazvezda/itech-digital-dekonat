import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, ClipboardList, XCircle } from "lucide-react";
import { rooms } from "../../shared/domain/campus-data.js";
import { printDate } from "../../shared/domain/timetable.js";
import { newRequestId } from "../../shared/api/request-id.js";
import { normalizeRoomQuery } from "../../shared/domain/booking-availability.js";
import "./teaching.css";
const actions = [{
  id: "reschedule",
  label: "Перенести пару",
  submit: "Опубликовать перенос",
  Icon: CalendarClock
}, {
  id: "cancel",
  label: "Отменить пару",
  submit: "Подтвердить отмену",
  Icon: XCircle
}, {
  id: "homework",
  label: "Отправить домашнее задание",
  submit: "Отправить группе",
  Icon: ClipboardList
}];
const classrooms = rooms.filter(room => room.kind === "Аудитория");
function slotLabel(slot) {
  return `${printDate(slot.date, {
    day: "numeric",
    month: "long"
  })} · ${slot.time}–${slot.end} · ${slot.room}`;
}
export function LessonChangeDetails({
  lesson
}) {
  if (!lesson.changed && !lesson.cancelled) return null;
  return <section className="lesson-change" data-cancelled={lesson.cancelled || undefined} aria-label="Изменение занятия">
    <strong>{lesson.cancelled ? "Пара отменена" : "Пара перенесена"}</strong>
    {lesson.previous && <p>Было {slotLabel(lesson.previous)}</p>}
    {!lesson.cancelled && <p>Стало {slotLabel(lesson)}</p>}
    {lesson.changeReason && <p>{lesson.changeReason}</p>}
  </section>;
}
export default function LessonActions({
  lesson,
  busy,
  onPublish
}) {
  const [action, setAction] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(lesson.date);
  const [time, setTime] = useState(lesson.time);
  const [room, setRoom] = useState(lesson.room);
  const request = useRef(null);
  const actionForm = useRef(null);
  const actionTrigger = useRef(null);
  const optionList = useRef(null);
  const datalistId = useId();
  const selected = actions.find(item => item.id === action);
  const roomCode = normalizeRoomQuery(room);
  const validRoom = classrooms.find(item => normalizeRoomQuery(item.short) === roomCode);
  useEffect(() => {
    if (actionForm.current) {
      actionForm.current.focus({
        preventScroll: true
      });
      actionForm.current.scrollIntoView({
        block: "nearest"
      });
    } else if (actionTrigger.current) {
      optionList.current?.querySelector(`[data-lesson-action="${actionTrigger.current}"]`)?.focus({
        preventScroll: true
      });
      actionTrigger.current = null;
    }
  }, [action]);
  function reset(nextAction = "") {
    if (nextAction) actionTrigger.current = nextAction;
    request.current = null;
    setAction(nextAction);
    setBody("");
    setDate(lesson.date);
    setTime(lesson.time);
    setRoom(lesson.room);
  }
  async function submit(event) {
    event.preventDefault();
    if (!body.trim() || action === "reschedule" && !validRoom || busy) return;
    const data = {
      lessonId: lesson.id,
      revision: lesson.revision || 0,
      body: body.trim()
    };
    if (action === "reschedule") Object.assign(data, {
      date,
      time,
      room: validRoom.short
    });
    const signature = JSON.stringify(data);
    if (request.current?.signature !== signature) request.current = {
      signature,
      id: newRequestId()
    };
    const result = await onPublish(action, {
      ...data,
      requestId: request.current.id
    });
    if (result) reset();
  }
  if (!lesson.canManage || lesson.cancelled) return null;
  return <section className="lesson-actions" aria-labelledby={datalistId + "-title"}>
    <h3 id={datalistId + "-title"}>Управление занятием</h3>
    {!selected ? <div className="lesson-action-options" ref={optionList}>
      {actions.map(({
        id,
        label,
        Icon
      }) => <button key={id} data-lesson-action={id} type="button" onClick={() => reset(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}
    </div> : <form ref={actionForm} tabIndex={-1} aria-labelledby={datalistId + "-action"} onSubmit={submit} className="lesson-action-form">
      <p id={datalistId + "-action"} className="lesson-action-kind">{selected.label} · {lesson.group}</p>
      {action === "reschedule" && <div className="lesson-action-fields">
        <label className="field">Новая дата<input required type="date" min="2026-09-01" max="2026-12-28" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="field">Начало<input required type="time" min="09:00" max="21:30" value={time} onChange={event => setTime(event.target.value)} /></label>
        <div className="lesson-action-room">
          <label className="field">Аудитория<input required value={room} list={datalistId} aria-invalid={!validRoom || undefined} aria-describedby={!validRoom ? datalistId + "-room-error" : undefined} onChange={event => setRoom(event.target.value)} /></label>
          <datalist id={datalistId}>{classrooms.map(item => <option key={item.short} value={item.short}>{item.building.name} · {item.capacity} мест</option>)}</datalist>
          {!validRoom && <p id={datalistId + "-room-error"} className="lesson-action-hint">Укажите номер аудитории из списка, например Б-412.</p>}
        </div>
      </div>}
      <label className="field">{action === "homework" ? "Текст задания" : "Причина для группы"}
        <textarea required rows={3} maxLength={2500} value={body} onChange={event => setBody(event.target.value)} />
      </label>
      <p className="lesson-action-hint">{action === "homework" ? "Студенты получат текст задания в уведомлениях." : "Изменение сразу появится в расписании и уведомлениях группы."}</p>
      <div className="lesson-action-buttons">
        <button type="submit" className="campus-action" disabled={busy || !body.trim() || action === "reschedule" && !validRoom}>{selected.submit}</button>
        <button type="button" className="text-link" onClick={() => reset()} disabled={busy}>Назад</button>
      </div>
    </form>}
  </section>;
}
