import { Navigation } from "lucide-react";
import { today } from "../../shared/domain/timetable.js";
import { EventType, eventType } from "../schedule/EventType.jsx";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelRoom() {
  useSignals();
  const {
    role,
    assetBase,
    findRoom,
    lesson,
    openLessonPage,
    venue,
    roomDate,
    roomEvents
  } = useCabinet();
  return <Fragment>
                    <div className={"room-ident"}>
                      <div>
                        <small>{lesson.value.building.name}</small>
                        <h3>
                          {"Аудитория "}
                          {lesson.value.room}
                        </h3>
                        <small className="lesson-room-location">
                          {[venue.value.floor, venue.value.address].filter(Boolean).join(" · ")}
                        </small>
                      </div>
                      <img src={assetBase + lesson.value.building.image} alt="" />
                    </div>
                    <button type="button" className="campus-action room-route-action" onClick={() => {
      openLessonPage("navigator", lesson.value.room, {
        date: roomDate.value,
        fromEntrance: true
      });
    }}>
                      <Navigation size={18} aria-hidden="true" /> Проложить маршрут
                    </button>
                    <label className={"field"}>
                      {"Занятость на дату"}
                      <input type="date" value={roomDate.value ?? ""} onChange={event => {
        roomDate.value = event.target.value;
      }} />
                    </label>
                    {roomEvents.value.map(e => <div key={e.id} className={"record"} data-event-type={eventType(e)}>
                        <em>{e.time}</em>
                        <span>
                          <b>{e.name}</b>
                          <small>
                            <EventType type={eventType(e)} /> · {e.time}
                            {"–"}
                            {e.end}
                            {" · "}
                            {e.teacher}
                          </small>
                        </span>
                      </div>)}
                    {!roomEvents.value.length ? <p>
                        {" На выбранную дату занятий и подтверждённых броней нет. "}
                      </p> : null}
                    {["student", "teacher"].includes(role.value) && <button type="button" onClick={() => findRoom(lesson.value.room, roomDate.value)} disabled={!roomDate.value || roomDate.value < today() || roomDate.value > "2026-12-28"} className="campus-action">
                        Выбрать время
                      </button>}
                  </Fragment>;
}
