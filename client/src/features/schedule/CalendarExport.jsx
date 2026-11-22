import { useEffect, useRef, useState } from "react";
import { Download, CalendarDays, Table2, X } from "lucide-react";
import AccountSelect from "../../shared/ui/AccountSelect.jsx";
import { exportRows, csvFile, calendarFile } from "./calendar-export.js";
export default function CalendarExport({
  date,
  mode,
  role,
  owner,
  bookings,
  schedule
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const [availableHeight, setAvailableHeight] = useState(500);
  function measureHeight() {
    const navigation = root.current.closest(".shell")?.querySelector(".phone-navigation");
    const bottom = navigation ? navigation.getBoundingClientRect().top : window.innerHeight;
    setAvailableHeight(Math.max(100, bottom - trigger.current.getBoundingClientRect().bottom - 24));
  }
  function dismiss() {
    setOpen(false);
    trigger.current?.focus({
      preventScroll: true
    });
  }
  useEffect(() => {
    if (!open) return;
    const outside = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key === "Escape") {
        event.stopPropagation();
        dismiss();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", measureHeight);
    window.addEventListener("scroll", measureHeight, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", measureHeight);
      window.removeEventListener("scroll", measureHeight, true);
    };
  }, [open]);
  const [period, setPeriod] = useState(mode);
  const [start, setStart] = useState(date),
    [end, setEnd] = useState(date);
  const [format, setFormat] = useState("ics");
  const [lessons, setLessons] = useState(true);
  const [rooms, setRooms] = useState(true);
  const events = open ? exportRows({
    date,
    period,
    start,
    end,
    role,
    owner,
    bookings,
    classesOnDate: d => schedule?.[d] || [],
    lessons,
    rooms
  }) : [];
  function download() {
    const csv = format === "csv";
    const url = URL.createObjectURL(new Blob([csv ? csvFile(events) : calendarFile(events)], {
      type: csv ? "text/csv;charset=utf-8" : "text/calendar;charset=utf-8"
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Расписание-" + period + "-" + (period === "Свой период" ? start + "_" + end : date) + "." + format;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    dismiss();
  }
  return <div className="calendar-export-anchor" ref={root}>
      <button ref={trigger} className="calendar-download" aria-label="Скачать расписание" title="Скачать расписание" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? "calendar-export-panel" : undefined} onClick={() => {
      if (open) {
        setOpen(false);
        return;
      }
      setPeriod(mode);
      setStart(date);
      setEnd(date);
      measureHeight();
      setOpen(true);
    }}>
        <Download size={21} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && <section id="calendar-export-panel" role="dialog" aria-label="Скачать расписание" className="export-popover" style={{
      maxHeight: availableHeight
    }}>
          <div className="export-popover-heading">
            <h3>Скачать расписание</h3>
            <button className="export-close" aria-label="Закрыть" onClick={dismiss}>
              <X size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <AccountSelect label="Период" value={period} onChange={setPeriod} options={["День", "Неделя", "Месяц", "Семестр", "Свой период"].map(value => ({
        value,
        label: value
      }))} />
          {period === "Свой период" && <div className="export-dates">
              <label className="export-field">
                С
                <input type="date" value={start} onChange={e => setStart(e.target.value)} />
              </label>
              <label className="export-field">
                По
                <input type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} />
              </label>
            </div>}
          <fieldset>
            <legend>Формат файла</legend>
            <div className="export-formats">
              {[{
            value: "ics",
            icon: CalendarDays,
            title: "Календарь",
            hint: ".ics"
          }, {
            value: "csv",
            icon: Table2,
            title: "Таблица",
            hint: ".csv"
          }].map(({
            value,
            icon: FormatIcon,
            title,
            hint
          }) => <button key={value} className="export-format" aria-pressed={format === value} onClick={() => setFormat(value)}>
                  <FormatIcon size={18} aria-hidden="true" />
                  <b>{title}</b><small>{hint}</small>
                </button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Включить в файл</legend>
            <label>
              <input type="checkbox" checked={lessons} onChange={e => setLessons(e.target.checked)} />{" "}
              Занятия
            </label>
            <label>
              <input type="checkbox" checked={rooms} onChange={e => setRooms(e.target.checked)} />{" "}
              Подтверждённые брони
            </label>
          </fieldset>
          <small className="export-summary" aria-live="polite">
            {events.length ? "Событий в файле — " + events.length : "В выбранном периоде нет подходящих событий"}
          </small>
          <button className="export-submit" disabled={!events.length} onClick={download}>
            <Download size={18} aria-hidden="true" /> Скачать файл
          </button>
        </section>}
    </div>;
}
