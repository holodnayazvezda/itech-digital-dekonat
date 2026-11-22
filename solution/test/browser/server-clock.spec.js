import { test, expect } from "@playwright/test";
test.use({timezoneId:"Pacific/Honolulu"});

test("сегодня и время занятия берутся с сервера при неверных часах устройства", async ({page}) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : ["2001-01-01T00:00:00Z"])); }
      static now() { return NativeDate.parse("2001-01-01T00:00:00Z"); }
    };
  });
  await page.goto("/");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  const calendar=page.locator(".calendar-responsive");
  await expect(calendar).toBeVisible();
  const day=page.getByRole("button",{name:"День",exact:true});
  if(await day.isVisible())await day.click();
  await expect(calendar.getByRole("button",{name:"Сегодня",exact:true}).last()).toHaveAttribute("aria-current","date");
  await expect(calendar).toContainText("20 ноября");
  await expect(page.locator(".timetable-agenda")).toContainText("10 мин");
});

test("недоступное время сервера показывает повтор подключения", async({page})=>{
  await page.route("**/api/campus/clock",r=>r.fulfill({status:503,body:"unavailable"}));
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Кабинет не загрузился"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Обновить",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Войти",exact:true})).toHaveCount(0);
});

test("новый серверный день обновляет сегодня и сохраняет выбранную другую дату", async({page})=>{
  let date = "2026-11-20", delivered;
  await page.route("**/api/campus/state", async route => {
    const response = await route.fetch();
    const state = await response.json();
    await route.fulfill({response,json:{...state,clock:{now:date+"T09:50:00+03:00",date,timezone:"Europe/Moscow"}}});
    delivered = date;
  });
  await page.goto("/");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  const calendar=page.locator(".calendar-responsive");
  await expect(calendar).toBeVisible();
  const dayMode = page.getByRole("button",{name:"День",exact:true});
  if (await dayMode.isVisible()) await dayMode.click();
  await expect(calendar).toContainText("20 ноября");
  date = "2026-11-21";
  await expect(calendar).toContainText("21 ноября");
  await page.getByRole("button",{name:/Предыдущ/}).first().click();
  const selected=await calendar.locator(".calendar-date-meta").textContent();
  date = "2026-11-22";
  await expect.poll(()=>delivered).toBe("2026-11-22");
  await expect(calendar.locator(".calendar-date-meta")).toHaveText(selected);
});
