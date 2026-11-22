import { expect, test } from "@playwright/test";

async function showLesson(page, name) {
  await page.goto("/schedule?date=2026-11-20");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  const day = page.getByRole("button", { name: "День", exact: true });
  if (await day.isVisible()) await day.click();
  await page.locator(".calendar-responsive").getByRole("button", { name }).click();
  return page.getByRole("dialog", { name: "Карточка кабинета", exact: true });
}

test("из пары можно открыть преподавателя и другую учебную группу", async ({ page }) => {
  const lesson = await showLesson(page, /10:00–11:30, Анализ данных/);
  await expect(lesson.getByText("Анализ данных", { exact: true })).toBeVisible();
  await expect(lesson.getByText("Лекция", { exact: true })).toBeVisible();
  const room = lesson.getByRole("button", { name: /Место занятия Б-412/ });
  await expect(room).toContainText("Корпус B · 4 этаж");
  await expect(room).toContainText("Университетская аллея, 14");

  await lesson.getByRole("button", { name: /Преподаватель Лесова Вера Андреевна/ }).click();
  await expect(page).toHaveURL(/\/services\/person\/teacher$/);
  await expect(page.getByRole("heading", { name: "Лесова Вера Андреевна" })).toBeVisible();
  const subjects = page.getByRole("region", { name: "Дисциплины и группы" });
  const analytics = subjects.getByRole("listitem").filter({ hasText: "Анализ данных" });
  await analytics.getByRole("button", { name: "АД-32", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Группа АД-32", exact: true })).toBeVisible();
  await page.goBack();
  await expect(subjects).toBeVisible();
  await page.goBack();
  await expect(lesson.getByText("Анализ данных", { exact: true })).toBeVisible();
  await lesson.getByRole("button", { name: "Расписание преподавателя", exact: true }).click();
  await expect(lesson.getByRole("heading", { name: "Расписание · осенний семестр" })).toBeVisible();
});

test("маршрут начинается от входа в корпус аудитории и позволяет вернуться к паре", async ({ page }) => {
  const lesson = await showLesson(page, /11:40–12:20, Проектный семинар/);
  await lesson.getByRole("button", { name: /Место занятия Н-318/ }).click();
  await expect(lesson.getByRole("heading", { name: "Аудитория Н-318", exact: true })).toBeVisible();
  await expect(lesson.getByText(/3 этаж · Университетская аллея, 12/)).toBeVisible();
  await lesson.getByRole("button", { name: "Проложить маршрут", exact: true }).click();
  await expect(page).toHaveURL(/\/services\/map\/[^?]+\?date=2026-11-20&from=entrance$/);
  const steps = page.getByRole("region", { name: "Шаги маршрута", exact: true });
  await expect(steps).toContainText("Корпус A · 1 этаж");
  await expect(steps).toContainText("Вход в корпус A");
  await steps.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(steps).toContainText("Корпус A · 3 этаж");
  await expect(steps).toContainText("Н-318");

  await page.getByRole("button", { name: "К аудитории", exact: true }).click();
  await expect(lesson.getByLabel("Занятость на дату")).toHaveValue("2026-11-20");
  await lesson.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(lesson.getByText("Проектный семинар", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});
