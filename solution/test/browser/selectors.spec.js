import {test,expect} from "@playwright/test";

async function expectSlide(group) {
  await expect(group).toHaveAttribute("data-sliding-selector","true");
  await expect.poll(()=>group.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.transitionProperty==="transform"))).toBe(true);
  const duration=await group.evaluate(el=>el.getAnimations({subtree:true}).find(a=>a.transitionProperty==="transform").effect.getTiming().duration);
  expect(duration).toBe(280);
  await group.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  const aligned=await group.evaluate(el=>{
    const button=el.querySelector(':scope > button:is([aria-pressed="true"],[aria-current="page"])');
    const target=button.getBoundingClientRect(),parent=el.getBoundingClientRect();
    const style=getComputedStyle(el,"::before"),matrix=new DOMMatrix(style.transform);
    return Math.abs(matrix.m41-(target.left-parent.left+el.scrollLeft-el.clientLeft))<1 && Math.abs(matrix.m42-(target.top-parent.top+el.scrollTop-el.clientTop))<1 && Math.abs(parseFloat(style.width)-target.width)<1;
  });
  expect(aligned).toBe(true);
}

test("подложки переключателей едут между пунктами, включая смену раздела",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/");await page.getByRole("button",{name:"Войти",exact:true}).click();
  await page.evaluate(()=>document.fonts.ready);
  const nav=page.getByRole("navigation", { name: "Навигация кабинета", exact: true });
  const desktop=page.viewportSize().width>640;
  const studySection=page.getByRole("button",{name:"Учёба",exact:true});
  if (!desktop) await nav.getByRole("button",{name:"Сервисы",exact:true}).click();
  if (desktop) await expect(nav).toHaveAttribute("data-sliding-selector","true");
  await studySection.click();
  if (desktop) await expectSlide(nav);
  else await expect(nav.getByRole("button",{name:"Сервисы",exact:true})).toHaveAttribute("aria-current","page");
  const study=page.locator(".study-tabs");
  await expect(study).toHaveAttribute("data-sliding-selector","true");
  await study.getByRole("button",{name:"Учебный план",exact:true}).click();
  await expectSlide(study);
  const terms=page.getByRole("group",{name:"Семестры",exact:true});
  await terms.getByRole("button",{name:"8 семестр",exact:true}).click();
  await expectSlide(terms);
  await terms.getByRole("button",{name:"1 семестр",exact:true}).click();
  await expectSlide(terms);
  if(page.viewportSize().width>1200) {
    await nav.getByRole("button",{name:"Расписание",exact:true}).click();
    await page.locator(".calendar-modes").getByRole("button",{name:"День",exact:true}).click();
    await expectSlide(page.locator(".calendar-modes"));
    await page.locator(".calendar-modes").getByRole("button",{name:"Неделя",exact:true}).click();
    await expectSlide(page.locator(".calendar-modes"));
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  await nav.getByRole("button",{name:"Сервисы",exact:true}).click();
  expect(await nav.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.transitionProperty==="transform").length)).toBe(0);
});
