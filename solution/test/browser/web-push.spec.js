import { test, expect } from "@playwright/test";

// Opt-in integration test: Firefox contacts Mozilla's public Web Push service.
test.skip(({ browserName }) => process.env.CAMPUS_TEST_REAL_PUSH !== "1" ||
  browserName !== "firefox" || test.info().project.name !== "firefox-desktop", "Требуется внешний провайдер Web Push Firefox");
test.use({
  permissions: ["notifications"],
  launchOptions: {firefoxUserPrefs: {
    "dom.push.enabled": true,
    "dom.push.connection.enabled": true,
    "dom.push.serverURL": "wss://push.services.mozilla.com/",
  }},
});

test("Web Push доставляет решение после закрытия вкладок студента и офиса", async ({ context, request }) => {
  test.setTimeout(90000);
  const signIn = async role => {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("combobox", {name: "Демонстрационный пользователь", exact: true}).click();
    await page.getByRole("option", {name: new RegExp(role === "student" ? "Студент" : "Сотрудник деканата" + "$")}).first().click();
    await page.getByRole("button", {name: "Войти", exact: true}).click();
    await page.getByRole("button", {name: "Настройки", exact: true}).click();
    await page.getByRole("button", {name: /^Уведомления/}).click();
    await expect(page.getByText("Уведомления браузера включены.", {exact: true})).toBeVisible({timeout: 30000});
    const token = await page.evaluate(() => sessionStorage.getItem("atlas-session"));
    return { page, headers: {Authorization: "Bearer " + token} };
  };
  const student = await signIn("student");
  const office = await signIn("office");
  const response = await request.post("/api/campus/request", {
    headers: student.headers,
    data: {kind: "booking", short: "Б-108", date: "2026-11-27", time: "21:00", end: "22:00"},
  });
  expect(response.ok()).toBe(true);
  const {id} = await response.json();
  await student.page.close();
  await office.page.close();
  expect((await request.post("/api/campus/decision", {
    headers: office.headers, data: {id, status: "approved"},
  })).ok()).toBe(true);
  const state = await (await request.get("/api/campus/state", {headers: student.headers})).json();
  const notice = state.notes.find(note => note.ref === id && note.title === "Бронь одобрена");
  expect(notice).toBeTruthy();

  // This static page cannot poll the campus API or initiate foreground delivery.
  const observer = await context.newPage();
  await observer.goto("/mark.svg");
  await expect.poll(() => observer.evaluate(async id => {
    const registration = await navigator.serviceWorker.ready;
    const list = await registration.getNotifications({tag: "campus:student:" + id});
    return list.map(note => [note.title, note.data.owner, note.data.id]);
  }, notice.id), {timeout: 30000}).toEqual([[notice.title, "student", notice.id]]);
});
