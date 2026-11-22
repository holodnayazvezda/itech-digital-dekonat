import {test, expect} from "@playwright/test";

const button = (page, name) => page.getByRole("button", {name, exact: true});

async function signIn(page, path, role) {
  await page.goto(path);
  if (role) {
    await page.getByRole("combobox", {name: "Демонстрационный пользователь", exact: true}).click();
    await page.getByRole("option", {name: new RegExp(role + "$")}).first().click();
  }
  await button(page, "Войти").click();
}

test("рассылка в группу открывает персональные диалоги с двусторонним ответом", async ({page, context}, testInfo) => {
  await signIn(page, "/services/chats", "Преподаватель");
  await expect(page).toHaveURL(/\/services\/chats$/);
  await button(page, "Рассылка группе").click();
  const form = page.locator(".mass-message");
  await form.getByLabel("Учебная группа").selectOption("АД-21");
  const label = await form.locator("select option:checked").textContent();
  const recipients = Number(label.match(/\d+$/)[0]);
  expect(recipients).toBeGreaterThan(1);
  const text = "Встречаемся на консультации · " + testInfo.project.name + " · " + Date.now();
  await form.getByLabel("Текст рассылки").fill(text);
  await button(form, "Отправить группе АД-21").click();
  await expect(page.getByRole("status").filter({hasText: "Сообщение отправлено группе"})).toContainText("Получателей — " + recipients);
  await page.getByLabel("Поиск по диалогам").fill(text);
  await expect(page.locator(".thread-row")).toHaveCount(recipients);

  const student = await context.newPage();
  await signIn(student, "/#notices");
  await student.getByRole("button", {name: /Сообщение группе АД-21/}).first().click();
  await expect(student).toHaveURL(/\/services\/chat\/teacher$/);
  await expect(student.getByRole("log")).toContainText(text);
  const reply = "Буду, благодарю! · " + testInfo.project.name + " · " + Date.now();
  await student.getByLabel("Сообщение", {exact: true}).fill(reply);
  await button(student, "Отправить сообщение").click();
  await expect(student.getByRole("log")).toContainText(reply);
  await student.goto("/services/chats");
  await expect(student.getByRole("heading", {name: "Мои диалоги"})).toBeVisible();
  await expect(button(student, "Рассылка группе")).toHaveCount(0);

  await page.getByLabel("Поиск по диалогам").fill("Клёнова");
  await page.locator(".thread-row").filter({hasText: "Арина Дмитриевна"}).click();
  await expect(page.getByRole("log")).toContainText(reply);
  await student.close();
});
