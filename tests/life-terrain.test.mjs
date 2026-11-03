import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLife } from '../src/lib/life-grid.mjs';
import { createTerrain, terrainCell, terrainStep, terrainCamera, projectTerrain, journeyDay } from '../src/lib/life-terrain.mjs';

test('完整人生所有日格唯一且按生日年分行，不用局部地砖重编号', () => {
  const life = calculateLife('2000-02-29', 80, '2026-11-03');
  const terrain = createTerrain(life, 'day');
  assert.equal(terrain.count, 29220);
  assert.equal(terrain.rows.length, 80);
  assert.equal(terrain.rows[0].end, 365);
  const positions = new Set(Array.from({ length: terrain.count }, (_, i) => { const cell = terrainCell(terrain, i); return `${cell.x},${cell.z}`; }));
  assert.equal(positions.size, life.totalDays);
  assert.equal(terrainCell(terrain, 365).row, 1);
});
test('完整周格没有在生日年边界重复或遗漏', () => {
  const life = calculateLife('2000-01-01', 80, '2026-11-03');
  const terrain = createTerrain(life, 'week');
  assert.equal(terrain.count, 4175);
  assert.equal(terrain.rows.reduce((n, row) => n + row.end - row.start, 0), 4175);
  for (let i = 1; i < terrain.rows.length; i++) assert.equal(terrain.rows[i].start, terrain.rows[i - 1].end);
});
test('角色沿相邻格中心走动，蛇形换行方向变化，最后停在末格', () => {
  const terrain = createTerrain(calculateLife('2001-01-01', 2, '2002-01-02'), 'day');
  const first = terrainCell(terrain, 0), next = terrainCell(terrain, 1);
  const half = terrainStep(terrain, .5);
  assert.equal(half.x, (first.x + next.x) / 2);
  assert.equal(half.z, first.z);
  assert.equal(terrainStep(terrain, 10).direction, 1);
  assert.equal(terrainStep(terrain, 370).direction, -1);
  const edge = terrainStep(terrain, 364.5);
  assert.ok(Number.isFinite(edge.x) && Number.isFinite(edge.z));
  assert.equal(terrainStep(terrain, terrain.count - 1).x, terrainCell(terrain, terrain.count - 1).x);
});
test('完整地面的全景在手机横竖屏和120岁范围内可容纳所有角点', () => {
  for (const unit of ['day', 'week']) for (const years of [1, 80, 120]) for (const [width, height] of [[240, 500], [844, 220], [1000, 650]]) {
    const terrain = createTerrain(calculateLife('2000-01-01', years, '2026-11-03'), unit);
    const camera = terrainCamera(terrain, width, height, terrainStep(terrain, 100), 0);
    for (const [x, z] of [[0, 0], [terrain.width, 0], [0, terrain.depth], [terrain.width, terrain.depth]]) {
      const p = projectTerrain(camera, x, z);
      assert.ok(p.x >= -1 && p.x <= width + 1 && p.y >= -1 && p.y <= height + 1, JSON.stringify({ years, unit, width, height, p }));
    }
  }
});

test('全景与近景之间缩放时，出生、今天和末格的人物始终在视野内', () => {
  const terrain = createTerrain(calculateLife('1990-04-15', 85, '2026-11-03'), 'day');
  for (const index of [0, 13351, terrain.count - 1]) for (const zoom of [.1, .25, .5, .75, 1]) {
    const foot = terrainStep(terrain, index), camera = terrainCamera(terrain, 900, 650, foot, zoom);
    const p = projectTerrain(camera, foot.x, foot.z);
    assert.ok(p.x >= 0 && p.x <= 900 && p.y >= 0 && p.y <= 650, JSON.stringify({ index, zoom, p }));
  }
});
test('超出设定寿命的动画止于真实末格日期，正常当前周止于今天', () => {
  const ended = calculateLife('2000-01-01', 1, '2026-11-03');
  assert.equal(journeyDay(ended, 'day', 365), ended.endDay - 1);
  assert.equal(journeyDay(ended, 'week', 52), ended.endDay - 1);
  const life = calculateLife('1990-04-15', 85, '2026-11-03');
  assert.equal(journeyDay(life, 'week', 1907), life.todayDay);
  assert.equal(journeyDay(life, 'day', 0), life.birthDay);
});
