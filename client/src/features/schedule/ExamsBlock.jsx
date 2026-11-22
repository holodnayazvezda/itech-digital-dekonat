import { printDate } from "../../shared/domain/timetable.js";
import { EventType } from "./EventType.jsx";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from '../../shared/state/CabinetContext.jsx';
export default function ExamsBlock() {
  useSignals();
  const {
    exam,
    role,
    showEvent
  } = useCabinet();
  if (!exam.value || role.value !== "student") return null;
  return <Fragment>
        <h2>{"Экзамен"}</h2>
        <button onClick={event => {
      showEvent(exam.value);
    }} data-event-type="Экзамен" className={"record"}>
          <em>
            {printDate(exam.value.date, {
          day: "numeric",
          month: "short"
        })}
          </em>
          <span>
            <b>{exam.value.name}</b>
            <small>
              <EventType type="Экзамен" />
              {" · "}
              {exam.value.room}
            </small>
          </span>
        </button>
      </Fragment>;
}
