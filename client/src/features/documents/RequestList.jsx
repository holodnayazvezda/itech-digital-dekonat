import { statuses } from "../../shared/domain/campus-data.js";
import { useSignals } from "@preact/signals-react/runtime";
import { FileText, CalendarDays, ChevronRight } from "lucide-react";
import { classNames } from "../../shared/ui/ui.jsx";
export default function RequestList(props) {
  useSignals();
  return <div className="requests-list">
      {!props.records.length ? <p>{"Здесь появятся ваши заявки и решения деканата."}</p> : null}
      {props.records.map(r => <button key={r.id} aria-haspopup="dialog" onClick={event => {
      event.currentTarget.focus({
        preventScroll: true
      });
      props.onSelect?.(r);
    }} className={"case-row request-list-row"}>
          <span className="request-row-icon">{r.kind === "booking" ? <CalendarDays size={20} strokeWidth={1.7} /> : <FileText size={20} strokeWidth={1.7} />}</span>
          <span className="request-row-copy">
            <b>{r.name}</b>
            <small>
              {r.kind === "booking" ? r.date + " · " + r.time + "–" + r.end : r.format}
            </small>
          </span>
          <i className={classNames("badge " + r.status)}>
            {statuses[r.status]}
          </i>
          <ChevronRight className="request-row-arrow" size={14} strokeWidth={1.6} />
        </button>)}
    </div>;
}
