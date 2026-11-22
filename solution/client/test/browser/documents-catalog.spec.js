import {test,expect} from "@playwright/test";

async function openCatalog(page) {
  await page.goto("/");await page.getByRole("button",{name:"Войти",exact:true}).click();
  await page.getByRole("navigation", { name: "Навигация кабинета", exact: true }).getByRole("button",{name:"Сервисы",exact:true}).click();
  await page.getByRole("button",{name:"Документы и заявления",exact:true}).click();
  return page.locator(".docs-catalog");
}

test("каталог документов: поиск, категории, монохромные иконки и отправка справки",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const catalog=await openCatalog(page);
  await expect(catalog.locator(".doc-section")).toHaveCount(7);
  const icon=catalog.locator(".doc-icon").first();
  await expect(icon).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
  await catalog.getByRole("button",{name:"Учёба",exact:true}).click();
  await expect(catalog.locator("#doc-group-study")).toHaveAttribute("inert","");
  const search=catalog.getByRole("searchbox",{name:"Найти справку или заявление",exact:true});
  await search.fill("стажировку");
  await expect(catalog.locator(".doc-tile")).toHaveCount(1);
  await expect(catalog.getByRole("button",{name:"Заявка на стажировку",exact:true})).toBeVisible();
  await search.fill("неттакойуслуги");
  await expect(catalog.getByRole("heading",{name:"Ничего не найдено",exact:true})).toBeVisible();
  await catalog.getByRole("button",{name:"Показать все услуги",exact:true}).click();
  await expect(catalog.locator(".doc-section")).toHaveCount(7);
  await page.screenshot({path:`docs/documents-${page.viewportSize().width}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await catalog.getByRole("button",{name:"Справка об обучении",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Справка об обучении",exact:true})).toBeVisible();
  await page.getByLabel("Куда предоставить",{exact:true}).fill("Учебная библиотека");
  await page.getByRole("button",{name:"Отправить заявку",exact:true}).click();
  await expect(page.locator(".result-card.pending")).toContainText("Справка об обучении");
  expect(errors).toEqual([]);
});

test("из каталога можно открыть свои заявки",async({page})=>{
  const catalog=await openCatalog(page);
  await catalog.getByRole("button",{name:"Мои заявки",exact:true}).click();
  await expect(page.getByRole("heading",{name:"История обращений",exact:true})).toBeVisible();
});
