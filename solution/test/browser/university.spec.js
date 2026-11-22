import {test, expect} from "@playwright/test";

test("структура связывает факультет, кафедру, программу, группу и персональную карточку", async ({page}) => {
  await page.goto("/services/structure");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  await page.getByRole("button",{name:/Факультет аналитики Ваш факультет/}).click();
  await page.getByRole("button",{name:/Кафедра аналитики Сотрудников/}).click();
  await expect(page.getByRole("heading",{name:"Заведующий кафедрой"})).toBeVisible();
  await page.getByRole("button",{name:/Прикладная аналитика Ваше направление/}).click();
  await page.getByRole("button",{name:"АД-21",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Группа АД-21"})).toBeVisible();
  await expect(page.getByRole("button",{name:/Лесова Вера Андреевна/})).toHaveCount(1);
  await page.getByRole("button",{name:/Клёнова Арина Дмитриевна/}).click();
  await expect(page.getByRole("heading",{name:"Клёнова Арина Дмитриевна"})).toBeVisible();
  await expect(page.getByRole("button",{name:/Группа АД-21 2 курс/})).toHaveCount(1);

  const nav=page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  await nav.getByRole("button",{name:"Сервисы",exact:true}).click();
  await page.getByRole("button",{name:"Люди",exact:true}).click();
  await expect(page.locator(".people-grid .person-row")).toHaveCount(24);
  const width=await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.getByRole("combobox",{name:"Факультет",exact:true}).click();
  await page.getByRole("option",{name:"Экономический факультет",exact:true}).click();
  await page.getByRole("combobox",{name:"Роль",exact:true}).click();
  await page.getByRole("option",{name:"Студенты",exact:true}).click();
  await page.getByLabel("ФИО или табельный номер").fill("ФН-21");
  await expect(page.locator(".person-row").first()).toContainText("Студент · ФН-21");
  await page.locator(".person-row").first().click();
  await expect(page.getByRole("button",{name:/Экономический факультет/})).toBeVisible();
  await page.getByRole("button",{name:/Финансы и кредит Образовательная программа/}).click();
  await page.getByRole("button",{name:/Открыть учебный план/}).click();
  await expect(page.getByRole("heading",{name:"Учебный план",exact:true})).toBeVisible();
  await expect(page.getByRole("rowheader",{name:"Финансовая математика",exact:true})).toBeVisible();
});

test("профиль преподавателя связывает дисциплины расписания с учебными группами", async ({ page }) => {
  await page.goto("/services/person/teacher");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Лесова Вера Андреевна", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Лесова Вера Андреевна", exact: true })).toBeFocused();

  const teaching = page.getByRole("region", { name: "Дисциплины и группы" });
  await expect(teaching.getByRole("heading", { name: "Статистика", exact: true })).toHaveCount(1);
  const dataAnalysis = teaching.getByRole("listitem").filter({ hasText: "Анализ данных" });
  await expect(dataAnalysis.getByRole("button", { name: "АД-21", exact: true })).toBeVisible();
  const otherGroup = dataAnalysis.getByRole("button", { name: "АД-32", exact: true });
  await expect(otherGroup).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  await otherGroup.click();
  await expect(page.getByRole("heading", { name: "Группа АД-32", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Лесова Вера Андреевна Доцент кафедры аналитики · Факультет аналитики", exact: true })).toBeVisible();
});
