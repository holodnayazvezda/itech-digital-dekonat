import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCampusLocation, toCampusLocation, fromCampusLocation, routeDate} from '../src/shared/routing/campus-routes.js';

test('прямая ссылка сохраняет русскую аудиторию, параметры брони и родительские экраны', () => {
  const screen={tab:4,pages:[{view:'spaces',peer:'Б-412',date:'2026-11-27',start:'14:00',duration:90,building:'Корпус B',fund:'Аудиторный фонд'}]};
  const location=resolveCampusLocation(toCampusLocation(screen));
  const restored=fromCampusLocation(resolveCampusLocation(location.href));
  assert.equal(restored.pages.at(-1).peer,'Б-412');
  assert.equal(restored.pages.at(-1).duration,90);
  assert.equal(restored.pages.at(-1).fund,'Аудиторный фонд');
  const person=fromCampusLocation(resolveCampusLocation('/services/person/teacher'));
  assert.deepEqual(person.pages,[{view:'directory',peer:''},{view:'person',peer:'teacher'}]);
});

test('базовый путь публикации, пустой раздел и неизвестный URL не ломают маршрутизацию', () => {
  const location=resolveCampusLocation({name:'navigator',params:{},query:{},hash:''},'/cabinet/');
  assert.equal(location.href,'/cabinet/services/map');
  assert.equal(fromCampusLocation(resolveCampusLocation(location.href,'/cabinet/')).pages.at(-1).view,'navigator');
  assert.equal(fromCampusLocation(resolveCampusLocation('/unknown')),null);
  assert.equal(routeDate('2026-02-31'),'');
});
