const encoder = new TextEncoder();
function fold(line) {
  let result = "",
    bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += ch;
    bytes += size;
  }
  return result;
}
const escapeText = (s) =>
  String(s)
    .replaceAll("\\", "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
const utcStamp = (date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const moscow = (day, time) =>
  utcStamp(new Date(day + "T" + time + ":00+03:00"));
export function calendarFile(events, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atlas//Campus Calendar//RU",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Моё расписание",
  ];
  for (const e of events) {
    const description = [e.type, e.teacher, e.group]
      .filter(Boolean)
      .join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + escapeText(e.id) + "@calendar.campus.example",
      "DTSTAMP:" + utcStamp(now),
      "DTSTART:" + moscow(e.date, e.time),
      "DTEND:" + moscow(e.date, e.end),
      "SUMMARY:" + escapeText(e.name),
      "LOCATION:" +
        escapeText([e.building?.name, e.room].filter(Boolean).join(" · ")),
      "DESCRIPTION:" + escapeText(description),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

import { monthOf, weekOf, offset } from "../../shared/domain/timetable.js";
import { personalClasses } from "../../shared/domain/campus-data.js";
export function exportRows({
  date,
  period,
  start,
  end,
  role,
  owner,
  bookings,
  classesOnDate = (d) => personalClasses(d, role, owner),
  lessons,
  rooms,
}) {
  let days;
  if (period === "Семестр" || period === "Свой период") {
    const first = period === "Семестр" ? "2026-09-01" : start;
    const last = period === "Семестр" ? "2026-12-28" : end;
    if (!first || !last || first > last) return [];
    days = [];
    for (
      let d = first < "2026-09-01" ? "2026-09-01" : first;
      d <= last && d <= "2026-12-28";
      d = offset(d, 1)
    )
      days.push(d);
  } else
    days =
      period === "День"
        ? [date]
        : period === "Неделя"
          ? weekOf(date)
          : monthOf(date).filter((d) => d.slice(0, 7) === date.slice(0, 7));
  return days.flatMap((d) =>
    [
      ...(lessons ? classesOnDate(d).filter(event => !event.cancelled) : []),
      ...(rooms
        ? bookings
            .filter(
              (b) =>
                b.date === d && b.owner === owner && b.status === "approved",
            )
            .map((b) => ({ ...b, type: "Бронь", room: b.short }))
        : []),
    ].sort((a, b) => a.time.localeCompare(b.time)),
  );
}
export function csvFile(events) {
  function quote(v) {
    const s = String(v ?? "");
    return (
      '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'
    );
  }
  return (
    "\uFEFF" +
    [
      [
        "Дата",
        "Начало (МСК)",
        "Конец (МСК)",
        "Название",
        "Тип",
        "Корпус",
        "Аудитория",
        "Преподаватель",
        "Группа",
      ],
      ...events.map((e) => [
        e.date,
        e.time,
        e.end,
        e.name,
        e.type,
        e.building?.name,
        e.room,
        e.teacher,
        e.group,
      ]),
    ]
      .map((row) => row.map(quote).join(";"))
      .join("\r\n") +
    "\r\n"
  );
}
