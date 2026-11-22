import { test } from "node:test";
import assert from "node:assert/strict";
import { setServerClock, advanceServerClock, today, serverMinute } from "../src/shared/domain/server-clock.js";

test("дата и минута берутся из серверного ISO по Москве", () => {
  setServerClock({now:"2026-11-22T22:15:00Z", timezone:"Europe/Moscow"});
  assert.equal(today(),"2026-11-23");
  assert.equal(serverMinute(),75);
});

test("полночь пересчитывает серверный день по монотонному времени", () => {
  const native = performance.now;
  let elapsed = 1000;
  performance.now = () => elapsed;
  try {
    setServerClock({now:"2026-11-22T23:59:59+03:00", timezone:"Europe/Moscow"});
    assert.equal(today(),"2026-11-22");
    elapsed += 2000;
    advanceServerClock();
    assert.equal(today(),"2026-11-23");
    assert.equal(serverMinute(),0);
  } finally { performance.now = native; }
});

test("некорректное время сервера отклоняется", () => {
  assert.throws(()=>setServerClock({now:"invalid",timezone:"Europe/Moscow"}));
});
