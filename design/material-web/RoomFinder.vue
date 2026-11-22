<script setup>
import { computed, ref, onBeforeUnmount, watch } from "vue";
import {
  rooms,
  gym,
  gymSeatsLeft,
  roomFund,
  roomActivities,
  personalClasses,
  numberTime,
  timeText,
} from "./campus-data.js";
import BookingMenu from "./BookingMenu.vue";
import { today, overlaps, buildings } from "./timetable.js";

const props = defineProps({
  initial: Object,
  reservations: Array,
  role: String,
  owner: String,
  busy: Boolean,
});
const emit = defineEmits(["send"]);
const first = rooms.find((r) => r.short === props.initial?.short);
const building = ref(first?.building.name || ""),
  fund = ref(first ? roomFund(first) : ""),
  short = ref(first?.short || ""),
  date = ref(props.initial?.date || today);
const campusNames = Object.values(buildings).map((campus) => campus.name);
const funds = computed(() =>
  building.value === gym.building.name
    ? ["Коворкинги", "Аудиторный фонд", "Спортзал"]
    : ["Коворкинги", "Аудиторный фонд"],
);
let suggestedStart = props.initial?.start;
const items = computed(() =>
  rooms.filter(
    (r) => r.building.name === building.value && roomFund(r) === fund.value,
  ),
);
const cells = Array.from({ length: 26 }, (_, i) => 540 + i * 30);
const hours = cells.filter((t) => t % 60 === 0);
const selection = ref(null),
  detail = ref(null),
  scrollBox = ref(null);
const availableDate = computed(
  () => date.value >= today && date.value <= "2026-12-28",
);
const events = computed(() =>
  !availableDate.value
    ? []
    : [
        ...roomActivities(date.value),
        ...props.reservations
          .filter((r) => r.date === date.value)
          .map((r) => ({
            ...r,
            room: r.short,
            name: "Бронь помещения",
            teacher: r.by,
          })),
      ],
);
const agenda = (room) => events.value.filter((e) => e.room === room);
function seats(t, end = t + 30) {
  return gymSeatsLeft(date.value, t, end, props.reservations);
}
function busyAt(room, t) {
  if (room === gym.short)
    return seats(t) === 0
      ? {
          time: timeText(t),
          end: timeText(t + 30),
          name: "Свободных мест нет",
          teacher: gym.name,
        }
      : null;

  return agenda(room).find(
    (e) => numberTime(e.time) < t + 30 && numberTime(e.end) > t,
  );
}
function chooseBuilding(value) {
  if (value === building.value) return;
  if (building.value) suggestedStart = null;
  building.value = value;
  fund.value = "";
  short.value = "";
  reset();
}
function chooseFund(value) {
  if (value === fund.value) return;
  fund.value = value;
  short.value = items.value[0]?.short || "";
  reset();
  if (short.value && suggestedStart) {
    const t = Math.ceil(numberTime(suggestedStart) / 30) * 30;
    suggestedStart = null;
    if (cells.includes(t) && !busyAt(short.value, t)) choose(short.value, t);
  }
}
function reset() {
  stop();
  selection.value = null;
  detail.value = null;
}
watch(date, reset);
const info = (e) => e.time + "–" + e.end + " · " + e.name + " · " + e.teacher;
function choose(room, t) {
  if (!availableDate.value) return;
  const occupied = busyAt(room, t);
  if (occupied) {
    detail.value = occupied;
    return;
  }
  detail.value = null;
  short.value = room;
  selection.value = { room, start: t, end: t + 30 };
}
const request = computed(() => {
  const s = selection.value;
  return (
    s && {
      kind: "booking",
      short: s.room,
      date: date.value,
      time: timeText(s.start),
      end: timeText(s.end),
    }
  );
});
const collision = computed(
  () =>
    request.value &&
    (request.value.short === gym.short
      ? seats(selection.value.start, selection.value.end) === 0
      : agenda(request.value.short).some((e) => overlaps(e, request.value))),
);
const personal = computed(
  () =>
    request.value &&
    personalClasses(date.value, props.role, props.owner).find((e) =>
      overlaps(e, request.value),
    ),
);
function bounds(room, t) {
  let lo = t,
    hi = t + 30;
  while (lo > 540 && !busyAt(room, lo - 30)) lo -= 30;
  while (hi < 1320 && !busyAt(room, hi)) hi += 30;
  return [lo, hi];
}
const endpoints = computed(() => {
  const s = selection.value;
  if (!s) return { start: [], end: [] };
  const [lo, hi] = bounds(s.room, s.start);
  return {
    start: cells.filter((t) => t >= lo && t >= s.end - 240 && t < s.end),
    end: cells
      .map((t) => t + 30)
      .filter((t) => t > s.start && t <= s.start + 240 && t <= hi),
  };
});
let drag = null,
  scrollFrame = 0;
function stop() {
  if (drag?.target.hasPointerCapture(drag.id))
    drag.target.releasePointerCapture(drag.id);
  drag = null;
  cancelAnimationFrame(scrollFrame);
}
onBeforeUnmount(stop);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function updateDrag() {
  if (!drag) return;
  const { track, vertical, edge, anchor, room, point } = drag,
    box = track.getBoundingClientRect();
  const pos = vertical
    ? (point - box.top) / box.height
    : (point - box.left) / box.width;
  const [lo, hi] = bounds(room, anchor);
  if (edge === "end")
    selection.value.end = clamp(
      540 + Math.round(pos * 26) * 30,
      anchor + 30,
      Math.min(hi, anchor + 240),
    );
  else if (edge === "start")
    selection.value.start = clamp(
      540 + Math.round(pos * 26) * 30,
      Math.max(lo, anchor + 30 - 240),
      anchor,
    );
  else {
    const t = clamp(
      540 + Math.floor(pos * 26) * 30,
      Math.max(lo, anchor - 210),
      Math.min(hi - 30, anchor + 210),
    );
    selection.value = {
      room,
      start: Math.min(t, anchor),
      end: Math.max(t, anchor) + 30,
    };
  }
}
function autoScroll() {
  if (!drag?.vertical) return;
  const box = scrollBox.value.getBoundingClientRect(),
    d = drag.point < box.top + 28 ? -6 : drag.point > box.bottom - 28 ? 6 : 0;
  if (d) {
    scrollBox.value.scrollTop += d;
    updateDrag();
  }
  scrollFrame = requestAnimationFrame(autoScroll);
}
function begin(e, room, edge) {
  if (e.button !== 0 || !availableDate.value) return;
  const target = e.currentTarget,
    track = target.closest(".slot-track"),
    vertical = track.classList.contains("vertical");
  if (vertical && !edge && e.pointerType === "touch") return;
  let anchor;
  if (edge) {
    anchor =
      edge === "start" ? selection.value.end - 30 : selection.value.start;
  } else {
    const box = track.getBoundingClientRect(),
      f = vertical
        ? (e.clientY - box.top) / box.height
        : (e.clientX - box.left) / box.width;
    anchor = 540 + clamp(Math.floor(f * 26), 0, 25) * 30;
    if (busyAt(room, anchor)) return;
    choose(room, anchor);
  }
  stop();
  target.setPointerCapture(e.pointerId);
  drag = {
    track,
    target,
    id: e.pointerId,
    room,
    vertical,
    edge,
    anchor,
    point: vertical ? e.clientY : e.clientX,
  };
  if (vertical) autoScroll();
  e.preventDefault();
}
function move(e) {
  if (drag?.id !== e.pointerId) return;
  drag.point = drag.vertical ? e.clientY : e.clientX;
  updateDrag();
}
function keyOrTap(e, room, t) {
  if (e.detail === 0 || e.pointerType === "touch" || busyAt(room, t))
    choose(room, t);
}
const cssRange = (a, b) => ({
  "--start": ((a - 540) / 780) * 100 + "%",
  "--length": ((b - a) / 780) * 100 + "%",
});
const roomTitle = (id) => rooms.find((r) => r.short === id)?.name;
</script>
<template>
  <section class="booking-flow">
    <div v-if="!building" class="building-pick">
      <h3>Выберите корпус</h3>
      <button
        v-for="b in buildings"
        :key="b.name"
        @click="chooseBuilding(b.name)"
      >
        <img :src="'./' + b.image" alt="" /><span>{{ b.name }} <i>↗</i></span>
      </button>
    </div>
    <template v-else
      ><div class="booking-crumb">
        <BookingMenu
          label="Корпус"
          :value="building"
          :options="campusNames"
          @choose="chooseBuilding"
        />
        <BookingMenu
          v-if="fund"
          label="Тип помещения"
          :value="fund"
          :options="funds"
          @choose="chooseFund"
        />
      </div>
      <div v-if="!fund" class="fund-list">
        <h3>Что хотите забронировать?</h3>
        <button v-for="f in funds" :key="f" @click="chooseFund(f)">
          <b>{{ f }}</b
          ><small>{{
            f === "Коворкинги"
              ? "Переговорные, проектные залы и студии"
              : f === "Спортзал"
                ? "Одно место для самостоятельной тренировки"
                : "Учебные аудитории корпуса"
          }}</small
          ><i>↗</i>
        </button>
      </div>
      <template v-else
        ><div class="booking-filters">
          <label class="field"
            >Дата<input
              type="date"
              :min="today"
              max="2026-12-28"
              v-model="date" /></label
          ><label v-if="fund !== 'Спортзал'" class="field mobile-room"
            >Помещение<select
              aria-label="Помещение"
              :value="short"
              @change="
                reset();
                short = $event.target.value;
              "
            >
              <option v-for="r in items" :value="r.short">{{ r.name }}</option>
            </select></label
          >
          <div v-if="fund !== 'Спортзал'" class="booking-key">
            <span>Свободно</span><span>Занято</span><span>Выбрано</span>
          </div>
        </div>
        <p v-if="!availableDate">Выберите дату с 20 ноября по 28 декабря.</p>
        <template v-else>
          <section v-if="fund === 'Спортзал'" class="gym-slots">
            <h3>{{ gym.name }}</h3>
            <p>
              Выберите начало тренировки. В каждом интервале указано число
              свободных мест из {{ gym.capacity }}.
            </p>
            <div>
              <button
                v-for="t in cells"
                :key="t"
                :disabled="!seats(t)"
                :aria-pressed="
                  !!selection && t >= selection.start && t < selection.end
                "
                @click="choose(gym.short, t)"
              >
                <b>{{ timeText(t) }}</b
                ><small>{{
                  seats(t) ? "Свободно " + seats(t) : "Мест нет"
                }}</small>
              </button>
            </div>
          </section>
          <div v-else class="matrix-scroll">
            <div class="room-matrix">
              <div class="matrix-head">
                <b>Помещение</b>
                <div>
                  <time v-for="h in hours">{{ timeText(h) }}</time>
                </div>
              </div>
              <div v-for="r in items" :key="r.short" class="matrix-row">
                <div class="matrix-name">
                  <b>{{ r.name }}</b
                  ><small>{{ r.meta }}</small>
                </div>
                <div
                  class="slot-track horizontal"
                  @pointerdown="begin($event, r.short)"
                  @pointermove="move"
                  @pointerup="stop"
                  @pointercancel="stop"
                >
                  <button
                    v-for="t in cells"
                    :key="t"
                    class="slot-cell"
                    :aria-label="
                      r.name +
                      ' ' +
                      timeText(t) +
                      ' ' +
                      (busyAt(r.short, t) ? 'занято' : 'свободно')
                    "
                    @click="keyOrTap($event, r.short, t)"
                  ></button>
                  <button
                    v-for="e in agenda(r.short)"
                    class="busy-block"
                    :style="cssRange(numberTime(e.time), numberTime(e.end))"
                    :title="info(e)"
                    @pointerdown.stop
                    @click="detail = e"
                  >
                    <b>{{ e.name }}</b
                    ><small>{{ e.time }}–{{ e.end }} · {{ e.teacher }}</small>
                  </button>
                  <div
                    v-if="selection?.room === r.short"
                    class="selected-block"
                    :style="cssRange(selection.start, selection.end)"
                  >
                    <span class="slot-range">
                      <time>{{ timeText(selection.start) }}</time
                      ><i aria-hidden="true">–</i
                      ><time>{{ timeText(selection.end) }}</time>
                    </span>
                    <button
                      v-for="edge in ['start', 'end']"
                      tabindex="-1"
                      :aria-label="
                        edge === 'start' ? 'Левая граница' : 'Правая граница'
                      "
                      :class="'handle ' + edge"
                      @pointerdown.stop="begin($event, r.short, edge)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="fund !== 'Спортзал'"
            class="mobile-timeline"
            ref="scrollBox"
          >
            <div class="mobile-day">
              <div class="time-ruler">
                <time v-for="t in cells">{{ timeText(t) }}</time>
              </div>
              <div
                class="slot-track vertical"
                @pointerdown="begin($event, short)"
                @pointermove="move"
                @pointerup="stop"
                @pointercancel="stop"
              >
                <button
                  v-for="t in cells"
                  class="slot-cell"
                  :aria-label="
                    timeText(t) +
                    ' ' +
                    (busyAt(short, t) ? 'занято' : 'свободно')
                  "
                  @click="keyOrTap($event, short, t)"
                >
                  <span
                    v-if="
                      !busyAt(short, t) &&
                      (!selection || t < selection.start || t >= selection.end)
                    "
                    >Свободно</span
                  >
                </button>
                <button
                  v-for="e in agenda(short)"
                  class="busy-block"
                  :style="cssRange(numberTime(e.time), numberTime(e.end))"
                  @pointerdown.stop
                  @click="detail = e"
                >
                  <b>{{ e.name }}</b
                  ><small>{{ e.time }}–{{ e.end }} · {{ e.teacher }}</small>
                </button>
                <div
                  v-if="selection?.room === short"
                  class="selected-block"
                  :style="cssRange(selection.start, selection.end)"
                >
                  <span
                    >{{ timeText(selection.start) }}–{{
                      timeText(selection.end)
                    }}</span
                  ><button
                    v-for="edge in ['start', 'end']"
                    tabindex="-1"
                    :class="'handle ' + edge"
                    :aria-label="
                      edge === 'start' ? 'Верхняя граница' : 'Нижняя граница'
                    "
                    @pointerdown.stop="begin($event, short, edge)"
                  />
                </div>
              </div>
            </div>
          </div>
          <p v-if="detail" class="booking-detail" aria-live="polite">
            {{ info(detail) }}
          </p>
          <div v-if="selection" class="range-editor">
            <b>{{ roomTitle(selection.room) }}</b
            ><label
              >С
              <select
                v-model.number="selection.start"
                aria-label="Начало брони"
              >
                <option v-for="t in endpoints.start" :value="t">
                  {{ timeText(t) }}
                </option>
              </select></label
            ><label
              >До
              <select v-model.number="selection.end" aria-label="Конец брони">
                <option v-for="t in endpoints.end" :value="t">
                  {{ timeText(t) }}
                </option>
              </select></label
            ><span>{{ selection.end - selection.start }} мин</span>
          </div>
          <p v-else-if="fund !== 'Спортзал'" class="slot-hint">
            Выберите свободные полчаса и растяните выделение до нужного времени.
          </p>
          <p v-if="selection && fund === 'Спортзал'" class="gym-summary">
            Одно место · свободно {{ seats(selection.start, selection.end) }} из
            {{ gym.capacity }} на весь интервал
          </p>
          <p v-if="collision && fund !== 'Спортзал'" class="overlap-note">
            Помещение уже занято. Выберите другой интервал.
          </p>
          <p v-else-if="personal" class="overlap-note">
            В это время у вас «{{ personal.name }}» в аудитории
            {{ personal.room }}, но заявку всё равно можно отправить.
          </p>
          <small>От 30 минут до 4 часов · согласование в деканате</small>
          <button
            class="campus-action"
            :disabled="!request || collision || busy"
            @click="emit('send', request)"
          >
            Отправить заявку
          </button></template
        ></template
      ></template
    >
  </section>
</template>
