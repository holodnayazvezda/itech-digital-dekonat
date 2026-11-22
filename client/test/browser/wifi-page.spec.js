import {test,expect} from "@playwright/test";

test("Wi-Fi: данные, копирование, показ пароля, смена и активация",async({page,context,browserName},testInfo)=>{
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read","clipboard-write"]);
  } else {
    await page.addInitScript(() => {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async text => {
        await write(text);
        window.lastClipboardWrite = text;
      };
    });
  }
  const copied = () => browserName === "chromium"
    ? page.evaluate(() => navigator.clipboard.readText())
    : page.evaluate(() => window.lastClipboardWrite);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");await page.getByRole("button",{name:"Войти",exact:true}).click();
  await page.getByRole("navigation", { name: "Навигация кабинета", exact: true }).getByRole("button",{name:"Сервисы",exact:true}).click();
  await page.getByRole("button",{name:"Wi-Fi кампуса",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Wi-Fi кампуса",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Campus Study",exact:true})).toBeVisible();
  const login=page.getByRole("textbox",{name:"Логин",exact:true});
  const password=page.locator("#campus-wifi-password");
  await expect(login).toHaveValue("student.demo");
  await expect(password).toHaveAttribute("type","password");
  await page.getByRole("button",{name:"Скопировать логин",exact:true}).press("Enter");
  await expect.poll(copied).toBe("student.demo");
  await expect(page.getByRole("button",{name:"Скопировать логин: скопировано",exact:true})).toBeFocused();
  await page.getByRole("button",{name:"Показать пароль",exact:true}).click();
  const previous=await password.inputValue();
  await expect(password).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Скопировать пароль",exact:true}).click();
  await expect.poll(copied).toBe(previous);
  await page.getByRole("button",{name:"Скрыть пароль",exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("wifi.png")});
  await page.getByRole("button",{name:"Сменить пароль",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Создать новый пароль?",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Отмена",exact:true}).click();
  await expect(password).toHaveValue(previous);
  await page.getByRole("button",{name:"Сменить пароль",exact:true}).click();
  await page.getByRole("button",{name:"Создать пароль",exact:true}).click();
  await expect(password).not.toHaveValue(previous);
  await expect(password).toHaveAttribute("type","password");
  await expect(page.locator(".wifi-activation-card")).toContainText("5 минут");
  await expect(page.locator(".wifi-countdown")).toHaveText(/^[45]:[0-5][0-9]$/);
  await page.getByText("Не получается подключиться?",{exact:true}).click();
  await expect(page.locator(".wifi-help[open]")).toContainText("дождитесь времени активации");
  await page.getByRole("button",{name:"Назад",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Сервисы",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("уведомление плавно появляется снизу и затухает",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/");await page.getByRole("button",{name:"Войти",exact:true}).click();
  await page.getByRole("navigation", { name: "Навигация кабинета", exact: true }).getByRole("button",{name:"Сервисы",exact:true}).click();
  await page.getByRole("button",{name:"Wi-Fi кампуса",exact:true}).click();
  await page.getByRole("button",{name:"Сменить пароль",exact:true}).click();
  await page.getByRole("button",{name:"Создать пароль",exact:true}).click();
  const toast=page.locator(".campus-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS("border-radius","24px");
  await expect(toast).toHaveCSS("animation-name","campus-toast-enter");
  await expect(toast).toHaveClass(/toast-exiting/);
  await expect(toast).toHaveCSS("animation-name","campus-toast-exit");
  await expect(toast).not.toBeVisible();
});
