<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";
import {
  monthOf,
  monthStep,
  offset,
  overlaps,
  printDate,
  today,
  weekOf,
} from "./timetable.js";
import { calendarFile } from "./calendar-export.js";
import { personalClasses } from "./campus-data.js";
const props = defineProps({ bookings: Array, role: String, owner: String });
const emit = defineEmits(["lesson", "booking", "spaces"]);
const mode = ref("Неделя"),
  anchor = ref(today);
const narrow = window.matchMedia("(max-width:680px)");
const compact = ref(narrow.matches);
function updateLayout() {
  compact.value = narrow.matches;
  if (compact.value) mode.value = "Неделя";
}
onMounted(() => narrow.addEventListener("change", updateLayout));
onUnmounted(() => narrow.removeEventListener("change", updateLayout));
const modes = computed(() =>
  compact.value ? ["Неделя"] : ["День", "Неделя", "Месяц"],
);
const bands = [
  ["Утро", "09:00", "12:00"],
  ["День", "12:00", "16:00"],
  ["Вечер", "16:00", "19:00"],
  ["Поздно", "19:00", "22:00"],
];
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const days = computed(() =>
  mode.value === "Месяц"
    ? monthOf(anchor.value)
    : mode.value === "Неделя"
      ? weekOf(anchor.value)
      : [anchor.value],
);
const groups = computed(() =>
  Object.fromEntries(
    days.value.map((d) => {
      const list = personalClasses(d, props.role, props.owner);
      list.push(
        ...props.bookings
          .filter((b) => b.date === d)
          .map((b) => ({ ...b, type: "Бронь", room: b.short })),
      );
      return [d, list.sort((a, b) => a.time.localeCompare(b.time))];
    }),
  ),
);
const exportEvents = computed(() =>
  days.value
    .filter(
      (d) =>
        mode.value !== "Месяц" || d.slice(0, 7) === anchor.value.slice(0, 7),
    )
    .flatMap((d) => groups.value[d]),
);
function exportCalendar() {
  const url = URL.createObjectURL(
    new Blob([calendarFile(exportEvents.value)], {
      type: "text/calendar;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "Расписание-" + mode.value + "-" + anchor.value + ".ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const title = computed(() => {
  const d = anchor.value;
  if (mode.value === "День")
    return printDate(d, { weekday: "long", day: "numeric", month: "long" });
  if (mode.value === "Месяц")
    return printDate(d, { month: "long", year: "numeric" }).replace(" г.", "");
  const [first, , , , , , last] = days.value;
  return (
    printDate(
      first,
      first.slice(0, 7) === last.slice(0, 7)
        ? { day: "numeric" }
        : { day: "numeric", month: "short" },
    ) +
    " — " +
    printDate(last, { day: "numeric", month: "long" })
  );
});
function go(n) {
  anchor.value =
    mode.value === "Месяц"
      ? monthStep(anchor.value, n)
      : offset(anchor.value, n * (mode.value === "Неделя" ? 7 : 1));
}
function conflict(e) {
  return groups.value[e.date].some(
    (other) => other.id !== e.id && overlaps(other, e),
  );
}
function activate(e) {
  if (e.kind === "booking") emit("booking", e);
  else emit("lesson", e);
}
function bandEvents(d, band) {
  return groups.value[d].filter((e) => e.time >= band[1] && e.time < band[2]);
}
function dayView(d) {
  anchor.value = d;
  mode.value = "День";
}
</script>
<template>
  <section class="planner">
    <div class="planner-toolbar">
      <div class="calendar-modes" aria-label="Вид расписания">
        <button
          v-for="m in modes"
          :key="m"
          :aria-pressed="mode === m"
          @click="mode = m"
        >
          {{ m }}
        </button>
      </div>
      <div class="period-nav">
        <button aria-label="Предыдущий период" @click="go(-1)">‹</button
        ><button @click="anchor = today">Сегодня</button
        ><button aria-label="Следующий период" @click="go(1)">›</button>
      </div>
    </div>
    <h2 class="period-title">{{ title }}</h2>
    <template v-if="mode === 'Неделя'">
      <div class="week-board">
        <div class="week-axis-head">Время</div>
        <button
          v-for="(d, i) in days"
          :key="d"
          class="week-head"
          :class="{ current: d === today }"
          @click="dayView(d)"
        >
          {{ weekdays[i] }} <b>{{ Number(d.slice(-2)) }}</b>
        </button>
        <template v-for="band in bands" :key="band[0]"
          ><div class="week-axis">
            <b>{{ band[0] }}</b
            ><small>{{ band[1] }}<br />{{ band[2] }}</small>
          </div>
          <div
            v-for="d in days"
            :key="d"
            class="week-cell"
            :class="{ current: d === today }"
          >
            <button
              v-for="e in bandEvents(d, band)"
              :key="e.id"
              class="class-tile"
              :data-kind="e.type"
              :class="{ overlap: conflict(e) }"
              @click="activate(e)"
            >
              <time>{{ e.time }}–{{ e.end }}</time
              ><strong>{{ e.name }}</strong
              ><span
                v-if="e.teacher"
                :title="role === 'teacher' ? e.group : e.teacher"
                >{{ role === "teacher" ? e.group : e.teacher }}</span
              ><small>{{ e.building.short }} · {{ e.room }}</small>
              <i v-if="conflict(e)">Совпадает по времени</i>
            </button>
          </div>
        </template>
      </div>
      <div class="week-list">
        <article v-for="d in days" :key="d">
          <h3>
            {{
              printDate(d, { weekday: "short", day: "numeric", month: "short" })
            }}
          </h3>
          <button
            v-for="e in groups[d]"
            :key="e.id"
            class="agenda-tile"
            :class="{ overlap: conflict(e) }"
            @click="activate(e)"
          >
            <time
              >{{ e.time }}<small>{{ e.end }}</small></time
            ><span
              ><b>{{ e.name }}</b
              ><small>{{
                [
                  role === "teacher" ? e.group : e.teacher,
                  e.building.short,
                  e.room,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }}</small
              ><i v-if="conflict(e)">Совпадает по времени</i></span
            ></button
          ><small v-if="!groups[d].length">Занятий нет</small>
        </article>
      </div>
    </template>
    <div v-else-if="mode === 'Месяц'" class="month-board">
      <b v-for="w in weekdays" :key="w" class="month-head">{{ w }}</b>
      <article
        v-for="d in days"
        :key="d"
        class="month-cell"
        :class="{
          outside: d.slice(0, 7) !== anchor.slice(0, 7),
          current: d === today,
        }"
      >
        <button
          class="month-date"
          :aria-current="d === today ? 'date' : undefined"
          :aria-label="printDate(d, { day: 'numeric', month: 'long' })"
          @click="dayView(d)"
        >
          {{ Number(d.slice(-2))
          }}<span>{{ printDate(d, { weekday: "short" }) }}</span>
        </button>
        <button
          v-for="e in groups[d]"
          :key="e.id"
          class="month-event"
          :class="{ overlap: conflict(e) }"
          :aria-label="
            e.time +
            ' ' +
            e.name +
            (conflict(e) ? ' · Совпадает по времени' : '')
          "
          @click="activate(e)"
        >
          <time>{{ e.time }}</time> {{ e.name }}
        </button>
      </article>
    </div>
    <div v-else class="day-list">
      <button
        v-for="e in groups[anchor]"
        :key="e.id"
        class="agenda-tile"
        :class="{ overlap: conflict(e) }"
        @click="activate(e)"
      >
        <time
          >{{ e.time }}<small>{{ e.end }}</small></time
        ><span
          ><b>{{ e.name }}</b
          ><small>{{
            [role === "teacher" ? e.group : e.teacher, e.building.name, e.room]
              .filter(Boolean)
              .join(" · ")
          }}</small
          ><i v-if="conflict(e)">Совпадает по времени</i></span
        ><em>{{ e.type }}</em>
      </button>
      <p v-if="!groups[anchor].length">Занятий на этот день нет.</p>
    </div>
    <button
      v-if="['teacher', 'student'].includes(role)"
      class="text-link room-search-link"
      @click="emit('spaces', anchor)"
    >
      Найти помещение ↗
    </button>
    <button
      class="text-link calendar-export"
      :disabled="!exportEvents.length"
      @click="exportCalendar"
    >
      Скачать календарь (.ics)
    </button>
  </section>
</template>
