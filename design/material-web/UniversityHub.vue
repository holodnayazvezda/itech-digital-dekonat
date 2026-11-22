<script setup>
import { electiveOptions, electiveSemester } from "./electives.js";
import { ref, computed, watch, nextTick } from "vue";
import { groups, services } from "./services.js";
import {
  directoryPeople as people,
  faculties,
  curriculum,
  programNames,
  planSources,
  residences,
} from "./university.js";
const props = defineProps({
  view: String,
  rootPlan: Boolean,
  electives: Object,
  peer: String,
  owner: String,
  messages: Array,
  records: Array,
  avatars: Object,
  busy: Boolean,
  send: Function,
});
const emit = defineEmits(["request", "record", "go", "back"]);
const query = ref(props.view === "directory" ? props.peer || "" : ""),
  collapsed = ref({}),
  program = ref(people[props.owner].program || programNames[0]),
  semester = ref(people[props.owner].program ? 3 : 1),
  draft = ref(""),
  log = ref(null);
const me = computed(() => people[props.owner]),
  peer = computed(() => people[props.peer]);
const ownPlan = computed(
  () => me.value.role === "student" && me.value.program === program.value,
);
const selected = computed(() =>
  electiveOptions.find((o) => o.id === props.electives?.selected),
);
const draftCourse = ref(""),
  saving = ref(false);
watch(
  () => props.electives?.selected,
  (id) => {
    draftCourse.value = id || "";
  },
  { immediate: true },
);
watch(
  () => props.peer,
  (v) => {
    if (props.view === "plan" && v === "electives")
      semester.value = electiveSemester;
  },
  { immediate: true },
);
const optionForm = ref(null);
async function showChoices() {
  semester.value = electiveSemester;
  await nextTick();
  optionForm.value?.scrollIntoView({ block: "start" });
  optionForm.value?.focus({ preventScroll: true });
}
async function saveChoice() {
  if (saving.value) return;
  saving.value = true;
  try {
    await props.send("choose-elective", {
      course: draftCourse.value,
      previous: props.electives?.selected || "",
    });
  } finally {
    saving.value = false;
  }
}
const match = (s) =>
  s.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/[ -]/g, "");
const matches = (s) => match(s).includes(match(query.value.trim()));
const catalog = computed(() =>
  groups
    .map((g) => ({
      ...g,
      items: services.filter(
        (s) => s.group === g.id && (matches(s.name) || matches(g.title)),
      ),
    }))
    .filter((g) => g.items.length),
);
const found = computed(() =>
  Object.values(people).filter(
    (p) =>
      matches(p.name) ||
      matches(p.number) ||
      matches(p.unit) ||
      matches(p.title),
  ),
);
const dialog = computed(() =>
  props.messages.filter(
    (m) => (m.sender === props.owner ? m.recipient : m.sender) === props.peer,
  ),
);
const threads = computed(() =>
  [
    ...new Set(
      [...props.messages]
        .reverse()
        .map((m) => (m.sender === props.owner ? m.recipient : m.sender)),
    ),
  ].map((id) => ({
    peer: people[id],
    last: [...props.messages]
      .reverse()
      .find((m) => m.sender === id || m.recipient === id),
  })),
);
const housing = computed(() =>
  props.records.filter((r) =>
    services.some((s) => s.group === "housing" && r.name === s.name),
  ),
);
const time = (t) =>
  new Date(t).toLocaleString("ru", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
async function send() {
  if (
    draft.value.trim() &&
    (await props.send("message", { to: props.peer, body: draft.value.trim() }))
  )
    draft.value = "";
}
watch(
  () => [props.view, props.peer],
  () => {
    query.value = props.view === "directory" ? props.peer || "" : "";
    draft.value = "";
  },
);
watch(
  () => [props.view, dialog.value.at(-1)?.id],
  async () => {
    await nextTick();
    if (log.value) log.value.scrollTop = log.value.scrollHeight;
  },
  { immediate: true },
);
</script>
<template>
  <div class="uni-hub">
    <button v-if="!rootPlan" class="text-link hub-back" @click="emit('back')">
      ← Назад
    </button>
    <template v-if="view === 'docs'">
      <label class="hub-search"
        ><svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10" cy="10" r="6" />
          <path d="m15 15 5 5" /></svg
        ><input
          v-model="query"
          type="search"
          aria-label="Найти справку или заявление"
          placeholder="Найти справку или заявление"
      /></label>
      <section v-for="g in catalog" :key="g.id" class="doc-section">
        <button
          class="section-toggle"
          :aria-expanded="!collapsed[g.id]"
          @click="collapsed[g.id] = !collapsed[g.id]"
        >
          {{ g.title
          }}<svg
            viewBox="0 0 16 16"
            :class="{ closed: collapsed[g.id] }"
            aria-hidden="true"
          >
            <path d="m4 10 4-4 4 4" />
          </svg>
        </button>
        <div v-if="!collapsed[g.id]" class="doc-grid">
          <button
            v-for="s in g.items"
            :key="s.name"
            class="doc-tile"
            @click="emit('request', s.name)"
          >
            <span class="doc-icon" :style="{ background: g.bg, color: g.ink }"
              ><svg viewBox="0 0 24 24" aria-hidden="true">
                <path :d="g.path" /></svg></span
            ><span>{{ s.name }}</span>
            <svg class="forward" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        </div>
      </section>
      <p v-if="!catalog.length">
        По вашему запросу ничего не найдено.
      </p></template
    >
    <template v-else-if="view === 'directory'">
      <div class="hub-controls">
        <label class="hub-search"
          ><input
            v-model="query"
            type="search"
            placeholder="ФИО или табельный номер"
            aria-label="ФИО или табельный номер"
        /></label>
        <button class="text-link" @click="emit('go', 'threads')">
          Мои диалоги ↗
        </button>
      </div>
      <div class="people-grid">
        <button
          v-for="p in found"
          :key="p.id"
          class="person-row"
          @click="emit('go', 'person', p.id)"
        >
          <img v-if="avatars[p.id]" :src="avatars[p.id]" alt="" /><i v-else>{{
            p.initials
          }}</i
          ><span
            ><strong>{{ p.name }}</strong
            ><small>{{ p.title }} · {{ p.unit }}</small></span
          ><span>›</span>
        </button>
      </div>
      <p v-if="!found.length">
        Совпадений нет. Попробуйте фамилию или номер.
      </p></template
    >
    <template v-else-if="view === 'person' && peer"
      ><article class="person-page">
        <img v-if="avatars[peer.id]" :src="avatars[peer.id]" alt="" /><i
          v-else
          >{{ peer.initials }}</i
        >
        <h2>{{ peer.name }}</h2>
        <p>{{ peer.title }} · {{ peer.unit }}</p>
        <small>Табельный номер · {{ peer.number }}</small>
        <button
          v-if="peer.id !== owner"
          class="campus-action"
          @click="emit('go', 'chat', peer.id)"
        >
          Написать сообщение
        </button>
      </article></template
    >
    <template v-else-if="view === 'threads'"
      ><p v-if="!threads.length">
        Пока нет диалогов. Выберите собеседника в разделе «Персоналии».
      </p>
      <button
        v-for="t in threads"
        class="person-row"
        @click="emit('go', 'chat', t.peer.id)"
      >
        <i>{{ t.peer.initials }}</i
        ><span
          ><strong>{{ t.peer.name }}</strong
          ><small>{{ t.last.body }}</small></span
        ><span>›</span>
      </button></template
    >
    <template v-else-if="view === 'chat' && peer"
      ><section class="chat-panel">
        <button class="person-row" @click="emit('go', 'person', peer.id)">
          <i>{{ peer.initials }}</i
          ><span
            ><strong>{{ peer.name }}</strong
            ><small>{{ peer.title }} · {{ peer.unit }}</small></span
          ><span>›</span>
        </button>
        <div ref="log" class="chat-log" role="log">
          <p v-if="!dialog.length">Начните диалог с приветствия.</p>
          <article
            v-for="m in dialog"
            :key="m.id"
            :class="{ mine: m.sender === owner }"
          >
            <p>{{ m.body }}</p>
            <small>{{ time(m.created) }}</small>
          </article>
        </div>
        <form class="hub-form" @submit.prevent="send">
          <label class="field"
            >Сообщение<textarea
              v-model="draft"
              required
              rows="2"
              maxlength="4000"
            ></textarea></label
          ><button class="campus-action" :disabled="busy || !draft.trim()">
            Отправить сообщение
          </button>
        </form>
      </section></template
    >
    <template v-else-if="view === 'structure'"
      ><h2>Ректорат</h2>
      <div class="people-grid">
        <button
          v-for="id in ['rector', 'vice-study', 'vice-science']"
          class="person-row"
          @click="emit('go', 'person', id)"
        >
          <i>{{ people[id].initials }}</i
          ><span
            ><strong>{{ people[id].name }}</strong
            ><small>{{ people[id].title }}</small></span
          ><span>›</span>
        </button>
      </div>
      <h2>Факультеты и направления</h2>
      <div class="people-grid">
        <section v-for="f in faculties" class="faculty-card">
          <h3>{{ f.name }}</h3>
          <button class="text-link" @click="emit('go', 'person', f.dean)">
            Декан · {{ people[f.dean].name }} ↗
          </button>
          <button
            v-for="p in f.programs"
            class="program-link"
            :class="{ own: p === me.program }"
            @click="
              program = p;
              semester = p === me.program ? 3 : 1;
              emit('go', 'plan');
            "
          >
            {{ p }} <small v-if="p === me.program">Ваше направление</small> ›
          </button>
        </section>
      </div></template
    >
    <template v-else-if="view === 'plan'"
      ><label class="field plan-select"
        >Образовательная программа<select v-model="program">
          <option v-for="p in programNames">{{ p }}</option>
        </select></label
      >
      <p>Бакалавриат · 4 года · 240 зачётных единиц</p>
      <div class="term-strip" aria-label="Семестры">
        <button
          v-for="i in 8"
          :class="{ active: i === semester }"
          @click="semester = i"
        >
          {{ i }} сем.
        </button>
      </div>
      <button
        v-if="ownPlan && electives && semester !== electiveSemester"
        class="text-link"
        @click="showChoices"
      >
        {{ selected ? "Мой выбор" : "Выбрать дисциплину" }} на 4 семестр ↗
      </button>
      <h2>{{ semester }} семестр</h2>
      <dl class="ledger">
        <div v-for="d in curriculum(program)[semester - 1]" :key="d.subject">
          <dt>
            {{
              ownPlan &&
              semester === electiveSemester &&
              d.subject === "Дисциплина по выбору" &&
              selected
                ? selected.name
                : d.subject
            }}
          </dt>
          <dd>{{ d.credits }} з. е. · {{ d.assessment }}</dd>
        </div>
      </dl>
      <form
        v-if="ownPlan && electives && semester === electiveSemester"
        ref="optionForm"
        tabindex="-1"
        class="elective-form"
        @submit.prevent="saveChoice"
      >
        <fieldset>
          <legend>Дисциплина по выбору</legend>
          <p>Один курс · 5 з. е. · зачёт</p>
          <label
            v-for="o in electiveOptions"
            :key="o.id"
            class="elective-option"
          >
            <input
              type="radio"
              name="course"
              v-model="draftCourse"
              :value="o.id"
              :disabled="
                busy ||
                saving ||
                (!electives.remaining[o.id] && selected?.id !== o.id)
              "
            />
            <span
              ><strong>{{ o.name }}</strong
              ><small>{{ o.description }}</small
              ><small>{{ o.teacher }}</small></span
            >
            <b>{{
              selected?.id === o.id
                ? "В вашем плане"
                : electives.remaining[o.id]
                  ? "Мест: " + electives.remaining[o.id]
                  : "Мест нет"
            }}</b>
          </label>
        </fieldset>
        <button
          class="campus-action"
          :disabled="
            busy ||
            saving ||
            !draftCourse ||
            draftCourse === selected?.id ||
            !electives.remaining[draftCourse]
          "
        >
          {{ selected ? "Изменить выбор" : "Сохранить выбор" }}
        </button>
      </form>
      <details>
        <summary>Об учебном плане</summary>
        <p>
          Демонстрационная программа. Структура семестров и состав дисциплин
          основаны на открытых университетских материалах.
        </p>
        <a
          v-for="[label, url] in planSources"
          :href="url"
          target="_blank"
          rel="noopener"
          >{{ label }} ↗</a
        >
      </details></template
    >
    <template v-else-if="view === 'dorm'"
      ><div class="people-grid">
        <section v-for="(r, i) in residences" class="faculty-card">
          <h3>{{ r }}</h3>
          <p>
            {{
              i
                ? "Парковый корпус · стойка администратора на первом этаже"
                : "Северный корпус · комната администрации 101"
            }}
          </p>
        </section>
      </div>
      <template v-if="me.role === 'student'"
        ><h2>Обращения в общежитие</h2>
        <button
          v-for="s in services.filter((s) => s.group === 'housing')"
          class="person-row"
          @click="emit('request', s.name)"
        >
          <strong>{{ s.name }}</strong
          ><span>›</span>
        </button>
        <h2>Мои обращения</h2>
        <p v-if="!housing.length">Обращений пока нет.</p>
        <button
          v-for="r in housing"
          class="person-row"
          @click="emit('record', r)"
        >
          <span>{{ r.name }}</span
          ><small>{{
            {
              pending: "На рассмотрении",
              approved: "Одобрено",
              rejected: "Отклонено",
            }[r.status]
          }}</small>
        </button></template
      ></template
    >
  </div>
</template>
