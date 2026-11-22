import { test, expect } from "@playwright/test";

test("поиск и настройки остаются в шапке, навигация меняет положение на ширине 640 пикселей", async ({page}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", {name:"Войти",exact:true}).click();
  await page.evaluate(() => document.fonts.ready);
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  for (const width of [360,640,641,770,1024,1512]) {
    await page.setViewportSize({width,height:900});
    const header=page.locator(".shell > .rail");
    const nav=page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
    const search=header.getByRole("searchbox",{name:"Поиск по деканату"});
    const assistant=page.getByRole("button",{name:"Тинки — помощник",exact:true});
    const settings=header.getByRole("button",{name:"Настройки",exact:true});
    const logo=header.getByRole("img",{name:"iTECH"});
    const desktop=width>640;
    await expect(search).toBeVisible();
    await expect(assistant).toBeVisible();
    if(desktop) {
      await expect(logo).toBeVisible();
      await expect(settings).toBeVisible();
    } else {
      await expect(logo).toBeHidden();
      await expect(header.getByRole("navigation")).toHaveCount(0);
      await expect(header.getByRole("button")).toHaveCount(1);
      await expect(settings).toBeVisible();
      await expect(nav.getByRole("button",{name:"Тинки — помощник",exact:true})).toBeVisible();
    }
    let height;
    for(const name of ["Расписание",desktop ? "Учёба" : "Навигатор","Сервисы"]) {
      const tab = nav.getByRole("button",{name,exact:true});
      if (touch) await tab.tap();
      else await tab.click();
      await expect(tab).toHaveAttribute("aria-current","page");
      if(name==="Учёба") {
        if(!desktop) await expect(page.getByRole("heading",{name:"Учёба",exact:true})).not.toBeVisible();
        else await expect(page.getByRole("heading",{name:"Учёба",exact:true})).toBeVisible();
      }
      if(name==="Сервисы") await expect(page.getByRole("heading",{name:"Сервисы",exact:true})).toBeVisible();
      const box=await header.boundingBox();
      if(height===undefined)height=box.height;
      expect(Math.abs(box.height-height)).toBeLessThan(1);
      const [n,s,a]=await Promise.all([nav.boundingBox(),search.boundingBox(),(desktop ? assistant : settings).boundingBox()]);
      if(desktop) {
        const c=await header.locator(".irishka-controls").boundingBox();
        expect(n.x+n.width).toBeLessThanOrEqual(s.x);
        expect(s.x+s.width).toBeLessThanOrEqual(c.x);
        expect(Math.abs((n.y+n.height/2)-(c.y+c.height/2))).toBeLessThan(2);
      } else {
        expect(s.x+s.width).toBeLessThanOrEqual(a.x);
        expect(Math.abs((s.y+s.height/2)-(a.y+a.height/2))).toBeLessThan(2);
        expect(n.y).toBeGreaterThanOrEqual(780);
        expect(n.y+n.height).toBeLessThanOrEqual(900);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.screenshot({path:testInfo.outputPath(`header-${width}.png`)});
  }
});

test("мобильный поиск раскрывается на всю ширину и закрывается по Escape", async ({page}, testInfo) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.getByRole("button", {name:"Войти",exact:true}).click();
  const header = page.locator(".shell > .rail");
  const input = header.getByRole("searchbox", {name:"Поиск по деканату"});
  for (const width of [320,390,640]) {
    await page.setViewportSize({width,height:844});
    await input.click();
    await input.fill("Б-");
    const results = header.locator(".search-results");
    await expect(results).toBeVisible();
    const box = await results.boundingBox(), top = await header.boundingBox();
    expect(box.x).toBe(0);
    expect(box.width).toBe(width);
    expect(Math.abs(box.y - top.y - top.height)).toBeLessThan(1);
    await expect(results).toHaveCSS("border-top-left-radius","0px");
    await expect(results).toHaveCSS("border-bottom-left-radius","26px");
    await expect(results).toHaveCSS("background-color", /^rgb\(/);
    await page.screenshot({path:testInfo.outputPath(`search-${width}.png`)});
    await input.press("Escape");
    await expect(results).toBeHidden();
    await expect(input).toBeFocused();
  }
  await input.fill("Б-108");
  await header.locator(".search-results").getByRole("button", {name:/Б-108/}).first().click();
  await expect(header.locator(".search-results")).toBeHidden();
  await expect(input).toHaveValue("");
});
