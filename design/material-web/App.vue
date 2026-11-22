<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useTheme } from "vuetify";
import {
  mdiViewDashboardOutline,
  mdiCalendarMonthOutline,
  mdiSchoolOutline,
  mdiBookOpenPageVariantOutline,
  mdiApps,
  mdiArrowTopRight,
  mdiBellOutline,
  mdiBrightness6,
  mdiClose,
  mdiEyeOutline,
  mdiContentCopy,
  mdiEyeOffOutline,
  mdiEmailOutline,
  mdiArrowLeft,
  mdiCheckCircleOutline,
  mdiMapMarkerOutline,
  mdiWifi,
  mdiFileDocumentOutline,
  mdiDoorOpen,
  mdiClipboardOutline,
} from "@mdi/js";
import palette from "./palette.json";
import CalendarView from "./CalendarView.vue";
import { classesOn, overlaps, printDate, today, weekOf } from "./timetable.js";

import UniversityHub from "./UniversityHub.vue";
import ServiceForm from "./ServiceForm.vue";
import RoomFinder from "./RoomFinder.vue";
import RequestList from "./RequestList.vue";
import FinanceView from "./FinanceView.vue";
import LessonHero from "./LessonHero.vue";
import { campusSession } from "./campus-client.js";
import {
  people,
  facultyDirectory,
  allClasses,
  personalClasses,
  teachingDays,
  checkpoints,
  statuses,
} from "./campus-data.js";
const {
  enablePush: subscribePush,
  payments,
  electives,
  wifi,
  owner,
  messages,
  role,
  token,
  records,
  notes,
  reservations,
  avatars,
  busy,
  login,
  logout,
  refresh,
  perform,
  download,
  bookings,
} = campusSession(say);

const loginRole = ref("student"),
  signing = ref(false);
const previewEvent = computed(
  () =>
    personalClasses(today, people[loginRole.value].role, loginRole.value)[0],
);
const account = computed(() => people[owner.value] || people.student);
async function enter() {
  if (signing.value) return;
  signing.value = true;
  try {
    await login(loginRole.value);
    route(0);
    if (location.hash === "#notices") {
      open("notices");
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (e) {
    say(e.message);
  } finally {
    signing.value = false;
  }
}
function exit() {
  close();
  tab.value = 0;
  pages.value = [];
  filter.value = "Моё";
  logout();
}
let poll;
onMounted(async () => {
  if (token.value)
    try {
      await refresh();
    } catch {
      logout();
    }
  poll = setInterval(() => refresh().catch(() => {}), 2000);
});
onUnmounted(() => clearInterval(poll));
const assetBase = import.meta.env.BASE_URL;
const tabs = [
  ["Сегодня", mdiViewDashboardOutline],
  ["Расписание", mdiCalendarMonthOutline],
  ["Зачётка", mdiSchoolOutline],
  ["Услуги", mdiFileDocumentOutline],
  ["Сервисы", mdiApps],
  ["Учебный план", mdiBookOpenPageVariantOutline],
];
const theme = useTheme(),
  tab = ref(0),
  panel = ref(""),
  stack = ref([]),
  filter = ref("Моё"),
  lesson = ref(null);
const pages = ref([]);
const page = computed(() => pages.value.at(-1));
const pageNames = {
  docs: "Документы и заявления",
  directory: "Персоналии",
  person: "Карточка участника",
  chat: "Личный диалог",
  threads: "Мои диалоги",
  structure: "Структура университета",
  plan: "Учебный план",
  dorm: "Общежития",
};
function goPage(view, peer = "") {
  close();
  pages.value.push({ view, peer });
  window.scrollTo(0, 0);
}
function visibleTab(i) {
  return (
    role.value === "student" ||
    (role.value === "teacher" && i !== 2 && i !== 5) ||
    (role.value === "staff" && [0, 1, 4].includes(i)) ||
    (role.value === "office" && [0, 4].includes(i))
  );
}
const campusItems = computed(() => [
  [
    mdiSchoolOutline,
    "Персоналии",
    "Найти человека или открыть диалог",
    "directory",
  ],
  ...(["student", "teacher"].includes(role.value)
    ? [
        [
          mdiDoorOpen,
          "Бронирование помещений",
          "Аудитории, коворкинги и спортзал",
          "spaces",
        ],
      ]
    : []),
  [mdiMapMarkerOutline, "Общежития", "Дома студентов и обращения", "dorm"],
]);
function selectItem(k) {
  if (k === "spaces") findRoom();
  else if (pageNames[k]) goPage(k);
  else open(k);
}
const lessons = computed(() => personalClasses(today, role.value, owner.value));
const exam = computed(() =>
  ["2026-11-24", "2026-11-28"]
    .flatMap((d) => personalClasses(d, role.value, owner.value))
    .find((e) => e.type === "Экзамен"),
);
lesson.value = lessons.value[0];
const directory = [
  ...new Map(
    weekOf(today)
      .flatMap(classesOn)
      .map((e) => [e.name, e]),
  ).values(),
];
const directoryRows = computed(() => [
  ...new Map(
    directory.map((e) => [
      filter.value === "Преподаватели" ? e.teacher : e.room,
      e,
    ]),
  ).values(),
]);
const dateLabel = computed(() =>
  printDate(lesson.value.date, { day: "numeric", month: "long" }),
);
const roomDate = ref(today),
  roomInitial = ref(null);
const roomEvents = computed(() =>
  roomDate.value
    ? [
        ...allClasses(roomDate.value).filter(
          (e) => e.room === lesson.value.room,
        ),
        ...reservations.value
          .filter(
            (b) => b.short === lesson.value.room && b.date === roomDate.value,
          )
          .map((b) => ({
            ...b,
            id: b.short + b.time,
            name: "Бронь помещения",
            teacher: b.by,
          })),
      ].sort((a, b) => a.time.localeCompare(b.time))
    : [],
);
const instructor = computed(() =>
  Object.values(people).find((p) => p.name === lesson.value?.teacher),
);
const faculty = computed(() => facultyDirectory[lesson.value?.teacher]);
const teaching = computed(() => teachingDays(lesson.value.teacher));
const firstUpcoming = computed(
  () => teaching.value.find((d) => d.date >= today)?.date,
);
function jumpToClass() {
  const list = document.querySelector(".teacher-list"),
    target = list?.querySelector('[data-upcoming="true"]');
  if (target)
    list.scrollTop +=
      target.getBoundingClientRect().top - list.getBoundingClientRect().top;
}
function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
const demoMinute = ref(toMinutes("09:50"));
let anchorTime = Date.now();
let anchorMinute = demoMinute.value;
let clockTimer;
function updateClock() {
  demoMinute.value = Math.min(
    1439,
    anchorMinute + Math.floor((Date.now() - anchorTime) / 60000),
  );
}
function setDemoTime(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
  anchorTime = Date.now();
  anchorMinute = toMinutes(value);
  updateClock();
}
onMounted(() => {
  clockTimer = window.setInterval(updateClock, 1000);
});
onUnmounted(() => window.clearInterval(clockTimer));
const demoTime = computed(() =>
  [Math.floor(demoMinute.value / 60), demoMinute.value % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":"),
);
const nextIndex = computed(() =>
  lessons.value.findIndex((item) => toMinutes(item.end) > demoMinute.value),
);
const nextLesson = computed(
  () =>
    lessons.value[nextIndex.value] ||
    (role.value === "teacher"
      ? teachingDays(account.value.name).find((day) => day.date > today)
          ?.events[0]
      : undefined),
);
const lessonInProgress = computed(() =>
  Boolean(
    nextLesson.value &&
      nextLesson.value.date === today &&
      demoMinute.value >= toMinutes(nextLesson.value.time),
  ),
);
const durationFormat = new Intl.NumberFormat("ru", {
  style: "unit",
  unit: "minute",
  unitDisplay: "long",
});
const countdown = computed(() => {
  if (!nextLesson.value) return "";
  const boundary = lessonInProgress.value
    ? nextLesson.value.end
    : nextLesson.value.time;
  if (nextLesson.value.date !== today) {
    const days =
      (Date.parse(nextLesson.value.date) - Date.parse(today)) / 86400000;
    const minutes =
      days * 1440 + toMinutes(nextLesson.value.time) - demoMinute.value;
    return (
      "До начала — " +
      [
        Math.floor(minutes / 1440) ? Math.floor(minutes / 1440) + " дн." : "",
        Math.floor((minutes % 1440) / 60) + " ч",
        minutes % 60 ? (minutes % 60) + " мин" : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  const duration = durationFormat.format(
    toMinutes(boundary) - demoMinute.value,
  );
  const minutes = toMinutes(boundary) - demoMinute.value;
  return (
    (lessonInProgress.value ? "До конца — " : "До начала — ") +
    (minutes < 60
      ? duration
      : [
          Math.floor(minutes / 60) + " ч",
          minutes % 60 ? (minutes % 60) + " мин" : "",
        ]
          .filter(Boolean)
          .join(" "))
  );
});
const gradeRows = computed(() =>
  owner.value === "friend"
    ? [
        [
          "Хорошо",
          "Анализ данных",
          "Экзамен · 78 баллов",
          [
            ["Лабораторные работы", 22, 30],
            ["Проект", 24, 30],
            ["Экзамен", 32, 40],
          ],
        ],
        ["Зачёт", "Иностранный язык", "Зачтено"],
        ["Ожидается", "Проектный семинар", "Ожидается защита"],
        ["28 ноя", "История культуры", "Предстоит экзамен · Б-240"],
        ["Ожидается", "Статистика", "Ожидается ведомость"],
      ]
    : [
        ["Отлично", "Анализ данных", "Экзамен · 92 балла", checkpoints],
        ["Зачёт", "Проектный семинар", "Зачтено"],
        ["Зачёт", "Иностранный язык", "Зачтено"],
        ["24 ноя", "История культуры", "Предстоит экзамен · Б-240"],
        ["Ожидается", "Статистика", "Ожидается ведомость"],
      ],
);
const closedCount = computed(
  () =>
    gradeRows.value.filter((r) => ["Хорошо", "Зачёт", "Отлично"].includes(r[0]))
      .length,
);
const gradeStyles = {
  Отлично: "excellent",
  Хорошо: "good",
  Удовлетворительно: "satisfactory",
  Неудовлетворительно: "failed",
};
const activeMark = ref(null);
const totalMark = computed(() =>
  (activeMark.value?.[3] || []).reduce(
    (v, [, s, m]) => [v[0] + s, v[1] + m],
    [0, 0],
  ),
);
function showMarks(row) {
  activeMark.value = row;
  open("marks");
}
const reveal = ref(false),
  recordId = ref(""),
  noteId = ref(0);
const activeRecord = computed(() =>
  records.value.find((r) => r.id === recordId.value),
);
const activeNote = computed(() =>
  notes.value.find((n) => n.id === noteId.value),
);
const topNotes = computed(() =>
  [...notes.value]
    .sort((a, b) => b.priority - a.priority || b.id - a.id)
    .slice(0, 3),
);
const docName = ref("");
function chooseService(name) {
  docName.value = name;
  open("request");
}
const letterTo = ref("student"),
  letterSubject = ref(""),
  letterBody = ref(""),
  reason = ref("");
function openRecord(r) {
  if (!r) return;
  recordId.value = r.id;
  reason.value = "";
  open("record");
}
function openNote(n) {
  if (n.ref === "electives") {
    route(5);
    pages.value.push({ view: "plan", peer: "electives" });
    return;
  }
  if (n.ref?.startsWith("chat:")) {
    route(4);
    goPage("directory");
    goPage("chat", n.ref.slice(5));
    return;
  }
  const result = n.ref && records.value.find((r) => r.id === n.ref);
  if (result) {
    openRecord(result);
    return;
  }
  noteId.value = n.id;
  open("letter");
}
async function submitRequest(data) {
  const result = await perform("request", data);
  if (!result) return;
  recordId.value = result.id;
  stack.value = [];
  panel.value = "record";
  say("Заявка направлена в деканат");
}
async function caseReply(command) {
  if (await perform(command, { id: recordId.value, body: reason.value })) {
    reason.value = "";
    say("Сведения отправлены");
  }
}
async function decide(status) {
  if (
    await perform("decision", {
      id: recordId.value,
      status,
      reason: reason.value,
    })
  )
    say("Решение отправлено");
}
async function sendLetter() {
  if (
    await perform("letter", {
      to: letterTo.value,
      subject: letterSubject.value,
      body: letterBody.value,
    })
  ) {
    letterSubject.value = "";
    letterBody.value = "";
    close();
    say("Письмо отправлено");
  }
}
async function enablePush() {
  try {
    await subscribePush();
    say("Уведомления браузера включены");
  } catch (e) {
    say(e.message);
  }
}
function openPushInbox() {
  if (role.value) open("notices");
  else location.hash = "notices";
}
function receivePush(e) {
  if (e.data === "open-campus-notices") openPushInbox();
}
watch(role, (value) => {
  if (value && location.hash === "#notices")
    nextTick(() => {
      open("notices");
      history.replaceState(null, "", location.pathname + location.search);
    });
});
onMounted(() =>
  navigator.serviceWorker?.addEventListener("message", receivePush),
);
onUnmounted(() =>
  navigator.serviceWorker?.removeEventListener("message", receivePush),
);
const serviceItems = computed(() => [
  ...(role.value === "student"
    ? [
        [
          mdiFileDocumentOutline,
          "Документы и заявления",
          "Каталог услуг студенческого офиса",
          "docs",
        ],
      ]
    : []),
  [mdiClipboardOutline, "Мои заявки", "Заявки и решения деканата", "booked"],
  [
    mdiSchoolOutline,
    financeName.value,
    "Начисления и график выплат",
    "finance",
  ],
  [mdiWifi, "Wi-Fi кампуса", "Персональный демо-доступ", "wifi"],
]);
const financeName = computed(() =>
  role.value === "teacher" ? "Заработная плата" : "Стипендия",
);
const message = ref(""),
  toast = ref(false),
  heading = ref(null);
const colors = computed(() =>
  Object.fromEntries(
    Object.entries(palette[theme.global.name.value] || palette.Light).map(
      ([k, v]) => ["--c-" + k, v],
    ),
  ),
);
const titles = {
  letter: "Письмо деканата",
  compose: "Написать письмо",
  record: "Моё обращение",
  marks: "Контрольные точки",
  docs: "Документы и заявления",
  finance: "Выплаты",
  lesson: "Занятие",
  teacher: "Преподаватель",
  room: "Аудитория",
  spaces: "Бронирование помещений",
  booking: "Бронирование",
  booked: "Мои заявки",
  doc: "Моя справка",
  request: "Новое обращение",
  submitted: "Моя заявка",
  notices: "Уведомления",
  profile: "Профиль",
  wifi: "Wi-Fi кампуса",
};
const showDialog = computed({
  get: () => Boolean(panel.value),
  set: (value) => {
    if (!value) close();
  },
});
function open(key) {
  if (panel.value === key) return;
  if (panel.value) stack.value.push(panel.value);
  if (key === "room") roomDate.value = today;
  panel.value = key;
}
function close() {
  panel.value = "";
  stack.value = [];
  reveal.value = false;
}
function back() {
  panel.value = stack.value.pop() || "";
}
function route(i) {
  close();
  pages.value = [];
  tab.value = i;
  nextTick(() => heading.value?.focus({ preventScroll: true }));
}
function showEvent(event, target = "lesson") {
  lesson.value = event;
  open(target);
}
function findRoom(short = "", date = today, start) {
  roomInitial.value = { short, date, start };
  open("spaces");
}
const homeAgenda = computed(() => {
  const entries = [
    ...lessons.value,
    ...bookings.value.filter((b) => b.date === today),
  ];
  const occupied = [...entries].sort((a, b) => a.time.localeCompare(b.time));
  let end = occupied[0]?.end;
  for (const event of occupied) {
    if (toMinutes(event.time) - toMinutes(end) >= 60)
      entries.push({
        id: "gap" + end,
        kind: "gap",
        time: end,
        end: event.time,
      });
    if (event.end > end) end = event.end;
  }
  return entries.sort((a, b) => a.time.localeCompare(b.time));
});
function overlapsBooking(entry) {
  return homeAgenda.value.some(
    (e) => e.kind !== "gap" && e.id !== entry.id && overlaps(entry, e),
  );
}
function say(text) {
  message.value = text;
  toast.value = true;
}
function toggleTheme() {
  theme.change(theme.global.name.value === "Light" ? "Dark" : "Light");
  localStorage.setItem("campus-theme", theme.global.name.value);
}
const wifiPassword = computed(() => wifi.value?.password || "");
const wifiReadyAt = computed(() => wifi.value?.ready || 0);
const wifiReadyTime = computed(() =>
  new Date(wifiReadyAt.value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }),
);
async function resetWifi() {
  if (await perform("reset-wifi", {}))
    say("Новый пароль готов. Активация примерно через 5 минут.");
}
const avatar = computed(() => avatars.value[owner.value] || "");
const avatarInput = ref(null);
async function changeAvatar(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    say("Выберите JPG, PNG или WebP");
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    canvas
      .getContext("2d")
      .drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        192,
        192,
      );
    const data = canvas.toDataURL("image/png");
    if (await perform("avatar", { image: data })) say("Фото профиля обновлено");
  } catch {
    say("Не удалось сохранить фото");
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(wifiPassword.value);
    say("Демо-пароль скопирован");
  } catch {
    say("Не удалось скопировать. Откройте поле и выделите пароль.");
  }
}
watch(panel, () => {
  reveal.value = false;
});
</script>
<template>
  <v-app :style="colors">
    <main v-if="!role" class="login-page" :style="colors">
      <div class="brand"><img src="./public/mark.svg" alt="" />Деканат</div>
      <h1>Вход</h1>
      <LessonHero
        v-if="previewEvent"
        :next-lesson="previewEvent"
        :faculty="people[loginRole].role === 'teacher'"
        :lesson-in-progress="false"
        :countdown="
          previewEvent.time === '10:00'
            ? 'До начала — 10 минут'
            : printDate(previewEvent.date, { day: 'numeric', month: 'long' })
        "
        preview
      />
      <p v-else class="login-role-summary">
        {{
          people[loginRole].role === "office"
            ? "Рассмотрение обращений и письма студентам"
            : "Расписание и личные сообщения"
        }}
      </p>
      <form @submit.prevent="enter">
        <label class="field"
          >Демонстрационный кабинет<select v-model="loginRole">
            <option v-for="(a, key) in people" :key="key" :value="key">
              {{ a.title }} · {{ a.name }}
            </option>
          </select></label
        ><button class="campus-action" :disabled="signing">Войти</button>
      </form>
    </main>
    <div v-else class="shell" :class="{ 'faculty-shell': role !== 'student' }">
      <aside class="rail">
        <div class="brand">
          <img :src="assetBase + 'mark.svg'" alt="" />Деканат
        </div>
        <nav v-if="role === 'office'">
          <button
            v-for="[key, label, ico] in [
              ['queue', 'Обращения', mdiClipboardOutline],
              ['compose', 'Письма', mdiEmailOutline],
              ['services', 'Сервисы', mdiApps],
            ]"
            :class="{
              active:
                (tab === 4
                  ? 'services'
                  : panel === 'compose'
                    ? 'compose'
                    : 'queue') === key,
            }"
            :aria-current="
              (tab === 4
                ? 'services'
                : panel === 'compose'
                  ? 'compose'
                  : 'queue') === key
                ? 'page'
                : undefined
            "
            @click="
              key === 'services'
                ? route(4)
                : key === 'queue'
                  ? route(0)
                  : open('compose')
            "
          >
            <v-icon :icon="ico" />{{ label }}
          </button>
        </nav>
        <nav v-else>
          <button
            v-for="i in [0, 1, 2, 5, 3, 4]"
            :key="i"
            v-show="visibleTab(i)"
            v-ripple
            :class="{ active: tab === i }"
            :aria-current="tab === i ? 'page' : undefined"
            @click="route(i)"
          >
            <v-icon :icon="tabs[i][1]" />{{ tabs[i][0] }}
          </button>
        </nav>
        <small>Конкурсный прототип</small>
      </aside>
      <main>
        <header :class="{ 'hub-heading': page }">
          <div>
            <p class="date">
              {{
                [
                  "Пятница, 20 ноября",
                  "Осенний семестр · 2026",
                  "Курс 2 · Семестр 3",
                  "Студенческий офис",
                  "Кампус",
                  "Образовательная программа",
                ][tab]
              }}
            </p>
            <h1 ref="heading" tabindex="-1">
              {{
                page
                  ? pageNames[page.view]
                  : role === "office" && tab === 0
                    ? "Деканат"
                    : tabs[tab][0]
              }}
            </h1>
          </div>
          <div class="tools">
            <v-btn
              icon
              variant="tonal"
              aria-label="Сменить тему"
              @click="toggleTheme"
              ><v-icon :icon="mdiBrightness6" /></v-btn
            ><v-btn
              icon
              variant="tonal"
              aria-label="Уведомления"
              @click="open('notices')"
              ><v-icon :icon="mdiBellOutline" /></v-btn
            ><v-btn
              icon
              variant="tonal"
              aria-label="Профиль"
              @click="open('profile')"
              ><img
                v-if="avatar"
                class="nav-avatar"
                :src="avatar"
                alt=""
              /><span v-else>{{ account.initials }}</span></v-btn
            >
          </div>
        </header>
        <transition name="screen" mode="out-in"
          ><section :key="tab" class="view">
            <UniversityHub
              v-if="page || tab === 5"
              :view="page?.view || 'plan'"
              :peer="page?.peer || ''"
              :root-plan="tab === 5 && (!page || page.peer === 'electives')"
              :electives="electives"
              :owner="owner"
              :messages="messages"
              :avatars="avatars"
              :records="records"
              :busy="busy"
              :send="perform"
              @go="goPage"
              @back="pages.pop()"
              @record="openRecord"
              @request="chooseService"
            />
            <section v-else-if="role === 'office' && tab === 0" class="content">
              <button class="campus-action" @click="open('compose')">
                Написать письмо
              </button>
              <h2>Обращения</h2>
              <p v-if="!records.length">Обращений пока нет.</p>
              <button
                v-for="r in records"
                :key="r.id"
                class="case-row"
                @click="openRecord(r)"
              >
                <span
                  ><b>{{ r.name }}</b
                  ><small
                    >{{ people[r.owner].name }} ·
                    {{
                      r.kind === "booking"
                        ? r.date + " · " + r.time + "–" + r.end
                        : r.format
                    }}</small
                  ></span
                ><i :class="'badge ' + r.status">{{ statuses[r.status] }}</i>
              </button>
            </section>
            <div v-else-if="tab === 0" class="dashboard">
              <LessonHero
                v-if="nextLesson"
                :next-lesson="nextLesson"
                :faculty="role === 'teacher'"
                :lesson-in-progress="lessonInProgress"
                :countdown="countdown"
                @lesson="showEvent(nextLesson)"
                @room="showEvent(nextLesson, 'room')"
                @teacher="showEvent(nextLesson, 'teacher')"
              />
              <div v-else class="day-complete">
                <h2>
                  {{
                    lessons.length
                      ? "Пары на сегодня закончились"
                      : "На сегодня обязательных занятий нет"
                  }}
                </h2>
              </div>
              <div class="agenda">
                <div class="agenda-title">
                  <h2>Мой день</h2>
                  <button class="text-link" @click="route(1)">
                    Расписание <v-icon :icon="mdiArrowTopRight" />
                  </button>
                </div>
                <template v-for="entry in homeAgenda" :key="entry.id">
                  <div v-if="entry.kind === 'gap'" class="rest-row">
                    <div>
                      <b>Свободное время</b
                      ><small>Можно отдохнуть до {{ entry.end }}</small>
                    </div>
                    <button
                      class="text-link"
                      @click="findRoom('', today, entry.time)"
                    >
                      Забронировать ↗
                    </button>
                  </div>
                  <button
                    v-else-if="entry.kind === 'booking'"
                    class="record"
                    :class="{ overlap: overlapsBooking(entry) }"
                    @click="openRecord(entry)"
                  >
                    <em>{{ entry.time }}</em
                    ><span
                      ><b>{{ entry.name }}</b
                      ><small>Одобрена · до {{ entry.end }}</small></span
                    >
                  </button>
                  <button
                    v-else
                    class="record"
                    :class="{ overlap: overlapsBooking(entry) }"
                    @click="showEvent(entry)"
                  >
                    <em>{{ entry.time }}</em
                    ><span
                      ><b>{{ entry.name }}</b
                      ><small
                        ><b v-if="role === 'teacher'" class="inline-group"
                          >{{ entry.group }} · </b
                        >{{ entry.type }} · {{ entry.room }}</small
                      >
                      <span v-if="overlapsBooking(entry)" class="agenda-overlap"
                        >Совпадает по времени</span
                      ></span
                    >
                  </button>
                </template>
              </div>
              <aside class="office">
                <h2>
                  {{ role === "student" ? "Студенческий офис" : "Деканат" }}
                </h2>
                <button
                  v-for="n in topNotes"
                  :key="n.id"
                  class="notice-row"
                  @click="openNote(n)"
                >
                  <small>{{
                    n.ref?.startsWith("chat:") ? "Личные сообщения" : "Деканат"
                  }}</small
                  ><b>{{ n.title }}</b></button
                ><button class="text-link" @click="open('notices')">
                  Все уведомления ↗
                </button>
                <button
                  v-if="role === 'teacher'"
                  class="text-link"
                  @click="
                    route(4);
                    goPage('directory');
                  "
                >
                  Написать студенту ↗
                </button>
                <template v-if="exam && role === 'student'"
                  ><h2>Экзамен</h2>
                  <button class="record" @click="showEvent(exam)">
                    <em>{{
                      printDate(exam.date, { day: "numeric", month: "short" })
                    }}</em
                    ><span
                      ><b>{{ exam.name }}</b
                      ><small>Экзамен · {{ exam.room }}</small></span
                    >
                  </button></template
                >
              </aside>
            </div>
            <div
              v-else-if="tab === 1"
              class="content"
              :class="{ wide: filter === 'Моё' }"
            >
              <div class="filters">
                <button
                  v-for="f in ['Моё', 'Преподаватели', 'Аудитории']"
                  :key="f"
                  :class="{ selected: filter === f }"
                  @click="filter = f"
                >
                  {{ f }}
                </button>
              </div>
              <CalendarView
                v-if="filter === 'Моё'"
                :bookings="bookings"
                :role="role"
                :owner="owner"
                @lesson="showEvent"
                @booking="openRecord"
                @spaces="(d) => findRoom('', d)"
              />
              <template v-else
                ><h2>{{ filter }}</h2>
                <button
                  v-for="(l, i) in directoryRows"
                  :key="i"
                  class="record"
                  @click="
                    showEvent(
                      l,
                      filter === 'Преподаватели' ? 'teacher' : 'room',
                    )
                  "
                >
                  <em>{{
                    filter === "Преподаватели" ? "Ведёт" : l.building.name
                  }}</em
                  ><span
                    ><b>{{ filter === "Преподаватели" ? l.teacher : l.room }}</b
                    ><small>{{ l.name }}</small></span
                  >
                </button></template
              >
            </div>
            <div v-else-if="tab === 2" class="content">
              <div class="grade">
                <small>Закрыто дисциплин</small
                ><strong>{{ closedCount }} из {{ gradeRows.length }}</strong>
                <div class="bars">
                  <i
                    v-for="n in 5"
                    :class="{ done: n <= closedCount }"
                    :key="n"
                  />
                </div>
              </div>
              <button class="text-link" @click="route(5)">
                Учебный план программы ↗
              </button>
              <h2>Дисциплины</h2>
              <component
                :is="r[3] ? 'button' : 'div'"
                @click="r[3] && showMarks(r)"
                v-for="r in gradeRows"
                :key="r[1]"
                class="record"
              >
                <em>{{ r[0] }}</em
                ><span
                  ><b>{{ r[1] }}</b
                  ><small>{{ r[2] }}</small></span
                >
              </component>
            </div>
            <div v-else class="content services-layout">
              <div class="service-catalog">
                <button
                  v-for="item in tab === 4 ? campusItems : serviceItems"
                  :key="item[1]"
                  class="record"
                  :class="{ 'mobile-requests': item[3] === 'booked' }"
                  @click="selectItem(item[3])"
                >
                  <em><v-icon :icon="item[0]" /></em
                  ><span
                    ><b>{{ item[1] }}</b
                    ><small>{{ item[2] }}</small></span
                  >
                </button>
              </div>
              <aside v-if="tab === 3" class="services-requests">
                <h2>Мои заявки</h2>
                <RequestList :records="records" @select="openRecord" />
              </aside>
            </div></section
        ></transition>
        <footer>
          <button class="text-link" @click="exit">Сменить кабинет</button>
          Конкурсный прототип
          <label
            >Демо-время
            <input
              type="time"
              aria-label="Демо-время"
              :value="demoTime"
              @change="setDemoTime($event.target.value)"
          /></label>
        </footer>
      </main>
      <nav class="bottom" :style="{ '--active-tab': tab }">
        <i class="selection-indicator" aria-hidden="true"></i
        ><button
          v-for="i in [0, 1, 2, 5, 3, 4]"
          :key="i"
          v-show="visibleTab(i)"
          :aria-label="tabs[i][0]"
          :aria-current="i === tab ? 'page' : undefined"
          :class="{ active: i === tab }"
          @click="route(i)"
        >
          <span><v-icon :icon="tabs[i][1]" /></span
          >{{ i === 5 ? "План" : tabs[i][0] }}
        </button>
      </nav>
    </div>
    <v-dialog
      v-model="showDialog"
      :max-width="
        panel === 'spaces'
          ? 1140
          : panel === 'finance'
            ? 790
            : panel === 'teacher'
              ? 600
              : 480
      "
      transition="dialog-bottom-transition"
      scrollable
      ><div class="sheet" :style="colors">
        <div class="sheet-top">
          <button
            class="circle"
            v-if="stack.length"
            @click="back"
            aria-label="Назад"
          >
            <v-icon :icon="mdiArrowLeft" /></button
          ><small>Цифровой деканат</small
          ><button class="circle close" @click="close" aria-label="Закрыть">
            <v-icon :icon="mdiClose" />
          </button>
        </div>
        <transition name="screen" mode="out-in"
          ><article :key="panel">
            <h2>
              {{
                panel === "finance"
                  ? financeName
                  : panel === "record" && role === "office"
                    ? "Обращение"
                    : panel === "request"
                      ? docName
                      : titles[panel]
              }}
            </h2>
            <template v-if="panel === 'lesson'"
              ><div class="detail-block primary">
                <small>{{ lesson.type }}</small
                ><b>{{ lesson.name }}</b
                ><span
                  >{{ lesson.time }} – {{ lesson.end }} · {{ dateLabel }}</span
                >
              </div>
              <button class="room-address" @click="open('room')">
                <span
                  ><small>Место занятия</small><b>{{ lesson.room }} ↗</b
                  ><small
                    >{{ lesson.building.name }} · {{ lesson.floor }} этаж</small
                  ></span
                >
                <img
                  :src="assetBase + lesson.building.image"
                  :alt="lesson.building.alt"
                />
              </button>
              <div class="lesson-people">
                <button
                  v-if="role !== 'teacher' || lesson.teacher !== account.name"
                  @click="open('teacher')"
                >
                  <small>Ведёт</small><b>{{ lesson.teacher }} ↗</b>
                </button>
                <button
                  v-if="role === 'teacher'"
                  @click="goPage('directory', lesson.group)"
                >
                  <small>Студенты группы</small><b>{{ lesson.group }} ↗</b>
                </button>
                <div v-else>
                  <small>Группа</small><b>{{ lesson.group }}</b>
                </div>
              </div>
            </template>
            <template v-if="panel === 'teacher'">
              <div class="identity">
                <div class="portrait">
                  <img
                    v-if="avatars[instructor?.id]"
                    :src="avatars[instructor?.id]"
                    alt="Фото преподавателя"
                  /><span v-else>{{
                    lesson.teacher
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                  }}</span>
                </div>
                <div>
                  <h3>{{ lesson.teacher }}</h3>
                  <template v-if="faculty"
                    ><b class="faculty-post">{{ faculty.position }}</b
                    ><small>{{ faculty.faculties.join(" · ") }}</small
                    ><small>{{ faculty.teaching }}</small></template
                  >
                </div>
              </div>
              <button
                v-if="instructor && owner !== instructor.id"
                class="text-link"
                @click="goPage('chat', instructor.id)"
              >
                Написать преподавателю ↗
              </button>
              <h3 class="faculty-agenda-title">Расписание · осенний семестр</h3>
              <button class="text-link" @click="jumpToClass">
                К ближайшему занятию ↓
              </button>
              <div class="teacher-list">
                <section
                  v-for="d in teaching"
                  :key="d.date"
                  :data-upcoming="d.date === firstUpcoming"
                >
                  <h3>
                    {{
                      printDate(d.date, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    }}
                  </h3>
                  <button
                    v-for="e in d.events"
                    :key="e.id"
                    class="record"
                    @click="showEvent(e)"
                  >
                    <em>{{ e.time }}</em
                    ><span
                      ><b>{{ e.name }}</b
                      ><small
                        >{{ e.time }}–{{ e.end }} · {{ e.group }} ·
                        {{ e.room }}</small
                      ></span
                    >
                  </button>
                </section>
              </div>
            </template>
            <template v-if="panel === 'room'"
              ><div class="room-ident">
                <div>
                  <small>{{ lesson.building.name }}</small>
                  <h3>Аудитория {{ lesson.room }}</h3>
                </div>
                <img :src="assetBase + lesson.building.image" alt="" />
              </div>
              <label class="field"
                >Занятость на дату<input type="date" v-model="roomDate"
              /></label>
              <div v-for="e in roomEvents" :key="e.id" class="record">
                <em>{{ e.time }}</em
                ><span
                  ><b>{{ e.name }}</b
                  ><small
                    >{{ e.time }}–{{ e.end }} · {{ e.teacher }}</small
                  ></span
                >
              </div>
              <p v-if="!roomEvents.length">
                На выбранную дату занятий и подтверждённых броней нет.
              </p>
              <button
                class="campus-action"
                @click="findRoom(lesson.room, roomDate)"
                :disabled="
                  !roomDate || roomDate < today || roomDate > '2026-12-28'
                "
              >
                Выбрать время
              </button></template
            >
            <RoomFinder
              v-if="panel === 'spaces'"
              :initial="roomInitial"
              :reservations="reservations"
              :role="role"
              :owner="owner"
              :busy="busy"
              @send="submitRequest"
            />
            <template v-if="panel === 'booked'">
              <RequestList :records="records" @select="openRecord"
            /></template>
            <ServiceForm
              v-if="panel === 'request'"
              :key="docName"
              :name="docName"
              :person="account"
              :busy="busy"
              @submit="submitRequest"
            />
            <template v-if="panel === 'record' && activeRecord"
              ><div :class="'result-card ' + activeRecord.status">
                <small
                  >{{
                    activeRecord.kind === "booking"
                      ? "Заявка на бронирование"
                      : "Обращение"
                  }}
                  · {{ statuses[activeRecord.status] }}</small
                >
                <h3>{{ activeRecord.name }}</h3>
                <span>{{
                  activeRecord.kind === "booking"
                    ? printDate(activeRecord.date, {
                        day: "numeric",
                        month: "long",
                      }) +
                      " · " +
                      activeRecord.time +
                      "–" +
                      activeRecord.end
                    : activeRecord.format
                }}</span>
              </div>
              <p v-if="activeRecord.status === 'pending'">
                Решение деканата придёт в уведомления.
              </p>
              <p v-if="activeRecord.reason">{{ activeRecord.reason }}</p>
              <dl v-if="activeRecord.details" class="ledger">
                <div v-for="(v, k) in activeRecord.details">
                  <dt>{{ k }}</dt>
                  <dd>{{ v }}</dd>
                </div>
              </dl>
              <p v-for="r in activeRecord.requirements">
                {{ r.subject }} · {{ r.met ? "Зачтено" : "Пройти аттестацию" }}
              </p>
              <button
                v-if="activeRecord.attachment"
                class="text-link"
                @click="download(activeRecord, true)"
              >
                Скачать вложение · {{ activeRecord.attachment }}
              </button>
              <section
                v-if="activeRecord.discussion?.length"
                class="case-discussion"
              >
                <h3>Уточнения по заявке</h3>
                <article v-for="m in activeRecord.discussion">
                  <small>{{ people[m.sender].name }}</small>
                  <p>{{ m.body }}</p>
                </article>
              </section>
              <form
                v-if="
                  activeRecord.status === 'clarification' &&
                  owner === activeRecord.owner
                "
                class="hub-form"
                @submit.prevent="caseReply('supplement')"
              >
                <label class="field"
                  >Дополнительные сведения<textarea
                    v-model="reason"
                    required
                    maxlength="2500"
                    rows="3"
                  ></textarea></label
                ><button class="campus-action" :disabled="busy">
                  Дополнить заявку
                </button>
              </form>
              <p v-if="activeRecord.comment">{{ activeRecord.comment }}</p>
              <template
                v-if="role === 'office' && activeRecord.status === 'pending'"
                ><label class="field"
                  >Комментарий к решению<textarea
                    v-model="reason"
                    rows="2"
                  ></textarea>
                </label>
                <button
                  v-if="activeRecord.kind === 'document'"
                  class="text-link"
                  :disabled="busy || !reason.trim()"
                  @click="caseReply('clarify')"
                >
                  Запросить уточнение
                </button>
                <div class="action-row">
                  <button
                    class="campus-action"
                    :disabled="busy"
                    @click="decide('approved')"
                  >
                    Одобрить</button
                  ><button
                    class="text-link"
                    :disabled="busy"
                    @click="decide('rejected')"
                  >
                    Отклонить
                  </button>
                </div></template
              >
              <button
                v-if="
                  role !== 'office' &&
                  activeRecord.kind === 'booking' &&
                  activeRecord.status === 'pending'
                "
                class="campus-action"
                @click="
                  stack = [];
                  panel = 'booked';
                "
              >
                Мои заявки
              </button>
              <template
                v-if="role !== 'office' && activeRecord.kind === 'booking'"
                ><button
                  v-if="activeRecord.status === 'approved'"
                  class="text-link"
                  @click="
                    filter = 'Моё';
                    route(1);
                  "
                >
                  Открыть расписание ↗</button
                ><button
                  v-if="['pending', 'approved'].includes(activeRecord.status)"
                  :disabled="busy"
                  class="text-link"
                  @click="perform('cancel', { id: activeRecord.id })"
                >
                  Отменить заявку
                </button></template
              >
              <template
                v-if="
                  activeRecord.status === 'approved' &&
                  activeRecord.kind === 'document' &&
                  role !== 'office'
                "
                ><template
                  v-if="
                    activeRecord.format === 'Электронная' &&
                    activeRecord.expires
                  "
                  ><button
                    class="campus-action compact-action"
                    :disabled="Date.now() >= activeRecord.expires"
                    @click="download(activeRecord)"
                  >
                    Скачать PDF</button
                  ><small class="footnote"
                    >Ссылка действует 24 часа с момента выдачи, до
                    {{
                      new Date(activeRecord.expires).toLocaleString("ru-RU", {
                        timeZone: "Europe/Moscow",
                      })
                    }}
                    МСК.</small
                  ></template
                >
                <p v-else-if="activeRecord.format === 'Бумажная'">
                  Студенческий офис · Б-214. Часы приёма: по будням с 10:00 до
                  16:00.
                </p></template
              ></template
            >
            <template v-if="panel === 'marks' && activeMark"
              ><div
                class="finance-total mark-summary"
                :data-grade="gradeStyles[activeMark[0]]"
              >
                <small>{{ activeMark[1] }} · {{ activeMark[0] }}</small
                ><b>{{ totalMark[0] }} из {{ totalMark[1] }}</b>
              </div>
              <dl class="ledger">
                <div v-for="[n, s, m] in activeMark[3]" :key="n">
                  <dt>{{ n }}</dt>
                  <dd>{{ s }} / {{ m }}</dd>
                </div>
              </dl></template
            >
            <FinanceView
              v-if="panel === 'finance'"
              :role="role"
              :payments="payments"
            />
            <template v-if="panel === 'notices'"
              ><button class="text-link" @click="enablePush">
                Включить уведомления браузера
              </button>
              <p v-if="!notes.length">Писем пока нет.</p>
              <button
                v-for="n in notes"
                :key="n.id"
                class="notice-row"
                @click="openNote(n)"
              >
                <small
                  >{{ new Date(n.created).toLocaleDateString("ru-RU") }} ·
                  {{
                    n.ref?.startsWith("chat:") ? "Личные сообщения" : "Деканат"
                  }}</small
                ><b>{{ n.title }}</b>
              </button></template
            >
            <template v-if="panel === 'letter' && activeNote"
              ><small>Студенческий офис</small>
              <h3>{{ activeNote.title }}</h3>
              <p class="letter-text">{{ activeNote.body }}</p>
              <button
                v-if="activeNote.ref"
                class="text-link"
                @click="
                  openRecord(records.find((r) => r.id === activeNote.ref))
                "
              >
                Открыть обращение ↗
              </button></template
            >
            <form
              class="letter-form"
              v-if="panel === 'compose' && role === 'office'"
              @submit.prevent="sendLetter"
            >
              <label class="field"
                >Получатель<select v-model="letterTo">
                  <option
                    v-for="p in Object.values(people).filter(
                      (p) => p.id !== owner,
                    )"
                    :value="p.id"
                  >
                    {{ p.name }}
                  </option>
                </select></label
              ><label class="field"
                >Тема<input
                  v-model="letterSubject"
                  required
                  maxlength="140" /></label
              ><label class="field"
                >Текст письма<textarea
                  v-model="letterBody"
                  required
                  maxlength="12000"
                  rows="7"
                ></textarea></label
              ><button class="campus-action" :disabled="busy">
                Отправить письмо
              </button>
            </form>
            <template v-if="panel === 'wifi'"
              ><p>Сеть <b>Campus Study</b></p>
              <p>
                Логин <b>{{ owner }}.demo</b>
              </p>
              <div class="wifi-controls">
                <div class="wifi-field">
                  <label for="wifi-secret">Пароль учебной сети</label>
                  <div>
                    <input
                      id="wifi-secret"
                      readonly
                      spellcheck="false"
                      :type="reveal ? 'text' : 'password'"
                      :value="wifiPassword"
                    /><button
                      type="button"
                      :aria-label="reveal ? 'Скрыть пароль' : 'Показать пароль'"
                      :aria-pressed="reveal"
                      @click="reveal = !reveal"
                    >
                      <v-icon
                        :icon="reveal ? mdiEyeOffOutline : mdiEyeOutline"
                      />
                    </button>
                  </div>
                </div>
                <button
                  class="wifi-copy"
                  type="button"
                  aria-label="Скопировать пароль"
                  title="Скопировать пароль"
                  @click="copy"
                >
                  <v-icon :icon="mdiContentCopy" />
                </button>
              </div>
              <v-btn variant="text" @click="resetWifi"
                >Получить новый пароль</v-btn
              >
              <p
                v-if="wifiReadyAt > Date.now()"
                class="wifi-activation"
                role="status"
              >
                Новый пароль готов. Ориентировочное время активации —
                {{ wifiReadyTime }} МСК, через 5 минут после смены.
              </p></template
            >
            <template v-if="panel === 'profile'">
              <div class="identity">
                <div class="portrait">
                  <img v-if="avatar" :src="avatar" alt="Фото профиля" /><span
                    v-else
                    >{{ account.initials }}</span
                  >
                </div>
                <div>
                  <h3>{{ account.name }}</h3>
                  <small>{{ account.caption }}</small
                  ><button class="text-link" @click="avatarInput.click()">
                    Изменить фото
                  </button>
                </div>
              </div>
              <input
                hidden
                type="file"
                ref="avatarInput"
                accept="image/jpeg,image/png,image/webp"
                @change="changeAvatar"
              />
              <dl v-if="role === 'student'" class="student-facts">
                <div>
                  <dt>Направление</dt>
                  <dd>{{ account.program }}</dd>
                </div>
                <div>
                  <dt>Факультет</dt>
                  <dd>{{ account.faculty }}</dd>
                </div>
                <div>
                  <dt>Табельный номер</dt>
                  <dd>{{ account.number }}</dd>
                </div>
                <div>
                  <dt>Студенческий билет</dt>
                  <dd>№ {{ account.card }}</dd>
                </div>
              </dl>
              <button
                v-if="['teacher', 'student'].includes(role)"
                class="text-link"
                @click="open('finance')"
              >
                {{ financeName }} ↗
              </button>
              <button class="text-link" @click="goPage('structure')">
                Структура университета ↗
              </button>
              <button
                v-if="role === 'student'"
                class="text-link"
                @click="route(5)"
              >
                Учебный план ↗
              </button>
              <label class="theme-row"
                >Тёмная тема
                <button
                  role="switch"
                  aria-label="Тёмная тема"
                  :aria-checked="theme.global.name.value === 'Dark'"
                  @click="toggleTheme"
                >
                  <i></i></button></label
              ><button class="text-link" @click="exit">Сменить кабинет</button>
            </template>
          </article></transition
        >
      </div></v-dialog
    >
    <v-snackbar v-model="toast" :timeout="2200">{{ message }}</v-snackbar>
  </v-app>
</template>
