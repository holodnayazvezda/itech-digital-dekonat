import { EventType, eventType } from "./EventType.jsx";
import { today, printDate } from "../../shared/domain/timetable.js";
import { mdiArrowTopRight } from "@mdi/js";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { Icon, Dynamic } from "../../shared/ui/ui.jsx";
export default function LessonHero(props) {
  useSignals();
  return <>
      <article className={"next-class"}>
        <div className={"lesson-head"}>
          <Dynamic as={props.preview ? "div" : "button"} onClick={event => {
          props.onLesson?.();
        }} className={"next-lesson"}>
            <span className={"lesson-label"}>
              {props.nextLesson.type === "Мероприятие" ? props.lessonInProgress ? "Сейчас идёт мероприятие" : "Следующее мероприятие" : props.lessonInProgress ? "Сейчас идёт пара" : "Следующая пара"}
            </span>
            <strong>{props.nextLesson.name}</strong>
            <span className={"countdown"}>{props.countdown}</span>
            <span className={"lesson-time"}>
              {props.faculty && props.nextLesson.date !== today() ? <Fragment>
                  {printDate(props.nextLesson.date, {
                day: "numeric",
                month: "short"
              })}
                  {" · "}
                </Fragment> : null}
              {props.nextLesson.time}
              {" — "}
              {props.nextLesson.end} <span>{" / "}</span>{" "}
              <EventType type={eventType(props.nextLesson)} />
            </span>
          </Dynamic>
          {props.faculty ? <span className={"instructor group-hero"}>
              {props.nextLesson.type === "Мероприятие" ? "Участники " : "Группа "}
              <b>{props.nextLesson.group}</b>
            </span> : <Dynamic as={props.preview ? "div" : "button"} onClick={event => {
          props.onTeacher?.();
        }} className={"instructor"}>
              {props.nextLesson.teacher}{" "}
              {!props.preview ? <Icon icon={mdiArrowTopRight} /> : null}
            </Dynamic>}
        </div>
        <Dynamic as={props.preview ? "div" : "button"} aria-label={"Открыть расписание аудитории " + props.nextLesson.room} onClick={event => {
        props.onRoom?.();
      }} className={"campus-plate"}>
          <img src={import.meta.env.BASE_URL + props.nextLesson.building.image} alt={props.nextLesson.building.alt} />
          <span className={"plate-caption"}>
            <b>{props.nextLesson.building.name}</b>
            <span>
              {props.nextLesson.floor}
              {" этаж · "}
              {props.nextLesson.room}
            </span>
            {!props.preview ? <Icon icon={mdiArrowTopRight} /> : null}
          </span>
        </Dynamic>
      </article>
    </>;
}
