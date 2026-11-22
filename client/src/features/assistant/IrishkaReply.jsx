import { useState } from "react";
import { ArrowUpRight, BookOpen, CalendarDays, Clock, DoorOpen, Download, FileText, LayoutGrid, MapPin, UserRound, Users } from "lucide-react";
import { offset, printDate, today } from "../../shared/domain/timetable.js";
import { ReplyAction, ReplyPanelHeading } from "./IrishkaActions.jsx";
import IrishkaMap from "./IrishkaMap.jsx";
import IrishkaSport from "./IrishkaSport.jsx";
import { TimetableAgenda } from "../schedule/TimetableWeek.jsx";
export { ReplyAction } from "./IrishkaActions.jsx";
function ScheduleBlock({
  block,
  role,
  onAction,
  actionHref
}) {
  const dates = [];
  for (let date = block.start; date && date <= block.end && dates.length < 31; date = offset(date, 1)) dates.push(date);
  const [date, setDate] = useState(() => dates.includes(today()) ? today() : block.lessons[0]?.date || dates[0]);
  const lessons = block.lessons.filter(lesson => lesson.date === date);
  const dayLabel = date && printDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  return <section className="irishka-reply-panel irishka-schedule calendar-responsive" aria-label="Расписание">
    <ReplyPanelHeading icon={CalendarDays}>Расписание</ReplyPanelHeading>
    {dates.length > 1 && <div className="irishka-schedule-days" role="group" aria-label="Выбрать день расписания">
      {dates.map(day => <button type="button" key={day} aria-pressed={day === date} onClick={() => setDate(day)}>
        {day === today() ? "Сегодня" : printDate(day, {
          weekday: "short",
          day: "numeric"
        })}
      </button>)}
    </div>}
    <TimetableAgenda events={lessons} role={role} label={dayLabel} showEnd={block.total <= block.lessons.length} onEvent={lesson => onAction("search-result", {
      category: "subjects",
      date: lesson.date,
      lessonId: lesson.id
    })} />
    <footer className="irishka-reply-actions">
      <ReplyAction action="schedule" detail={{
        date
      }} onAction={onAction} actionHref={actionHref}>Открыть расписание<ArrowUpRight size={14} aria-hidden="true" /></ReplyAction>
    </footer>
  </section>;
}
const searchCategories = [["people", "Люди", Users], ["rooms", "Аудитории", DoorOpen], ["subjects", "Предметы", BookOpen], ["services", "Сервисы", LayoutGrid]];
function SubjectDetails({
  match,
  onAction,
  actionHref
}) {
  const teachers = match.teachers?.length ? match.teachers : match.teacher ? [{
    name: match.teacher,
    id: match.teacherId
  }] : [];
  const room = [match.room, match.building?.short || match.building?.name].filter(Boolean).join(" · ");
  const date = match.date && printDate(match.date, {
    day: "numeric",
    month: "long"
  });
  const time = match.time && [match.time, match.end].filter(Boolean).join("–");
  return <div className="irishka-subject-details">
    {(date || time) && <span><Clock size={13} aria-hidden="true" />{[date, time].filter(Boolean).join(", ")}</span>}
    {teachers.map(({
      name,
      id
    }) => id ? <ReplyAction key={id} className="irishka-subject-detail-link" action="search-result" detail={{
      category: "people",
      id
    }} onAction={onAction} actionHref={actionHref}>
        <UserRound size={13} aria-hidden="true" />{name}
      </ReplyAction> : <span key={name}><UserRound size={13} aria-hidden="true" />{name}</span>)}
    {room && (match.placeId || match.room ? <ReplyAction className="irishka-subject-detail-link" action="search-result" detail={{
      category: "rooms",
      id: match.placeId || match.room
    }} onAction={onAction} actionHref={actionHref}>
        <MapPin size={13} aria-hidden="true" />{room}
      </ReplyAction> : <span><MapPin size={13} aria-hidden="true" />{room}</span>)}
  </div>;
}
function SearchBlock({
  block,
  onAction,
  actionHref
}) {
  return <section className="irishka-search-list" aria-label="Результаты поиска">
    {searchCategories.map(([category, label, Icon]) => {
      const matches = block.matches.filter(match => match.category === category);
      if (!matches.length) return null;
      return <div className="irishka-reply-panel irishka-search-group" key={category}>
        <ReplyPanelHeading icon={Icon}>{label}</ReplyPanelHeading>
        <ul>{matches.map((match, index) => <li key={match.id + ":" + index}>
          <ReplyAction className="irishka-search-result" action="search-result" detail={match} onAction={onAction} actionHref={actionHref}>
            <span>
              <strong>{match.name}</strong>
              {(match.detail || match.changed || match.cancelled) && <small>{[match.detail, match.cancelled ? "Отменено" : match.changed ? "Перенесено" : ""].filter(Boolean).join(" · ")}</small>}
            </span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </ReplyAction>
          {category === "subjects" && <SubjectDetails match={match} onAction={onAction} actionHref={actionHref} />}
        </li>)}</ul>
      </div>;
    })}
  </section>;
}
function DocumentBlock({
  block,
  onAction,
  actionHref
}) {
  if (!block.forms.length && !block.downloads.length) return null;
  return <section className="irishka-reply-actions irishka-document-links" aria-label="Документы и заявления">
    {block.forms.map(form => <ReplyAction key={form.name} action="document-form" detail={form} onAction={onAction} actionHref={actionHref}>
      <FileText size={15} aria-hidden="true" /><span>{form.name}</span><ArrowUpRight size={13} aria-hidden="true" />
    </ReplyAction>)}
    {block.downloads.map(download => {
      const expired = Boolean(download.expires && download.expires <= Date.now());
      return <button type="button" className="irishka-action-chip" key={download.id} disabled={expired} onClick={() => onAction("document-download", download)}>
        <Download size={15} aria-hidden="true" /><span>{download.name}{expired && <small> · Срок скачивания истёк</small>}</span>
        {!expired && <span className="irishka-file-type">PDF</span>}
      </button>;
    })}
  </section>;
}
export function ReplyBlocks({
  blocks,
  role,
  onAction,
  actionHref,
  sportsBookings,
  onBookSport,
  onAsk
}) {
  return <div className="irishka-reply-blocks">
    {blocks.map((block, index) => {
      if (block.type === "schedule") return <ScheduleBlock key={index} block={block} role={role} onAction={onAction} actionHref={actionHref} />;
      if (block.type === "route" || block.type === "place") {
        const destination = block.to || block.place;
        return <IrishkaMap key={`${index}:${block.from?.id || ""}:${destination.id}`} block={block} onAction={onAction} actionHref={actionHref} />;
      }
      if (block.type === "search") return <SearchBlock key={index} block={block} onAction={onAction} actionHref={actionHref} />;
      if (block.type === "documents") return <DocumentBlock key={index} block={block} onAction={onAction} actionHref={actionHref} />;
      if (block.type === "sports") return <IrishkaSport key={index} block={block} bookings={sportsBookings} onBook={onBookSport} onAsk={onAsk} onAction={onAction} actionHref={actionHref} />;
      return null;
    })}
  </div>;
}
