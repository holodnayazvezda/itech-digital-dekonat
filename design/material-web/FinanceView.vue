<script setup>
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { printDate, today } from "./timetable.js";
const props = defineProps({ role: String, payments: Object });
const financePeriods = computed(() =>
  Object.keys(props.payments).sort().reverse(),
);
const month = ref(financePeriods.value[0]);
const year = computed(() => month.value.slice(0, 4));
const years = computed(() => [
  ...new Set(financePeriods.value.map((p) => p.slice(0, 4))),
]);
const months = computed(() =>
  financePeriods.value.filter((p) => p.startsWith(year.value)).reverse(),
);
const strip = ref(null);
function selectYear(value) {
  const same = value + month.value.slice(4);
  month.value = props.payments[same]
    ? same
    : financePeriods.value.find((p) => p.startsWith(value));
}
function revealMonth() {
  nextTick(() => {
    const bar = strip.value,
      active = bar?.querySelector("[aria-pressed=true]");
    if (active)
      bar.scrollLeft +=
        active.getBoundingClientRect().left -
        bar.getBoundingClientRect().left -
        (bar.clientWidth - active.offsetWidth) / 2;
  });
}
onMounted(revealMonth);
watch(month, revealMonth);
const bill = computed(() => props.payments[month.value]);
const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const date = (value) =>
  printDate(value, {
    day: "numeric",
    month: "long",
    ...(value.slice(0, 4) !== year.value ? { year: "numeric" } : {}),
  });
const period = (value) => printDate(value + "-01", { month: "long" });
</script>
<template>
  <section class="finance" aria-label="Расчёт за месяц">
    <div class="pay-periods" aria-label="Расчётный месяц">
      <select
        aria-label="Расчётный год"
        :value="year"
        @change="selectYear($event.target.value)"
      >
        <option v-for="y in years" :key="y">{{ y }}</option>
      </select>
      <button
        aria-label="Предыдущие месяцы"
        class="month-arrow"
        @click="strip.scrollBy({ left: -220, behavior: 'smooth' })"
      >
        ‹
      </button>
      <div ref="strip" class="month-strip">
        <button
          v-for="p in months"
          :key="p"
          :aria-pressed="p === month"
          @click="month = p"
        >
          {{ period(p) }}
        </button>
      </div>
      <button
        aria-label="Следующие месяцы"
        class="month-arrow"
        @click="strip.scrollBy({ left: 220, behavior: 'smooth' })"
      >
        ›
      </button>
    </div>
    <div class="finance-total">
      <small>{{
        role === "student" ? "Начислено стипендий" : "К выплате за месяц"
      }}</small><b>{{ money.format(bill.total) }}</b>
    </div>
    <p v-if="!bill.lines.length && role === 'student'">
      За этот месяц стипендии не назначены.
    </p>
    <div v-else class="pay-columns">
      <section>
        <h3>Состав начислений</h3>
        <dl class="ledger">
          <div v-for="[label, value, desc] in bill.lines" :key="label">
            <dt>
              {{ label }}<small>{{ desc }}</small>
            </dt>
            <dd>{{ money.format(value) }}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>График выплат</h3>
        <dl class="ledger">
          <div v-for="[d, title, value] in bill.transfers" :key="d">
            <dt>
              {{ title
              }}<small
                >{{ date(d) }} ·
                {{ d <= today ? "Перечислено" : "Запланировано" }}</small
              >
            </dt>
            <dd>{{ money.format(value) }}</dd>
          </div>
        </dl>
      </section>
    </div>
    <small class="pay-note"
      >Учебный расчёт. Суммы и даты демонстрационные.</small
    >
  </section>
</template>
