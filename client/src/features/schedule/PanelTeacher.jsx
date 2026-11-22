import { printDate } from "../../shared/domain/timetable.js";
import { EventType, eventType } from "./EventType.jsx";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelTeacher() {
  useSignals();
  const {
    showEvent,
    avatars,
    lesson,
    instructor,
    openLessonPage,
    faculty,
    jumpToClass,
    teaching,
    firstUpcoming
  } = useCabinet();
  return <Fragment>
                    <div className={"identity"}>
                      <div className={"portrait"}>
                        {avatars.value[instructor.value?.id] ? <img src={avatars.value[instructor.value?.id]} alt="Фото преподавателя" /> : <span>
                            {lesson.value.teacher.split(" ").map(n => n[0]).join("")}
                          </span>}
                      </div>
                      <div>
                        <h3>{lesson.value.teacher}</h3>
                        {faculty.value ? <Fragment>
                            <b className={"faculty-post"}>
                              {faculty.value.position}
                            </b>
                            <small>{faculty.value.faculties.join(" · ")}</small>
                            <small>{faculty.value.teaching}</small>
                          </Fragment> : null}
                      </div>
                    </div>
                    {instructor.value && <button type="button" className="text-link lesson-instructor-schedule" onClick={() => openLessonPage("person", instructor.value.id)}>
                        Открыть профиль преподавателя
                      </button>}
                    <h3 className={"faculty-agenda-title"}>
                      {"Расписание · осенний семестр"}
                    </h3>
                    <button onClick={jumpToClass} className={"text-link"}>
                      {" К ближайшему занятию ↓ "}
                    </button>
                    <div className={"teacher-list"}>
                      {teaching.value.map(d => <section key={d.date} data-upcoming={d.date === firstUpcoming.value}>
                          <h3>
                            {printDate(d.date, {
            weekday: "long",
            day: "numeric",
            month: "long"
          })}
                          </h3>
                          {d.events.map(e => <button key={e.id} onClick={event => {
          showEvent(e);
        }} data-event-type={eventType(e)} className={"record"}>
                              <em>{e.time}</em>
                              <span>
                                <b>{e.name}</b>
                                <small>
                                  <EventType type={eventType(e)} /> · {e.time}
                                  {"–"}
                                  {e.end}
                                  {" · "}
                                  {e.group}
                                  {" · "}
                                  {e.room}
                                </small>
                              </span>
                            </button>)}
                        </section>)}
                    </div>
                  </Fragment>;
}
