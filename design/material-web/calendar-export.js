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
