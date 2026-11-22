import { advanceServerClock, serverMinute } from "../shared/server-clock.js";
import demoAccess from "../shared/demo-access.json";
import LoginForm from "./LoginForm.jsx";
import RequestCorrection from "./RequestCorrection.jsx";
import ProfilePanel from "./ProfilePanel.jsx";
import useSlidingSelectors from "./use-sliding-selectors.js";
import { flushSync } from "react-dom";
import Irishka from "./Irishka.jsx";
import SettingsMenu, { DemoTimeInput } from "./SettingsMenu.jsx";
import {
  ArrowLeft, CalendarDays, ChevronRight, ClipboardList, LayoutGrid, Moon, Navigation, Sun, SunMoon, UsersRound,
} from "lucide-react";
import GlobalSearch from "./GlobalSearch.jsx";
import PhoneNavigation, { PhoneNavigatorIcon, usePhoneLayout } from "./PhoneNavigation.jsx";
import {
  mdiViewDashboardOutline,
  mdiCalendarMonthOutline,
  mdiSchoolOutline,
  mdiBookOpenPageVariantOutline,
  mdiApps,
  mdiArrowTopRight,
  mdiClose,
  mdiEyeOutline,
  mdiContentCopy,
  mdiEyeOffOutline,
  mdiEmailOutline,
  mdiArrowLeft,
  mdiMapMarkerOutline,
  mdiWifi,
  mdiFileDocumentOutline,
  mdiDoorOpen,
  mdiDumbbell,
  mdiClipboardOutline,
  mdiMapSearchOutline,
  mdiMessageTextOutline,
} from "@mdi/js";
import palette from "./palette.json";
import {
  overlaps,
  printDate,
  today,
  weekOf,
} from "../shared/timetable.js";
import PortalLoading, { PortalSection } from "./PortalLoading.jsx";
import { layoutForRoute } from "./portal-skeleton.js";
import LoginFrame from "./LoginFrame.jsx";
import { services } from "../shared/services.js";
import RequestList from "./RequestList.jsx";
import RequestSummary from "./RequestSummary.jsx";
import { serviceDesign } from "./service-design.js";
import { EventType, eventType } from "./EventType.jsx";
import LetterRecipient from "./LetterRecipient.jsx";
import LessonHero from "./LessonHero.jsx";
import LessonActions from "./LessonActions.jsx";
import LessonDetails, { lessonLocation } from "./LessonDetails.jsx";
import { campusSession } from "./campus-client.js";
import { browserNoticeHint } from "./notice-delivery.js";
import { routeDate, toCampusLocation } from "./campus-routes.js";
import {
  people,
  rooms,
  gym,
  facultyDirectory,
  publishedClasses,
  teachingDays,
  statuses,
} from "../shared/campus-data.js";
import { computed, useSignal } from "@preact/signals-react";
import { useState, useRef, useLayoutEffect, useEffect, Fragment, lazy } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import {
  useWatch,
  useMount,
  useCleanup,
  afterPaint,
  Icon,
  Dialog,
  Toast,
  classNames,
} from "./ui.jsx";

const CalendarView = lazy(() => import("./CalendarView.jsx"));
const CampusNavigator = lazy(() => import("./CampusNavigator.jsx"));
const FinanceView = lazy(() => import("./FinanceView.jsx"));
const OfficeSchedule = lazy(() => import("./OfficeSchedule.jsx"));
const OfficeTodo = lazy(() => import("./OfficeTodo.jsx"));
const RoomFinder = lazy(() => import("./RoomFinder.jsx"));
const ServiceCatalog = lazy(() => import("./ServiceCatalog.jsx"));
const ServiceForm = lazy(() => import("./ServiceForm.jsx"));
const StudyGrades = lazy(() => import("./StudyGrades.jsx"));
const UniversityHub = lazy(() => import("./UniversityHub.jsx"));
const WifiView = lazy(() => import("./WifiView.jsx"));

export default function App({ navigation }) {
  useSignals();
  useSlidingSelectors();
  const phone = usePhoneLayout();
  const noticeHint = browserNoticeHint();

  const {
    enablePush: subscribePush,
    stopDelivery,
    markRead,
    pushMode,
    payments,
    housing,
    grades,
    electives,
    wifi,
    owner,
    messages,
    teachingGroups,
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
    assistantApi,
    assistantSendStream,
    perform,
    download,
    bookings,
    schedule,
    lessonChanges,
    scheduleRevision,
  } = useState(() => campusSession(say, resetCabinet))[0];

  const password = useSignal("");
  const connectionIssue = useSignal(false);
  const loginCategory = useSignal("student");
  const demoIdentities = { student: ["student", "friend"], teacher: ["teacher"], dean: ["dean-data"], office: ["office"] };
  const loginRole = useSignal("student"),
    signing = useSignal(false);
  const account = computed(() => people[owner.value] || people.student);
  async function enter() {
    if (signing.value) return;
    signing.value = true;
    try {
      await login(loginRole.value, password.value);
      password.value = "";
    } catch (e) {
      if (token.value && !role.value) connectionIssue.value = true;
      say(e.message);
    } finally {
      signing.value = false;
    }
  }
  function resetCabinet() {
    close();
    tab.value = role.value === "office" ? 0 : 1;
    pages.value = [];
    filter.value = "Моё";
    lesson.value = null;
    activeMark.value = null;
    letterTo.value = "";
    letterSubject.value = "";
    letterBody.value = "";
    reason.value = "";
    password.value = "";
    connectionIssue.value = false;
    toast.value = false;
    void navigation.write({}, { replace: true });
  }
  async function reconnectCabinet() {
    if (!token.value) return;
    try {
      await refresh({ background: true });
      if (role.value) connectionIssue.value = false;
    } catch {
      if (token.value && !role.value) connectionIssue.value = true;
    }
  }
  useEffect(() => {
    void reconnectCabinet();
    const poll = setInterval(reconnectCabinet, 2000);
    return () => { clearInterval(poll); stopDelivery(); };
  }, []);
  const assetBase = import.meta.env.BASE_URL;
  const tabs = [
    ["Сегодня", mdiViewDashboardOutline],
    ["Расписание", mdiCalendarMonthOutline],
    ["Учёба", mdiSchoolOutline],
    ["Услуги", mdiFileDocumentOutline],
    ["Сервисы", mdiApps],
    ["Учебный план", mdiBookOpenPageVariantOutline],
  ];
  const themePreference = useSignal(localStorage.getItem("campus-theme") || "System");
  const themeTransition = useRef(null);
  useEffect(() => () => {
    themeTransition.current?.skipTransition();
    document.documentElement.classList.remove("theme-crossfade");
  }, []);
  const theme = useSignal(
      (themePreference.value !== "System" ? themePreference.value : null) ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light"),
    ),
    tab = useSignal(1),
    panel = useSignal(""),
    stack = useSignal([]),
    filter = useSignal("Моё"),
    lesson = useSignal(null);
  const navRef = useRef(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const selected = nav.querySelector('[aria-current="page"]');
    if (!selected) {
      delete nav.dataset.measured;
      return;
    }
    function alignIndicator() {
      const navBox = nav.getBoundingClientRect();
      const box = selected.getBoundingClientRect();
      nav.style.setProperty("--active-left", box.left - navBox.left + "px");
      nav.style.setProperty("--active-width", box.width + "px");
      nav.dataset.measured = "true";
    }
    alignIndicator();
    const resize = new ResizeObserver(alignIndicator);
    resize.observe(nav);
    for (const item of nav.children) resize.observe(item);
    return () => resize.disconnect();
  }, [role.value, tab.value, panel.value, phone]);
  const pages = useSignal([]);
  const calendarDate = useSignal(today());
  const page = computed(() => pages.value.at(-1));
  const pageNames = {
    docs: "Документы и заявления",
    directory: "Люди",
    person: "Карточка участника",
    chat: "Личный диалог",
    threads: "Чаты",
    navigator: "Навигатор",
    structure: "Структура университета",
    plan: "Учебный план",
    electives: "Выбор дисциплин",
    dorm: "Общежития",
    residence: "Карточка общежития",
    spaces: "Бронирование помещений",
    sports: "Спорт",
    booked: "Мои заявки",
    finance: "Выплаты",
    wifi: "Wi-Fi кампуса",
    "service-request": "Новое обращение",
  };
  function currentNavigation() {
    return { tab: tab.value, pages: pages.value, date: calendarDate.value === today() ? "" : calendarDate.value };
  }
  function updatePage(next, options) {
    close();
    if (page.value?.view === next.view && page.value.peer === next.peer) {
      pages.value = [...pages.value.slice(0,-1), next];
    } else {
      pages.value = [...pages.value, next];
    }
    void navigation.write(currentNavigation(), options);
    window.scrollTo(0, 0);
  }
  function goPage(view, peer = "") {
    updatePage({ view, peer });
  }
  function focusPageHeading() {
    afterPaint(() => heading.current?.focus({ preventScroll: true }));
  }
  function visibleTab(i) {
    return (
      role.value === "student" ||
      (role.value === "teacher" && i !== 2 && i !== 5) ||
      (role.value === "staff" && [0, 1, 4].includes(i)) ||
      (role.value === "office" && [0, 1, 4].includes(i))
    );
  }
  const campusItems = computed(() => [
    [mdiMapSearchOutline, "Навигатор", "Найти аудиторию или место в кампусе", "navigator"],
    [
      mdiSchoolOutline,
      "Люди",
      "Студенты, преподаватели и сотрудники",
      "directory",
    ],
    ...(["student", "teacher"].includes(role.value)
      ? [
          [
            mdiDoorOpen,
            "Бронирование помещений",
            "Аудитории и коворкинги",
            "spaces",
          ],
          [mdiDumbbell, "Спорт", "Расписание и запись в спортзал", "sports"],
        ]
      : []),
    ...(role.value === "student"
      ? [
          [
            mdiBookOpenPageVariantOutline,
            "Выбор дисциплин",
            "Курсы на следующий семестр",
            "electives",
          ],
        ]
      : []),
    [mdiMessageTextOutline, "Чаты", "Личные диалоги и сообщения учебным группам", "threads"],
    [mdiMapMarkerOutline, "Общежития", "Проживание, оплата и контакты", "dorm"],
  ]);
  function openLessonPage(view, peer, options = {}) {
    const lessonOrigin = { lessonId: lesson.value.id, panel: panel.value, stack: stack.value };
    if (panel.value === "room") lessonOrigin.date = roomDate.value;
    updatePage({ view, peer, ...options, lessonOrigin });
    afterPaint(() => heading.current?.focus({ preventScroll: true }));
  }
  function restoreLessonOrigin(entry) {
    const origin = entry?.lessonOrigin;
    if (!origin || lesson.value?.id !== origin.lessonId) return false;
    stack.value = origin.stack;
    panel.value = origin.panel;
    if (origin.date !== undefined) roomDate.value = origin.date;
    return true;
  }
  function leavePage() {
    const current = page.value;
    pages.value = pages.value.slice(0, -1);
    void navigation.back(currentNavigation());
    restoreLessonOrigin(current);
  }
  function applyNavigation(screen) {
    if (!role.value) return;
    const defaultTab = role.value === "office" ? 0 : 1;
    const restricted = screen?.pages.some(({ view, peer }) =>
      (["docs", "service-request", "electives"].includes(view) && role.value !== "student") ||
      (["spaces", "sports"].includes(view) && !["student", "teacher"].includes(role.value)) ||
      (view === "service-request" && !services.some(item => item.name === peer)) ||
      (["person", "chat"].includes(view) && !people[peer]) ||
      (view === "sports" && peer && peer !== gym?.short) ||
      (view === "spaces" && peer && !rooms.some(room => room.short === peer))
    );
    if (!screen || restricted || !visibleTab(screen.tab) || (screen.tab === 0 && role.value !== "office")) {
      close();
      pages.value = [];
      tab.value = defaultTab;
      calendarDate.value = today();
      void navigation.write(currentNavigation(), { replace: true, hash: location.hash });
      return;
    }
    if (JSON.stringify(currentNavigation()) !== JSON.stringify(screen)) {
      const originPage = screen.tab === tab.value &&
        JSON.stringify(screen.pages) === JSON.stringify(pages.value.slice(0, screen.pages.length))
        ? pages.value[screen.pages.length]
        : null;
      close();
      pages.value = screen.pages;
      tab.value = screen.tab;
      calendarDate.value = screen.date || today();
      if (["spaces", "sports"].includes(page.value?.view)) {
        roomInitial.value = { short: page.value.peer, date: page.value.date || today(), start: page.value.start };
      }
      if (!restoreLessonOrigin(originPage)) afterPaint(() => heading.current?.focus({ preventScroll: true }));
    }
  }
  const handleNavigation = useRef(applyNavigation);
  handleNavigation.current = applyNavigation;
  useEffect(() => navigation.subscribe(screen => handleNavigation.current(screen)), [navigation]);
  useLayoutEffect(() => {
    if (role.value) handleNavigation.current(navigation.read());
  }, [role.value, navigation]);
  useEffect(() => {
    if (!role.value) return;
    const openNoticeLink = () => { void openPendingNotice(); };
    openNoticeLink();
    window.addEventListener("hashchange", openNoticeLink);
    return () => window.removeEventListener("hashchange", openNoticeLink);
  }, [role.value, navigation]);
  function selectItem(k) {
    if (["spaces", "sports"].includes(k)) { roomInitial.value = null; goPage(k); }
    else if (pageNames[k]) goPage(k);
    else open(k);
  }
  function assistantLocation(action, detail) {
    if (action === "schedule") {
      return { tab: 1, date: routeDate(detail?.date) || today(), pages: [] };
    }
    if (action === "navigator") {
      const fromPlace = detail?.from?.id;
      const peer = detail?.to?.id || "";
      return { tab: 4, pages: [{ view: "navigator", peer, fromPlace, focusOnly: Boolean(peer && !fromPlace) }] };
    }
    if (["sports", "spaces", "docs", "booked", "directory"].includes(action)) {
      if ((action === "docs" && role.value !== "student") ||
          (["sports", "spaces"].includes(action) && !["student", "teacher"].includes(role.value))) return null;
      return { tab: 4, pages: [{ view: action, peer: "" }] };
    }
    const targetTab = ({ study: 2, services: 4, queue: 0, "office-tasks": 0 })[action];
    if (targetTab !== undefined && visibleTab(targetTab) && (targetTab !== 0 || role.value === "office")) {
      return { tab: targetTab, pages: [] };
    }
    const category = action === "search-result" ? detail?.category : "";
    const form = action === "document-form" ? detail?.name : detail?.serviceView === "service-request" ? detail.id : "";
    if (form && role.value === "student" && services.some(item => item.name === form)) {
      return { tab: 4, pages: [{ view: "docs", peer: "" }, { view: "service-request", peer: form }] };
    }
    if (category === "people" && Object.hasOwn(people, detail.id)) {
      return { tab: 4, pages: [{ view: "directory", peer: "" }, { view: "person", peer: detail.id }] };
    }
    if (category === "rooms" && detail.id) {
      return { tab: 4, pages: [{ view: "navigator", peer: detail.id, focusOnly: true }] };
    }
    if (category === "subjects") {
      return { tab: 1, date: routeDate(detail.date) || today(), pages: [] };
    }
    if (category === "services" && Object.hasOwn(pageNames, detail.serviceView) && detail.serviceView !== "service-request") {
      const view = detail.serviceView;
      return { tab: view === "electives" ? 5 : 4, pages: [{ view, peer: "" }] };
    }
    return null;
  }
  function assistantHref(action, detail) {
    const destination = assistantLocation(action, detail);
    return destination ? navigation.router.resolve(toCampusLocation(destination)).href : undefined;
  }
  function openAssistantAction(action, detail) {
    const destination = assistantLocation(action, detail);
    if (destination) {
      route(destination.tab, destination.date || today(), { navigate: !destination.pages.length });
      const target = destination.pages.at(-1);
      if (target) {
        pages.value = destination.pages.slice(0, -1);
        roomInitial.value = null;
        updatePage(target);
      } else if (action === "search-result" && detail.lessonId) {
        const lesson = schedule.value?.[destination.date]?.find(item => item.id === detail.lessonId);
        if (lesson) showEvent(lesson);
      } else if (action === "office-tasks") {
        afterPaint(() => document.getElementById("office-todo-title")?.focus());
      }
    } else if (action === "document-download" && detail?.id) {
      void download(detail);
    } else if (action === "notices") {
      open("notices");
    }
  }
  async function bookAssistantSport({ sport, short, date, time, end }) {
    const result = await perform("request", { kind: "booking", sport, short, date, time, end }, { throwOnError: true });
    if (!result?.record) throw new Error("Заявка не отправилась. Попробуйте ещё раз.");
    return result.record;
  }
  const shortcuts = {spaces: "Забронировать помещение", directory: "Найти человека", booked: "Мои заявки"};
  const shortcutOverrides = useSignal({});
  const shortcut = computed(() => shortcutOverrides.value[owner.value] ??
    localStorage.getItem("campus-shortcut:" + owner.value) ?? "");
  const lessons = computed(() => (schedule.value?.[today()] || []).filter(event=>!event.cancelled));
  const exam = computed(() =>
    ["2026-11-24", "2026-11-28"]
      .flatMap((d) => schedule.value?.[d] || [])
      .find((e) => e.type === "Экзамен"),
  );

  const directoryRows = computed(() => [
    ...new Map(
      weekOf(today()).flatMap(date=>publishedClasses(date,lessonChanges.value)).filter(event=>!event.cancelled).map((e) => [
        filter.value === "Преподаватели" ? e.teacher : e.room,
        e,
      ]),
    ).values(),
  ]);
  const scheduleDirectoryQuery = useSignal("");
  const scheduleDirectoryLimit = useSignal(24);
  const filteredDirectory = computed(() => {
    const fold = value => value.toLocaleLowerCase("ru").replaceAll("ё", "е");
    const words = fold(scheduleDirectoryQuery.value).trim().split(/\s+/);
    return directoryRows.value.filter(event => {
      const label = filter.value === "Преподаватели" ? event.teacher : event.room + " " + event.building.name;
      return words.every(word => fold(label).includes(word));
    });
  });
  const roomDate = useSignal(today()),
    roomInitial = useSignal(null);
  const venue = computed(() => lesson.value && lessonLocation(lesson.value));
  const pageBackLabel = computed(() => {
    const origin = page.value?.lessonOrigin;
    if (!origin || lesson.value?.id !== origin.lessonId) return "Назад";
    return { room: "К аудитории", lesson: "К занятию", teacher: "К преподавателю" }[origin.panel] || "Назад";
  });
  const roomEvents = computed(() =>
    roomDate.value
      ? [
          ...publishedClasses(roomDate.value,lessonChanges.value).filter(
            (e) => !e.cancelled && e.room === lesson.value.room,
          ),
          ...reservations.value
            .filter(
              (b) => b.short === lesson.value.room && b.date === roomDate.value,
            )
            .map((b) => ({
              ...b,
              id: b.short + b.time,
              name: "Бронь помещения",
              type: "Бронь",
              teacher: b.by,
            })),
        ].sort((a, b) => a.time.localeCompare(b.time))
      : [],
  );
  const instructor = computed(() =>
    Object.values(people).find(person => person.role === "teacher" && person.name === lesson.value?.teacher),
  );
  const faculty = computed(() => facultyDirectory[lesson.value?.teacher]);
  const teaching = computed(() => teachingDays(lesson.value.teacher,lessonChanges.value));
  const firstUpcoming = computed(
    () => teaching.value.find((d) => d.date >= today())?.date,
  );
  function jumpToClass() {
    const sheet = document.querySelector("dialog[open] .sheet");
    const day = sheet?.querySelector('.teacher-list [data-upcoming="true"]');
    if (day) {
      const header = sheet.querySelector(".sheet-top");
      sheet.scrollTop += day.getBoundingClientRect().top - sheet.getBoundingClientRect().top - header.offsetHeight;
    }
  }
  function toMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }
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
    demoMinute.value = demoClock.current
      ? Math.min(1439, demoClock.current.minute + Math.floor((performance.now() - demoClock.current.at) / 60000))
      : serverMinute();
  }
  function setDemoTime(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
    demoClock.current = {minute:toMinutes(value), at:performance.now()};
    updateClock();
  }
  useMount(() => {
    clockTimer = window.setInterval(updateClock, 1000);
  });
  useCleanup(() => window.clearInterval(clockTimer));
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
        ? teachingDays(account.value.name).find((day) => day.date > today())
            ?.events[0]
        : undefined),
  );
  const lessonInProgress = computed(() =>
    Boolean(
      nextLesson.value &&
        nextLesson.value.date === today() &&
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
    if (nextLesson.value.date !== today()) {
      const days =
        (Date.parse(nextLesson.value.date) - Date.parse(today())) / 86400000;
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
  const activeMark = useSignal(null);
  const reveal = useSignal(false),
    recordId = useSignal(""),
    noteId = useSignal(0);
  const activeRecord = computed(() =>
    records.value.find((r) => r.id === recordId.value),
  );
  const activeNote = computed(() =>
    notes.value.find((n) => n.id === noteId.value),
  );
  const unreadCount = computed(() => notes.value.filter((n) => !n.read).length);
  const topNotes = computed(() =>
    [...notes.value]
      .sort((a, b) => b.priority - a.priority || b.id - a.id)
      .slice(0, 3),
  );
  const docName = useSignal("");
  function chooseService(name) {
    docName.value = name;
    goPage("service-request", name);
  }
  const letterTo = useSignal(""),
    letterSubject = useSignal(""),
    letterBody = useSignal(""),
    reason = useSignal("");
  function openRecord(r) {
    if (!r) return;
    recordId.value = r.id;
    reason.value = "";
    open("record");
  }
  function openNote(n) {
    if (!n.read) void markRead(n.id);
    if (n.ref === "electives") {
      route(5, today(), { navigate: false });
      goPage("electives");
      return;
    }
    if (n.ref?.startsWith("chat:") && people[n.ref.slice(5)]) {
      route(4, today(), { navigate: false });
      pages.value = [{ view: "threads", peer: "" }];
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
  async function submitRequest(data, options) {
    const result = await perform("request", data, options);
    if (!result) return;
    if (data.kind === "document" && page.value?.view === "service-request") {
      pages.value = [...pages.value.slice(0, -1), { view: "booked", peer: "" }];
      void navigation.write(currentNavigation(), { replace: true });
      window.scrollTo(0, 0);
    }
    recordId.value = result.id;
    stack.value = [];
    panel.value = "record";
    say("Заявка направлена в деканат");
    return result;
  }
  async function caseReply(command, body = reason.value, attachment = null) {
    if (await perform(command, {
      id: recordId.value,
      body,
      ...(attachment ? { attachment } : {}),
    })) {
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
  const connectingPush = useSignal(false);
  async function enablePush() {
    if (connectingPush.value) return;
    connectingPush.value = true;
    try {
      await subscribePush();
    } catch (e) {
      say(e.message);
    } finally {
      connectingPush.value = false;
    }
  }
  function showIncoming(id) {
    const n = notes.value.find(n => n.id === id);
    if (n) openNote(n);
    else open("notices");
  }
  async function openPendingNotice() {
    const match = /^#(?:notices|notice-(\d+))$/.exec(location.hash);
    const recipient = owner.value;
    if (!match || !recipient) return;
    const failure = await navigation.write(currentNavigation(), { replace: true });
    if (!failure && owner.value === recipient) showIncoming(Number(match[1]));
  }
  function receivePush(e) {
    const msg = e.data;
    if (msg?.type === "campus-owner") {
      e.ports[0]?.postMessage(Boolean(owner.value && owner.value === msg.owner));
    } else if (msg?.type === "campus-refresh" && owner.value === msg.owner) {
      void refresh().catch(() => {});
    } else if (msg?.type === "campus-open" && owner.value === msg.owner) {
      void refresh().catch(() => {}).then(() => {
        if (owner.value === msg.owner) showIncoming(msg.id);
      });
    } else if (msg === "open-campus-notices") {
      if (owner.value) open("notices");
      else location.hash = "notices";
    }
  }
  useMount(() =>
    navigator.serviceWorker?.addEventListener("message", receivePush),
  );
  useCleanup(() =>
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
  const message = useSignal(""),
    toast = useSignal(false),
    heading = useRef(null);
  const studyRoot = useRef(null), studyScroll = useRef({}), studyRestore = useRef(null);
  const studyHeight = useSignal(0);
  function switchStudy(next) {
    if(next===tab.value) return;
    const current={top:window.scrollY,left:window.scrollX};
    studyScroll.current[tab.value]=current;
    const target=studyScroll.current[next] || current;
    const top=studyRoot.current.getBoundingClientRect().top+window.scrollY;
    studyHeight.value=Math.max(0,target.top+window.innerHeight-top+1);
    studyRestore.current=target;
    route(next);
  }
  useLayoutEffect(()=>{
    const target=studyRestore.current;
    if(!target) return;
    studyRestore.current=null;
    const restore=()=>window.scrollTo({...target,behavior:'instant'});
    restore();
    const frame=requestAnimationFrame(restore);
    return ()=>cancelAnimationFrame(frame);
  },[tab.value]);
  const colors = computed(() =>
    Object.fromEntries(
      Object.entries(palette[theme.value] || palette.Light).map(([k, v]) => [
        "--c-" + k,
        v,
      ]),
    ),
  );
  const titles = {
    letter: "Письмо деканата",
    compose: "Написать письмо",
    record: "Моё обращение",
    docs: "Документы и заявления",
    finance: "Выплаты",
    lesson: "Занятие",
    teacher: "Преподаватель",
    room: "Аудитория",
    spaces: "Бронирование помещений",
    sports: "Спорт",
    booking: "Бронирование",
    booked: "Мои заявки",
    doc: "Моя справка",
    request: "Новое обращение",
    submitted: "Моя заявка",
    settings: "Настройки",
    notices: "Уведомления",
    profile: "Профиль",
    wifi: "Wi-Fi кампуса",
  };
  const officeTab = panel.value === "compose" ? "compose" : tab.value === 4 ? "services" : tab.value === 1 ? "schedule" : "queue";
  const showDialog = computed(() => Boolean(role.value && panel.value));
  function open(key) {
    if (panel.value === key) return;
    if (panel.value) stack.value = [...stack.value, panel.value];
    if (key === "compose") letterTo.value = "";
    if (key === "room") roomDate.value = lesson.value?.date || today();
    panel.value = key;
  }
  function close() {
    panel.value = "";
    stack.value = [];
    reveal.value = false;
  }
  function back() {
    panel.value = stack.value.at(-1) || "";
    stack.value = stack.value.slice(0, -1);
  }
  function route(i, date = today(), { navigate = true } = {}) {
    if (i === 0 && role.value !== "office") i = 1;
    if (i === 3) i = 4;
    close();
    calendarDate.value = date;
    pages.value = [];
    tab.value = i;
    if (navigate) void navigation.write(currentNavigation());
    afterPaint(() => heading.current?.focus({ preventScroll: true }));
  }
  function showEvent(event, target = "lesson") {
    lesson.value = event;
    open(target);
  }
  function findRoom(short = "", date = today(), start) {
    roomInitial.value = { short, date, start };
    updatePage({ view: short === gym?.short ? "sports" : "spaces", peer: short, date, start: start || "" });
  }
  function changeBooking(changes, transition) {
    const current = page.value;
    const { short = current.peer, ...fields } = changes;
    const next = { ...current, ...fields, peer: short };
    const previous = pages.value.at(-2);
    if (["back", "buildings"].includes(transition) &&
      previous?.view === "spaces" && (previous.peer || "") === short &&
      (previous.building || "") === (next.building || "")) {
      leavePage();
      return;
    }
    const push = transition === "push";
    pages.value = [...(push ? pages.value : pages.value.slice(0, -1)), next];
    void navigation.write(currentNavigation(), { replace: !push });
    if (push || transition === "buildings") window.scrollTo(0, 0);
  }
  const homeAgenda = computed(() => {
    const entries = [
      ...lessons.value,
      ...bookings.value.filter((b) => b.date === today()),
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
  function agendaRow(entry) {
    return (
      <Fragment key={entry.id}>
        {entry.kind === "gap" ? (
          <div className={"rest-row"}>
            <div>
              <b>{"Свободное время"}</b>
              <small>
                {"Можно отдохнуть до "}
                {entry.end}
              </small>
            </div>
            <button
              onClick={(event) => {
                findRoom("", today(), entry.time);
              }}
              className={"text-link"}
            >
              {" Забронировать ↗ "}
            </button>
          </div>
        ) : entry.kind === "booking" ? (
          <button
            onClick={(event) => {
              openRecord(entry);
            }}
            data-event-type={eventType(entry)}
            className={classNames("record", {
              overlap: overlapsBooking(entry),
            })}
          >
            <em>{entry.time}</em>
            <span>
              <b>{entry.name}</b>
              <small>
                <EventType type="Бронь" />
                {" · Одобрена до "}
                {entry.end}
              </small>
            </span>
          </button>
        ) : (
          <button
            onClick={(event) => {
              showEvent(entry);
            }}
            data-event-type={eventType(entry)}
            className={classNames("record", {
              overlap: overlapsBooking(entry),
            })}
          >
            <em>{entry.time}</em>
            <span>
              <b>{entry.name}</b>
              <small>
                {role.value === "teacher" ? (
                  <b className={"inline-group"}>
                    {entry.group}
                    {" · "}
                  </b>
                ) : null}
                <EventType type={eventType(entry)} />
                {" · "}
                {entry.room}
              </small>
              {overlapsBooking(entry) ? (
                <span className={"agenda-overlap"}>
                  {"Совпадает по времени"}
                </span>
              ) : null}
            </span>
          </button>
        )}
      </Fragment>
    );
  }
  function examBlock() {
    if (!exam.value || role.value !== "student") return null;
    return (
      <Fragment>
        <h2>{"Экзамен"}</h2>
        <button
          onClick={(event) => {
            showEvent(exam.value);
          }}
          data-event-type="Экзамен"
          className={"record"}
        >
          <em>
            {printDate(exam.value.date, {
              day: "numeric",
              month: "short",
            })}
          </em>
          <span>
            <b>{exam.value.name}</b>
            <small>
              <EventType type="Экзамен" />
              {" · "}
              {exam.value.room}
            </small>
          </span>
        </button>
      </Fragment>
    );
  }
  function overlapsBooking(entry) {
    return homeAgenda.value.some(
      (e) => e.kind !== "gap" && e.id !== entry.id && overlaps(entry, e),
    );
  }
  function say(text) {
    message.value = text;
    toast.value = true;
  }
  function applyTheme(value, preference) {
    const update = () => flushSync(() => {
      if (preference !== undefined) themePreference.value = preference;
      theme.value = value;
    });
    themeTransition.current?.skipTransition();
    if (theme.value === value || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update();
      return;
    }
    document.documentElement.classList.add("theme-crossfade");
    const transition = document.startViewTransition(update);
    themeTransition.current = transition;
    transition.ready.catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      if (themeTransition.current !== transition) return;
      themeTransition.current = null;
      document.documentElement.classList.remove("theme-crossfade");
    });
  }
  function setAppearance(value) {
    applyTheme(value === "System" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light") : value, value);
    localStorage.setItem("campus-theme", value);
  }
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => {
      if (themePreference.value === "System") applyTheme(media.matches ? "Dark" : "Light");
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

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
    const result = await perform("reset-wifi", {});
    if (result) say("Новый пароль готов. Активация примерно через 5 минут.");
    return Boolean(result);
  }
  const avatar = computed(() => avatars.value[owner.value] || "");
  async function changeAvatar(event) {
    const auth = token.value;
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
      if (auth !== token.value) return;
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
      if (await perform("avatar", { image: data }))
        say("Фото профиля обновлено");
    } catch {
      if (auth === token.value) say("Не удалось сохранить фото");
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
  useWatch(panel, () => {
    reveal.value = false;
  });
  const routeLayout = layoutForRoute({ tab: tab.value, pages: pages.value }, role.value);

  const themeName = { Light: "светлая", Dark: "тёмная", System: "автоматическая" }[themePreference.value];
  const ThemeIcon = { Light: Sun, Dark: Moon, System: SunMoon }[themePreference.value] || SunMoon;
  const settingsMenu = (
    <SettingsMenu phone={phone} themeButton={
      <button type="button" aria-label={"Тема: " + themeName} title="Сменить тему: светлая, тёмная, автоматическая"
        onClick={() => setAppearance(({ Light: "Dark", Dark: "System", System: "Light" })[themePreference.value] || "Light")}>
        <ThemeIcon size={20} strokeWidth={1.6} aria-hidden="true" />
        {phone && <span>Тема · {themeName}</span>}
      </button>
    }>{dismiss => (
      <div className="settings-list">
        <button className="record" onClick={() => { dismiss(); open("notices"); }}>
          <span><b>Уведомления</b><small>Непрочитанных: {unreadCount.value}</small></span>
          <ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <button className="record" onClick={() => { dismiss(); open("profile"); }}>
          <span><b>Профиль</b><small>Фото и данные аккаунта</small></span>
          <ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <details className="demo-disclosure">
          <summary><span>Демонстрационные данные</span><ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" /></summary>
          <div className="demo-settings">
            {!phone && <div className="demo-time-field">
              <span>Время для демонстрации</span>
              <DemoTimeInput value={demoTime.value} onChange={setDemoTime} />
            </div>}
            <button onClick={logout} className="demo-switch">Сменить кабинет<ChevronRight size={17} strokeWidth={1.6} aria-hidden="true" /></button>
          </div>
        </details>
        <small className="settings-prototype-label">Конкурсный прототип</small>
      </div>
    )}</SettingsMenu>
  );
  const assistant = (
    <Irishka phone={phone} key={owner.value} ownerId={owner.value} request={assistantApi} sendStream={assistantSendStream}
                    onBookSport={bookAssistantSport} sportsBookings={records.value.filter(record => record.sport)}
                    name={account.value.name} role={role.value} onAction={openAssistantAction} actionHref={assistantHref} />
  );
  function openPhoneTab(destination) {
    route(destination);
    window.scrollTo(0, 0);
  }
  const peopleShortcut = !["student", "office"].includes(role.value);
  const peoplePage = peopleShortcut && ["directory", "person", "structure"].includes(page.value?.view);
  const studentNavigator = role.value === "student" && page.value?.view === "navigator";
  const secondaryPhoneTab = role.value === "office"
    ? { label: "Обращения", Icon: ClipboardList, active: tab.value === 0, onSelect: () => openPhoneTab(0) }
    : peopleShortcut
      ? { label: "Люди", Icon: UsersRound, active: peoplePage, onSelect: () => {
        if (page.value?.view === "directory" && !page.value.peer) {
          window.scrollTo(0, 0);
          return;
        }
        route(4, today(), { navigate: false });
        goPage("directory");
      } }
      : { label: "Навигатор", Icon: PhoneNavigatorIcon, active: studentNavigator, onSelect: () => {
        if (studentNavigator) { window.scrollTo(0, 0); return; }
        route(4, today(), { navigate: false });
        goPage("navigator");
      } };
  const schedulePhoneTab = { label: "Расписание", Icon: CalendarDays, active: tab.value === 1 && !peoplePage && !studentNavigator, onSelect: () => openPhoneTab(1) };
  const phoneTabs = [
    ...(role.value === "office" ? [secondaryPhoneTab, schedulePhoneTab] : [schedulePhoneTab, secondaryPhoneTab]),
    { label: "Сервисы", Icon: LayoutGrid, active: (tab.value === 4 || (role.value === "student" && [2,5].includes(tab.value))) && !peoplePage && !studentNavigator, onSelect: () => openPhoneTab(4) },
  ];


  return (
    <>
      <div
        style={colors.value}
        className={classNames("v-application", "v-theme--" + theme.value)}
      >
        {!role.value && token.value && !signing.value ? (
          <PortalLoading wide layout={layoutForRoute(navigation.read(), sessionStorage.getItem("atlas-layout-role") || loginCategory.value)}
            title="Восстанавливаем кабинет"
            onRetry={connectionIssue.value ? reconnectCabinet : undefined}
            onExit={connectionIssue.value ? logout : undefined} />
        ) : !role.value ? (
          <LoginFrame style={colors.value}>
            <LoginForm people={people} busy={signing.value} onLogin={(identity, secret) => {
              loginRole.value = identity;
              password.value = secret;
              enter();
            }} />
          </LoginFrame>
        ) : (
          <div
            className={classNames("shell", {
              "faculty-shell": role.value !== "student",
              "phone-shell": phone,
            })}
          >
            <aside className={"rail"}>
              {!phone && <img className="header-logo" src={assetBase + "itech-logo.png"} alt="iTECH" width="80" height="28" />}
              {!phone && (role.value === "office" ? (
                <nav ref={navRef} className="office-navigation" aria-label="Навигация кабинета">
                  {[
                    ["queue", "Обращения", mdiClipboardOutline],
                    ["schedule", "Расписание", mdiCalendarMonthOutline],
                    ["compose", "Письма", mdiEmailOutline],
                    ["services", "Сервисы", mdiApps],
                  ].map(([key, label, ico]) => (
                    <button
                      aria-current={officeTab === key ? "page" : undefined}
                      onClick={(event) => {
                        key === "services"
                          ? route(4)
                          : key === "queue"
                            ? route(0)
                            : key === "schedule"
                              ? route(1)
                              : open("compose");
                      }}
                      key={key}
                      className={classNames({active: officeTab === key})}
                    >
                      <Icon icon={ico} />
                      {label}
                    </button>
                  ))}
                </nav>
              ) : (
                <nav ref={navRef} aria-label="Навигация кабинета">
                  {[1, 2, 4].map((i) => (
                    <button
                      key={i}
                      hidden={!visibleTab(i)}
                      aria-current={(tab.value === i || (i === 2 && tab.value === 5)) ? "page" : undefined}
                      onClick={(event) => {
                        route(i);
                      }}
                      className={classNames({
                        active: tab.value === i || (i === 2 && tab.value === 5),
                      })}
                    >
                      <Icon icon={tabs[i][1]} />
                      {tabs[i][0]}
                    </button>
                  ))}
                </nav>
              ))}
                <div className={"tools"}>
                  <GlobalSearch people={people} schedule={schedule.value} services={[...serviceItems.value, ...campusItems.value]} rooms={rooms}
                    onPerson={id => { goPage("person", id); focusPageHeading(); }}
                    onRoom={short => { updatePage({ view: "navigator", peer: short, focusOnly: true }); focusPageHeading(); }}
                    onLesson={event => { route(1, event.date); showEvent(event); }}
                    onService={id => { selectItem(id); focusPageHeading(); }} />
                  <div className="irishka-controls">
                  {!phone && assistant}
                  {settingsMenu}
                  </div>
                </div>
            </aside>
            <main>
              <div ref={studyRoot} className={classNames("workspace-start",{"study-workspace":!page.value && [2,5].includes(tab.value)})} style={{minHeight:!page.value && [2,5].includes(tab.value) ? studyHeight.value || undefined : undefined}}>
              <header
                className={classNames({
                  "hub-heading": page.value,
                  "study-root-heading": !page.value && [2,5].includes(tab.value),
                })}
              >
                <div>
                  <p className={tab.value === 0 ? "date today-date" : "date"}>
                    {
                      [
                        printDate(today(), {weekday:"long",day:"numeric",month:"long"}),
                        "Осенний семестр · 2026",
                        "Курс 2 · Семестр 3",
                        "Студенческий офис",
                        "Кампус",
                        "Образовательная программа",
                      ][tab.value]
                    }
                  </p>
                  {["wifi","docs","service-request","booked","directory","person","navigator","finance","spaces","sports","dorm","residence"].includes(page.value?.view) &&
                    <button className={page.value.view === "wifi" ? "wifi-page-back" : "docs-page-back"}
                      data-map-home={page.value.view === "navigator" && !page.value.peer ? true : undefined}
                      onClick={leavePage}><ArrowLeft size={15} />{pageBackLabel.value}</button>}
                  {page.value?.view !== "person" && <h1 ref={heading} tabIndex="-1">
                    {page.value
                      ? page.value.view === "finance" ? financeName.value : page.value.view === "service-request" ? page.value.peer : pageNames[page.value.view]
                      : role.value === "office" && tab.value === 0
                        ? "Деканат"
                        : [2,5].includes(tab.value) ? "Учёба" : tabs[tab.value][0]}
                  </h1>}
                </div>

              </header>
              {!page.value && [2,5].includes(tab.value) && <div className="study-toolbar"><div className="study-tabs" aria-label="Раздел учёбы"><button aria-current={tab.value===2 ? "page" : undefined} onClick={()=>switchStudy(2)}>Зачётка</button><button aria-current={tab.value===5 ? "page" : undefined} onClick={()=>switchStudy(5)}>Учебный план</button></div></div>}
              <Fragment>
                <section key={page.value ? page.value.view + "/" + page.value.peer : tab.value} className={classNames("view campus-route-view", {"service-page":Boolean(page.value),"study-pane":!page.value && [2,5].includes(tab.value)})} data-service={page.value?.view} style={{"--service-accent":serviceDesign[page.value?.view]?.color}}>
                  <PortalSection layout={routeLayout}>
                  {["spaces", "sports", "booked", "finance", "wifi", "service-request"].includes(page.value?.view) ? (
                    <>
                      {!["wifi","booked","sports"].includes(page.value.view) && serviceDesign[page.value.view]?.description && <p className="service-page-intro">{serviceDesign[page.value.view].description}</p>}
                      {["spaces", "sports"].includes(page.value.view) && <RoomFinder
                        sportsOnly={page.value.view === "sports"} schedule={schedule.value}
                        initial={{ ...page.value, short:page.value.peer || "" }}
                        onNavigate={page.value.view === "spaces" || page.value.peer && page.value.peer === gym?.short ? changeBooking : undefined}
                        reservations={reservations.value} lessonChanges={lessonChanges.value} role={role.value} owner={owner.value} busy={busy.value} onSend={submitRequest}/>
                      }
                      {page.value.view === "booked" && <section className="service-surface requests-page"><div className="service-card-heading"><h2>История обращений</h2></div><RequestList records={records.value} onSelect={openRecord}/></section>}
                      {page.value.view === "finance" && <FinanceView role={role.value} payments={payments.value}/>}
                      {page.value.view === "wifi" && <WifiView owner={owner.value} password={wifiPassword.value} readyAt={wifiReadyAt.value} readyTime={wifiReadyTime.value} busy={busy.value} onReset={resetWifi} onMessage={say}/>}
                      {page.value.view === "service-request" && <div className="service-surface service-form-page"><ServiceForm key={page.value.peer} housing={housing.value} records={records.value} onRecord={openRecord} name={page.value.peer} person={account.value} busy={busy.value} onSubmit={submitRequest}/></div>}
                    </>
                  ) : page.value?.view === "navigator" ? (
                    <CampusNavigator
                      initialRoom={page.value.peer || ""}
                      initialOrigin={page.value.fromPlace}
                      initialFocusOnly={page.value.focusOnly}
                      initialFromEntrance={page.value.fromEntrance}
                      initialDate={page.value.date || today()}
                      reservations={reservations.value}
                      lessonChanges={lessonChanges.value}
                      onRoom={["student", "teacher"].includes(role.value)
                        ? (short, date) => findRoom(short, date || page.value.date || today())
                        : undefined}
                    />
                  ) : page.value || tab.value === 5 ? (
                    <Fragment>
                    <UniversityHub
                      view={page.value?.view || "plan"}
                      peer={page.value?.peer || ""}
                      rootPlan={tab.value === 5 && !page.value}
                      housing={housing.value}
                      electives={electives.value}
                      owner={owner.value}
                      messages={messages.value}
                      teachingGroups={teachingGroups.value}
                      lessonChanges={lessonChanges.value}
                      avatars={avatars.value}
                      records={records.value}
                      busy={busy.value}
                      send={perform}
                      onGo={goPage}
                      onBack={leavePage}
                      onRecord={openRecord}
                      onRequest={chooseService}
                    />
                    </Fragment>
                  ) : role.value === "office" && tab.value === 0 ? (
                    <section className={"content"}>
                      <OfficeTodo key={owner.value} request={assistantApi} records={records.value} onRecord={openRecord} />
                      <button
                        onClick={(event) => {
                          open("compose");
                        }}
                        className={"campus-action"}
                      >
                        {" Написать письмо "}
                      </button>
                      <h2>{"Обращения"}</h2>
                      {!records.value.length ? (
                        <p>{"Обращений пока нет."}</p>
                      ) : null}
                      {records.value.map((r) => (
                        <button
                          key={r.id}
                          onClick={(event) => {
                            openRecord(r);
                          }}
                          className={"case-row"}
                        >
                          <span>
                            <b>{r.name}</b>
                            <small>
                              {people[r.owner]?.name || "Архивный кабинет"}
                              {" · "}
                              {r.kind === "booking"
                                ? r.date + " · " + r.time + "–" + r.end
                                : r.format}
                            </small>
                          </span>
                          <i className={classNames("badge " + r.status)}>
                            {statuses[r.status]}
                          </i>
                        </button>
                      ))}
                    </section>
                  ) : tab.value === 0 ? (
                    <div className={"dashboard"}>
                      {nextLesson.value ? (
                        <LessonHero
                          nextLesson={nextLesson.value}
                          faculty={role.value === "teacher"}
                          lessonInProgress={lessonInProgress.value}
                          countdown={countdown.value}
                          onLesson={(event) => {
                            showEvent(nextLesson.value);
                          }}
                          onRoom={(event) => {
                            showEvent(nextLesson.value, "room");
                          }}
                          onTeacher={(event) => {
                            showEvent(nextLesson.value, "teacher");
                          }}
                        />
                      ) : (
                        <div className={"day-complete"}>
                          <h2>
                            {lessons.value.length
                              ? "Пары на сегодня закончились"
                              : "На сегодня обязательных занятий нет"}
                          </h2>
                        </div>
                      )}
                      <div className={"agenda"}>
                        <div className={"agenda-title"}>
                          <h2>{"Мой день"}</h2>
                          <button
                            onClick={(event) => {
                              route(1);
                            }}
                            className={"text-link"}
                          >
                            {" Расписание "}
                            <Icon icon={mdiArrowTopRight} />
                          </button>
                        </div>
                        {homeAgenda.value.map(agendaRow)}
                        {shortcuts[shortcut.value] && (
                          <button className="pinned-action" onClick={() => selectItem(shortcut.value)}>
                            {shortcuts[shortcut.value]} <Icon icon={mdiArrowTopRight} />
                          </button>
                        )}
                      </div>
                      <aside className={"office"}>
                        <h2>
                          {role.value === "student"
                            ? "Студенческий офис"
                            : "Деканат"}
                        </h2>
                        {topNotes.value.map((n) => (
                          <button
                            key={n.id}
                            onClick={(event) => {
                              openNote(n);
                            }}
                            className={"notice-row"}
                          >
                            <small>
                              {n.ref?.startsWith("chat:") &&
                              people[n.ref.slice(5)]
                                ? "Личные сообщения"
                                : "Деканат"}
                            </small>
                            <b>{n.title}</b>
                          </button>
                        ))}
                        <button
                          onClick={(event) => {
                            open("notices");
                          }}
                          className={"text-link"}
                        >
                          {" Все уведомления ↗ "}
                        </button>
                        {role.value === "teacher" ? (
                          <button
                            onClick={(event) => {
                              route(4, today(), { navigate: false });
                              goPage("directory");
                            }}
                            className={"text-link"}
                          >
                            {" Найти студента ↗ "}
                          </button>
                        ) : null}
                        {examBlock()}
                      </aside>
                    </div>
                  ) : tab.value === 1 && role.value === "office" ? (
                    <OfficeSchedule request={assistantApi} revision={scheduleRevision.value} onLesson={showEvent}/>
                  ) : tab.value === 1 ? (
                    <div
                      className={classNames("content", {
                        wide: filter.value === "Моё",
                      })}
                    >
                      {filter.value === "Моё" ? (
                        <CalendarView
                          initialDate={calendarDate.value}
                          onDateChange={date => {
                            calendarDate.value = date;
                            void navigation.write(currentNavigation(), { replace: true });
                          }}
                          schedule={schedule.value}
                          bookings={bookings.value}
                          role={role.value}
                          owner={owner.value}
                          demoMinute={demoMinute.value}
                          onLesson={showEvent}
                          onBooking={openRecord}
                          onSpaces={(d) => findRoom("", d)}
                        />
                      ) : (
                        <Fragment>
                          <h2>{filter.value}</h2>
                          <label className="hub-search">
                            <input type="search" aria-label="Поиск в расписаниях"
                              placeholder={filter.value === "Преподаватели" ? "Фамилия, имя или отчество" : "Аудитория или корпус"}
                              value={scheduleDirectoryQuery.value} onChange={event => {
                                scheduleDirectoryQuery.value = event.target.value;
                                scheduleDirectoryLimit.value = 24;
                              }} />
                          </label>
                          {filteredDirectory.value.length === 0 && <p>Совпадений нет.</p>}
                          {filteredDirectory.value.slice(0, scheduleDirectoryLimit.value).map((l, i) => (
                            <button
                              key={i}
                              onClick={(event) => {
                                showEvent(
                                  l,
                                  filter.value === "Преподаватели"
                                    ? "teacher"
                                    : "room",
                                );
                              }}
                              className={"record"}
                            >
                              <em>
                                {filter.value === "Преподаватели"
                                  ? "Ведёт"
                                  : l.building.name}
                              </em>
                              <span>
                                <b>
                                  {filter.value === "Преподаватели"
                                    ? l.teacher
                                    : l.room}
                                </b>
                                <small>{l.name}</small>
                              </span>
                            </button>
                          ))}
                          {filteredDirectory.value.length > scheduleDirectoryLimit.value && (
                            <button className="directory-more" onClick={() => { scheduleDirectoryLimit.value += 24; }}>Показать ещё</button>
                          )}
                        </Fragment>
                      )}
                    </div>
                  ) : tab.value === 2 ? (
                    <StudyGrades
                      grades={grades.value}
                      expandedCourse={activeMark.value}
                      onSelect={name => { activeMark.value = activeMark.value === name ? null : name; }}
                    />
                  ) : tab.value === 4 ? (
                    <ServiceCatalog onSelect={key => key === "study" ? openPhoneTab(2) : selectItem(key)} groups={[
                        { title:null, items:[...(phone && role.value === "student" ? [[mdiSchoolOutline, "Учёба", "Оценки и учебный план", "study"]] : []), ...serviceItems.value.filter(item => !["docs", "booked", "finance"].includes(item[3])), ...campusItems.value.filter(item => !["dorm", "electives", "directory", "threads", ...(phone && role.value === "student" ? ["navigator"] : [])].includes(item[3]))].sort((a,b)=>["study","wifi","sports","spaces","navigator"].indexOf(a[3])-["study","wifi","sports","spaces","navigator"].indexOf(b[3])), kind:"campus" },
                        { title:"Заявки", items:serviceItems.value.filter(item => ["docs", "booked"].includes(item[3])), kind:"requests" },
                        { title:"Студенческая жизнь", items:[...serviceItems.value.filter(item => item[3] === "finance"), ...campusItems.value.filter(item => ["dorm", "electives", "directory", "threads"].includes(item[3]))], kind:"life" },
                      ]}/>
                  ) : (
                    <div className="content services-layout">
                      <div className={"service-catalog"}>
                        {(tab.value === 4
                          ? [...serviceItems.value, ...campusItems.value]
                          : serviceItems.value
                        ).map((item) => (
                          <button
                            key={item[1]}
                            onClick={(event) => {
                              selectItem(item[3]);
                            }}
                            className={classNames("record", {
                              "mobile-requests": item[3] === "booked",
                            })}
                          >
                            <em>
                              <Icon icon={item[0]} />
                            </em>
                            <span>
                              <b>{item[1]}</b>
                              <small>{item[2]}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                      {tab.value === 3 ? (
                        <aside className={"services-requests"}>
                          <h2>{"Мои заявки"}</h2>
                          <RequestList
                            records={records.value}
                            onSelect={openRecord}
                          />
                        </aside>
                      ) : null}
                    </div>
                  )}
                  </PortalSection>
                </section>
              </Fragment>
              </div>

            </main>
            {phone && <PhoneNavigation items={phoneTabs} assistant={assistant} />}
          </div>
        )}
        <Dialog
          className={["notices", "letter"].includes(panel.value) ? "notices-dialog" : panel.value === "lesson" ? "lesson-dialog" : panel.value === "profile" ? "profile-dialog" : panel.value === "record" ? "request-dialog" : ""}
          label={panel.value === "notices" ? "Уведомления" : panel.value === "letter" ? "Уведомление" : panel.value === "profile" ? "Профиль" : panel.value === "record" ? "Заявка" : "Карточка кабинета"}
          focusSelf={["profile","record","lesson","notices","letter"].includes(panel.value)}
          open={showDialog.value}
          onClose={close}
          maxWidth={
            ["lesson", "notices", "letter"].includes(panel.value)
              ? "100vw"
              : panel.value === "spaces"
              ? 1140
              : panel.value === "finance"
                ? 790
                : panel.value === "teacher"
                  ? 600
                  : 480
          }
        >
          <div className="sheet">
            <div className={"sheet-top"}>
              {stack.value.length ? (
                <button onClick={back} aria-label="Назад" className={"circle"}>
                  <Icon icon={mdiArrowLeft} />
                </button>
              ) : null}
              {panel.value === "notices" ? <h2>Уведомления</h2> : panel.value === "letter" ? <h2>Уведомление</h2> : panel.value === "profile" ? <h2>Профиль</h2> : panel.value === "record" ? <h2>Заявка</h2> : <small>{panel.value === "lesson" ? "Занятие" : "Цифровой деканат"}</small>}
              <button
                onClick={close}
                aria-label="Закрыть"
                className={"circle close"}
              >
                <Icon icon={mdiClose} />
              </button>
            </div>
            <Fragment>
              <article key={panel.value}>
                <h2 hidden={["profile","record","lesson","notices","letter"].includes(panel.value)}>
                  {panel.value === "finance"
                    ? financeName.value
                    : panel.value === "record" && role.value === "office"
                      ? "Обращение"
                      : panel.value === "request"
                        ? docName.value
                        : titles[panel.value]}
                </h2>
                {panel.value === "lesson" ? (
                  <Fragment>
                    <LessonDetails
                      lesson={lesson.value}
                      instructor={instructor.value}
                      onRoom={() => open("room")}
                      onRoute={() => openLessonPage("navigator", lesson.value.room, {date:lesson.value.date,fromEntrance:true})}
                      onInstructor={instructor.value ? () => openLessonPage("person", instructor.value.id) : undefined}
                      onInstructorSchedule={() => open("teacher")}
                      onGroup={role.value === "teacher" ? () => goPage("directory", lesson.value.group) : undefined}
                    >
                    <LessonActions lesson={lesson.value} key={lesson.value.id} busy={busy.value}
                      onPublish={async (action,data)=>{
                        const result = await perform("teaching/lesson/" + action,data);
                        if (result) {
                          lesson.value=result.lesson;
                          say(action === "homework" ? "Задание отправлено группе" : action === "cancel" ? "Отмена опубликована" : "Перенос опубликован");
                        }
                        return result;
                      }}/>
                    </LessonDetails>
                  </Fragment>
                ) : null}
                {panel.value === "teacher" ? (
                  <Fragment>
                    <div className={"identity"}>
                      <div className={"portrait"}>
                        {avatars.value[instructor.value?.id] ? (
                          <img
                            src={avatars.value[instructor.value?.id]}
                            alt="Фото преподавателя"
                          />
                        ) : (
                          <span>
                            {lesson.value.teacher
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3>{lesson.value.teacher}</h3>
                        {faculty.value ? (
                          <Fragment>
                            <b className={"faculty-post"}>
                              {faculty.value.position}
                            </b>
                            <small>{faculty.value.faculties.join(" · ")}</small>
                            <small>{faculty.value.teaching}</small>
                          </Fragment>
                        ) : null}
                      </div>
                    </div>
                    {instructor.value && (
                      <button type="button" className="text-link lesson-instructor-schedule"
                        onClick={() => openLessonPage("person", instructor.value.id)}>
                        Открыть профиль преподавателя
                      </button>
                    )}
                    <h3 className={"faculty-agenda-title"}>
                      {"Расписание · осенний семестр"}
                    </h3>
                    <button onClick={jumpToClass} className={"text-link"}>
                      {" К ближайшему занятию ↓ "}
                    </button>
                    <div className={"teacher-list"}>
                      {teaching.value.map((d) => (
                        <section
                          key={d.date}
                          data-upcoming={d.date === firstUpcoming.value}
                        >
                          <h3>
                            {printDate(d.date, {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </h3>
                          {d.events.map((e) => (
                            <button
                              key={e.id}
                              onClick={(event) => {
                                showEvent(e);
                              }}
                              data-event-type={eventType(e)}
                              className={"record"}
                            >
                              <em>{e.time}</em>
                              <span>
                                <b>{e.name}</b>
                                <small>
                                  <EventType type={eventType(e)} /> · {e.time}
                                  {"–"}
                                  {e.end}
                                  {" · "}
                                  {e.group}
                                  {" · "}
                                  {e.room}
                                </small>
                              </span>
                            </button>
                          ))}
                        </section>
                      ))}
                    </div>
                  </Fragment>
                ) : null}
                {panel.value === "room" ? (
                  <Fragment>
                    <div className={"room-ident"}>
                      <div>
                        <small>{lesson.value.building.name}</small>
                        <h3>
                          {"Аудитория "}
                          {lesson.value.room}
                        </h3>
                        <small className="lesson-room-location">
                          {[venue.value.floor, venue.value.address].filter(Boolean).join(" · ")}
                        </small>
                      </div>
                      <img
                        src={assetBase + lesson.value.building.image}
                        alt=""
                      />
                    </div>
                    <button type="button" className="campus-action room-route-action" onClick={() => {
                      openLessonPage("navigator", lesson.value.room, { date: roomDate.value, fromEntrance: true });
                    }}>
                      <Navigation size={18} aria-hidden="true" /> Проложить маршрут
                    </button>
                    <label className={"field"}>
                      {"Занятость на дату"}
                      <input
                        type="date"
                        value={roomDate.value ?? ""}
                        onChange={(event) => {
                          roomDate.value = event.target.value;
                        }}
                      />
                    </label>
                    {roomEvents.value.map((e) => (
                      <div key={e.id} className={"record"} data-event-type={eventType(e)}>
                        <em>{e.time}</em>
                        <span>
                          <b>{e.name}</b>
                          <small>
                            <EventType type={eventType(e)} /> · {e.time}
                            {"–"}
                            {e.end}
                            {" · "}
                            {e.teacher}
                          </small>
                        </span>
                      </div>
                    ))}
                    {!roomEvents.value.length ? (
                      <p>
                        {
                          " На выбранную дату занятий и подтверждённых броней нет. "
                        }
                      </p>
                    ) : null}
                    {["student", "teacher"].includes(role.value) && (
                      <button type="button" onClick={() => findRoom(lesson.value.room, roomDate.value)}
                        disabled={!roomDate.value || roomDate.value < today() || roomDate.value > "2026-12-28"}
                        className="campus-action">
                        Выбрать время
                      </button>
                    )}
                  </Fragment>
                ) : null}
                {["spaces", "sports"].includes(panel.value) ? (
                  <PortalSection layout={panel.value === "sports" ? "sports" : "booking"}>
                    <RoomFinder
                      key={panel.value}
                      sportsOnly={panel.value === "sports"}
                      schedule={schedule.value}
                      initial={roomInitial.value}
                      reservations={reservations.value}
                      lessonChanges={lessonChanges.value}
                      role={role.value}
                      owner={owner.value}
                      busy={busy.value}
                      onSend={submitRequest}
                    />
                  </PortalSection>
                ) : null}
                {panel.value === "booked" ? (
                  <Fragment>
                    <RequestList
                      records={records.value}
                      onSelect={openRecord}
                    />
                  </Fragment>
                ) : null}
                {panel.value === "request" ? (
                  <PortalSection layout="form">
                    <ServiceForm
                      key={docName.value}
                      housing={housing.value}
                      records={records.value}
                      onRecord={openRecord}
                      name={docName.value}
                      person={account.value}
                      busy={busy.value}
                      onSubmit={submitRequest}
                    />
                  </PortalSection>
                ) : null}
                {panel.value === "record" && activeRecord.value ? (
                  <Fragment>
                    <RequestSummary record={activeRecord.value}/>
                    {activeRecord.value.status === "pending" && activeRecord.value.owner === owner.value ? (
                      <Fragment>
                        <p>Решение деканата придёт в уведомления.</p>
                        {!noticeHint && window.Notification?.permission === "default" && (
                          <button disabled={connectingPush.value} onClick={enablePush} className="text-link">
                            {connectingPush.value ? "Подключение…" : "Включить уведомления браузера"}
                          </button>
                        )}
                      </Fragment>
                    ) : null}
                    {activeRecord.value.reason ? (
                      <p>{activeRecord.value.reason}</p>
                    ) : null}
                    {activeRecord.value.details ? (
                      <dl className={"ledger"}>
                        {Object.entries(activeRecord.value.details || {}).map(
                          ([k, v]) => (
                            <div key={k}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    ) : null}
                    {activeRecord.value.requirements?.map((r) => (
                      <p key={r.subject}>
                        {r.subject}
                        {" · "}
                        {r.met ? "Зачтено" : "Пройти аттестацию"}
                      </p>
                    ))}
                    {activeRecord.value.attachment ? (
                      <button
                        onClick={(event) => {
                          download(activeRecord.value, true);
                        }}
                        className={"text-link"}
                      >
                        {" Скачать вложение · "}
                        {activeRecord.value.attachment}
                      </button>
                    ) : null}
                    {activeRecord.value.discussion?.length ? (
                      <section className={"case-discussion"}>
                        <h3>{"Уточнения по заявке"}</h3>
                        {activeRecord.value.discussion.map((m) => (
                          <article key={m.created + "-" + m.sender}>
                            <small>{people[m.sender].name}</small>
                            <p>{m.body}</p>
                          </article>
                        ))}
                      </section>
                    ) : null}
                    {activeRecord.value.status === "clarification" &&
                    owner.value === activeRecord.value.owner ? (
                      <RequestCorrection key={activeRecord.value.id} busy={busy.value}
                        attachedFile={activeRecord.value.attachment}
                        onSend={(body, attachment) => caseReply("supplement", body, attachment)} />
                    ) : null}
                    {activeRecord.value.comment ? (
                      <p>{activeRecord.value.comment}</p>
                    ) : null}
                    {role.value === "office" &&
                    activeRecord.value.status === "pending" ? (
                      <Fragment>
                        <label className={"field"}>
                          {"Комментарий к решению"}
                          <textarea
                            value={reason.value ?? ""}
                            onChange={(event) => {
                              reason.value = event.target.value;
                            }}
                            rows="2"
                          />
                        </label>
                        {activeRecord.value.kind === "document" ? (
                          <button
                            disabled={busy.value || !reason.value.trim()}
                            onClick={(event) => {
                              caseReply("clarify");
                            }}
                            className={"text-link"}
                          >
                            {" Вернуть на доработку "}
                          </button>
                        ) : null}
                        <div className={"action-row"}>
                          <button
                            disabled={busy.value}
                            onClick={(event) => {
                              decide("approved");
                            }}
                            className={"campus-action"}
                          >
                            {" Одобрить"}
                          </button>
                          <button
                            disabled={busy.value}
                            onClick={(event) => {
                              decide("rejected");
                            }}
                            className={"text-link"}
                          >
                            {" Отклонить "}
                          </button>
                        </div>
                      </Fragment>
                    ) : null}
                    {activeRecord.value.owner === owner.value &&
                    (activeRecord.value.kind === "document" || activeRecord.value.status === "pending") ? (
                      <button
                        onClick={(event) => {
                          if (activeRecord.value.kind === "document") {
                            if (page.value?.view === "booked") close();
                            else goPage("booked");
                          } else {
                            stack.value = [];
                            panel.value = "booked";
                          }
                        }}
                        className={"campus-action"}
                      >
                        {" Мои заявки "}
                      </button>
                    ) : null}
                    {role.value !== "office" &&
                    activeRecord.value.kind === "booking" ? (
                      <Fragment>
                        {activeRecord.value.status === "approved" ? (
                          <button
                            onClick={(event) => {
                              filter.value = "Моё";
                              route(1, activeRecord.value.date);
                            }}
                            className={"text-link"}
                          >
                            {" Открыть расписание ↗"}
                          </button>
                        ) : null}
                        {["pending", "approved"].includes(
                          activeRecord.value.status,
                        ) ? (
                          <button
                            disabled={busy.value}
                            onClick={(event) => {
                              perform("cancel", {
                                id: activeRecord.value.id,
                              });
                            }}
                            className={"text-link"}
                          >
                            {" Отменить заявку "}
                          </button>
                        ) : null}
                      </Fragment>
                    ) : null}
                    {activeRecord.value.status === "approved" &&
                    activeRecord.value.kind === "document" &&
                    role.value !== "office" ? (
                      <Fragment>
                        {activeRecord.value.format === "Электронная" &&
                        activeRecord.value.expires ? (
                          <Fragment>
                            <button
                              disabled={
                                Date.now() >= activeRecord.value.expires
                              }
                              onClick={(event) => {
                                download(activeRecord.value);
                              }}
                              className={"campus-action compact-action"}
                            >
                              {" Скачать PDF"}
                            </button>
                            <small className={"footnote"}>
                              {"Ссылка действует 24 часа с момента выдачи, до "}
                              {new Date(
                                activeRecord.value.expires,
                              ).toLocaleString("ru-RU", {
                                timeZone: "Europe/Moscow",
                              })}
                              {" МСК."}
                            </small>
                          </Fragment>
                        ) : activeRecord.value.format === "Бумажная" ? (
                          <p>
                            {
                              " Студенческий офис · Б-214. Часы приёма: по будням с 10:00 до 16:00. "
                            }
                          </p>
                        ) : null}
                      </Fragment>
                    ) : null}
                  </Fragment>
                ) : null}
                {panel.value === "finance" ? (
                  <PortalSection layout="payment">
                    <FinanceView role={role.value} payments={payments.value} />
                  </PortalSection>
                ) : null}
                {panel.value === "notices" ? (
                  <Fragment>
                    {pushMode.value !== "off" && window.Notification?.permission === "granted" && (
                      <p role="status" className="notification-status">
                        {pushMode.value === "background"
                          ? "Уведомления браузера включены."
                          : "Уведомления приходят, пока кабинет открыт."}
                      </p>
                    )}
                    {noticeHint ? (
                      <p className="notification-status">{noticeHint}</p>
                    ) : window.Notification?.permission === "denied" ? (
                      <p className="notification-status">Браузер блокирует уведомления. Разрешите их в настройках этого сайта — кабинет подключится автоматически.</p>
                    ) : (pushMode.value !== "background" || window.Notification?.permission !== "granted") && (
                      <button disabled={connectingPush.value} onClick={enablePush} className="text-link">
                        {connectingPush.value ? "Подключение…"
                          : pushMode.value === "foreground" ? "Подключить фоновую доставку"
                          : "Включить уведомления браузера"}
                      </button>
                    )}
                    {!notes.value.length && <p role="status">Уведомлений пока нет.</p>}
                    {notes.value.map((n) => (
                      <button
                        key={n.id}
                        onClick={(event) => {
                          openNote(n);
                        }}
                        className="notice-row"
                        data-unread={!n.read}
                      >
                        <small>
                          {!n.read && "Новое · "}
                          {new Date(n.created).toLocaleDateString("ru-RU")}
                          {" · "}
                          {n.ref?.startsWith("chat:") && people[n.ref.slice(5)]
                            ? "Личные сообщения"
                            : n.ref?.startsWith("lesson:") ? "Расписание" : "Деканат"}
                        </small>
                        <b>{n.title}</b>
                      </button>
                    ))}
                    {notes.value.length > 0 && (
                      <button
                        className="text-link clear-notices"
                        disabled={busy.value}
                        onClick={() => perform("notes/clear", {through_id: notes.value[0].id})}
                      >
                        Очистить уведомления
                      </button>
                    )}
                  </Fragment>
                ) : null}
                {panel.value === "letter" && !activeNote.value && (
                  <p role="status">Уведомление убрано из входящих.</p>
                )}
                {panel.value === "letter" && activeNote.value ? (
                  <Fragment>
                    <small>{activeNote.value.ref?.startsWith("lesson:") ? "Учебная группа" : "Студенческий офис"}</small>
                    <h3>{activeNote.value.title}</h3>
                    <p className={"letter-text"}>{activeNote.value.body}</p>
                    {activeNote.value.ref?.startsWith("lesson:") && Object.values(schedule.value || {}).flat().some(event=>event.id===activeNote.value.ref.slice(7)) &&
                      <button className="text-link" onClick={()=>{
                        const event=Object.values(schedule.value || {}).flat().find(event=>event.id===activeNote.value.ref.slice(7));
                        if (event) showEvent(event);
                      }}>Открыть занятие</button>}
                    {records.value.some((r) => r.id === activeNote.value.ref) ? (
                      <button
                        onClick={(event) => {
                          openRecord(
                            records.value.find(
                              (r) => r.id === activeNote.value.ref,
                            ),
                          );
                        }}
                        className={"text-link"}
                      >
                        {" Открыть обращение ↗ "}
                      </button>
                    ) : null}
                  </Fragment>
                ) : null}
                {panel.value === "compose" && role.value === "office" ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendLetter(event);
                    }}
                    className={"letter-form"}
                  >
                    <LetterRecipient owner={owner.value} value={letterTo.value} onChange={value => { letterTo.value = value; }} />
                    <label className={"field"}>
                      {"Тема"}
                      <input
                        value={letterSubject.value ?? ""}
                        onChange={(event) => {
                          letterSubject.value = event.target.value;
                        }}
                        required
                        maxLength="140"
                      />
                    </label>
                    <label className={"field"}>
                      {"Текст письма"}
                      <textarea
                        value={letterBody.value ?? ""}
                        onChange={(event) => {
                          letterBody.value = event.target.value;
                        }}
                        required
                        maxLength="12000"
                        rows="7"
                      />
                    </label>
                    <button disabled={busy.value} className={"campus-action"}>
                      {" Отправить письмо "}
                    </button>
                  </form>
                ) : null}
                {panel.value === "wifi" ? (
                  <Fragment>
                    <p>
                      {"Сеть "}
                      <b>{"Campus Study"}</b>
                    </p>
                    <p>
                      {" Логин "}
                      <b>
                        {owner.value}
                        {".demo"}
                      </b>
                    </p>
                    <div className={"wifi-controls"}>
                      <div className={"wifi-field"}>
                        <label htmlFor="wifi-secret">
                          {"Пароль учебной сети"}
                        </label>
                        <div>
                          <input
                            id="wifi-secret"
                            autoComplete="off"
                            readOnly
                            spellCheck="false"
                            type={reveal.value ? "text" : "password"}
                            value={wifiPassword.value}
                          />
                          <button
                            type="button"
                            aria-label={
                              reveal.value ? "Скрыть пароль" : "Показать пароль"
                            }
                            aria-pressed={reveal.value}
                            onClick={(event) => {
                              reveal.value = !reveal.value;
                            }}
                          >
                            <Icon
                              icon={
                                reveal.value ? mdiEyeOffOutline : mdiEyeOutline
                              }
                            />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Скопировать пароль"
                        title="Скопировать пароль"
                        onClick={copy}
                        className={"wifi-copy"}
                      >
                        <Icon icon={mdiContentCopy} />
                      </button>
                    </div>
                    <button className="wifi-reset" onClick={resetWifi} disabled={busy.value}>
                      {"Получить новый пароль"}
                    </button>
                    {wifiReadyAt.value > Date.now() ? (
                      <p role="status" className={"wifi-activation"}>
                        {
                          " Новый пароль готов. Ориентировочное время активации — "
                        }
                        {wifiReadyTime.value}
                        {" МСК, через 5 минут после смены. "}
                      </p>
                    ) : null}
                  </Fragment>
                ) : null}

                {panel.value === "profile" ? (
                  <ProfilePanel account={account.value} avatar={avatar.value} owner={owner.value}
                    identities={demoIdentities} people={people} allowSwitch={import.meta.env.VITE_CAMPUS_AUTH !== "password"}
                    busy={busy.value || signing.value} onAvatar={changeAvatar} onLogout={logout}
                    onSwitch={id => {
                      password.value = demoAccess.password;
                      loginRole.value = id;
                      loginCategory.value = Object.keys(demoIdentities).find(key => demoIdentities[key].includes(id)) || "student";
                      return enter();
                    }} />
                ) : null}
              </article>
            </Fragment>
          </div>
        </Dialog>
        <Toast
          open={toast.value}
          onClose={() => {
            toast.value = false;
          }}
          timeout={2200}
        >
          {message.value}
        </Toast>
      </div>
    </>
  );
}
