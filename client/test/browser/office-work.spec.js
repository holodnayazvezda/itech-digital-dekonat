import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

async function authorize(request, role) {
  const session = await request.post("/api/campus/login", { data:{role, password:"CampusDemo2026!"} });
  expect(session.ok()).toBe(true);
  const { token } = await session.json();
  return { Authorization: `Bearer ${token}` };
}

test("задача деканата связана с заявкой и сохраняется после перезагрузки", async ({ page, request }) => {
  const submitted = await request.post("/api/campus/request", {
    headers: await authorize(request, "student"),
    data: { kind: "document", name: "Справка об обучении", format: "Электронная", values: { destination: "Библиотека" } },
  });
  expect(submitted.ok()).toBe(true);
  const record = await submitted.json();

  await page.goto("/office");
  await page.getByRole("combobox", { name: "Демонстрационный пользователь", exact: true }).click();
  await page.getByRole("option", {name: new RegExp("Сотрудник деканата" + "$")}).first().click();
  await page.getByRole("button", { name: "Войти", exact: true }).click();

  const title = `Сверить справку ${randomUUID().slice(0, 6)}`;
  const tasks = page.getByRole("region", { name: "Задачи деканата" });
  await tasks.getByRole("button", { name: "Новая задача" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await tasks.getByLabel("Название", { exact: true }).fill(title);
  await tasks.getByLabel("Срок", { exact: true }).fill("2026-11-27");
  await tasks.getByRole("combobox", { name: "Связанная заявка", exact: true }).selectOption(record.id);
  await tasks.getByRole("button", { name: "Добавить", exact: true }).click();
  const task = tasks.getByRole("listitem").filter({ hasText: title });
  await expect(task).toContainText("27 ноября");
  await expect(task.getByRole("button", { name: "Открыть заявку: Справка об обучении" })).toBeVisible();
  await task.getByRole("button", { name: `Завершить: ${title}` }).click();
  await expect(task).toHaveCount(0);

  await page.reload();
  await tasks.getByRole("button", { name: /^Готово/ }).click();
  await task.getByRole("button", { name: `Вернуть в работу: ${title}` }).click();
  await tasks.getByRole("button", { name: /^В работе/ }).click();
  await expect(task.getByRole("button", { name: `Завершить: ${title}` })).toBeVisible();
});

test("студент заменяет файл в возвращённой заявке, сохраняя её номер", async ({ page, request }) => {
  const student = await authorize(request, "student");
  const office = await authorize(request, "office");
  const submitted = await request.post("/api/campus/request", {
    headers: student,
    data: {
      kind: "document", name: "Справка об обучении", format: "Электронная", values: { destination: "Библиотека" },
      attachment: { name: "черновик.pdf", mime: "application/pdf", base64: Buffer.from("%PDF-1.4").toString("base64") },
    },
  });
  expect(submitted.ok()).toBe(true);
  const { id } = await submitted.json();
  expect((await request.post("/api/campus/clarify", {
    headers: office, data: { id, body: "Приложите исправленный файл." },
  })).ok()).toBe(true);

  await page.goto("/services/requests");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.getByRole("button", { name: /Справка об обучении/ }).first().click();
  await expect(page.getByText("Приложите исправленный файл.")).toBeVisible();
  await page.getByLabel("Дополнительные сведения", { exact: true }).fill("Исправила данные.");
  const corrected = Buffer.from("%PDF-1.4\n% corrected fixture");
  await page.getByLabel(/Заменить вложение/).setInputFiles({
    name: "исправление.pdf", mimeType: "application/pdf", buffer: corrected,
  });
  await page.getByRole("button", { name: "Дополнить заявку", exact: true }).click();
  await expect(page.getByRole("button", { name: /Скачать вложение · исправление.pdf/ })).toBeVisible();
  const attachment = await request.get(`/api/campus/attachment/${id}`, { headers: office });
  expect(await attachment.body()).toEqual(corrected);
});
