import { expect, test } from "@playwright/test";

const button = (scope, name) => scope.getByRole("button", { name, exact: typeof name === "string" });

async function signIn(page, path, role) {
  await page.goto(path);
  if (role) {
    await page.getByRole("combobox", { name: "Демонстрационный пользователь", exact: true }).click();
    await page.getByRole("option", {name: new RegExp(role + "$")}).first().click();
  }
  await button(page, "Войти").click();
}

test("соседняя неделя доступна в дневном расписании и сохраняется по ссылке", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "/schedule");
  await button(page, "Следующая неделя").click();
  await expect(page).toHaveURL(/date=2026-11-27/);
  await expect(page.locator(".calendar-date-meta")).toContainText("27 ноября");
  await button(page, /пн 23/i).click();
  await expect(page).toHaveURL(/date=2026-11-23/);
  await page.reload();
  await expect(page.locator(".calendar-date-meta")).toContainText("23 ноября");
  await button(page, "Предыдущая неделя").click();
  await expect(page.locator(".calendar-date-meta")).toContainText("16 ноября");
});

test("поиск повторно открывается с тем же запросом и код не смешивается с людьми", async ({ page }) => {
  await signIn(page, "/schedule");
  const search = page.getByRole("searchbox", { name: "Поиск по деканату" });
  const results = page.locator(".search-results");
  await search.fill("B-108");
  await expect(results.getByRole("region", { name: "Аудитории" })).toBeVisible();
  await expect(results.getByRole("region", { name: "Люди" })).toHaveCount(0);
  await search.press("Escape");
  await expect(results).toBeHidden();
  await search.click();
  await expect(button(results, /Б-108/)).toBeVisible();
  await search.press("Escape");
  await search.press("ArrowDown");
  await expect(results).toBeVisible();
  await search.press("ArrowDown");
  await expect(button(results, /Б-108/).first()).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(search).toBeFocused();
});

test("загрузка поиска по смыслу сохраняет позицию нажатого результата", async ({ page }) => {
  await signIn(page, "/schedule");
  const search = page.getByRole("searchbox", { name: "Поиск по деканату" });
  const worker = page.waitForEvent("worker");
  await search.fill("Лесова");
  const result = button(page.locator(".search-results"), "Лесова Вера Андреевна");
  await expect(result).toBeVisible();
  const position = await result.boundingBox();
  await page.mouse.move(position.x + position.width / 2, position.y + position.height / 2);
  await page.mouse.down();
  await worker;
  expect((await result.boundingBox()).y).toBe(position.y);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/services\/person\/teacher$/);
});

test("демонстрация элективов возвращает клавиатурный фокус", async ({ page }) => {
  await signIn(page, "/study/electives");
  const open = button(page, "Показать выбор для жюри");
  const close = button(page, "Закрыть демонстрацию");
  await open.press("Enter");
  await expect(close).toBeFocused();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await close.press("Enter");
  await expect(open).toBeFocused();
});

test("бронирование сохраняет помещение, дату, длительность и выбранный слот", async ({ page }) => {
  await signIn(page, "/services/booking");
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await button(page.locator(".space-buildings"), /Корпус B/).click();
  await expect(page).toHaveURL(/building=/);
  await page.getByRole("searchbox", { name: "Поиск помещения" }).fill("Б-108");
  await button(page.locator(".space-room-grid"), /Б-108/).click();
  const date = page.getByLabel("Дата бронирования");
  await date.fill("2026-12-12");
  await page.getByRole("combobox", { name: "Длительность" }).click();
  await expect(page.getByRole("option", { name: "3 часа 30 минут" })).toBeVisible();
  await page.getByRole("option", { name: "2 часа 30 минут" }).click();
  const slot = page.locator(".space-time-slots button").first();
  const time = await slot.getAttribute("aria-label");
  await slot.click();
  await expect(page).toHaveURL(/start=.*duration=150/);
  await page.reload();
  await expect(date).toHaveValue("2026-12-12");
  await expect(button(page, time)).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(page.getByRole("searchbox", { name: "Поиск помещения" })).toBeVisible();
  await page.goBack();
  await expect(page.locator(".space-buildings")).toBeVisible();
  expect(errors).toEqual([]);
});

test("форма завершённой заявки заменяется историей и показывает номер", async ({ page }) => {
  await signIn(page, "/services/apply/" + encodeURIComponent("Справка об обучении"));
  await page.getByLabel("Куда предоставить").fill("Библиотека");
  await button(page, "Отправить заявку").click();
  const confirmation = page.getByRole("dialog", { name: "Заявка", exact: true });
  await expect(confirmation).toContainText("Номер заявки");
  await button(confirmation, "Мои заявки").click();
  await expect(page).toHaveURL(/\/services\/requests$/);
  await expect(page.locator(".service-form-page")).toHaveCount(0);
  await expect(page.locator(".requests-list").getByText("Справка об обучении", { exact: true }).first()).toBeVisible();
});

test("бронь спортзала с карты сохраняет дату и слот", async ({ page }) => {
  await signIn(page, "/services/map/" + encodeURIComponent("Н-101") + "?date=2026-12-11&show=place");
  await button(page, "Выбрать время брони").click();
  const date = page.getByLabel("Дата тренировки");
  await expect(date).toHaveValue("2026-12-11");
  await date.fill("2026-12-12");
  const slot = button(page, /09:00 ·/).first();
  await slot.click();
  await expect(page).toHaveURL(/date=2026-12-12&start=09:00/);
  await page.reload();
  await expect(date).toHaveValue("2026-12-12");
  await expect(slot).toHaveAttribute("aria-pressed", "true");
});

test("ошибка спортивной записи сохраняет интервал и не предлагает дату за пределами периода", async ({ page }) => {
  await signIn(page, "/services/sports");
  await button(page, "Аквааэробика").click();
  const dialog = page.getByRole("dialog", { name: "Аквааэробика" });
  const date = dialog.getByLabel("Дата тренировки");
  await date.fill("2026-12-28");
  await expect(button(dialog, "Выбрать ближайшее занятие")).toHaveCount(0);
  await date.fill("2026-12-01");
  const slot = dialog.locator(".sports-slots button").first();
  await slot.click();
  await page.route("**/api/campus/request", route => route.fulfill({
    status: 409, json: { error: "Интервал уже занят." }
  }));
  await button(dialog, "Отправить заявку").click();
  await expect(dialog.getByRole("alert")).toContainText("Интервал уже занят.");
  await expect(date).toHaveValue("2026-12-01");
  await expect(slot).toHaveAttribute("aria-pressed", "true");
});

test("на промежуточной ширине доступны настройки сотрудника", async ({ page }) => {
  await page.setViewportSize({ width: 641, height: 820 });
  await signIn(page, "/office", "Сотрудник деканата");
  const settings = button(page, "Настройки");
  await expect(settings).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(641);
  await settings.click();
  await expect(page.getByRole("dialog", { name: "Настройки" })).toBeVisible();
});

test("поиск занятий деканата понимает альтернативные написания номера", async ({ page }) => {
  await signIn(page, "/schedule", "Сотрудник деканата");
  const query = page.getByRole("searchbox", { name: "Поиск занятий" });
  const room = button(page.locator(".office-schedule-list"), /Б-412/).first();
  for (const value of ["Б-412", "B-412", "Б 412", "B – 412"]) {
    await query.fill(value);
    await expect(room).toBeVisible();
  }
});
