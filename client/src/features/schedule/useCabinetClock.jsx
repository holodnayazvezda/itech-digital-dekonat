import { advanceServerClock, serverMinute } from "../../shared/domain/server-clock.js";
import { today } from "../../shared/domain/timetable.js";
import { computed, useSignal } from "@preact/signals-react";
import { useRef } from "react";
import { useWatch, useMount, useCleanup } from "../../shared/ui/ui.jsx";
export default function useCabinetClock({
  calendarDate,
  roomDate,
  toMinutes
}) {
  const demoMinute = useSignal(serverMinute());
  const demoClock = useRef(null);
  const previousDay = useRef(today());
  useWatch(today, day => {
    if (calendarDate.value === previousDay.current) calendarDate.value = day;
    if (roomDate.value === previousDay.current) roomDate.value = day;
    previousDay.current = day;
    demoClock.current = null;
    updateClock();
  });
  let clockTimer;
  function updateClock() {
    advanceServerClock();
    demoMinute.value = demoClock.current ? Math.min(1439, demoClock.current.minute + Math.floor((performance.now() - demoClock.current.at) / 60000)) : serverMinute();
  }
  function setDemoTime(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
    demoClock.current = {
      minute: toMinutes(value),
      at: performance.now()
    };
    updateClock();
  }
  useMount(() => {
    clockTimer = window.setInterval(updateClock, 1000);
  });
  useCleanup(() => window.clearInterval(clockTimer));
  const demoTime = computed(() => [Math.floor(demoMinute.value / 60), demoMinute.value % 60].map(part => String(part).padStart(2, "0")).join(":"));
  return {
    demoMinute,
    demoTime,
    setDemoTime
  };
}
