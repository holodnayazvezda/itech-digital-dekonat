import { test, expect } from "@playwright/test";

test("вход с паролем, глазок и все демонстрационные кабинеты", async ({ page }) => {
  await page.goto("/");
  const username=page.getByRole("textbox",{name:"Логин",exact:true});
  const password=page.getByLabel("Пароль",{exact:true});
  await expect(password).toHaveAttribute("type","password");
  await page.getByRole("button",{name:"Показать пароль",exact:true}).click();
  await expect(password).toHaveAttribute("type","text");
  await expect(password).toHaveValue("CampusDemo2026!");
  await page.getByRole("button",{name:"Скрыть пароль",exact:true}).click();
  await password.fill("incorrect-password");
  const response=page.waitForResponse(r=>r.url().endsWith("/api/campus/login") && r.request().method()==="POST");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  expect((await response).status()).toBe(401);
  await expect(page.getByText("Неверный кабинет или пароль",{exact:true})).toBeVisible();
  for(const id of ["student","friend","teacher","dean-data","office"]) {
    await page.getByRole("combobox",{name:"Демонстрационный пользователь",exact:true}).click();
    await page.getByRole("option").nth(["student","friend","teacher","dean-data","office"].indexOf(id)).click();
    await expect(username).toHaveValue(id);
    await expect(password).toHaveValue("CampusDemo2026!");
    await expect(password).toHaveAttribute("type","password");
  }
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  await expect(page.locator(".shell")).toBeVisible();
  await expect(page.getByRole("button",{name:"Новая задача",exact:true})).toBeVisible();
});
