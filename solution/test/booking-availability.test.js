import test from 'node:test';
import assert from 'node:assert/strict';
import { availableRoomStarts, normalizeRoomQuery } from '../shared/booking-availability.js';
test('поиск помещений понимает латинские буквы, пробелы и разные дефисы',()=>{
 const normalized=normalizeRoomQuery('Переговорная Н-102');
 for(const query of ['Н102','H102','h 102','n-102','Н—102']) assert.ok(normalized.includes(normalizeRoomQuery(query)),query);
 assert.equal(normalizeRoomQuery('B 108'),normalizeRoomQuery('Б-108'));
});
test('бронирование исключает пересечение на всей длительности, допускает соседние интервалы',()=>{
 const events=[{room:'Б-108',time:'10:00',end:'11:00'},{short:'Б-108',time:'13:00',end:'14:00'}];
 const starts=availableRoomStarts(events,'Б-108',60);
 assert.ok(starts.includes(540));assert.ok(!starts.includes(570));assert.ok(!starts.includes(600));assert.ok(starts.includes(660));assert.ok(!starts.includes(750));
 assert.ok(availableRoomStarts(events,'Б-120',60).includes(600));
});
test('длительность от 30 минут до 4 часов, конец не позже 22:00',()=>{
 for(const duration of [0,15,45,250,NaN]) assert.deepEqual(availableRoomStarts([],'Б-108',duration),[]);
 assert.ok(availableRoomStarts([],'Б-108',30).includes(1290));
 assert.ok(!availableRoomStarts([],'Б-108',60).includes(1290));
 assert.equal(availableRoomStarts([],'Б-108',240).at(-1),1080);
});
