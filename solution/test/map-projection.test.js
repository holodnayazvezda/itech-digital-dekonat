import test from 'node:test';
import assert from 'node:assert/strict';
import {mapProjection} from '../client/map-projection.js';
test('плоский вид сохраняет координаты, стены поднимаются вертикально при любом повороте',()=>{
  const flat=mapProjection([0,0,1200,700],0,0);
  assert.deepEqual(flat.matrix,[1,0,-0,1,0,0]);
  for(const yaw of [-180,-90,-18,0,45,180]) {
    const p=mapProjection([0,0,1200,700],yaw,42);
    const [a,b,c,d]=p.matrix,[x,y]=p.wallOffset;
    assert.ok(Math.abs(a*x+c*y)<1e-8);
    assert.ok(b*x+d*y<0);
    assert.ok(p.matrix.every(Number.isFinite));
  }
});
