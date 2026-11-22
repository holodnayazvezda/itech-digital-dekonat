import {test,expect} from '@playwright/test';
test('занятие открывается на весь экран с длительностью, аудиторией и переходами',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/schedule?date=2026-11-20');await page.getByRole('button',{name:'Войти',exact:true}).click();
  await expect(page.locator('.calendar-responsive')).toBeVisible();
  const day=page.getByRole('button',{name:'День',exact:true});if(await day.isVisible())await day.click();
  const trigger=page.locator('.calendar-responsive').getByRole('button',{name:/11:40–12:20, Проектный семинар/});await trigger.click();
  const dialog=page.locator('dialog.lesson-dialog');await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox(),viewport=page.viewportSize();
  expect(Math.abs(box.width-viewport.width)).toBeLessThan(2);expect(Math.abs(box.height-viewport.height)).toBeLessThan(2);expect(box.x).toBe(0);expect(box.y).toBe(0);
  await expect(dialog).toContainText('40 минут');await expect(dialog).toContainText('32 места');await expect(dialog).toContainText('проектор');await expect(dialog).toContainText('Университетская аллея, 12');
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(dialog.locator('.lesson-room b')).toHaveCSS('color',await dialog.evaluate(el=>getComputedStyle(el).color));
  await page.screenshot({path:`docs/lesson-fullscreen-${viewport.width}.png`});
  await dialog.getByRole('button',{name:/Место занятия Н-318/}).click();await expect(page.getByRole('heading',{name:'Аудитория Н-318',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});
