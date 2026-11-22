import { CalendarDays, Check, Clock3, MessageCircle, Minus, X } from "lucide-react";
import DocumentIcon from "./DocumentIcon.jsx";
import { statuses } from "../../shared/domain/campus-data.js";
const statusIcons = {
  approved: Check,
  pending: Clock3,
  clarification: MessageCircle,
  rejected: X,
  cancelled: Minus
};
export default function RequestSummary({
  record
}) {
  const StatusIcon = statusIcons[record.status] || Clock3;
  const booking = record.kind === "booking";
  const details = booking ? new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow"
  }).format(new Date(record.date + "T12:00:00+03:00")) + " · " + record.time + "–" + record.end : record.format;
  return <div className={"result-card " + record.status}>
    <div className="request-summary-top"><span className="request-summary-icon">{booking ? <CalendarDays size={26} strokeWidth={1.8} /> : <DocumentIcon name={record.name} />}</span><span className="request-detail-status"><StatusIcon size={14} strokeWidth={1.7} />{statuses[record.status]}</span></div>
    <span className="request-summary-kind">{booking ? "Бронирование" : "Документ"}</span>
    <h3>{record.name}</h3><p className="request-summary-format">{details}</p>
    {record.created && <div className="request-submitted">Подано <time>{new Intl.DateTimeFormat("ru", {
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Moscow"
        }).format(record.created)}</time></div>}
    <div className="request-submitted">Номер заявки <span title={record.id}>{record.id.slice(0, 8).toUpperCase()}</span></div>
  </div>;
}
