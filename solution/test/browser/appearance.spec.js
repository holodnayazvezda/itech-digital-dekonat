import { test, expect } from "@playwright/test";

test("новый кабинет следует системной теме и сохраняет выбор пользователя", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const app = page.locator(".v-application");
  await expect(app).toHaveClass(/v-theme--Dark/);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(app).toHaveClass(/v-theme--Light/);
  if (page.viewportSize().width <= 640) {
    await page.getByRole("button", { name: "Настройки", exact: true }).click();
  }
  await page.getByRole("button", { name: /^Тема: автоматическая/ }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator(".calendar-responsive")).toBeVisible();
  await expect(app).toHaveClass(/v-theme--Light/);
});

test("единый переход темы: одинаковые начало, длительность и прогресс всех цветов",async ({page}, testInfo) => {
  await page.emulateMedia({colorScheme:"light",reducedMotion:"no-preference"});
  await page.addInitScript(() => localStorage.setItem("campus-theme","Light"));
  await page.goto("/");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  if (page.viewportSize().width <= 640) {
    await page.getByRole("button", { name: "Настройки", exact: true }).click();
  }
  const themeControl = page.getByRole("button", { name: /^Тема:/ });
  await page.evaluate(() => {
    const original=document.startViewTransition.bind(document);
    window.__themeCount=0;
    document.startViewTransition=callback => {
      window.__themeCount++;
      const transition=original(callback);
      window.__themeFinished=transition.finished;
      window.__themeReady=transition.ready.then(async () => {
        const pair=document.getAnimations().filter(a => ["tinky-theme-in","tinky-theme-out"].includes(a.animationName));
        await Promise.all(pair.map(a=>a.ready));
        window.__themeTimings=pair.map(a => ({name:a.animationName,start:a.startTime,duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay}));
        pair.forEach(a=>a.pause());
        window.__themeAnimations=pair;
      });
      return transition;
    };
  });
  const reports=[];
  for (const theme of ["Dark","Light"]) {
    await themeControl.click();
    await page.evaluate(()=>window.__themeReady);
    const timings=await page.evaluate(()=>window.__themeTimings);
    expect(timings).toHaveLength(2);
    timings.forEach(a=>{expect(a.duration).toBe(500);expect(a.delay).toBe(0);});
    expect(Math.abs(timings[0].start-timings[1].start)).toBeLessThan(1);
    const frames=await page.evaluate(()=>[0,125,250,375,500].map(time=>{
      window.__themeAnimations.forEach(a=>{a.currentTime=time;});
      return {time,old:Number(getComputedStyle(document.documentElement,"::view-transition-old(root)").opacity),next:Number(getComputedStyle(document.documentElement,"::view-transition-new(root)").opacity)};
    }));
    frames.forEach(frame=>{expect(frame.next).toBeCloseTo(frame.time/500,3);expect(frame.old+frame.next).toBeCloseTo(1,3);});
    expect(await page.locator(".v-application").evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.transitionProperty && /color|fill|stroke/.test(a.transitionProperty)).length)).toBe(0);
    reports.push({theme,timings,frames});
    await page.evaluate(()=>document.getAnimations().filter(a=>a.animationName?.includes("view-transition") || a.animationName?.startsWith("tinky-theme-")).forEach(a=>a.finish()));
    await page.evaluate(()=>window.__themeFinished);
    await expect(page.locator(".v-application")).toHaveClass(new RegExp("v-theme--"+theme));
  }
  const {writeFileSync}=await import("node:fs");
  writeFileSync(testInfo.outputPath("theme-timing-after.json"),JSON.stringify(reports,null,2));
  const count=await page.evaluate(()=>window.__themeCount);
  await page.emulateMedia({reducedMotion:"reduce"});
  await themeControl.click();
  await themeControl.click();
  expect(await page.evaluate(()=>window.__themeCount)).toBe(count);
});

test("фотографии сервисов не скачут на границах широкого экрана",async ({page}) => {
  await page.goto("/");
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  await page.getByRole("navigation", { name: "Навигация кабинета", exact: true }).getByRole("button",{name:"Сервисы",exact:true}).click();
  const measurements={};
  for(const width of [1099,1100,1199,1200,1280,1512]) {
    await page.setViewportSize({width,height:900});
    measurements[width]=await page.locator(".service-tile-photo").evaluateAll(els => els.map(el => ({service:el.dataset.service,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
  }
  for(const [before,after] of [[1099,1100],[1199,1200],[1280,1512]]) {
    measurements[before].forEach((item,i) => {
      expect(Math.abs(item.width-measurements[after][i].width)).toBeLessThan(2);
      expect(Math.abs(item.height-measurements[after][i].height)).toBeLessThan(1);
    });
  }
});
