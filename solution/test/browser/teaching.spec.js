import { expect, test } from "@playwright/test";

async function signIn(page, role) {
  await page.goto("/");
  if (role) {
    await page.getByRole("combobox", { name: "Демонстрационный пользователь", exact: true }).click();
    await page.getByRole("option", {name: new RegExp(role + "$")}).first().click();
  }
  await page.getByRole("button", { name: "Войти", exact: true }).click();
}

test("преподаватель отправляет домашнее задание, студент открывает уведомление и занятие", async ({ page, browser }, testInfo) => {
  const assignment = "Решить учебный пример. " + testInfo.project.name + " · " + Date.now();
  await signIn(page, "Преподаватель");
  const dayMode = page.getByRole("button", { name: "День", exact: true });
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  if (await dayMode.isVisible()) await dayMode.click();
  await page.getByRole("button", { name: /10:00–11:30, Анализ данных/ }).click();
  await expect(page.getByRole("button", { name: "Перенести пару" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отменить пару" })).toBeVisible();
  await page.getByRole("button", { name: "Отправить домашнее задание" }).click();
  await page.getByLabel("Текст задания").fill(assignment);
  await page.getByRole("button", { name: "Отправить группе" }).click();
  await expect(page.getByRole("button", { name: "Отправить домашнее задание" })).toBeVisible();

  const student = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: page.viewportSize() });
  try {
    const tab = await student.newPage();
    await signIn(tab);
    await tab.getByRole("button", { name: "Настройки", exact: true }).click();
    await tab.getByRole("button", { name: /^Уведомления/ }).click();
    await tab.getByRole("button", { name: /Домашнее задание.*Анализ данных/ }).first().click();
    await expect(tab.getByText(assignment)).toBeVisible();
    await tab.getByRole("button", { name: "Открыть занятие", exact: true }).click();
    const lesson = tab.getByRole("dialog", { name: "Карточка кабинета" });
    await expect(lesson.getByText("Анализ данных", { exact: true })).toBeVisible();
    await expect(lesson.getByRole("button", { name: "Отменить пару" })).toHaveCount(0);
  } finally {
    await student.close();
  }
});

test("сотрудник деканата открывает занятие другого преподавателя через поиск", async ({ page }) => {
  await signIn(page, "Сотрудник деканата");
  await page.getByRole("button", { name: "Расписание", exact: true }).first().click();
  await page.getByRole("searchbox", { name: "Поиск занятий" }).fill("Проектный семинар");
  await page.getByRole("button", { name: /11:40.*Проектный семинар/ }).first().click();
  await expect(page.getByRole("heading", { name: "Управление занятием" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отменить пару" })).toBeVisible();
});
