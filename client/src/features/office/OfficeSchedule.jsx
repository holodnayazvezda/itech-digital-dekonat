import { useEffect, useState } from "react";
import { today } from "../../shared/domain/timetable.js";
import { normalizeRoomQuery } from "../../shared/domain/booking-availability.js";
import PortalLoading from "../../shared/ui/PortalLoading.jsx";
import "../schedule/teaching.css";
export default function OfficeSchedule({
  request,
  revision,
  onLesson
}) {
  const [date, setDate] = useState(today());
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({
    status: "loading",
    rows: []
  });
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    setState({
      status: "loading",
      rows: []
    });
    request(`schedule?start=${date}&end=${date}`, undefined, {
      signal: controller.signal
    }).then(rows => {
      if (!controller.signal.aborted) setState({
        status: "ready",
        rows
      });
    }).catch(error => {
      if (!controller.signal.aborted) setState({
        status: "error",
        rows: [],
        error: error.message
      });
    });
    return () => controller.abort();
  }, [date, revision, retry, request]);
  const filter = query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  const roomFilter = normalizeRoomQuery(filter);
  const rows = state.rows.filter(lesson => [lesson.name, lesson.teacher, lesson.group, lesson.room].join(" ").toLocaleLowerCase("ru").replaceAll("ё", "е").includes(filter) || /\d/.test(roomFilter) && normalizeRoomQuery(lesson.room).includes(roomFilter));
  return <section className="office-schedule" aria-label="Управление расписанием">
    <div className="office-schedule-controls">
      <label className="field">Дата<input type="date" min="2026-09-01" max="2026-12-28" value={date} onChange={event => {
          setDate(event.target.value);
          setLimit(20);
        }} /></label>
      <label className="field">Поиск занятий<input type="search" placeholder="Название, группа, преподаватель или аудитория" value={query} onChange={event => {
          setQuery(event.target.value);
          setLimit(20);
        }} /></label>
    </div>
    {!date ? <p>Выберите дату.</p> : state.status === "loading" ? <PortalLoading layout="lessons" /> : state.status === "error" ? <div role="alert"><p>{state.error}</p><button className="text-link" onClick={() => setRetry(n => n + 1)}>Повторить</button></div> : <>
      <p className="office-schedule-count" role="status">Найдено занятий: {rows.length}</p>
      <div className="office-schedule-list">{rows.slice(0, limit).map(lesson => <button key={lesson.id} onClick={() => onLesson(lesson)}>
        <time>{lesson.time}–{lesson.end}</time>
        <span><strong>{lesson.name}{lesson.cancelled ? " · Отменена" : lesson.changed ? " · Перенесена" : ""}</strong>
          <small>{lesson.group} · {lesson.teacher} · {lesson.room}</small></span>
      </button>)}</div>
      {limit < rows.length && <button className="text-link" onClick={() => setLimit(n => n + 20)}>Показать ещё</button>}
    </>}
  </section>;
}
