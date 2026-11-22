import { today } from "../../shared/domain/timetable.js";
import { EventType, eventType } from "./EventType.jsx";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { classNames } from "../../shared/ui/ui.jsx";
import { useCabinet } from '../../shared/state/CabinetContext.jsx';
export default function AgendaRow({
  entry
}) {
  useSignals();
  const {
    findRoom,
    openRecord,
    overlapsBooking,
    showEvent,
    role
  } = useCabinet();
  return <Fragment key={entry.id}>
        {entry.kind === "gap" ? <div className={"rest-row"}>
            <div>
              <b>{"Свободное время"}</b>
              <small>
                {"Можно отдохнуть до "}
                {entry.end}
              </small>
            </div>
            <button onClick={event => {
        findRoom("", today(), entry.time);
      }} className={"text-link"}>
              {" Забронировать ↗ "}
            </button>
          </div> : entry.kind === "booking" ? <button onClick={event => {
      openRecord(entry);
    }} data-event-type={eventType(entry)} className={classNames("record", {
      overlap: overlapsBooking(entry)
    })}>
            <em>{entry.time}</em>
            <span>
              <b>{entry.name}</b>
              <small>
                <EventType type="Бронь" />
                {" · Одобрена до "}
                {entry.end}
              </small>
            </span>
          </button> : <button onClick={event => {
      showEvent(entry);
    }} data-event-type={eventType(entry)} className={classNames("record", {
      overlap: overlapsBooking(entry)
    })}>
            <em>{entry.time}</em>
            <span>
              <b>{entry.name}</b>
              <small>
                {role.value === "teacher" ? <b className={"inline-group"}>
                    {entry.group}
                    {" · "}
                  </b> : null}
                <EventType type={eventType(entry)} />
                {" · "}
                {entry.room}
              </small>
              {overlapsBooking(entry) ? <span className={"agenda-overlap"}>
                  {"Совпадает по времени"}
                </span> : null}
            </span>
          </button>}
      </Fragment>;
}
