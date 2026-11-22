import { test, expect } from "@playwright/test";

async function openProfile(page) {
  await page.getByRole("button",{name:"Настройки",exact:true}).click();
  await page.getByRole("dialog",{name:"Настройки",exact:true}).getByRole("button",{name:/Профиль/}).click();
  return page.getByRole("dialog",{name:"Профиль",exact:true});
}

test("компактный профиль, выбор демо-пользователя и выход", async ({page}) => {
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  let dialog=await openProfile(page);
  await expect(dialog.getByRole("heading",{name:"Профиль",exact:true})).toBeVisible();
  await expect(dialog.getByRole("heading",{name:"Клёнова Арина Дмитриевна",exact:true})).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Изменить фото",exact:true})).toBeVisible();
  await expect(dialog.getByRole("region",{name:"Учёба",exact:true})).toContainText("Прикладная аналитика");
  await expect(dialog.locator("dl")).toContainText("Факультет аналитики");
  await expect(dialog.locator("dl")).toContainText("Курс2");
  await expect(dialog.locator("dl")).toContainText("АД-21");
  await expect(dialog).not.toContainText("Табельный номер");
  await expect(dialog).not.toContainText("Демонстрационные данные профиля");
  await expect(dialog).not.toContainText("Быстрое действие");
  await expect(dialog.getByRole("switch")).toHaveCount(0);
  expect(await dialog.evaluate(el => el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:`docs/profile-${page.viewportSize().width}.png`});
  await dialog.getByRole("button",{name:"Сменить пользователя",exact:true}).click();
  await dialog.getByRole("combobox",{name:"Пользователь",exact:true}).click();
  await expect(dialog.getByRole("option")).toHaveCount(5);
  await dialog.getByRole("option",{name:/Мартынов Никита Романович/}).click();
  await dialog.getByRole("button",{name:"Перейти в кабинет",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  dialog=await openProfile(page);
  await expect(dialog.getByRole("heading",{name:"Мартынов Никита Романович",exact:true})).toBeVisible();
  await expect(dialog.locator("dl")).toContainText("АД-32");
  await dialog.getByRole("button",{name:"Выйти",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Вход",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
