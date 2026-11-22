import {test,expect} from '@playwright/test';

test('30 видов спорта: поиск, разные окна, расписание и сохранённая запись',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'Войти',exact:true}).click();
  await expect(page.locator('.shell')).toBeVisible();
  async function openSports(){
    await page.getByRole("navigation", { name: "Навигация кабинета", exact: true }).getByRole('button',{name:'Сервисы',exact:true}).click();
    await page.getByRole('button',{name:'Спорт',exact:true}).click();
    await expect(page.getByRole('region',{name:'Виды спорта',exact:true})).toBeVisible();
  }
  await openSports();await expect(page.locator('.sport-card')).toHaveCount(30);
  await page.getByRole('button',{name:'Водные',exact:true}).click();await expect(page.locator('.sport-card')).toHaveCount(2);
  await page.getByRole('button',{name:'Плавание',exact:true}).click();
  const swim=page.getByRole('dialog',{name:'Плавание',exact:true});
  await expect(swim).toContainText('Бассейн');await expect(swim).toContainText('Купальник');
  await page.keyboard.press('Escape');await expect(swim).not.toBeVisible();await expect(page.getByRole('button',{name:'Плавание',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Все',exact:true}).click();
  await page.getByRole('searchbox',{name:'Найти вид спорта'}).fill('неттакогоспорта');await expect(page.locator('.sports-catalogue-empty')).toBeVisible();
  await page.getByRole('button',{name:'Сбросить поиск',exact:true}).click();await expect(page.locator('.sport-card')).toHaveCount(30);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath('sports-catalogue.png'),fullPage:true});
  await page.getByRole('button',{name:'Силовые тренировки',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Силовые тренировки',exact:true});
  await expect(dialog).toContainText('Тренажёрный зал');
  const send=dialog.locator('.sports-submit'),dateInput=dialog.locator('input[type=date]');
  await expect(send).toBeDisabled();
  await dateInput.fill('2026-11-24');await expect(dialog.locator('.sports-empty')).toContainText('занятий нет');
  await dialog.getByRole('button',{name:'Выбрать ближайшее занятие',exact:true}).click();await expect(dateInput).toHaveValue('2026-11-25');
  const chosenDate={
    'chromium-desktop':'2026-11-23',
    'chromium-mobile':'2026-11-25',
    'firefox-desktop':'2026-11-30',
    'firefox-mobile':'2026-12-02',
    'webkit-mobile':'2026-12-07',
  }[testInfo.project.name];
  await dateInput.fill(chosenDate);
  await dialog.getByRole('button',{name:'09:00 · 12 мест свободно',exact:true}).click();await expect(send).toBeEnabled();
  await expect(dialog.locator('.sports-selection')).toContainText('10:00');
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await dialog.screenshot({path:testInfo.outputPath('sports-direction.png')});
  const waiting=page.waitForResponse(r=>r.url().includes('/api/campus/request') && r.request().method()==='POST');
  await send.click();const response=await waiting;expect(response.ok(),await response.text()).toBe(true);const {id}=await response.json();
  await expect(dialog).not.toBeVisible();await expect(page.getByRole('dialog',{name:'Заявка',exact:true})).toContainText('Силовые тренировки');
  const tokenStudent=await page.evaluate(()=>sessionStorage.getItem('atlas-session'));
  const state=await(await page.request.get('/api/campus/state',{headers:{Authorization:'Bearer '+tokenStudent}})).json();
  const saved=state.records.find(r=>r.id===id);expect(saved.sport).toBe('strength');expect(saved.short).toBe('СП-01');expect(saved.date).toBe(chosenDate);
  const {token}=await(await page.request.post('/api/campus/login',{data:{role: 'office', password:"OfficeHelp2026!"}})).json();
  const decision=await page.request.post('/api/campus/decision',{headers:{Authorization:'Bearer '+token},data:{id,status:'approved'}});expect(decision.ok(),await decision.text()).toBe(true);
  await page.reload();await expect(page.locator('.shell')).toBeVisible();await openSports();await page.getByRole('button',{name:'Силовые тренировки',exact:true}).click();await dateInput.fill(chosenDate);
  await expect(dialog.getByRole('button',{name:'09:00 · 11 мест свободно',exact:true})).toBeEnabled();
  await dialog.getByRole('button',{name:'Закрыть вид спорта',exact:true}).click();
  await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.locator('.sports-catalogue')).not.toBeVisible();
  expect(errors).toEqual([]);
});
