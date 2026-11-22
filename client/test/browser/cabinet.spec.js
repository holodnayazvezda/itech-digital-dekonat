import { test as base, expect } from "@playwright/test";

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await use(page);
    expect(errors).toEqual([]);
  },
});
const button = (page, name) => page.getByRole("button", { name, exact: true });
const close = (page) => button(page.locator("dialog[open]"), "Закрыть").click();
const mobile = (page) => page.viewportSize().width < 681;
const menu = async (page, name) => {
  const nav = page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  if (name === "Учёба" && page.viewportSize().width <= 640) {
    await button(nav, "Сервисы").click();
    await button(page, "Учёба").click();
  } else await button(nav, name).click();
};
const roleNames = {
  student: "Студент",
  teacher: "Преподаватель",
  "dean-data": "Декан",
  office: "Сотрудник деканата",
};

async function openSettings(page) {
  await button(page, "Настройки").click();
  return page.getByRole("dialog", { name: "Настройки", exact: true });
}

async function openSettingsItem(page, name) {
  const popover = await openSettings(page);
  await popover.getByRole("button", { name: new RegExp("^" + name) }).click();
}

async function appleBrowserTab(page) {
  return page.evaluate(() => /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone);
}

async function unreadCount(page) {
  await openSettingsItem(page, "Уведомления");
  const inbox = page.locator("dialog[open]");
  await expect(inbox.getByRole("heading", { name: "Уведомления", exact: true })).toBeVisible();
  const count = await inbox.locator(".notice-row[data-unread=true]").count();
  await close(page);
  return count;
}

async function openRequests(page) {
  await menu(page, "Сервисы");
  await button(page, "Мои заявки").click();
  await expect(page.getByRole("heading", { name: "История обращений" })).toBeVisible();
  return page.locator(".requests-page");
}

async function switchAccount(page) {
  const popover = await openSettings(page);
  await popover.getByText("Демонстрационные данные", { exact: true }).click();
  await button(popover, "Сменить кабинет").click();
}

async function login(page, role = "student", path = "/") {
  await page.goto(path);
  await page.getByRole("combobox", { name: "Демонстрационный пользователь", exact: true }).click();
  await page.getByRole("option", {name: new RegExp(roleNames[role] + "$")}).first().click();
  await button(page, "Войти").click();
  await expect(page.locator(".shell")).toBeVisible();
}

async function dailyAgenda(page) {
  const calendar = page.locator(".calendar-responsive");
  await expect(calendar).toBeVisible();
  const dayMode = button(calendar, "День");
  if (await dayMode.isVisible()) await dayMode.click();
  const agenda = calendar.locator(".timetable-agenda");
  await expect(agenda).toBeVisible();
  return agenda;
}

test("бронь от выбора времени до согласования, календаря и отмены", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await context.addInitScript(() => {
    if (window.PushManager) PushManager.prototype.subscribe = async () => {throw Error("provider offline")};
  });
  await login(page);
  const before = await unreadCount(page);
  await menu(page, "Сервисы");
  await button(page, "Бронирование помещений").click();
  await page.locator(".space-buildings").getByRole("button", { name: /Корпус B/ }).click();
  await page.getByRole("searchbox", { name: "Поиск помещения" }).fill("Б-108");
  await page.locator(".space-room-card").filter({ hasText: "Б-108" }).click();
  await page.getByLabel("Дата бронирования").fill("2026-11-27");
  await button(page.getByRole("group", { name: "Часть дня" }), "Вечер").click();
  await button(page, "19:00 — 20:00").click();
  await button(page, "Отправить заявку").click();
  await expect(page.locator(".result-card.pending")).toContainText("Б-108");
  await button(page.getByRole("dialog", { name: "Заявка" }), "Мои заявки").click();
  await page.locator(".sheet .case-row").filter({ hasText: "Б-108" }).filter({ hasText: "На рассмотрении" }).first().click();
  await expect(page.locator(".result-card.pending")).toBeVisible();

  const office = await context.newPage();
  await login(office, "office");
  await office.locator(".case-row").filter({ hasText: "Б-108" }).filter({ hasText: "На рассмотрении" }).first().click();
  await button(office, "Одобрить").click();
  await expect(office.locator(".result-card.approved")).toBeVisible();
  await office.close();
  if (!await appleBrowserTab(page)) {
    await expect.poll(() => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return (await registration.getNotifications()).filter(note => note.title === "Бронь одобрена" && note.data.owner === "student").length;
    })).toBe(1);
  }
  await page.keyboard.press("Escape");
  const requests = await openRequests(page);
  await expect(requests.locator(".case-row").filter({ hasText: "Б-108" })
    .filter({ hasText: "Одобрена" }).first()).toBeVisible();
  expect(await unreadCount(page)).toBe(before + 1);
  await openSettingsItem(page, "Уведомления");
  const decision = page.locator(".notice-row[data-unread=true]").filter({ hasText: "Бронь одобрена" }).first();
  await expect(decision).toContainText("Новое");
  await decision.click();
  await expect(page.locator(".result-card.approved")).toContainText("Б-108");
  await close(page);
  await expect.poll(() => unreadCount(page)).toBe(before);
  await page.reload();
  expect(await unreadCount(page)).toBe(before);
  await openSettingsItem(page, "Уведомления");
  await page.locator(".sheet .notice-row").filter({ hasText: "Бронь одобрена" }).first().click();
  await page.locator(".sheet").getByRole("button", { name: /Открыть расписание/ }).click();
  await expect(page).toHaveURL(/\/schedule\?date=2026-11-27$/);
  await page.getByRole("button", { name: /^19:00–20:00, .*Б-108/ }).click();
  await expect(page.locator(".result-card.approved")).toBeVisible();
  await button(page, "Отменить заявку").click();
  await expect(page.locator(".result-card")).toContainText("Отменена");
});

test("поле Wi-Fi, смена темы, маска и новый пароль", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  const appearance = page.locator(".v-application");
  for (let i = 0; i < 2; i++) {
    await menu(page, "Сервисы");
    await button(page, "Wi-Fi кампуса").click();
    await expect(page.getByRole("region", { name: "Данные для подключения" })).toBeVisible();
    const field = page.getByLabel("Пароль сети", { exact: true });
    await expect(field).toHaveAttribute("type", "password");
    const previous = await field.inputValue();
    await button(page, "Показать пароль").click();
    await expect(field).toHaveAttribute("type", "text");
    await button(page, "Скрыть пароль").click();
    await button(page, "Скопировать пароль").click();
    await expect(page.getByText("Пароль скопирован", { exact: true })).toBeVisible();
    await expect(field).toHaveAttribute("type", "password");
    await button(page, "Сменить пароль").click();
    await button(page, "Создать пароль").click();
    await expect(field).not.toHaveValue(previous);
    await expect(page.getByRole("region", { name: "Активация пароля" })).toContainText("5 минут");
    const wasDark = (await appearance.getAttribute("class")).includes("v-theme--Dark");
    const settings = page.viewportSize().width <= 640 ? await openSettings(page) : null;
    const theme = (settings || page).getByRole("button", { name: /^Тема:/ });
    for (let attempt = 0; attempt < 2; attempt++) {
      const previousTheme = await theme.getAttribute("aria-label");
      await theme.click();
      await expect(theme).not.toHaveAttribute("aria-label", previousTheme);
      if ((await appearance.getAttribute("class")).includes("v-theme--Dark") !== wasDark) break;
    }
    await expect(appearance).toHaveClass(wasDark ? /v-theme--Light/ : /v-theme--Dark/);
    if (settings) await button(settings, "Закрыть настройки").click();
    await expect(field).toHaveAttribute("type", "password");
    await button(page, "Назад").click();
  }
});

test("открытие готовых документов, форм, справочника и основных учебных разделов", async ({page}) => {
  await login(page);
  const requests = await openRequests(page);
  await requests.locator(".case-row").filter({hasText: "Выписка из зачётной книжки"}).click();
  await expect(page.locator(".result-card")).toBeVisible();
  const file = page.waitForEvent("download");
  await page.getByRole("button", {name: /Скачать PDF/}).click();
  expect((await file).suggestedFilename()).toMatch(/\.pdf$/);
  await close(page);
  await button(page, "Назад").click();
  await page.getByRole("button", {name: /Документы и заявления/}).click();
  const forms = page.locator(".doc-tile");
  await expect.poll(() => forms.count()).toBeGreaterThan(20);
  for (const form of await forms.all()) {
    const moveIn = await form.getAttribute("aria-label") === "Заселение в общежитие";
    await form.click();
    if (moveIn) {
      await expect(page.locator(".service-form-page")).toContainText("Вам уже предоставлено место в общежитии");
      await expect(page.locator(".hub-form")).toHaveCount(0);
    } else {
      await expect(page.locator(".hub-form")).toBeVisible();
    }
    await button(page, "Назад").click();
  }
  await menu(page, "Учёба");
  await page.getByRole("button", { name: /^Анализ данных/ }).click();
  await expect(page.getByRole("region", { name: "Контрольные точки: Анализ данных" })).toBeVisible();
  await button(page, "Учебный план").click();
  await button(page,"4 семестр").click();
  await expect(page.locator(".plan-courses tbody tr")).toHaveCount(5);
  await menu(page, "Сервисы");
  await page.getByRole("button",{name:/Выбор дисциплин/}).click();
  const study = page.locator(".academic-section");
  await expect(study).toBeVisible();
  if (await study.getByRole("heading", { name: "Выбор открыт" }).isVisible()) {
    await expect(study.getByRole("radio")).toHaveCount(3);
  } else {
    await expect(study.getByRole("status")).toHaveText(/Выбор дисциплин (откроется|завершён)/);
  }
  await menu(page,"Сервисы");
  await button(page, "Люди").click();
  await page.getByLabel("ФИО или табельный номер").fill("Лесова");
  await page.locator(".person-row").first().click();
  await expect(page.getByRole("heading", { name: "Лесова Вера Андреевна" })).toBeVisible();
  await expect(page.getByText(/Табельный номер/)).toBeVisible();
});

test("общежития: расположение корпусов, формы и история обращений", async ({page}) => {
  await login(page);
  await menu(page,"Сервисы");
  await page.getByRole("button",{name:/Общежития/}).click();
  await expect(page.locator(".housing-building")).toHaveCount(2);
  const home = page.locator(".housing-building.is-home");
  await expect(home.locator(".housing-room-number")).toContainText(/Комната\s*314/);
  await page.getByText("История начислений и оплат", { exact: true }).click();
  await expect(page.locator(".rent-row")).toHaveCount(3);
  await expect(page.locator(".rent-row").first()).toContainText("Частично оплачено");
  await home.click();
  await expect(page.getByRole("link", { name: "Открыть на карте" })).toHaveAttribute("href", /yandex.ru\/maps/);
  await expect(page.locator(".housing-detail")).toContainText("Внутренний 21-01");
  await page.getByRole("button",{name:/Назад/}).first().click();
  const services = page.getByRole("region", { name: "Обращения в общежитие" });
  await expect(services.getByRole("button", {name:/Заселение/})).toHaveCount(0);
  await services.getByRole("button", { name: /^Поддержка общежития/ }).click();
  await expect(page.getByLabel("Основание обращения")).toBeVisible();
  await button(page, "Назад").click();
  await services.getByRole("button", { name: /^Заявка на ремонт/ }).click();
  await expect(page.getByLabel("Номер комнаты")).toHaveValue("314");
  await page.getByRole("combobox", {name:"Общежитие", exact:true}).selectOption({label:"Дом студентов · Парковый"});
  await page.getByLabel("Номер комнаты").fill("212");
  await page.getByLabel("Что требует ремонта").fill("Требуется ремонт оконной ручки");
  await page.getByLabel("Контактный телефон").fill("+79990000000");
  await button(page, "Отправить заявку").click();
  await expect(page.locator(".result-card.pending")).toBeVisible();
  await close(page);
  await button(page, "Назад").click();
  const history = page.getByRole("region", { name: "Мои обращения" });
  await history.getByRole("button", {name:/Заявка на ремонт.*На рассмотрении/}).first().click();
  await expect(page.locator(".sheet")).toContainText("212");
  await close(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("кабинеты преподавателя и декана, расписание и начисления", async ({ page }) => {
  for (const [role, lesson, room] of [
    ["teacher", /10:00–11:30, Анализ данных/, "Б-412"],
    ["dean-data", /10:30–12:00, Аналитический практикум/, "Б-310"],
  ]) {
    await login(page, role);
    const agenda = await dailyAgenda(page);
    await agenda.getByRole("button", { name: lesson }).click();
    await page.getByRole("button", { name: /Место занятия/ }).click();
    await expect(page.getByRole("heading", { name: "Аудитория " + room })).toBeVisible();
    await expect(page.getByLabel("Занятость на дату")).toHaveValue("2026-11-20");
    await button(page, "Выбрать время").click();
    await expect(page.getByRole("region", { name: "Выбор времени бронирования" })).toBeVisible();
    await expect(page.getByLabel("Дата бронирования")).toHaveValue("2026-11-20");
    await button(page, "Назад").click();

    await page.getByRole("searchbox", { name: "Поиск по деканату" }).fill("Орлова Елена");
    await page.locator(".search-results").getByRole("button", { name: /Орлова Елена Николаевна/ }).click();
    await expect(page.getByRole("heading", { name: "Орлова Елена Николаевна" })).toBeVisible();
    await menu(page, "Расписание");
    if (page.viewportSize().width > 640) {
      await button(page, "Скачать расписание").click();
      const exportDialog = page.getByRole("dialog", { name: "Скачать расписание" });
      await expect(exportDialog.getByRole("group", { name: "Формат файла" })).toBeVisible();
      const file = page.waitForEvent("download");
      await button(exportDialog, "Скачать файл").click();
      expect((await file).suggestedFilename()).toMatch(/\.ics$/);
    } else {
      await expect(button(page, "Скачать расписание")).toBeHidden();
    }

    await menu(page, "Сервисы");
    await button(page, "Заработная плата").click();
    const payments = page.getByRole("region", { name: "Расчёт за месяц" });
    await expect(payments.locator(".finance-total")).toContainText("Начисления за месяц");
    await switchAccount(page);
  }
});

test("условия перевода и переписка через уведомление", async ({page, context}, testInfo) => {
  await login(page);
  await menu(page, "Сервисы");
  await page.getByRole("button", {name: /Документы и заявления/}).click();
  await button(page, "Перевод на другую программу").click();
  await page.getByLabel("Новая программа").selectOption("Аналитика бизнеса");
  await expect(page.locator(".transfer-box")).toContainText("Базы данных");
  await page.getByLabel("Основание обращения").fill("Хочу специализироваться на бизнес-анализе.");
  await button(page, "Отправить заявку").click();
  await expect(page.locator(".result-card.pending")).toBeVisible();
  await expect(page.locator(".sheet")).toContainText("Базы данных");
  await close(page);

  const teacher = await context.newPage();
  await login(teacher,"teacher");
  await menu(teacher, "Сервисы");
  await button(teacher, "Чаты").click();
  await button(teacher, "Новый диалог").click();
  await teacher.getByLabel("Найти собеседника").fill("Клёнова");
  await teacher.locator(".thread-row").filter({hasText:"Клёнова Арина Дмитриевна"}).click();
  const message = "Консультация по проекту · " + testInfo.project.name;
  await teacher.getByLabel("Сообщение", {exact:true}).fill(message);
  await button(teacher,"Отправить сообщение").click();
  await expect(teacher.locator(".chat-log")).toContainText(message);
  await openSettingsItem(page, "Уведомления");
  await page.getByRole("button", {name: /Сообщение · Лесова/}).first().click();
  await expect(page.locator(".chat-log")).toContainText(message);
  await teacher.close();
});

test("открытый кабинет показывает системное уведомление при недоступной фоновой подписке", async ({page, context, request}, testInfo) => {
  await context.grantPermissions(["notifications"]);
  await context.addInitScript(() => {
    if (window.PushManager) {
      PushManager.prototype.subscribe = async () => { throw new Error("Push transport offline"); };
    }
  });
  // Prove that a throttled/background tab receives changes without its periodic polling timer.
  await context.addInitScript(() => {
    const schedule = window.setInterval;
    window.setInterval = (callback, time, ...args) => time === 2000 ? 0 : schedule(callback, time, ...args);
  });
  await login(page);
  await openSettingsItem(page, "Уведомления");
  const homeScreenRequired = await appleBrowserTab(page);
  if (homeScreenRequired) {
    await expect(page.locator(".notification-status")).toContainText("экран «Домой»");
    await expect(button(page, "Включить уведомления браузера")).toHaveCount(0);
  } else {
    await expect(page.getByRole("status").filter({hasText:"пока кабинет открыт"})).toBeVisible();
  }
  const office = await request.post("/api/campus/login", {data:{role: "office", password:"OfficeHelp2026!"}});
  const {token} = await office.json();
  const subject = "Ответ деканата · " + testInfo.project.name;
  const result = await request.post("/api/campus/letter", {
    headers:{Authorization:"Bearer " + token},
    data:{to:"student", subject, body:"Ваша справка готова к выдаче."},
  });
  expect(result.ok()).toBe(true);
  if (!homeScreenRequired) {
    await expect.poll(() => page.evaluate(async title => {
      const reg = await navigator.serviceWorker.ready;
      return (await reg.getNotifications()).filter(note => note.title === title).length;
    }, subject)).toBe(1);
  }
  await page.locator(".sheet .notice-row").filter({hasText:subject}).click();
  await expect(page.locator(".letter-text")).toHaveText("Ваша справка готова к выдаче.");
});

test("подтверждение заявки при недоступном обновлении кабинета", async ({ page }) => {
  await login(page);
  await menu(page, "Сервисы");
  await page.getByRole("button", { name: /Документы и заявления/ }).click();
  await button(page, "Справка об обучении").click();
  await page.getByLabel("Куда предоставить").fill("Для библиотеки");
  let firstPoll = true;
  let snapshotReady, releaseSnapshot;
  const started = new Promise(resolve => { snapshotReady = resolve; });
  const released = new Promise(resolve => { releaseSnapshot = resolve; });
  await page.route("**/api/campus/state", async route => {
    if (firstPoll) {
      firstPoll = false;
      const response = await route.fetch();
      snapshotReady();
      await released;
      await route.fulfill({ response });
    } else {
      await route.fulfill({status:503, json:{error:"Обновление кабинета временно недоступно"}});
    }
  });
  await started;
  let submissions = 0;
  page.on("request", req => {
    if (new URL(req.url()).pathname === "/api/campus/request") submissions++;
  });
  await button(page, "Отправить заявку").click();
  await expect(page.locator(".result-card.pending")).toContainText("Справка об обучении");
  const stalePoll = page.waitForResponse(response => response.url().endsWith("/api/campus/state") && response.ok());
  releaseSnapshot();
  await stalePoll;
  await expect(page.locator(".sheet")).toContainText("Для библиотеки");
  expect(submissions).toBe(1);
  await close(page);
  await page.unroute("**/api/campus/state");
  await page.reload();
  const list = await openRequests(page);
  await list.locator(".case-row").first().click();
  await expect(page.locator(".result-card.pending")).toContainText("Справка об обучении");
  await expect(page.locator(".sheet")).toContainText("Для библиотеки");
});

test("демо-время в настройках и единая прокрутка расписания преподавателя", async ({page}) => {
  await login(page);
  const settings = await openSettings(page);
  await settings.getByText("Демонстрационные данные", { exact:true }).click();
  const clock = settings.getByRole("group", {name:"Демо-время"});
  if (page.viewportSize().width <= 640) {
    await expect(clock).toHaveCount(0);
  } else {
    await expect(clock).toBeVisible();
    await clock.getByLabel("Часы демо-времени").fill("10");
    await clock.getByLabel("Минуты демо-времени").fill("05");
    await clock.getByLabel("Минуты демо-времени").press("Enter");
  }
  await button(settings, "Закрыть настройки").click();
  const dayMode = button(page, "День");
  if (await dayMode.isVisible()) await dayMode.click();
  if (page.viewportSize().width > 640) {
    await expect(page.locator(".agenda-event").first()).toContainText("Идёт сейчас · до 11:30");
  }
  await page.getByRole("button", {name:/10:00–11:30, Анализ данных/}).first().click();
  await button(page, "Расписание преподавателя").click();
  const sheet = page.locator("dialog[open] .sheet");
  await expect(sheet.locator(".teacher-list")).toHaveCSS("overflow-y", "visible");
  await sheet.getByRole("button", {name:/К ближайшему занятию/}).click();
  const day = sheet.locator('[data-upcoming="true"]');
  await expect(day.locator("h3")).toBeInViewport();
  await expect(sheet.getByRole("button", {name:"Закрыть"})).toBeInViewport();
  expect(await sheet.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await day.getByRole("button").first().click();
  await expect(page.locator("dialog[open] .lesson-details")).toBeVisible();
});

test("первый экран дня и раскрытие списков с клавиатуры", async ({page, browserName}) => {
  await login(page);
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  const dayMode = button(page, "День");
  if (await dayMode.isVisible()) await dayMode.click();
  await expect(page.locator(".timetable-agenda .agenda-event")).toHaveCount(3);

  await page.emulateMedia({reducedMotion: "no-preference"});
  await menu(page, "Сервисы");
  await page.getByRole("button", {name: /Документы и заявления/}).click();
  const group = page.locator(".doc-section").first();
  const trigger = group.locator(".section-toggle");
  const list = group.locator(".doc-reveal");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(list).toHaveAttribute("inert", "");
  await expect.poll(() => list.evaluate(el => el.offsetHeight)).toBe(0);
  await page.keyboard.press("Space");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(group.locator(".doc-tile").first()).toBeFocused();

  await menu(page, "Сервисы");
  await page.getByRole("button", {name: /Бронирование помещений/}).click();
  await page.locator(".space-buildings button").first().click();
  await page.locator(".space-room-grid button").first().click();
  const duration = page.getByRole("combobox", {name:"Длительность"});
  await duration.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox", {name:"Длительность"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(duration).toBeFocused();
  await expect(page.getByRole("listbox", {name:"Длительность"})).toHaveCount(0);
});

test("очистка входящих синхронизируется между сеансами", async ({page, context, request}) => {
  const office = await request.post("/api/campus/login", {data:{role: "office", password:"OfficeHelp2026!"}});
  const token = (await office.json()).token;
  const sendLetter = async subject => {
    const result = await request.post("/api/campus/letter", {
      headers: {Authorization: "Bearer " + token},
      data: {to: "teacher", subject, body: "Текст тестового письма"},
    });
    expect(result.ok()).toBeTruthy();
  };
  await sendLetter("Проверка очистки");
  const second = await context.newPage();
  await login(page, "teacher");
  await login(second, "teacher");
  await expect.poll(() => unreadCount(second)).toBeGreaterThan(0);
  await openSettingsItem(page, "Уведомления");
  await button(page, "Очистить уведомления").click();
  await expect(page.getByRole("status").filter({hasText:"Уведомлений пока нет"})).toBeVisible();
  await expect.poll(() => unreadCount(second)).toBe(0);
  await close(page);
  expect(await unreadCount(page)).toBe(0);
  await page.reload();
  await openSettingsItem(page, "Уведомления");
  await expect(button(page, "Очистить уведомления")).toHaveCount(0);
  await sendLetter("После очистки");
  await expect(page.locator(".sheet .notice-row")).toHaveText(/После очистки/);
  await expect.poll(() => unreadCount(second)).toBe(1);
  await second.close();
});

test("тип события виден в расписании и карточке занятия", async ({page}) => {
  await login(page, "student", "/schedule?date=2026-11-24");
  const agenda = await dailyAgenda(page);
  const exam = agenda.getByRole("button", { name: /История культуры/ });
  await expect(exam.getByText("Экзамен", { exact: true })).toBeVisible();
  const accent = type => agenda.getByText(type, { exact: true }).first()
    .evaluate(el => getComputedStyle(el).color);
  expect(await accent("Лекция")).not.toBe(await accent("Практика"));
  await page.emulateMedia({reducedMotion:"no-preference"});
  const dayPicker = page.locator(".day-picker");
  await dayPicker.getByRole("button", { name: /^ср 25$/i }).click();
  await dayPicker.getByRole("button", { name: /^вт 24$/i }).click();
  await expect(page.locator(".calendar-period")).toHaveCSS("animation-name", "schedule-mode-enter");
  await exam.click();
  await expect(page.locator(".lesson-details .event-type")).toHaveText("Экзамен");
  await expect(page.locator(".lesson-details")).toHaveAttribute("data-event-type", "Экзамен");
  await expect(page.locator(".lesson-details")).toHaveCSS("animation-name", "detail-arrives");
  await close(page);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator(".calendar-period")).toHaveCSS("animation-name", "none");
  await switchAccount(page);
  await login(page, "dean-data");
  const deanAgenda = await dailyAgenda(page);
  await expect(deanAgenda.getByRole("button", { name: /Совет факультета/ })).toContainText("Встреча");
  await expect(deanAgenda.getByRole("button", { name: /Аналитический практикум/ })).toContainText("Семинар");
});

test("общежития: студент без места открывает отдельную форму заселения", async ({ page }) => {
  const response = await page.request.post("/api/campus/login", { data:{role: "friend" , password:"NikitaStudy2026!"} });
  expect(response.ok()).toBe(true);
  const { token } = await response.json();
  await page.addInitScript(value => sessionStorage.setItem("atlas-session", value), token);
  await page.goto("/");
  await menu(page, "Сервисы");
  await page.getByRole("button", { name: /Общежития/ }).click();
  await expect(page.getByText("Место пока не назначено")).toBeVisible();
  await expect(page.locator(".rent-ledger")).toHaveCount(0);
  await button(page, "Подать заявление на заселение").click();
  await expect(page.getByRole("heading", { name: "Заселение в общежитие", exact: true })).toBeVisible();
  await expect(page.getByLabel("Дата начала")).toBeVisible();
  await expect(page.getByLabel("Контактный телефон")).toBeVisible();
});
