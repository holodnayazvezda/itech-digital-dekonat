import test from 'node:test';
import assert from 'node:assert/strict';
import { searchScore } from '../src/shared/domain/search.js';

test('короткие имена находят полные формы, включая неоднозначное Саша',()=>{
  for(const [q,name] of [['маша','Рябова Мария Олеговна'],['катя','Екатерина Белова'],['саша','Александр Рощин'],['саша','Александра Рощина'],['маша ряб','Рябова Мария Олеговна']]) assert.ok(searchScore(q,name,{names:true})>0);
  assert.equal(searchScore('маша','Рябова Марина Олеговна',{names:true}),0);
  assert.equal(searchScore('маша','Рябова Мария Олеговна'),0);
});
test('поиск допускает одну опечатку, сохраняет точные совпадения выше и учитывает все слова',()=>{
  assert.ok(searchScore('мария','Мария')>searchScore('мария','Марья',{names:true}));
  assert.ok(searchScore('марияа','Мария',{names:true})>0);
  assert.equal(searchScore('рябова катя','Рябова Мария',{names:true}),0);
  assert.ok(searchScore('б 412','Корпус Б · Б-412')>0);
  assert.ok(searchScore('серёжа','Сергей',{names:true})>0);
});
