import { expect, test } from "@playwright/test";

test("глобальный поиск открывает найденного человека, аудиторию, занятие и сервис", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "Поиск по деканату" });
  const results = page.locator(".search-results");

  await input.fill("Лесова");
  const person = results.getByRole("button", { name: "Лесова Вера Андреевна", exact: true });
  await expect(person).toBeVisible();
  const box = await person.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Some browsers blur the search field without focusing the tapped button.
  await person.evaluate(button => {
    document.activeElement?.blur();
    button.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/services\/person\/teacher$/);
  await expect(page.getByRole("heading", { name: "Лесова Вера Андреевна" })).toBeVisible();
  await expect(input).toHaveValue("");
  await page.goBack();
  await expect(page.locator(".calendar-responsive")).toBeVisible();

  await input.fill("Б-412");
  await results.getByRole("region", { name: "Аудитории" }).getByRole("button", { name: /Б-412/ }).click();
  await expect(page).toHaveURL(/\/services\/map\/[^?]+\?show=place$/);
  await expect(page.locator(".atlas-inspector").getByRole("heading", { name: /Б-412/ })).toBeVisible();

  await input.fill("Иностранный язык");
  await results.getByRole("region", { name: "Предметы" }).getByRole("button", { name: /Иностранный язык/ }).click();
  await expect(page).toHaveURL(/\/schedule\?date=2026-11-21$/);
  const lesson = page.getByRole("dialog", { name: "Карточка кабинета" });
  await expect(lesson.getByText("Иностранный язык", { exact: true })).toBeVisible();
  await expect(lesson.getByRole("button", { name: /Место занятия Н-205/ })).toBeEnabled();
  await lesson.getByRole("button", { name: "Закрыть", exact: true }).click();

  await input.fill("Wi-Fi");
  const wifi = results.getByRole("region", { name: "Сервисы" }).getByRole("button", { name: /Wi-Fi кампуса/ });
  await wifi.focus();
  await wifi.press("Enter");
  await expect(page).toHaveURL(/\/services\/wifi$/);
  await expect(page.getByRole("heading", { name: "Wi-Fi кампуса", exact: true })).toBeVisible();
});

test("страницы каталога сохраняются по ссылке, после перезагрузки и через историю браузера", async ({ page }) => {
  await page.goto("/services/people");
  await expect(page.getByRole("button", { name: "Войти", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/services\/people$/);
  await expect(page.getByRole("heading", { name: "Люди", exact: true })).toBeVisible();
  await page.locator(".people-directory .person-row").first().click();
  await expect(page).toHaveURL(/\/services\/person\/student$/);
  await expect(page.locator(".person-page")).toBeVisible();
  await page.reload();
  await expect(page.locator(".person-page")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/services\/people$/);
  await expect(page.locator(".people-directory")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/services\/person\/student$/);
  await expect(page.locator(".person-page")).toBeVisible();
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(page.locator(".people-directory")).toBeVisible();
});

test("восстановление сессии показывает скелетон и открывает выбранную учебную страницу", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/api/campus/state", async route => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/study/plan");
    await expect(page.getByRole("status", { name: "Восстанавливаем кабинет" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Войти", exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.locator(".academic-section")).toBeVisible();
  await expect(page).toHaveURL(/\/study\/plan$/);
});

test("студент остаётся в своём кабинете при открытии служебной ссылки", async ({ page }) => {
  await page.goto("/office");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("button", { name: "Написать письмо" })).toHaveCount(0);
});

test("выбранный день расписания восстанавливается после перезагрузки", async ({ page }) => {
  await page.goto("/schedule?date=2026-11-18");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  const dayMode = page.getByRole("button", { name: "День", exact: true });
  if (await dayMode.isVisible()) await dayMode.click();
  await expect(page.locator(".calendar-date-meta")).toHaveText(/^18 ноября ·/);
  await page.getByRole("button", { name: /^чт 19$/i }).click();
  await expect(page).toHaveURL(/\/schedule\?date=2026-11-19$/);
  await page.reload();
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  if (await dayMode.isVisible()) await dayMode.click();
  await expect(page.locator(".calendar-date-meta")).toHaveText(/^19 ноября ·/);
});

test("ссылка из уведомления открывается после входа", async ({ page }) => {
  await page.goto("/#notices");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("heading", { name: "Уведомления", exact: true })).toBeVisible();
});

test("ссылка на бронирование выбирает только свободное время", async ({ page }) => {
  const booking = "/services/booking/" + encodeURIComponent("Б-412") + "?date=2026-11-20&start=";
  await page.goto(booking + "18:00");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const submit = page.getByRole("button", { name: "Отправить заявку", exact: true });
  const evening = page.getByRole("button", { name: "18:00 — 19:00", exact: true });
  await expect(page.getByLabel("Дата бронирования")).toHaveValue("2026-11-20");
  await expect(evening).toHaveAttribute("aria-pressed", "true");
  await expect(submit).toBeEnabled();

  await page.goto(booking + "10:00");
  await expect(page.getByRole("heading", { name: "Аудитория Б-412" })).toBeVisible();
  await expect(page.getByRole("button", { name: "10:00 — 11:00", exact: true })).toHaveCount(0);
  await expect(submit).toBeDisabled();

  await page.goto("/services/booking?date=2026-11-20&start=18:00");
  await page.locator(".space-buildings").getByRole("button", { name: /Корпус B/ }).click();
  await page.getByRole("button", { name: "Аудитории", exact: true }).click();
  await page.getByRole("searchbox", { name: "Поиск помещения" }).fill("Б-412");
  await page.locator(".space-room-card").filter({ hasText: "Аудитория Б-412" }).click();
  await expect(evening).toHaveAttribute("aria-pressed", "true");
  await expect(submit).toBeEnabled();
});
