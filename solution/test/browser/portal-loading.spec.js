import { expect, test } from "@playwright/test";

async function holdRequest(page, pattern, run, { settle = route => route.continue(), times = 1 } = {}) {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const hold = async route => {
    await pending;
    await settle(route);
  };
  await page.route(pattern, hold, { times });
  try {
    await run();
  } finally {
    release();
  }
}

async function boxes(locator) {
  await expect(locator.first()).toBeVisible();
  return locator.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }).sort((a, b) => a.y - b.y || a.x - b.x));
}

function expectSameBoxes(actual, expected, dimensions = ["x", "y", "width", "height"]) {
  expect(actual).toHaveLength(expected.length);
  for (const [index, box] of actual.entries()) {
    const previous = expected[index];
    for (const key of dimensions) {
      expect(Math.abs(box[key] - previous[key]), `Блок ${index + 1}, ${key} (${previous[key]} → ${box[key]})`)
        .toBeLessThanOrEqual(1);
    }
  }
}

async function watchImageDecodes(page, heldFile = "") {
  await page.addInitScript(file => {
    const decode = HTMLImageElement.prototype.decode;
    const pending = new Promise(resolve => { window.releaseImageDecode = resolve; });
    HTMLImageElement.prototype.decode = function () {
      const result = decode.call(this);
      const image = new URL(this.src, document.baseURI).pathname.match(/\/services\/([\w-]+\.png)$/)?.[1];
      if (!image) return result;
      return result.then(() => {
        document.documentElement.setAttribute(`data-decoded-${image}`, "true");
        return image === file ? pending : undefined;
      });
    };
    const observer = new MutationObserver(() => {
      const pendingCards = document.querySelector(":is(.service-section-campus, .space-buildings)[data-image-pending]");
      if (!pendingCards?.getClientRects().length || getComputedStyle(pendingCards).visibility !== "visible") return;
      document.documentElement.dataset.sawCardSkeleton = "true";
      observer.disconnect();
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-image-pending"] });
  }, heldFile);
}

async function enter(page, role) {
  if (role) {
    await page.getByRole("combobox", { name: "Демонстрационный пользователь", exact: true }).click();
    await page.getByRole("option", {name: new RegExp(role + "$")}).first().click();
  }
  await page.getByRole("button", { name: "Войти", exact: true }).click();
}

test("прямые ссылки показывают скелетон нужного раздела при восстановлении", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  const routes = [
    ["/schedule", "schedule", ".calendar-responsive"],
    ["/study", "grades", ".study-summary"],
    ["/study/plan", "plan", ".academic-section"],
    ["/services", "services", ".services-home"],
    ["/services/documents", "documents", ".docs-catalog"],
    ["/services/requests", "requests", ".requests-list"],
    ["/services/people", "directory", ".people-directory"],
    ["/services/map", "map", ".atlas-nav"],
  ];
  const loading = page.locator("[data-loading-layout]:visible");
  for (const [path, layout, content] of routes) {
    await holdRequest(page, "**/api/campus/state", async () => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const loader = page.getByRole("status", { name: "Восстанавливаем кабинет" });
      await expect(loader).toHaveAttribute("data-loading-layout", layout);
      await expect(loading).toHaveCount(1);
      await expect(loader.locator(".portal-skeleton")).toHaveCSS("animation-name", "none");
      await expect(page.locator(content)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
    });
    await expect(page.locator(content)).toBeVisible();
    await expect(loading).toHaveCount(0);
  }
});

test("холодный переход показывает скелетон только пока загружается модуль вкладки", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  const study = {click: async () => {
    if (page.viewportSize().width <= 640) await nav.getByRole("button", {name:"Сервисы",exact:true}).click();
    await page.getByRole("button", {name:"Учёба",exact:true}).click();
  }};
  const loader = page.getByRole("status", { name: "Загружаем зачётку" });
  await holdRequest(page, "**/client/StudyGrades.jsx*", async () => {
    await study.click();
    await expect(loader).toHaveAttribute("data-loading-layout", "grades");
    await expect(nav).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(loader.locator(".portal-skeleton")).toHaveCSS("animation-name", "campus-skeleton-pulse");
  });
  await expect(page.locator(".study-summary")).toBeVisible();
  await expect(loader).toHaveCount(0);
  await nav.getByRole("button", { name: "Расписание", exact: true }).click();
  await study.click();
  await expect(page.locator(".study-summary")).toBeVisible();
  await expect(loader).toHaveCount(0);
});

test("единый скелетон сервисов остаётся до декодирования всех фото кампуса", async ({ page }) => {
  await watchImageDecodes(page, "booking-room.png");
  await page.goto("/");
  await enter(page);
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  const loader = page.locator('[data-loading-layout="services"]');
  let initialLoader;
  let routeTiles;
  await holdRequest(page, "**/client/ServiceCatalog.jsx*", async () => {
    await nav.getByRole("button", { name: "Сервисы", exact: true }).click();
    await expect(loader).toBeVisible();
    initialLoader = await loader.elementHandle();
    await page.evaluate(() => document.fonts.ready);
    routeTiles = await boxes(loader.locator(".sk-service-campus > *"));
  });

  const campus = page.locator(".service-section-campus");
  const tiles = campus.locator(".service-tile");
  const sportsImage = campus.locator('[data-service="sports"] img');
  const spacesImage = campus.locator('[data-service="spaces"] img');
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-decoded-sports.png", "true");
  await expect(html).toHaveAttribute("data-decoded-booking-room.png", "true");
  await expect(loader).toBeVisible();
  expect(await loader.evaluate((node, initial) => node === initial, initialLoader)).toBe(true);
  await expect(campus).not.toBeVisible();
  await page.evaluate(() => window.releaseImageDecode());

  await expect(campus).toBeVisible();
  await expect(loader).toHaveCount(0);
  await expect(html).not.toHaveAttribute("data-saw-card-skeleton", "true");
  await expect(campus).not.toHaveAttribute("aria-busy", "true");
  await expect(spacesImage).toHaveCSS("visibility", "visible");
  await expect(sportsImage).toHaveCSS("visibility", "visible");
  await expect(campus.getByRole("button", { name: "Спорт", exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  expectSameBoxes(await boxes(tiles), routeTiles);
});

test("прямая ссылка на сервисы сохраняет один скелетон при восстановлении и декодировании фото", async ({ page }) => {
  await watchImageDecodes(page, "booking-room.png");
  await page.goto("/");
  await enter(page);
  await expect(page.locator(".calendar-responsive")).toBeVisible();

  const loader = page.getByRole("status", { name: "Восстанавливаем кабинет" });
  const visibleLoaders = page.locator("[data-loading-layout]:visible");
  let initialLoader;
  await holdRequest(page, "**/api/campus/state", async () => {
    await page.goto("/services", { waitUntil: "domcontentloaded" });
    await expect(loader).toHaveAttribute("data-loading-layout", "services");
    await expect(visibleLoaders).toHaveCount(1);
    initialLoader = await loader.elementHandle();
  });

  const html = page.locator("html");
  const campus = page.locator(".service-section-campus");
  await expect(html).toHaveAttribute("data-decoded-booking-room.png", "true");
  await expect(visibleLoaders).toHaveCount(1);
  expect(await loader.evaluate((node, initial) => node === initial, initialLoader)).toBe(true);
  await expect(campus).not.toBeVisible();
  await page.evaluate(() => window.releaseImageDecode());

  await expect(campus).toBeVisible();
  await expect(visibleLoaders).toHaveCount(0);
  await expect(html).not.toHaveAttribute("data-saw-card-skeleton", "true");
});

test("единый скелетон бронирования остаётся до получения обоих фото, включая ошибку", async ({ page }) => {
  await watchImageDecodes(page);
  const loader = page.locator('[data-loading-layout="booking"]');
  const buildings = page.locator(".space-buildings");
  const cards = buildings.locator("button");
  const html = page.locator("html");
  const mainImage = buildings.locator('img[src$="/campus-main-view.png"]');
  const modernImage = buildings.locator('img[src$="/campus-modern-view.png"]');
  let pendingPhotos;
  await holdRequest(page, "**/services/campus-main-view.png", async () => {
    await page.goto("/services", { waitUntil: "domcontentloaded" });
    await enter(page);
    await page.getByRole("button", { name: "Бронирование помещений", exact: true }).click();
    await expect(loader).toBeVisible();
    const initialLoader = await loader.elementHandle();
    await expect(html).toHaveAttribute("data-decoded-campus-modern-view.png", "true");
    expect(await loader.evaluate((node, initial) => node === initial, initialLoader)).toBe(true);
    await expect(buildings).not.toBeVisible();
    pendingPhotos = await boxes(loader.locator(".sk-space-buildings > .sk-space-card > .is-photo"));
  }, { settle: route => route.abort(), times: Number.POSITIVE_INFINITY });

  await expect(buildings).toBeVisible();
  await expect(loader).toHaveCount(0);
  await expect(html).not.toHaveAttribute("data-saw-card-skeleton", "true");
  await expect(mainImage).toHaveAttribute("data-image-state", "error");
  await expect(buildings).not.toHaveAttribute("aria-busy", "true");
  await expect(mainImage).toHaveCSS("visibility", "hidden");
  await expect(modernImage).toHaveCSS("visibility", "visible");
  await expect(cards.first()).toBeEnabled();
  await expect(cards.last()).toBeEnabled();
  expectSameBoxes(await boxes(cards.locator(".space-booking-photo")), pendingPhotos, ["x", "width", "height"]);
  await buildings.getByRole("button", { name: /Корпус B/ }).click();
  await expect(page.getByRole("searchbox", { name: "Поиск помещения" })).toBeVisible();
});

test("карта и рабочие списки деканата показывают скелетоны при ожидании данных", async ({ page, browser }, info) => {
  await page.goto("/services/map");
  const mapLoading = page.getByRole("status", { name: "Загружаем план кампуса" });
  let mapPlaceholder;
  await holdRequest(page, "**/campus-map.json", async () => {
    await enter(page);
    await expect(mapLoading).toHaveAttribute("data-loading-layout", "map");
    [mapPlaceholder] = await boxes(mapLoading.locator(".sk-map-canvas"));
  });
  const [mapDrawing] = await boxes(page.locator(".atlas-drawing"));
  expect(Math.abs(mapDrawing.width - mapPlaceholder.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(mapDrawing.height - mapPlaceholder.height)).toBeLessThanOrEqual(1);

  const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: page.viewportSize() });
  try {
    const office = await context.newPage();
    await office.goto("/office");
    await holdRequest(office, "**/api/campus/office/tasks", async () => {
      await enter(office, "Сотрудник деканата");
      await expect(office.getByRole("status", { name: "Загружаем задачи деканата" }))
        .toHaveAttribute("data-loading-layout", "tasks");
    });
    await expect(office.getByRole("button", { name: "Новая задача" })).toBeEnabled();
    await holdRequest(office, "**/api/campus/schedule?*", async () => {
      await office.getByRole("navigation", { name: "Навигация кабинета", exact: true }).getByRole("button", { name: "Расписание", exact: true }).click();
      await expect(office.getByRole("status", { name: "Загружаем занятия" }))
        .toHaveAttribute("data-loading-layout", "lessons");
      await expect(office.getByRole("searchbox", { name: "Поиск занятий" })).toBeVisible();
    });
    await expect(office.locator(".office-schedule-list")).toBeVisible();
  } finally {
    await context.close();
  }
});
