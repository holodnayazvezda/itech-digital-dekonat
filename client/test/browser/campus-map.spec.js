import {test,expect} from "@playwright/test";

const button=(scope,name)=>scope.getByRole("button",{name,exact:true});
async function login(page){
  await page.goto("/");
  await expect(page.getByRole("combobox",{name:"Демонстрационный пользователь",exact:true})).toContainText("Студент");
  await button(page,"Войти").click();
  await expect(page.locator(".shell")).toBeVisible();
}
async function openMap(page){
  await button(page.getByRole("navigation", { name: "Навигация кабинета", exact: true }),"Сервисы").click();
  await button(page,"Навигатор").click();
}
async function enterMap(page){
  await login(page);
  await openMap(page);
  await expect(page.locator(".atlas-svg")).toBeVisible();
}
const track=page=>page.locator(".atlas-route-track");
const steps=page=>page.getByRole("region",{name:"Шаги маршрута"});

test("после щипка карту можно двигать оставшимся пальцем", async ({page}) => {
  await page.setViewportSize({width:390,height:744});
  await enterMap(page);
  const svg=page.locator(".atlas-svg");
  await svg.scrollIntoViewIfNeeded();
  const gesture=await svg.evaluate(async node => {
    const box=node.getBoundingClientRect();
    const send=(type,id,offset)=>node.dispatchEvent(new PointerEvent(type,{
      bubbles:true, pointerType:"touch", pointerId:id, button:0,
      clientX:box.left+box.width/2+offset, clientY:box.top+box.height/2
    }));
    const state=async()=>{
      await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      return node.getAttribute("viewBox").split(" ").map(Number);
    };
    // Synthetic pointers are dispatched directly to the SVG and have no native capture target.
    node.setPointerCapture=()=>{};
    try {
      const original=await state();
      send("pointerdown",11,-20);
      send("pointerdown",12,20);
      send("pointermove",11,-50);
      send("pointermove",12,50);
      const zoom=await state();
      send("pointerup",12,50);
      send("pointermove",11,-15);
      const pan=await state();
      send("pointerup",11,-15);
      return {original,zoom,pan};
    } finally { delete node.setPointerCapture; }
  });
  expect(gesture.zoom[2]).toBeLessThan(gesture.original[2]);
  expect(gesture.pan[0]).toBeLessThan(gesture.zoom[0]);
  expect(gesture.pan[2]).toBe(gesture.zoom[2]);
});

async function findPlace(page, code) {
  const mapSearch=page.getByRole("searchbox",{name:"Поиск по карте"});
  if (await mapSearch.isVisible()) {
    await mapSearch.fill(code);
    await mapSearch.press("Enter");
  } else {
    await page.getByRole("combobox",{name:"Куда",exact:true}).fill(code);
    await page.getByRole("listbox",{name:"Куда",exact:true}).getByRole("option").first().click();
  }
}

test("ссылка на маршрут начинает путь от входа в корпус аудитории", async ({ page }) => {
  await login(page);
  const rooms = [
    { room: "Б-412", building: "Корпус B", floor: 4, entrance: "Главный вход" },
    { room: "Н-318", building: "Корпус A", floor: 3, entrance: "Вход в корпус A" },
  ];
  for (const { room, building, floor, entrance } of rooms) {
    await page.goto(`/services/map/${encodeURIComponent(room)}?date=2026-11-20&from=entrance`);
    const card = steps(page);
    await expect(card).toContainText(`Шаг 1 из 2 · ${building} · 1 этаж`);
    await expect(card).toContainText(`${entrance} → Лифт`);
    await expect(page.locator(".atlas-route-line")).toBeVisible();
    await button(card, "Далее").click();
    await expect(card).toContainText(`Шаг 2 из 2 · ${building} · ${floor} этаж`);
    await expect(card).toContainText(`Лифт → ${room}`);
    await expect(page.locator(".atlas-occupancy input")).toHaveValue("2026-11-20");
  }
});

test("навигация по этажам, поиск и маршрут между этажами",async({page})=>{
  await enterMap(page);
  await page.getByLabel("Корпус на карте").selectOption("modern");
  await button(page.getByRole("group",{name:"Выбрать этаж"}),"3 этаж").click();
  await expect(page.locator(".atlas-svg")).toHaveAccessibleName(/Корпус A, 3 этаж/);
  await button(page,"Вода").click();
  const map = await (await page.request.get("/campus-map.json")).json();
  const fountains = map.buildings.flatMap(b=>b.floors.flatMap(f=>f.places.filter(p=>p.kind==="water")));
  await expect(page.locator(".atlas-result-header")).toContainText("Найдено · "+fountains.length);
  await expect(page.locator(".atlas-result-list button")).toHaveCount(Math.min(fountains.length,24));
  await button(page,"Сбросить").click();
  const search=page.getByRole("searchbox",{name:"Поиск по карте"});
  if (await search.isVisible()) {
    await search.fill("несуществующее помещение");
    await expect(page.locator(".atlas-result-list")).toContainText("Попробуйте");
  }
  await findPlace(page,"B412");
  const inspector=page.getByRole("complementary",{name:"Информация о месте"});
  await expect(inspector.getByRole("heading")).toHaveText("Аудитория Б-412");
  const svg=page.locator(".atlas-svg");
  await button(inspector,"Скрыть маршрут").click();
  await expect(svg).toHaveAccessibleName(/Корпус B, 4 этаж/);
  await svg.press("Home");
  await expect(button(page,"Уменьшить карту")).toBeDisabled();
  await button(page,"Увеличить карту").click();
  await expect(page.locator(".atlas-svg")).toHaveAttribute("data-zoomed","true");
  await button(page,"Как пройти от входа").click();
  await expect(page.locator(".atlas-svg")).toHaveAccessibleName(/Корпус B, 1 этаж/);
  await expect(page.locator(".atlas-route-line")).toBeVisible();
  const card = steps(page);
  await expect(page.locator(".atlas-drawing")).toHaveCSS("background-image","none");
  await expect(card).toContainText("Шаг 1 из 2 · Корпус B · 1 этаж");
  await expect(button(card,"Предыдущий шаг")).toHaveCount(0);
  await expect(page.locator(".atlas-route-arrow")).toBeVisible();
  const firstSegment = await track(page).getAttribute("points");
  await button(card,"Далее").click();
  await expect(card).toContainText("Лифт → Б-412");
  await expect(track(page)).not.toHaveAttribute("points",firstSegment);
  await button(card,"Предыдущий шаг").click();
  await expect(track(page)).toHaveAttribute("points",firstSegment);
  await card.press("ArrowRight");
  await expect(card).toContainText("Шаг 2 из 2 · Корпус B · 4 этаж");
  await expect(page.locator(".atlas-svg")).toHaveAccessibleName(/Корпус B, 4 этаж/);
  await expect(page.locator(".atlas-space[aria-pressed=true]")).toHaveAccessibleName("Аудитория Б-412");
  await button(card,"Завершить").click();
  await expect(card).toHaveCount(0);
  await expect(button(page,"Как пройти от входа")).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
});

test("из занятости аудитории открывается нужное место на карте и та же дата брони",async({page})=>{
  await login(page);
  const day=button(page,"День");
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  if(await day.isVisible())await day.click();
  await page.getByRole("button",{name:/10:00–11:30, Анализ данных.*Б-412/}).click();
  await page.getByRole("button",{name:/Место занятия Б-412/}).click();
  const roomDate=page.getByLabel("Занятость на дату");
  await roomDate.fill("2026-11-25");
  await button(page,"Проложить маршрут").click();
  await button(steps(page),"Далее").click();
  await expect(page.locator(".atlas-svg")).toHaveAccessibleName(/Корпус B, 4 этаж/);
  const date=page.locator(".atlas-occupancy input");
  await expect(date).toHaveValue("2026-11-25");
  await date.fill("2026-11-26");
  await button(page,"Выбрать время брони").click();
  await expect(page.getByLabel("Дата бронирования")).toHaveValue("2026-11-26");
  await expect(page.locator(".space-reservation")).toContainText("Б-412");
  await button(page,"Назад").click();
  await page.getByRole("button",{name:/К аудитории/}).click();
  await expect(roomDate).toHaveValue("2026-11-25");
  await expect(page.locator(".sheet .room-ident")).toContainText("Б-412");
});

test("ошибка загрузки статического плана допускает повторную попытку",async({page})=>{
  let count=0;
  await page.route("**/campus-map.json",route=>{
    if(count++===0)return route.fulfill({status:503,body:"unavailable"});
    return route.continue();
  });
  await login(page);
  await openMap(page);
  await expect(page.getByRole("alert")).toContainText("Не удалось загрузить");
  await button(page,"Повторить").click();
  await expect(page.locator(".atlas-svg")).toBeVisible();
});

test("пятый этаж сохраняет силуэт корпуса, поиск приближает учебную аудиторию", async({page})=>{
  await enterMap(page);
  const map = await (await page.request.get("/campus-map.json")).json();
  const building = map.buildings.find(b=>b.id==="main"), top = building.floors.find(f=>f.id==="5");
  const room = top.places.find(p=>p.kind==="class" && p.code);
  const floors = page.getByRole("group",{name:"Выбрать этаж"});
  await button(floors,top.name).click();
  const svg = page.locator(".atlas-svg");
  await expect(svg.locator(".atlas-footprint")).toHaveAttribute("d", building.footprint);
  await expect(svg.locator(".atlas-shell")).toHaveAttribute("d", top.outline);
  await expect(page.getByText("Здесь этажа нет",{exact:true})).toHaveCount(0);
  const footprintBox = await svg.getAttribute("viewBox");
  await button(page,"Увеличить карту").click();
  const centred = await svg.getAttribute("viewBox");
  await svg.focus();
  await svg.press("ArrowRight");
  const panned = await svg.getAttribute("viewBox");
  expect(panned).not.toBe(centred);
  for (const level of ["4 этаж",top.name]) {
    await button(floors,level).click();
    await expect(svg).toHaveAttribute("viewBox",panned);
  }
  await page.getByLabel("Корпус на карте").selectOption("modern");
  await expect(svg).toHaveAttribute("data-zoomed","false");
  await page.getByLabel("Корпус на карте").selectOption("main");
  await button(floors,"1 этаж").click();
  await expect(svg).toHaveAttribute("viewBox",footprintBox);
  await expect(page.getByRole("button",{name:"Показать ещё",exact:false}).last()).toBeVisible();
  await button(page.getByRole("group",{name:"Список мест этажа"}),"Аудитории").click();
  await expect(page.locator(".atlas-floor-directory>button")).toHaveCount(8);
  await findPlace(page,room.code);
  await button(page,"Скрыть маршрут").click();
  await expect(svg).toHaveAccessibleName(new RegExp(top.name));
  await expect(svg).toHaveAttribute("data-zoomed","true");
  const roomView = await svg.getAttribute("viewBox");
  await svg.press("Home");
  await findPlace(page,room.code);
  await button(page,"Скрыть маршрут").click();
  await expect(svg).toHaveAttribute("viewBox",roomView);
  await button(page,"Как пройти от входа").click();
  await expect(svg).toHaveAccessibleName(/1 этаж/);
  const step = steps(page);
  await expect(svg).toHaveAttribute("data-zoomed","true");
  await button(step,"Далее").click();
  await expect(svg).toHaveAccessibleName(new RegExp(top.name));
  await expect(svg.locator(".atlas-route-line")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
});

test("этаж в другой системе координат открывается целиком",async({page})=>{
  const floor=(id, x) => ({id,name:id+" этаж",viewBox:[x,x,120,80],
    outline:`M${x} ${x}h120v80h-120Z`,places:[]});
  const map = {version:1,buildings:[{
    id:"gallery",name:"Галерея",viewBox:[0,0,120,80],floors:[floor("1",0),floor("2",300)],
  }]};
  await page.route("**/campus-map.json", r => r.fulfill({json:map}));
  await enterMap(page);
  await button(page,"Увеличить карту").click();
  await expect(page.locator(".atlas-svg")).toHaveAttribute("data-zoomed","true");
  await button(page.getByRole("group",{name:"Выбрать этаж"}),"2 этаж").click();
  await expect(page.locator(".atlas-svg")).toHaveAttribute("viewBox","300 300 120 80");
  await expect(page.locator(".atlas-svg")).toHaveAttribute("data-zoomed","false");
});

test("маршрут на своём этаже завершается за один шаг",async({page})=>{
  await enterMap(page);
  await findPlace(page,"Б-108");
  await button(page,"Скрыть маршрут").click();
  await button(page,"Как пройти от входа").click();
  const card = steps(page);
  await expect(card).toContainText("Шаг 1 из 1 · Корпус B · 1 этаж");
  await expect(button(card,"Предыдущий шаг")).toHaveCount(0);
  await expect(button(card,"Далее")).toHaveCount(0);
  await button(card,"Завершить").click();
  await expect(page.locator(".atlas-space[aria-pressed=true]")).toHaveAccessibleName(/Б-108/);
});

test("условные обозначения остаются читаемыми и открывают карточку места",async({page})=>{
  await enterMap(page);
  const plan = page.locator(".atlas-svg");
  const inspector = page.getByRole("complementary",{name:"Информация о месте"});
  for (const campus of ["main","modern"]) {
    await page.getByLabel("Корпус на карте").selectOption(campus);
    await expect(plan.locator(".atlas-space:not([data-kind=class]) text")).toHaveText(["Гардероб"]);
    await expect(plan.locator(".atlas-number").first()).toHaveText(/^\d+$/);
    for (const kind of ["stairs","wc","food","library"]) {
      if (kind === "library" && campus === "modern") await button(page,"2 этаж").click();
      const place = plan.locator(`.atlas-space[data-kind="${kind}"]`).first();
      const label = await place.getAttribute("aria-label");
      await expect(place.locator(".atlas-poi")).toBeVisible();
      await place.locator(".atlas-cell").click();
      await expect(inspector.getByRole("heading")).toHaveText(label);
      await expect(place.locator("text")).toHaveCount(0);
      await button(page,"Скрыть маршрут").click();
      await plan.press("Home");
    }
  }
});


test("карта другого вуза загружается со статического адреса и строит маршрут",async({page})=>{
  await page.route("**/campus-map.json", route => route.fulfill({
    path: "docs/campus-map.example.json", contentType:"application/json",
  }));
  await enterMap(page);
  await expect(page.getByLabel("Корпус на карте")).toContainText("Учебный павильон");
  await findPlace(page,"П-201");
  await button(page,"Скрыть маршрут").click();
  await button(page,"Как пройти от входа").click();
  await expect(page.locator(".atlas-route-arrow")).toBeVisible();
  await button(page,"Далее").click();
  await expect(page.locator(".atlas-svg")).toHaveAccessibleName(/Учебный павильон, 2 этаж/);
  await expect(page.locator(".atlas-route-arrow")).toBeVisible();
});
