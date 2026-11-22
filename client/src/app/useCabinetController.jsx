import { demoIdentities, tabs, pageNames, titles } from "./config.js";
import CabinetAssistant from "../features/assistant/CabinetAssistant.jsx";
import CabinetSettings from "../features/settings/CabinetSettings.jsx";
import ExamsBlock from "../features/schedule/ExamsBlock.jsx";
import AgendaRow from "../features/schedule/AgendaRow.jsx";
import useCabinetClock from "../features/schedule/useCabinetClock.jsx";
import useActiveNavigation from "./layout/useActiveNavigation.jsx";
import useSession from "../features/auth/useSession.jsx";
import * as wifiActions from "../features/wifi/actions.js";
import * as profileActions from "../features/profile/actions.js";
import * as assistantActions from "../features/assistant/actions.js";
import * as bookingActions from "../features/booking/actions.js";
import * as documentsActions from "../features/documents/actions.js";
import * as notificationsActions from "../features/notifications/actions.js";
import * as authActions from "../features/auth/actions.js";
import useAppearance from "../features/settings/useAppearance.jsx";
import useSlidingSelectors from "../shared/ui/use-sliding-selectors.js";
import { CalendarDays, ClipboardList, LayoutGrid, UsersRound } from "lucide-react";
import { PhoneNavigatorIcon, usePhoneLayout } from "../shared/ui/PhoneNavigation.jsx";
import { mdiSchoolOutline, mdiBookOpenPageVariantOutline, mdiMapMarkerOutline, mdiWifi, mdiFileDocumentOutline, mdiDoorOpen, mdiDumbbell, mdiClipboardOutline, mdiMapSearchOutline, mdiMessageTextOutline } from "@mdi/js";
import { today, weekOf } from "../shared/domain/timetable.js";
import { layoutForRoute } from "../shared/ui/portal-skeleton.js";
import { services } from "../shared/domain/services.js";
import { lessonLocation } from "../features/schedule/LessonDetails.jsx";
import { browserNoticeHint } from "../shared/platform/notice-delivery.js";
import { people, rooms, gym, facultyDirectory, publishedClasses, teachingDays } from "../shared/domain/campus-data.js";
import { computed, useSignal } from "@preact/signals-react";
import { useRef, useLayoutEffect, useEffect } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useWatch, useMount, useCleanup, afterPaint } from "../shared/ui/ui.jsx";
export default function useCabinetController({
  navigation
}) {
  useSignals();
  const {
    themePreference,
    theme,
    colors,
    themeName,
    ThemeIcon,
    setAppearance
  } = useAppearance();
  useSlidingSelectors();
  const phone = usePhoneLayout();
  const noticeHint = browserNoticeHint();
  const {
    subscribePush,
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
    connectionIssue,
    reconnectCabinet
  } = useSession({
    say,
    resetCabinet
  });
  const password = useSignal("");
  const loginCategory = useSignal("student");
  const loginRole = useSignal("student"),
    signing = useSignal(false);
  const account = computed(() => people[owner.value] || people.student);
  async function enter() {
    return await authActions.enter({
      signing,
      login,
      loginRole,
      password,
      token,
      role,
      connectionIssue,
      say
    }, ...arguments);
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
    void navigation.write({}, {
      replace: true
    });
  }
  const assetBase = import.meta.env.BASE_URL;
  const tab = useSignal(1),
    panel = useSignal(""),
    stack = useSignal([]),
    filter = useSignal("Моё"),
    lesson = useSignal(null);
  const navRef = useActiveNavigation({
    role,
    tab,
    panel,
    phone
  });
  const pages = useSignal([]);
  const calendarDate = useSignal(today());
  const page = computed(() => pages.value.at(-1));
  function currentNavigation() {
    return {
      tab: tab.value,
      pages: pages.value,
      date: calendarDate.value === today() ? "" : calendarDate.value
    };
  }
  function updatePage(next, options) {
    close();
    if (page.value?.view === next.view && page.value.peer === next.peer) {
      pages.value = [...pages.value.slice(0, -1), next];
    } else {
      pages.value = [...pages.value, next];
    }
    void navigation.write(currentNavigation(), options);
    window.scrollTo(0, 0);
  }
  function goPage(view, peer = "") {
    updatePage({
      view,
      peer
    });
  }
  function focusPageHeading() {
    afterPaint(() => heading.current?.focus({
      preventScroll: true
    }));
  }
  function visibleTab(i) {
    return role.value === "student" || role.value === "teacher" && i !== 2 && i !== 5 || role.value === "staff" && [0, 1, 4].includes(i) || role.value === "office" && [0, 1, 4].includes(i);
  }
  const campusItems = computed(() => [[mdiMapSearchOutline, "Навигатор", "Найти аудиторию или место в кампусе", "navigator"], [mdiSchoolOutline, "Люди", "Студенты, преподаватели и сотрудники", "directory"], ...(["student", "teacher"].includes(role.value) ? [[mdiDoorOpen, "Бронирование помещений", "Аудитории и коворкинги", "spaces"], [mdiDumbbell, "Спорт", "Расписание и запись в спортзал", "sports"]] : []), ...(role.value === "student" ? [[mdiBookOpenPageVariantOutline, "Выбор дисциплин", "Курсы на следующий семестр", "electives"]] : []), [mdiMessageTextOutline, "Чаты", "Личные диалоги и сообщения учебным группам", "threads"], [mdiMapMarkerOutline, "Общежития", "Проживание, оплата и контакты", "dorm"]]);
  function openLessonPage(view, peer, options = {}) {
    const lessonOrigin = {
      lessonId: lesson.value.id,
      panel: panel.value,
      stack: stack.value
    };
    if (panel.value === "room") lessonOrigin.date = roomDate.value;
    updatePage({
      view,
      peer,
      ...options,
      lessonOrigin
    });
    afterPaint(() => heading.current?.focus({
      preventScroll: true
    }));
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
    const restricted = screen?.pages.some(({
      view,
      peer
    }) => ["docs", "service-request", "electives"].includes(view) && role.value !== "student" || ["spaces", "sports"].includes(view) && !["student", "teacher"].includes(role.value) || view === "service-request" && !services.some(item => item.name === peer) || ["person", "chat"].includes(view) && !people[peer] || view === "sports" && peer && peer !== gym?.short || view === "spaces" && peer && !rooms.some(room => room.short === peer));
    if (!screen || restricted || !visibleTab(screen.tab) || screen.tab === 0 && role.value !== "office") {
      close();
      pages.value = [];
      tab.value = defaultTab;
      calendarDate.value = today();
      void navigation.write(currentNavigation(), {
        replace: true,
        hash: location.hash
      });
      return;
    }
    if (JSON.stringify(currentNavigation()) !== JSON.stringify(screen)) {
      const originPage = screen.tab === tab.value && JSON.stringify(screen.pages) === JSON.stringify(pages.value.slice(0, screen.pages.length)) ? pages.value[screen.pages.length] : null;
      close();
      pages.value = screen.pages;
      tab.value = screen.tab;
      calendarDate.value = screen.date || today();
      if (["spaces", "sports"].includes(page.value?.view)) {
        roomInitial.value = {
          short: page.value.peer,
          date: page.value.date || today(),
          start: page.value.start
        };
      }
      if (!restoreLessonOrigin(originPage)) afterPaint(() => heading.current?.focus({
        preventScroll: true
      }));
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
    const openNoticeLink = () => {
      void openPendingNotice();
    };
    openNoticeLink();
    window.addEventListener("hashchange", openNoticeLink);
    return () => window.removeEventListener("hashchange", openNoticeLink);
  }, [role.value, navigation]);
  function selectItem(k) {
    if (["spaces", "sports"].includes(k)) {
      roomInitial.value = null;
      goPage(k);
    } else if (pageNames[k]) goPage(k);else open(k);
  }
  function assistantLocation(action, detail) {
    return assistantActions.assistantLocation({
      role,
      visibleTab,
      pageNames
    }, ...arguments);
  }
  function assistantHref(action, detail) {
    return assistantActions.assistantHref({
      assistantLocation,
      navigation
    }, ...arguments);
  }
  function openAssistantAction(action, detail) {
    return assistantActions.openAssistantAction({
      assistantLocation,
      route,
      pages,
      roomInitial,
      updatePage,
      schedule,
      showEvent,
      download,
      open
    }, ...arguments);
  }
  async function bookAssistantSport({
    sport,
    short,
    date,
    time,
    end
  }) {
    return await assistantActions.bookAssistantSport({
      perform
    }, ...arguments);
  }
  const shortcuts = {
    spaces: "Забронировать помещение",
    directory: "Найти человека",
    booked: "Мои заявки"
  };
  const shortcutOverrides = useSignal({});
  const shortcut = computed(() => shortcutOverrides.value[owner.value] ?? localStorage.getItem("campus-shortcut:" + owner.value) ?? "");
  const lessons = computed(() => (schedule.value?.[today()] || []).filter(event => !event.cancelled));
  const exam = computed(() => ["2026-11-24", "2026-11-28"].flatMap(d => schedule.value?.[d] || []).find(e => e.type === "Экзамен"));
  const directoryRows = computed(() => [...new Map(weekOf(today()).flatMap(date => publishedClasses(date, lessonChanges.value)).filter(event => !event.cancelled).map(e => [filter.value === "Преподаватели" ? e.teacher : e.room, e])).values()]);
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
    return {
      room: "К аудитории",
      lesson: "К занятию",
      teacher: "К преподавателю"
    }[origin.panel] || "Назад";
  });
  const roomEvents = computed(() => roomDate.value ? [...publishedClasses(roomDate.value, lessonChanges.value).filter(e => !e.cancelled && e.room === lesson.value.room), ...reservations.value.filter(b => b.short === lesson.value.room && b.date === roomDate.value).map(b => ({
    ...b,
    id: b.short + b.time,
    name: "Бронь помещения",
    type: "Бронь",
    teacher: b.by
  }))].sort((a, b) => a.time.localeCompare(b.time)) : []);
  const instructor = computed(() => Object.values(people).find(person => person.role === "teacher" && person.name === lesson.value?.teacher));
  const faculty = computed(() => facultyDirectory[lesson.value?.teacher]);
  const teaching = computed(() => teachingDays(lesson.value.teacher, lessonChanges.value));
  const firstUpcoming = computed(() => teaching.value.find(d => d.date >= today())?.date);
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
  const {
    demoMinute,
    demoTime,
    setDemoTime
  } = useCabinetClock({
    calendarDate,
    roomDate,
    toMinutes
  });
  const nextIndex = computed(() => lessons.value.findIndex(item => toMinutes(item.end) > demoMinute.value));
  const nextLesson = computed(() => lessons.value[nextIndex.value] || (role.value === "teacher" ? teachingDays(account.value.name).find(day => day.date > today())?.events[0] : undefined));
  const lessonInProgress = computed(() => Boolean(nextLesson.value && nextLesson.value.date === today() && demoMinute.value >= toMinutes(nextLesson.value.time)));
  const durationFormat = new Intl.NumberFormat("ru", {
    style: "unit",
    unit: "minute",
    unitDisplay: "long"
  });
  const countdown = computed(() => {
    if (!nextLesson.value) return "";
    const boundary = lessonInProgress.value ? nextLesson.value.end : nextLesson.value.time;
    if (nextLesson.value.date !== today()) {
      const days = (Date.parse(nextLesson.value.date) - Date.parse(today())) / 86400000;
      const minutes = days * 1440 + toMinutes(nextLesson.value.time) - demoMinute.value;
      return "До начала — " + [Math.floor(minutes / 1440) ? Math.floor(minutes / 1440) + " дн." : "", Math.floor(minutes % 1440 / 60) + " ч", minutes % 60 ? minutes % 60 + " мин" : ""].filter(Boolean).join(" ");
    }
    const duration = durationFormat.format(toMinutes(boundary) - demoMinute.value);
    const minutes = toMinutes(boundary) - demoMinute.value;
    return (lessonInProgress.value ? "До конца — " : "До начала — ") + (minutes < 60 ? duration : [Math.floor(minutes / 60) + " ч", minutes % 60 ? minutes % 60 + " мин" : ""].filter(Boolean).join(" "));
  });
  const activeMark = useSignal(null);
  const reveal = useSignal(false),
    recordId = useSignal(""),
    noteId = useSignal(0);
  const activeRecord = computed(() => records.value.find(r => r.id === recordId.value));
  const activeNote = computed(() => notes.value.find(n => n.id === noteId.value));
  const unreadCount = computed(() => notes.value.filter(n => !n.read).length);
  const topNotes = computed(() => [...notes.value].sort((a, b) => b.priority - a.priority || b.id - a.id).slice(0, 3));
  const docName = useSignal("");
  function chooseService(name) {
    return documentsActions.chooseService({
      docName,
      goPage
    }, ...arguments);
  }
  const letterTo = useSignal(""),
    letterSubject = useSignal(""),
    letterBody = useSignal(""),
    reason = useSignal("");
  function openRecord(r) {
    return documentsActions.openRecord({
      recordId,
      reason,
      open
    }, ...arguments);
  }
  function openNote(n) {
    return notificationsActions.openNote({
      markRead,
      route,
      goPage,
      pages,
      records,
      openRecord,
      noteId,
      open
    }, ...arguments);
  }
  async function submitRequest(data, options) {
    return await documentsActions.submitRequest({
      perform,
      page,
      pages,
      navigation,
      currentNavigation,
      recordId,
      stack,
      panel,
      say
    }, ...arguments);
  }
  async function caseReply(command, body = reason.value, attachment = null) {
    return await documentsActions.caseReply({
      reason,
      perform,
      recordId,
      say
    }, ...arguments);
  }
  async function decide(status) {
    return await documentsActions.decide({
      perform,
      recordId,
      reason,
      say
    }, ...arguments);
  }
  async function sendLetter() {
    return await documentsActions.sendLetter({
      perform,
      letterTo,
      letterSubject,
      letterBody,
      close,
      say
    }, ...arguments);
  }
  const connectingPush = useSignal(false);
  async function enablePush() {
    return await notificationsActions.enablePush({
      connectingPush,
      subscribePush,
      say
    }, ...arguments);
  }
  function showIncoming(id) {
    return notificationsActions.showIncoming({
      notes,
      openNote,
      open
    }, ...arguments);
  }
  async function openPendingNotice() {
    return await notificationsActions.openPendingNotice({
      owner,
      navigation,
      currentNavigation,
      showIncoming
    }, ...arguments);
  }
  function receivePush(e) {
    return notificationsActions.receivePush({
      owner,
      refresh,
      showIncoming,
      open
    }, ...arguments);
  }
  useMount(() => navigator.serviceWorker?.addEventListener("message", receivePush));
  useCleanup(() => navigator.serviceWorker?.removeEventListener("message", receivePush));
  const serviceItems = computed(() => [...(role.value === "student" ? [[mdiFileDocumentOutline, "Документы и заявления", "Каталог услуг студенческого офиса", "docs"]] : []), [mdiClipboardOutline, "Мои заявки", "Заявки и решения деканата", "booked"], [mdiSchoolOutline, financeName.value, "Начисления и график выплат", "finance"], [mdiWifi, "Wi-Fi кампуса", "Персональный демо-доступ", "wifi"]]);
  const financeName = computed(() => role.value === "teacher" ? "Заработная плата" : "Стипендия");
  const message = useSignal(""),
    toast = useSignal(false),
    heading = useRef(null);
  const studyRoot = useRef(null),
    studyScroll = useRef({}),
    studyRestore = useRef(null);
  const studyHeight = useSignal(0);
  function switchStudy(next) {
    if (next === tab.value) return;
    const current = {
      top: window.scrollY,
      left: window.scrollX
    };
    studyScroll.current[tab.value] = current;
    const target = studyScroll.current[next] || current;
    const top = studyRoot.current.getBoundingClientRect().top + window.scrollY;
    studyHeight.value = Math.max(0, target.top + window.innerHeight - top + 1);
    studyRestore.current = target;
    route(next);
  }
  useLayoutEffect(() => {
    const target = studyRestore.current;
    if (!target) return;
    studyRestore.current = null;
    const restore = () => window.scrollTo({
      ...target,
      behavior: 'instant'
    });
    restore();
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [tab.value]);
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
  function route(i, date = today(), {
    navigate = true
  } = {}) {
    if (i === 0 && role.value !== "office") i = 1;
    if (i === 3) i = 4;
    close();
    calendarDate.value = date;
    pages.value = [];
    tab.value = i;
    if (navigate) void navigation.write(currentNavigation());
    afterPaint(() => heading.current?.focus({
      preventScroll: true
    }));
  }
  function showEvent(event, target = "lesson") {
    lesson.value = event;
    open(target);
  }
  function findRoom(short = "", date = today(), start) {
    return bookingActions.findRoom({
      roomInitial,
      updatePage
    }, ...arguments);
  }
  function changeBooking(changes, transition) {
    return bookingActions.changeBooking({
      page,
      pages,
      leavePage,
      navigation,
      currentNavigation
    }, ...arguments);
  }
  const homeAgenda = computed(() => {
    const entries = [...lessons.value, ...bookings.value.filter(b => b.date === today())];
    const occupied = [...entries].sort((a, b) => a.time.localeCompare(b.time));
    let end = occupied[0]?.end;
    for (const event of occupied) {
      if (toMinutes(event.time) - toMinutes(end) >= 60) entries.push({
        id: "gap" + end,
        kind: "gap",
        time: end,
        end: event.time
      });
      if (event.end > end) end = event.end;
    }
    return entries.sort((a, b) => a.time.localeCompare(b.time));
  });
  function agendaRow(entry) {
    return <AgendaRow entry={entry} key={entry.id || entry.time} />;
  }
  function examBlock() {
    return <ExamsBlock />;
  }
  function overlapsBooking(entry) {
    return bookingActions.overlapsBooking({
      homeAgenda
    }, ...arguments);
  }
  function say(text) {
    message.value = text;
    toast.value = true;
  }
  const wifiPassword = computed(() => wifi.value?.password || "");
  const wifiReadyAt = computed(() => wifi.value?.ready || 0);
  const wifiReadyTime = computed(() => new Date(wifiReadyAt.value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow"
  }));
  async function resetWifi() {
    return await wifiActions.resetWifi({
      perform,
      say
    }, ...arguments);
  }
  const avatar = computed(() => avatars.value[owner.value] || "");
  async function changeAvatar(event) {
    return await profileActions.changeAvatar({
      token,
      say,
      perform
    }, ...arguments);
  }
  async function copy() {
    return await wifiActions.copy({
      wifiPassword,
      say
    }, ...arguments);
  }
  useWatch(panel, () => {
    reveal.value = false;
  });
  const routeLayout = layoutForRoute({
    tab: tab.value,
    pages: pages.value
  }, role.value);
  const settingsMenu = <CabinetSettings />;
  const assistant = <CabinetAssistant />;
  function openPhoneTab(destination) {
    route(destination);
    window.scrollTo(0, 0);
  }
  const peopleShortcut = !["student", "office"].includes(role.value);
  const peoplePage = peopleShortcut && ["directory", "person", "structure"].includes(page.value?.view);
  const studentNavigator = role.value === "student" && page.value?.view === "navigator";
  const secondaryPhoneTab = role.value === "office" ? {
    label: "Обращения",
    Icon: ClipboardList,
    active: tab.value === 0,
    onSelect: () => openPhoneTab(0)
  } : peopleShortcut ? {
    label: "Люди",
    Icon: UsersRound,
    active: peoplePage,
    onSelect: () => {
      if (page.value?.view === "directory" && !page.value.peer) {
        window.scrollTo(0, 0);
        return;
      }
      route(4, today(), {
        navigate: false
      });
      goPage("directory");
    }
  } : {
    label: "Навигатор",
    Icon: PhoneNavigatorIcon,
    active: studentNavigator,
    onSelect: () => {
      if (studentNavigator) {
        window.scrollTo(0, 0);
        return;
      }
      route(4, today(), {
        navigate: false
      });
      goPage("navigator");
    }
  };
  const schedulePhoneTab = {
    label: "Расписание",
    Icon: CalendarDays,
    active: tab.value === 1 && !peoplePage && !studentNavigator,
    onSelect: () => openPhoneTab(1)
  };
  const phoneTabs = [...(role.value === "office" ? [secondaryPhoneTab, schedulePhoneTab] : [schedulePhoneTab, secondaryPhoneTab]), {
    label: "Сервисы",
    Icon: LayoutGrid,
    active: (tab.value === 4 || role.value === "student" && [2, 5].includes(tab.value)) && !peoplePage && !studentNavigator,
    onSelect: () => openPhoneTab(4)
  }];
  return {
    colors,
    theme,
    role,
    token,
    signing,
    navigation,
    loginCategory,
    connectionIssue,
    reconnectCabinet,
    logout,
    loginRole,
    password,
    enter,
    phone,
    assetBase,
    navRef,
    officeTab,
    route,
    open,
    visibleTab,
    tab,
    tabs,
    schedule,
    serviceItems,
    campusItems,
    goPage,
    focusPageHeading,
    updatePage,
    showEvent,
    selectItem,
    assistant,
    settingsMenu,
    studyRoot,
    page,
    studyHeight,
    leavePage,
    pageBackLabel,
    heading,
    financeName,
    pageNames,
    switchStudy,
    routeLayout,
    changeBooking,
    reservations,
    lessonChanges,
    owner,
    busy,
    submitRequest,
    records,
    openRecord,
    payments,
    wifiPassword,
    wifiReadyAt,
    wifiReadyTime,
    resetWifi,
    say,
    housing,
    account,
    findRoom,
    electives,
    messages,
    teachingGroups,
    avatars,
    perform,
    chooseService,
    assistantApi,
    nextLesson,
    lessonInProgress,
    countdown,
    lessons,
    homeAgenda,
    agendaRow,
    shortcuts,
    shortcut,
    topNotes,
    openNote,
    examBlock,
    scheduleRevision,
    filter,
    calendarDate,
    currentNavigation,
    bookings,
    demoMinute,
    scheduleDirectoryQuery,
    scheduleDirectoryLimit,
    filteredDirectory,
    grades,
    activeMark,
    openPhoneTab,
    phoneTabs,
    panel,
    showDialog,
    close,
    stack,
    back,
    docName,
    titles,
    lesson,
    instructor,
    openLessonPage,
    faculty,
    jumpToClass,
    teaching,
    firstUpcoming,
    venue,
    roomDate,
    roomEvents,
    roomInitial,
    activeRecord,
    noticeHint,
    connectingPush,
    enablePush,
    download,
    caseReply,
    reason,
    decide,
    pushMode,
    notes,
    activeNote,
    sendLetter,
    letterTo,
    letterSubject,
    letterBody,
    reveal,
    copy,
    avatar,
    demoIdentities,
    changeAvatar,
    toast,
    message,
    overlapsBooking,
    exam,
    themeName,
    setAppearance,
    themePreference,
    ThemeIcon,
    unreadCount,
    demoTime,
    setDemoTime,
    assistantSendStream,
    bookAssistantSport,
    openAssistantAction,
    assistantHref
  };
}
