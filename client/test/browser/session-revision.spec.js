import {test, expect} from "@playwright/test";

const enter = page => page.getByRole("button", {name:"Войти",exact:true}).click();

test("фоновый опрос не вытесняет медленный вход", async({page})=>{
  await page.clock.install();
  let attempts = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/api/campus/state",async route=>{
    attempts++;
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await enter(page);
  try {
    await expect.poll(()=>attempts).toBe(1);
    await page.clock.runFor(2300);
    expect(attempts).toBe(1);
  } finally { release(); }
  await expect(page.locator(".shell")).toBeVisible();
});

test("временная недоступность API при перезагрузке сохраняет кабинет",async({page})=>{
  await page.goto("/");
  await enter(page);
  await expect(page.locator(".shell")).toBeVisible();
  const session = await page.evaluate(()=>sessionStorage.getItem("atlas-session"));
  await page.route("**/api/campus/state",route=>route.fulfill({status:503,json:{error:"Повторяем подключение"}}),{times:1});
  await page.reload();
  await expect(page.locator(".shell")).toBeVisible({timeout:9000});
  expect(await page.evaluate(()=>sessionStorage.getItem("atlas-session"))).toBe(session);
});

test("при истечении сессии личная карточка закрывается",async({page})=>{
  await page.goto("/");
  await enter(page);
  await expect(page.locator(".shell")).toBeVisible();
  await page.getByRole("button",{name:"Настройки",exact:true}).click();
  await page.getByRole("dialog",{name:"Настройки",exact:true}).getByRole("button",{name:/Профиль/}).click();
  await expect(page.getByRole("dialog",{name:"Профиль",exact:true})).toBeVisible();
  await page.route("**/api/campus/state",route=>route.fulfill({status:401,json:{error:"Войдите снова"}}));
  await expect(page.locator(".login-page")).toBeVisible({timeout:9000});
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});
