import {test, expect} from "@playwright/test";
import {rooms, numberTime, timeText} from "../../shared/campus-data.js";

test("поиск в большом аудиторном фонде и бронь аудитории с частичного этажа", async ({page}, info) => {
  const room = rooms.find(r => r.short.startsWith("Б-") && r.floor === "5" && r.kind === "Аудитория");
  const slot = {"chromium-desktop":"18:00","chromium-mobile":"18:30","firefox-desktop":"19:00","firefox-mobile":"19:30","webkit-mobile":"20:30"}[info.project.name];
  await page.goto("/");
  await page.getByRole("button", {name:"Войти",exact:true}).click();
  const nav = page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  await nav.getByRole("button", {name:"Сервисы",exact:true}).click();
  await page.getByRole("button", {name:/Бронирование помещений/}).click();
  await page.locator(".space-buildings button").filter({hasText:room.building.name}).click();
  await page.getByRole("button",{name:"Аудитории",exact:true}).click();

  const cards = page.locator(".space-room-card");
  await expect(cards).toHaveCount(12);
  await page.getByRole("button",{name:"Показать ещё",exact:true}).click();
  await expect(cards).toHaveCount(24);
  const search = page.getByRole("searchbox",{name:"Поиск помещения"});
  await search.fill("Q9999");
  await expect(page.getByText(/Помещений не найдено/)).toBeVisible();
  await expect(cards).toHaveCount(0);
  await search.fill(room.short.replace("Б-","B"));
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(room.floorName);
  await cards.first().click();
  await page.getByLabel("Дата бронирования",{exact:true}).fill("2026-12-06");
  await page.getByRole("button",{name:"Вечер",exact:true}).click();
  await page.getByRole("button",{name:`${slot} — ${timeText(numberTime(slot)+60)}`,exact:true}).click();
  await page.getByRole("button",{name:"Отправить заявку",exact:true}).click();
  await expect(page.locator(".result-card.pending")).toContainText(room.short);
});
