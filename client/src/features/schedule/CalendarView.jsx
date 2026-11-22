import { ChevronLeft, ChevronRight } from "lucide-react";
import { offset, printDate, today, weekOf } from "../../shared/domain/timetable.js";
import TimetableWeek, { TimetableAgenda } from "./TimetableWeek.jsx";
import CalendarExport from "./CalendarExport.jsx";
import { computed, useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { useLayoutEffect, useRef } from "react";
const lessonPlural = new Intl.PluralRules("ru");
const lessonCountLabel = count => `${count} ${{
  one: "занятие",
  few: "занятия",
  many: "занятий",
  other: "занятия"
}[lessonPlural.select(count)]}`;
export default function CalendarView(props) {
  useSignals();
  const container = useRef(null),
    dayStrip = useRef(null),
    dayIndicator = useRef(null);
  const scrollPositions = useRef({}),
    pendingScroll = useRef(null);
  const scrollSpace = useSignal(0);
  const availableWidth = useSignal(0),
    preferredMode = useSignal("Неделя"),
    anchor = useSignal(props.initialDate || today());
  useLayoutEffect(() => {
    anchor.value = props.initialDate || today();
  }, [props.initialDate]);
  const canShowWeek = computed(() => availableWidth.value >= 1120);
  const mode = computed(() => canShowWeek.value ? preferredMode.value : "День");
  function switchMode(next) {
    if (next === mode.value) return;
    const current = {
      top: window.scrollY,
      left: window.scrollX
    };
    scrollPositions.current[mode.value] = current;
    const target = scrollPositions.current[next] || current;
    const calendarTop = container.current.getBoundingClientRect().top + window.scrollY;
    // A shorter day must not clamp the page's scroll offset before restoration.
    scrollSpace.value = Math.max(0, target.top + window.innerHeight - calendarTop + 1);
    pendingScroll.current = target;
    direction.value = 0;
    preferredMode.value = next;
  }
  useLayoutEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    pendingScroll.current = null;
    const restore = () => window.scrollTo({
      ...target,
      behavior: 'instant'
    });
    restore();
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [mode.value]);
  useLayoutEffect(() => {
    const measure = () => {
      availableWidth.value = container.current.getBoundingClientRect().width;
    };
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    let cancelled = false;
    function alignSelectedDay() {
      const strip = dayStrip.current,
        active = strip?.querySelector('[aria-pressed="true"]');
      if (!cancelled && active) {
        strip.scrollLeft += active.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - active.offsetWidth) / 2;
        if (dayIndicator.current) Object.assign(dayIndicator.current.style, {
          width: active.offsetWidth + 'px',
          height: active.offsetHeight + 'px',
          transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)`,
          opacity: '1'
        });
      }
    }
    alignSelectedDay();
    document.fonts.ready.then(alignSelectedDay);
    return () => {
      cancelled = true;
    };
  }, [anchor.value, mode.value, availableWidth.value]);
  const modes = ["День", "Неделя"];
  const dayOptions = computed(() => weekOf(anchor.value));
  const days = computed(() => {
    if (mode.value === "День") return [anchor.value];
    const week = weekOf(anchor.value);
    const sunday = week.at(-1);
    return props.schedule?.[sunday]?.length || props.bookings.some(booking => booking.date === sunday) ? week : week.slice(0, 6);
  });
  const groups = computed(() => Object.fromEntries(days.value.map(d => {
    const list = [...(props.schedule?.[d] || [])];
    list.push(...props.bookings.filter(b => b.date === d).map(b => ({
      ...b,
      type: "Бронь",
      room: b.short
    })));
    return [d, list.sort((a, b) => a.time.localeCompare(b.time))];
  })));
  const title = computed(() => {
    const d = anchor.value;
    if (mode.value === "День") return printDate(d, {
      weekday: "long"
    });
    const first = days.value[0];
    const last = days.value.at(-1);
    return printDate(first, first.slice(0, 7) === last.slice(0, 7) ? {
      day: "numeric"
    } : {
      day: "numeric",
      month: "short"
    }) + " — " + printDate(last, {
      day: "numeric",
      month: "long"
    });
  });
  const direction = useSignal(0);
  function selectDate(date) {
    anchor.value = date;
    props.onDateChange?.(date);
  }
  function go(n) {
    direction.value = n;
    selectDate(offset(anchor.value, n * 7));
  }
  function activate(e) {
    if (e.kind === "booking") props.onBooking?.(e);else props.onLesson?.(e);
  }
  function dayView(d) {
    direction.value = 0;
    selectDate(d);
    switchMode("День");
  }
  return <div className="calendar-responsive" ref={container} data-week-available={canShowWeek.value} style={{
    minHeight: scrollSpace.value || undefined
  }}>
      <section className={"planner" + (mode.value === "День" ? " calendar-day-mode" : " calendar-week-mode")}>
        <div className={"planner-toolbar"}>
          <div className="calendar-toolbar-left" key={mode.value}>
          <div className="calendar-date-nav">
            <button aria-label="Предыдущая неделя" onClick={() => go(-1)}>
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
            <div className="calendar-date-copy">
              {mode.value === "День" ? <h1 className="calendar-date-meta" aria-live="polite">{printDate(anchor.value, {
                  day: "numeric",
                  month: "long"
                })} · {lessonCountLabel(groups.value[anchor.value].filter(event => event.kind !== "booking" && !event.cancelled).length)}</h1> : <h2 className="period-title" aria-live="polite">{title.value}</h2>}
            </div>
            <button aria-label="Следующая неделя" onClick={() => go(1)}>
              <ChevronRight size={20} strokeWidth={2} />
            </button>
          </div>
          {mode.value === "День" && <div className="day-picker" ref={dayStrip} aria-label="Выбрать день">
            <span className="day-selection" ref={dayIndicator} aria-hidden="true" />
            {dayOptions.value.map(d => <button key={d} aria-pressed={d === anchor.value} aria-current={d === today() ? "date" : undefined} onClick={() => selectDate(d)}><span>{d === today() ? "Сегодня" : `${printDate(d, {
                  weekday: "short"
                })} ${Number(d.slice(-2))}`}</span></button>)}
          </div>}
          </div>
          <div className="calendar-toolbar-actions">
          {canShowWeek.value && <div aria-label="Вид расписания" className={"calendar-modes"}>
            {modes.map(m => <button key={m} aria-pressed={mode.value === m} onClick={event => {
              switchMode(m);
            }}>
                {m}
              </button>)}
          </div>}
        <CalendarExport schedule={props.schedule} date={anchor.value} mode={mode.value} role={props.role} owner={props.owner} bookings={props.bookings} />
          </div>
        </div>
        <div className="calendar-period" key={mode.value + days.value[0]} data-direction={direction.value}>
          {mode.value === "Неделя" ? <TimetableWeek days={days.value} groups={groups.value} onDay={dayView} onEvent={activate} role={props.role} minute={props.demoMinute} /> : <TimetableAgenda events={groups.value[anchor.value]} onEvent={activate} role={props.role} minute={anchor.value === today() ? props.demoMinute : null} />}
        </div>

      </section>
    </div>;
}
