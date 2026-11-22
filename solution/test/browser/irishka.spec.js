import { test, expect } from "@playwright/test";
const dialogName = "Тинки — помощник";
async function enter(page, {newChat = true} = {}) {
  await page.goto("/");
  await page.getByRole("button", {name:"Войти",exact:true}).click();
  await page.getByRole("button", {name:dialogName,exact:true}).click();
  const dialog = page.getByRole("dialog", {name:dialogName,exact:true});
  if (newChat) await dialog.getByRole("button", {name:"Новый чат",exact:true}).first().click();
  return dialog;
}

test("темы чата, нейтральное затемнение, четыре подсказки и анимированный персонаж", async ({page}, testInfo) => {
  const dialog = await enter(page, {newChat:false});
  await expect(dialog).toBeFocused();
  await dialog.getByRole("button", {name:"Новый чат",exact:true}).first().click();
  await expect(dialog).toHaveCSS("outline-style", "none");
  const phoneLayout = page.viewportSize().width <= 640;
  if (phoneLayout) {
    await expect(dialog.locator(".irishka-chat-rail")).toHaveCount(0);
    const main = await dialog.locator(".irishka-chat-main").boundingBox();
    expect(main.width).toBe(page.viewportSize().width);
    await expect(dialog.locator(".irishka-chat-header").getByRole("button", {name:"История чатов",exact:true})).toBeVisible();
  } else {
    await expect(dialog.locator(".irishka-chat-rail > button").first()).toHaveCSS("box-shadow", "none");
  }
  const dark=await page.locator(".v-application").evaluate(el => el.classList.contains("v-theme--Dark"));
  await expect(dialog).toHaveCSS("background-color", dark ? "rgb(25, 25, 25)" : "rgb(255, 255, 255)");
  expect(await dialog.evaluate(el => getComputedStyle(el,"::backdrop").backgroundColor)).toBe("rgba(0, 0, 0, 0.44)");
  await expect(dialog.getByRole("heading", {name:"Привет, Арина"})).toBeVisible();
  await expect(dialog.locator(".irishka-suggestions button")).toHaveCount(4);
  const canvas = await dialog.locator(".irishka-chat-scroll").boundingBox();
  const markBox = await dialog.locator(".irishka-character").boundingBox();
  const suggestions = await dialog.locator(".irishka-suggestions").boundingBox();
  expect(markBox.x + markBox.width / 2).toBeCloseTo(canvas.x + canvas.width / 2, 0);
  expect((markBox.y + suggestions.y + suggestions.height) / 2).toBeCloseTo(canvas.y + canvas.height / 2, 0);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath("welcome.png")});
  await dialog.getByRole("button", {name:"История чатов",exact:true}).click();
  await expect(dialog.locator(".irishka-chat-rail svg.irishka-mark")).toHaveCount(0);
  await expect(dialog.getByRole("heading", {name:"Твои чаты"})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("history.png")});
  await dialog.locator(".irishka-history").getByRole("button", {name:"Новый чат",exact:true}).click();
  await expect(dialog.getByRole("heading", {name:"Твои чаты"})).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  const trigger = page.getByRole("button",{name:dialogName,exact:true});
  await expect(trigger).toBeFocused();
  if (phoneLayout) await expect(trigger).toHaveCSS("border-radius","22px");
  else await expect(trigger).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
  await page.emulateMedia({reducedMotion:"no-preference"});
  const mark=trigger.locator("svg");
  if (!phoneLayout) {
    await page.mouse.move(1,100);
    await expect.poll(() => mark.evaluate(el => parseFloat(el.style.getPropertyValue("--look-x")))).toBeLessThan(0);
    await page.mouse.move(page.viewportSize().width-1,100);
    await expect.poll(() => mark.evaluate(el => parseFloat(el.style.getPropertyValue("--look-x")))).toBeGreaterThan(0);
  }
  await expect(mark.locator(".irishka-eyes")).toHaveCSS("animation-name","irishka-blink");
  for(let i=0;i<3;i++) {
    const phone = page.viewportSize().width <= 640;
    if (phone) await page.getByRole("button", { name: "Настройки", exact: true }).click();
    await page.getByRole("button",{name:/^Тема:/}).click();
    await expect(page.locator("html")).not.toHaveClass(/theme-crossfade/);
    if (phone) await page.getByRole("button", { name: "Закрыть настройки", exact: true }).click();
    const isDark=await page.locator(".v-application").evaluate(el => el.classList.contains("v-theme--Dark"));
    await trigger.click();
    await expect(dialog).toHaveCSS("background-color",isDark?"rgb(25, 25, 25)":"rgb(255, 255, 255)");
    await page.keyboard.press("Escape");
  }
});

test("поле Тинки остаётся над клавиатурой при сжатии видимой области", async ({page}) => {
  test.skip(page.viewportSize().width > 640, "Мобильный чат");
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, "visualViewport", { value: viewport });
  });
  const dialog = await enter(page);
  const input = dialog.getByRole("textbox", {name:"Сообщение Тинки"});
  const fullHeight = await page.evaluate(() => window.innerHeight);
  await input.fill("Черновик");

  await page.evaluate(() => {
    Object.assign(window.visualViewport, { height:470, offsetTop:24 });
    window.visualViewport.dispatchEvent(new Event("resize"));
    window.visualViewport.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(() => dialog.boundingBox()).toMatchObject({ y:24, height:470 });
  expect(await dialog.locator(".irishka-chat-scroll").evaluate(node => node.scrollTop)).toBe(0);
  const field = await dialog.locator(".irishka-composer").boundingBox();
  expect(field.y + field.height).toBeLessThan(24 + 470);
  const send = await dialog.getByRole("button", {name:"Отправить сообщение", exact:true}).boundingBox();
  expect(send.y + send.height).toBeLessThan(24 + 470);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Черновик");

  await page.evaluate(height => {
    Object.assign(window.visualViewport, { height, offsetTop:0 });
    window.visualViewport.dispatchEvent(new Event("resize"));
  }, fullHeight);
  await expect.poll(() => dialog.boundingBox()).toMatchObject({ y:0, height:fullHeight });
  await expect(input).toHaveValue("Черновик");
});

test("отправка, история после перезагрузки, поиск, переименование и удаление", async ({page}, testInfo) => {
  let dialog=await enter(page);
  await dialog.getByRole("button", {name:"Как заказать справку?",exact:true}).click();
  await expect(dialog.getByRole("article", {name:"Ответ Тинки"})).toContainText("Справка об обучении");
  await expect(dialog.getByRole("link", {name:/Справка об обучении/})).toBeVisible();
  await expect(dialog.locator(".irishka-chat-header")).toContainText("Заказ справки");
  const input=dialog.getByRole("textbox", {name:"Сообщение Тинки"});
  await input.fill("Мои оценки"); await input.press("Enter");
  await expect(dialog.getByRole("article", {name:"Ответ Тинки"})).toHaveCount(2);
  await expect(dialog.getByRole("article", {name:"Ответ Тинки"}).last()).toContainText("Анализ данных");
  await page.screenshot({path:testInfo.outputPath("messages.png")});
  await page.reload();
  await page.getByRole("button", {name:dialogName,exact:true}).click();
  dialog=page.getByRole("dialog",{name:dialogName,exact:true});
  await expect(dialog.getByRole("article", {name:"Ответ Тинки"})).toHaveCount(2);
  await dialog.getByRole("button", {name:"История чатов",exact:true}).click();
  await expect(dialog.locator(".irishka-chat-header")).toContainText("Заказ справки");
  await dialog.getByRole("textbox", {name:"Поиск по чатам"}).fill("Заказ справки");
  await dialog.getByRole("button", {name:"Переименовать чат «Заказ справки»",exact:true}).first().click({force:true});
  await dialog.getByRole("textbox", {name:"Название чата"}).fill("Справка и оценки");
  await dialog.getByRole("button", {name:"Сохранить название",exact:true}).click();
  await expect(dialog.locator(".irishka-chat-header")).toContainText("Справка и оценки");
  await dialog.getByRole("textbox", {name:"Поиск по чатам"}).fill("Справка и оценки");
  await dialog.locator(".irishka-history-select").filter({hasText:"Справка и оценки"}).first().click();
  await expect(dialog.getByRole("article", {name:"Ответ Тинки"})).toHaveCount(2);
  await dialog.getByRole("button",{name:"История чатов",exact:true}).click();
  await dialog.locator(".irishka-history-item").filter({hasText:"Справка и оценки"}).first().hover();
  await dialog.getByRole("button",{name:"Удалить чат «Справка и оценки»",exact:true}).first().click();
  await dialog.getByRole("button",{name:"Удалить",exact:true}).click();
  await expect(dialog.getByRole("heading", {name:"Привет, Арина"})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Тинки отправляет сообщения, когда браузер не предоставляет crypto.randomUUID", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, "randomUUID", { value: undefined });
  });
  const dialog = await enter(page);
  const request = page.waitForRequest(req => req.method() === "POST" && req.url().endsWith("/messages/stream"));
  await dialog.getByRole("textbox", { name: "Сообщение Тинки" }).fill("Как заказать справку?");
  await dialog.getByRole("button", { name: "Отправить сообщение", exact: true }).click();
  expect((await request).postDataJSON().request_id)
    .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await expect(dialog.getByRole("article", { name: "Ответ Тинки" })).toContainText(/справк/i);
  await expect(dialog.getByRole("article", { name: "Твоё сообщение" })).toHaveCount(1);
  await expect(dialog.getByRole("alert")).toBeHidden();
});

test("ошибка отправки и повтор без двойного сообщения", async ({page}) => {
  const dialog=await enter(page);
  let failed=false;
  await page.route("**/irishka/chats/*/messages/stream", async route => {
    if(!failed){failed=true;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Временно нет связи"})});}
    else await route.continue();
  });
  const input=dialog.getByRole("textbox",{name:"Сообщение Тинки"});
  await input.fill("Расписание на неделю");await input.press("Enter");
  await expect(dialog.getByRole("alert")).toContainText("Временно нет связи");
  await dialog.getByRole("button",{name:"Повторить отправку",exact:true}).click();
  await expect(dialog.getByRole("article",{name:"Ответ Тинки"})).toHaveCount(1);
  await expect(dialog.getByRole("article",{name:"Твоё сообщение"})).toHaveCount(1);
  await expect(dialog.getByRole("alert")).not.toBeVisible();
});

test("Markdown виден в потоке, карточки и действия появляются после ответа", async ({page}) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (!String(url).endsWith("/messages/stream")) return nativeFetch(url, options);
      const text = JSON.parse(options.body).text;
      const encoder = new TextEncoder();
      const answer = "**Найдено**\n\n- Первый результат\n- Второй результат";
      const blocks = [{ type:"search", matches:[
        {category:"subjects", id:"Статистика", name:"Статистика", detail:"Практика", date:"2026-11-23"},
      ] }];
      const stream = new ReadableStream({
        start(controller) {
          function send(event) {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          }
          send({type:"status", state:"thinking"});
          send({type:"blocks", blocks});
          window.publishAssistantDraft = () => {
            const event = encoder.encode(JSON.stringify({type:"delta", text:"**Найдено**"}) + "\n");
            const split = event.indexOf(0xd0) + 1;
            controller.enqueue(event.slice(0, split));
            controller.enqueue(event.slice(split));
          };
          window.finishAssistantDraft = () => {
            const chatId = String(url).split("/").at(-3);
            send({type:"delta", text:answer.slice("**Найдено**".length)});
            send({type:"done", chat:{id:chatId, title:"Расписание занятий", created:Date.now(), updated:Date.now(), messages:[
              {id:"fixture-user", role:"user", text, created:Date.now()},
              {id:"fixture-assistant", role:"assistant", text:answer, created:Date.now(),
                blocks, actions:[{action:"booked", label:"Мои заявки"}]},
            ]}});
            controller.close();
          };
        },
      });
      return Promise.resolve(new Response(stream, {headers:{"Content-Type":"application/x-ndjson"}}));
    };
  });
  const dialog = await enter(page);
  const input = dialog.getByRole("textbox", {name:"Сообщение Тинки"});
  await input.fill("Пример форматирования");
  await input.press("Enter");
  await expect.poll(() => page.evaluate(() => typeof window.publishAssistantDraft)).toBe("function");
  await page.evaluate(() => window.publishAssistantDraft());
  await expect(dialog.locator("strong").filter({hasText:"Найдено"})).toBeVisible();
  await expect(dialog.getByText("Первый результат")).toHaveCount(0);
  await expect(dialog.getByRole("region", {name:"Результаты поиска"})).toHaveCount(0);
  await page.evaluate(() => window.finishAssistantDraft());
  const message = dialog.getByRole("article", {name:"Ответ Тинки"});
  await expect(message.locator(".irishka-markdown li")).toHaveCount(2);
  await expect(message.getByRole("link", {name:/Статистика/})).toBeVisible();
  await expect(message.getByRole("link", {name:"Мои заявки", exact:true})).toHaveAttribute("href", "/services/requests");
  expect(await message.evaluate(node => {
    const prose = node.querySelector(".irishka-markdown");
    return ["[aria-label='Результаты поиска']", ".irishka-message-actions"].every(selector => (
      prose.compareDocumentPosition(node.querySelector(selector)) & Node.DOCUMENT_POSITION_FOLLOWING
    ));
  })).toBe(true);
  await expect(dialog.getByRole("article", {name:"Ответ Тинки"})).toHaveCount(1);
});

test("карточки расписания и маршрута открывают данные кабинета", async ({page}) => {
  const dialog = await enter(page);
  await dialog.getByRole("button", {name:"Расписание на неделю", exact:true}).click();
  const schedule = dialog.getByRole("article", {name:"Ответ Тинки"}).last();
  await expect(schedule).toContainText("Анализ данных");
  const input = dialog.getByRole("textbox", {name:"Сообщение Тинки"});
  await input.fill("Построй маршрут от Б-108 до Б-412");
  await input.press("Enter");

  const answer = dialog.getByRole("article", {name:"Ответ Тинки"}).last();
  await expect(answer.getByRole("combobox", {name:"Откуда", exact:true})).toHaveValue(/Б-108/);
  await expect(answer.getByRole("combobox", {name:"Куда", exact:true})).toHaveValue(/Б-412/);
  const plan = answer.getByRole("group", {name:/Поэтажный план/});
  await expect(plan.locator(".atlas-route-track")).toBeVisible();
  await expect(plan).toHaveAttribute("data-3d", "true");
  const initialView = await plan.getAttribute("viewBox");
  await answer.getByRole("button", {name:"Увеличить карту", exact:true}).click();
  await expect(plan).not.toHaveAttribute("viewBox", initialView);
  await expect(answer.locator(".irishka-map-instruction .campus-maneuver")).toContainText("Прямо");
  await answer.getByRole("link", {name:"Далее в навигаторе", exact:true}).click();
  await expect(dialog).not.toBeVisible();
  const directions = page.getByRole("region", {name:"Шаги маршрута"});
  await expect(directions).toContainText("Б-108");
  await expect(directions.locator(".campus-maneuver-icon svg").first()).toBeVisible();
  await expect(directions.locator(".campus-maneuver small").first()).toContainText(/≈ \d+ м/);
  await expect(page.getByRole("combobox", {name:"Куда", exact:true})).toHaveValue(/Б-412/);
  await page.reload();
  await expect(page.getByRole("region", {name:"Шаги маршрута"})).toContainText("Б-108");
  await expect(page.getByRole("combobox", {name:"Куда", exact:true})).toHaveValue(/Б-412/);
});

test("поиск людей и аудиторий, ссылки на форму и готовый PDF", async ({page}) => {
  const dialog = await enter(page);
  const input = dialog.getByRole("textbox", {name:"Сообщение Тинки"});
  const answers = dialog.getByRole("article", {name:"Ответ Тинки"});
  let count = 0;
  async function ask(text) {
    await input.fill(text);
    await input.press("Enter");
    const message = answers.nth(count++);
    await expect(message.getByRole("button", {name:"Скопировать сообщение", exact:true})).toBeVisible();
    return message;
  }
  const people = await ask("Найди Машу");
  await expect(people.getByRole("region", {name:"Результаты поиска"}).getByRole("link", {name:/Мария/}).first())
    .toHaveAttribute("href", /^\/services\/person\//);

  const room = await ask("Найди Б-412");
  await expect(room.getByRole("group", {name:/Поэтажный план/}).locator(".atlas-space[data-selected=true]"))
    .toHaveAttribute("aria-label", /Б-412/);
  await expect(room.getByRole("link", {name:/на карте/i}).first()).toHaveAttribute("href", /^\/services\/map\//);

  const forms = await ask("Как заказать справку об обучении?");
  await expect(forms.getByRole("link", {name:/Справка об обучении/})).toHaveAttribute("href", /^\/services\/apply\//);
  const documents = await ask("Скачать выписку из зачётной книжки");
  const downloadEvent = page.waitForEvent("download");
  await documents.getByRole("button", {name:/Выписка из зачётной книжки/}).click();
  expect((await downloadEvent).suggestedFilename().normalize("NFC")).toBe("Выписка из зачётной книжки.pdf");
  await expect(page.getByRole("dialog", {name:dialogName, exact:true})).toBeVisible();
  await forms.getByRole("link", {name:/Справка об обучении/}).click();
  await expect(page.getByRole("heading", {name:"Справка об обучении", exact:true})).toBeVisible();
});

test("Тинки называет преподавателя и даёт ссылки на профиль и аудиторию", async ({page}) => {
  const dialog = await enter(page);
  const input = dialog.getByRole("textbox", {name:"Сообщение Тинки"});
  await input.fill("Кто ведёт статистику 23 ноября?");
  await input.press("Enter");

  const answer = dialog.getByRole("article", {name:"Ответ Тинки"});
  await expect(answer.locator(".irishka-markdown")).toContainText("Лесова Вера Андреевна");
  await expect(answer.getByRole("link", {name:/Б-205/})).toHaveAttribute("href", /\/services\/map\//);
  const teacher = answer.getByRole("link", {name:/Лесова Вера Андреевна/});
  await expect(teacher).toHaveAttribute("href", /\/services\/person\//);
  await teacher.click();
  await expect(page.getByRole("heading", {name:"Лесова Вера Андреевна", exact:true})).toBeVisible();
});

test("Тинки подаёт спортивную заявку и строит маршрут по записи", async ({page}) => {
  const dialog = await enter(page);
  const input = dialog.getByRole("textbox", {name:"Сообщение Тинки"});
  await input.fill("Запиши меня на силовые тренировки");
  await input.press("Enter");
  const sports = dialog.getByRole("region", {name:"Запись на спорт"});
  const enroll = sports.getByRole("button", {name:/^Записаться: Силовые тренировки/}).first();
  await expect(enroll).toBeVisible();
  const response = page.waitForResponse(result =>
    result.url().endsWith("/api/campus/request") && result.request().method() === "POST"
  );
  await enroll.click();
  expect((await (await response).json()).record.status).toBe("pending");
  await expect(sports.getByText("Заявка на рассмотрении").first()).toBeVisible();
  await sports.getByRole("button", {name:"Маршрут на тренировку", exact:true}).click();
  const route = dialog.getByRole("region", {name:"Маршрут по кампусу"});
  await expect(route.getByRole("combobox", {name:"Куда", exact:true})).toHaveValue(/Н-101/);
  await route.getByRole("link", {name:"Далее в навигаторе", exact:true}).click();
  await expect(page.getByRole("region", {name:"Шаги маршрута"})).toContainText("Н-101");
});
