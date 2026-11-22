import { expect, test } from "@playwright/test";

test("полноэкранные настройки остаются открытыми при касании пустого места", async ({ page }) => {
  await page.setViewportSize({width: 360, height: 740});
  await page.goto("/schedule");
  await page.getByRole("button", {name:"Войти", exact:true}).click();
  const toggle = page.getByRole("button", {name:"Настройки", exact:true});
  await toggle.click();
  const panel = page.getByRole("dialog", {name:"Настройки", exact:true});
  await expect(panel).toBeInViewport();
  const gap = {x: 12, y: 625};
  expect(await panel.evaluate((el, {x, y}) => document.elementFromPoint(x, y) === el, gap)).toBe(true);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(gap.x, gap.y);
  else await page.mouse.click(gap.x, gap.y);
  await expect(panel).toBeVisible();
  await panel.getByRole("button", {name:"Закрыть настройки"}).click();
  await expect(toggle).toBeFocused();
});

test("результаты поиска помещаются над клавиатурой и последний результат можно выбрать", async ({ page }) => {
  await page.setViewportSize({width: 360, height: 740});
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), {height:740, offsetTop:0, scale:1});
    Object.defineProperty(window, "visualViewport", {value:viewport});
  });
  await page.goto("/schedule");
  await page.getByRole("button", {name:"Войти", exact:true}).click();
  await page.getByRole("searchbox", {name:"Поиск по деканату"}).fill("Б-1");
  const results = page.locator(".search-results");
  await expect(results.getByRole("button").first()).toBeVisible();
  await page.evaluate(() => {
    window.visualViewport.height = 280;
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  const list = await results.boundingBox();
  expect(list.y + list.height).toBeLessThanOrEqual(280);
  const last = results.getByRole("button").last();
  await last.scrollIntoViewIfNeeded();
  const item = await last.boundingBox();
  expect(item.y + item.height).toBeLessThanOrEqual(280);
  await last.click();
  await expect(page).toHaveURL(/\/services\/map\//);
});

async function expectNavigation(nav, names) {
  const buttons = nav.getByRole("button");
  await expect(buttons).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  }
}

test("кабинет студента помещается на 320 и 430 пикселях", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 745 });
  await page.goto("/schedule?date=2026-11-20");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  const search = page.getByRole("searchbox", { name: "Поиск по деканату" });
  await expect(search).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect((await search.boundingBox()).width).toBeGreaterThanOrEqual(86);
  await expectNavigation(nav, ["Расписание", "Навигатор", "Сервисы", "Тинки — помощник"]);

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 745 });
    await nav.getByRole("button", { name: "Расписание", exact: true }).click();
    const exportButton = page.getByRole("button", { name: "Скачать расписание", exact: true });
    await expect(exportButton).toBeHidden();

    const navigator = nav.getByRole("button", {name:"Навигатор",exact:true});
    await navigator.click();
    await expect(navigator).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".atlas-nav")).toBeVisible();
    await expect(nav.getByRole("button", {name:"Сервисы",exact:true})).not.toHaveAttribute("aria-current");
    await nav.getByRole("button", {name:"Сервисы",exact:true}).click();
    await page.getByRole("button", { name: "Учёба", exact: true }).click();
    await expect(nav.getByRole("button", {name:"Сервисы",exact:true})).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Учебный план", exact: true }).click();
    const controlHeading = page.getByRole("columnheader", { name: "Контроль" });
    await expect(controlHeading).toBeInViewport({ ratio: 1 });
    expect((await controlHeading.boundingBox()).width).toBeGreaterThanOrEqual(75);

    await nav.getByRole("button", { name: "Сервисы", exact: true }).click();
    await page.getByRole("button", { name: "Документы и заявления", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Документы и заявления", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }

  const settings = page.locator(".rail").getByRole("button", { name: "Настройки", exact: true });
  await settings.click();
  const panel = page.getByRole("dialog", { name: "Настройки", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: /^Профиль/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^Уведомления/ })).toBeVisible();
  const theme = panel.getByRole("button", { name: /^Тема:/ });
  const previous = await theme.getAttribute("aria-label");
  await theme.click();
  await expect(theme).not.toHaveAttribute("aria-label", previous);
  await expect(panel).toBeInViewport({ ratio: 1 });
  expect(await panel.boundingBox()).toMatchObject({x:0,y:0,width:430,height:745});
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(settings).toBeFocused();
  await nav.getByRole("button", {name:"Тинки — помощник",exact:true}).click();
  const assistant = page.getByRole("dialog", {name:"Тинки — помощник",exact:true});
  await expect(assistant).toBeVisible();
  expect(await assistant.boundingBox()).toMatchObject({x:0,y:0,width:430,height:745});
  await assistant.getByRole("button", {name:"Закрыть Тинки",exact:true}).click();
  await expect(assistant).toBeHidden();
  if (await page.evaluate(() => CSS.supports("-webkit-tap-highlight-color", "transparent"))) {
    await expect(settings).toHaveCSS("-webkit-tap-highlight-color", "rgba(0, 0, 0, 0)");
  }
});

test("преподаватель открывает справочник с нижней панели", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 745 });
  await page.goto("/schedule");
  await page.getByRole("combobox", { name: "Демонстрационный пользователь", exact: true }).click();
  await page.getByRole("option", {name: new RegExp("Преподаватель" + "$")}).first().click();
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  await expectNavigation(nav, ["Расписание", "Люди", "Сервисы", "Тинки — помощник"]);

  const people = nav.getByRole("button", { name: "Люди", exact: true });
  await people.click();
  await expect(people).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Люди", exact: true })).toBeVisible();
});

test("на 320 пикселях вкладки деканата в одном ряду, форма переноса открывается в видимой части", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 745 });
  await page.goto("/office");
  await page.getByRole("combobox", { name: "Демонстрационный пользователь", exact: true }).click();
  await page.getByRole("option", {name: new RegExp("Сотрудник деканата" + "$")}).first().click();
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  await expectNavigation(nav, ["Обращения", "Расписание", "Сервисы", "Тинки — помощник"]);
  await page.evaluate(() => document.fonts.ready);
  const rows = await nav.getByRole("button").evaluateAll(buttons =>
    buttons.map(button => Math.round(button.getBoundingClientRect().top)),
  );
  expect(new Set(rows).size).toBe(1);

  await page.getByRole("button", { name: "Написать письмо", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Написать письмо", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Новая задача" }).click();
  await expect(page.getByLabel("Срок", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await nav.getByRole("button", { name: "Расписание", exact: true }).click();
  await page.locator(".office-schedule-list button").first().click();
  await page.getByRole("button", { name: "Перенести пару", exact: true }).click();
  const form = page.getByRole("form", { name: /^Перенести пару/ });
  await expect(form).toBeFocused();
  await expect(form.getByLabel("Новая дата")).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Закрыть", exact: true })).toBeInViewport({ ratio: 1 });
});
