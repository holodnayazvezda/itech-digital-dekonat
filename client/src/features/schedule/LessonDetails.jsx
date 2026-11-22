import { CalendarDays, Clock3, ChevronRight, DoorOpen, MapPin, UsersRound, Monitor, Navigation } from "lucide-react";
import { rooms } from "../../shared/domain/campus-data.js";
import { printDate } from "../../shared/domain/timetable.js";
import { EventType, eventType, eventTones } from "./EventType.jsx";
import { LessonChangeDetails } from "./LessonActions.jsx";
import { useImageReady } from "../../shared/ui/image-ready.js";
import "./lesson-details.css";
export function lessonLocation(lesson) {
  const room = rooms.find(item => item.short === lesson.room);
  return {
    floor: room?.floorName || `${lesson.floor} этаж`,
    address: room?.building.address || lesson.building.address
  };
}
function Text({
  children
}) {
  return <span className="image-skeleton-text">{children}</span>;
}
export default function LessonDetails({
  lesson,
  instructor,
  onRoom,
  onInstructor,
  onInstructorSchedule,
  onGroup,
  onRoute,
  children
}) {
  const photo = lesson.building.image ? import.meta.env.BASE_URL + lesson.building.image : "";
  const {
    pending,
    imageProps
  } = useImageReady(photo);
  const type = eventType(lesson);
  const {
    floor,
    address
  } = lessonLocation(lesson);
  const date = printDate(lesson.date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const room = rooms.find(item => item.short === lesson.room);
  const minutes = time => time.split(":").map(Number).reduce((h, m) => h * 60 + m);
  const duration = minutes(lesson.end) - minutes(lesson.time);
  const equipment = room?.meta.split(" · ").slice(1).join(" · ");
  const teacher = <>
      <span>
        <small><Text>Преподаватель</Text></small>
        <b><Text>{lesson.teacher}</Text></b>
        {instructor?.title && instructor.title !== "Преподаватель" && <small className="lesson-person-title"><Text>{instructor.title}</Text></small>}
        {instructor?.unit && <small className="lesson-person-unit"><Text>{instructor.unit}</Text></small>}
      </span>
      {onInstructor && <ChevronRight size={19} className="image-skeleton-icon" aria-hidden="true" />}
    </>;
  const group = <>
      <small><Text>{lesson.type === "Мероприятие" ? "Участники" : "Группа"}</Text></small>
      <b><Text>{lesson.group}</Text></b>
    </>;
  return <div className="lesson-media" data-image-pending={pending || undefined}>
      {pending && <span role="status" aria-label="Загружаем карточку занятия" className="media-loading-status" />}
      <div inert={pending || undefined}>
      <div className="detail-block lesson-details" data-event-type={type} style={{
        "--event-accent": eventTones[type] || "#aab6cc"
      }}>
        <Text><EventType type={type} /></Text>
        <b><Text>{lesson.name}</Text></b>
        <div className="lesson-time-facts">
          <span><CalendarDays className="image-skeleton-icon" size={17} /><Text>{date}</Text></span>
          <span><Clock3 className="image-skeleton-icon" size={17} /><Text>{lesson.time} – {lesson.end}</Text></span>
          {duration > 0 && <span className="lesson-duration"><Text>{duration} минут</Text></span>}
        </div>
      </div>
      <LessonChangeDetails lesson={lesson} />
      <div className="lesson-body-grid"><section className="lesson-location-block" aria-label="Место проведения"><h3><MapPin className="image-skeleton-icon" size={18} /><Text>Место проведения</Text></h3>
      <button type="button" className="room-address lesson-room" onClick={onRoom}>
        <span>
          <small><Text>Место занятия</Text></small>
          <b><Text>{lesson.room}</Text></b>
          <small><Text>{lesson.building.name} · {floor}</Text></small>
          {address && <small><Text>{address}</Text></small>}
        </span>
        {photo ? <span className="lesson-room-photo image-skeleton-block"><img {...imageProps} alt="" /></span> : <DoorOpen size={22} aria-hidden="true" />}
      </button>
      {room && <dl className="lesson-room-facts">
        <div><dt><UsersRound className="image-skeleton-icon" size={16} /><Text>Вместимость</Text></dt><dd><Text>{room.capacity} {{
                    one: "место",
                    few: "места",
                    many: "мест",
                    other: "места"
                  }[new Intl.PluralRules("ru").select(room.capacity)]}</Text></dd></div>
        <div><dt><DoorOpen className="image-skeleton-icon" size={16} /><Text>Помещение</Text></dt><dd><Text>{room.kind}</Text></dd></div>
        {equipment && <div><dt><Monitor className="image-skeleton-icon" size={16} /><Text>Оснащение</Text></dt><dd><Text>{equipment}</Text></dd></div>}
      </dl>}
      {onRoute && <button type="button" className="lesson-route-button image-skeleton-block" onClick={onRoute}><Navigation className="image-skeleton-icon" size={17} /><Text>Проложить маршрут</Text></button>}
      </section><section className="lesson-side-block" aria-label="Участники занятия"><h3><Text>Участники занятия</Text></h3>
      <div className="lesson-people lesson-contacts">
        {onInstructor ? <button type="button" className="lesson-instructor" onClick={onInstructor}>{teacher}</button> : <div className="lesson-instructor">{teacher}</div>}
        {onGroup && lesson.type !== "Мероприятие" ? <button type="button" onClick={onGroup}>{group}</button> : <div>{group}</div>}
      </div>
      <button type="button" className="text-link lesson-instructor-schedule" onClick={onInstructorSchedule}>
        <Text>Расписание преподавателя</Text>
      </button>
      </section></div>
      {children}
      </div>
    </div>;
}
