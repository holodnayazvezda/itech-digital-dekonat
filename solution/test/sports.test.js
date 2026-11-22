import test from 'node:test';
import assert from 'node:assert/strict';
import {sports,sportSlots,sportSeatsLeft,nextSportDate} from '../shared/sports.js';
import {timeText} from '../shared/campus-data.js';
test('30 уникальных направлений с непротиворечивыми окнами общих площадок',()=>{
  assert.equal(sports.length,30);assert.equal(new Set(sports.map(s=>s.id)).size,30);
  for(const sport of sports){
    assert.equal(sportSlots(sport,nextSportDate(sport,'2026-11-20')).length,2);
    for(const t of sport.starts)assert.ok(t>=540 && t+sport.duration<=1320);
    for(const other of sports.filter(s=>s.short===sport.short && s.id!==sport.id)){
      assert.equal(sport.capacity,other.capacity);
      if(sport.weekdays.some(d=>other.weekdays.includes(d)))
        for(const a of sport.starts)for(const b of other.starts)assert.ok(a+sport.duration<=b || b+other.duration<=a);
    }
  }
});
test('места учитывают площадку, дату, весь интервал и отменённое время не перекрывает соседний сеанс',()=>{
  const sport=sports[0],date='2026-11-23',start=sport.starts[0];
  const reservation={short:sport.short,date,time:timeText(start),end:timeText(start+sport.duration)};
  assert.equal(sportSeatsLeft(sport,date,start,[reservation]),sport.capacity-1);
  assert.equal(sportSeatsLeft(sport,date,sport.starts[1],[reservation]),sport.capacity);
  assert.equal(sportSeatsLeft(sport,'2026-11-25',start,[reservation]),sport.capacity);
  assert.equal(sportSeatsLeft(sport,date,start,[{...reservation,short:'другая площадка'}]),sport.capacity);
  assert.deepEqual(sportSlots(sport,'2026-11-24'),[]);
  assert.deepEqual(sportSlots(sport,''),[]);
});
