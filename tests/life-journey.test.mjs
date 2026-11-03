import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLife, formatDay } from '../src/lib/life-grid.mjs';
import { STAGES, stageAtDay, stageSegments, fitGrid, cellPosition, normalizeWish, visibleLength, groundLayout, groundPoint, walkPosition } from '../src/lib/life-journey.mjs';

test('七阶段以公历生日划分，今天只定位到真实年龄', () => {
  const life = calculateLife('1990-04-15', 85, '2026-11-03');
  assert.equal(STAGES.length, 7);
  assert.equal(stageAtDay(life, life.todayDay).id, 'adult');
  assert.equal(stageAtDay(life, Date.parse('2008-04-14T00:00Z') / 86400000).id, 'teen');
  assert.equal(stageAtDay(life, Date.parse('2008-04-15T00:00Z') / 86400000).id, 'young');
  const segments = stageSegments(life, 'day');
  assert.equal(formatDay(segments[1].startDay), '1993-04-15');
  assert.equal(formatDay(segments.at(-1).endDay), '2075-04-15');
});

test('闰日出生阶段边界落在非闰年的二月二十八日，短寿命截断未来阶段', () => {
  const life = calculateLife('2000-02-29', 10, '2001-02-28');
  const segments = stageSegments(life, 'day');
  assert.deepEqual(segments.map(s => s.id), ['baby', 'child']);
  assert.equal(formatDay(segments[1].startDay), '2003-02-28');
  assert.equal(segments.at(-1).endCell, 3652);
});

test('周格按起始日期分组，不重复或遗失跨生日的周', () => {
  const life = calculateLife('2000-01-01', 80, '2026-11-03');
  const segments = stageSegments(life, 'week');
  assert.equal(segments[0].firstCell, 0);
  assert.equal(segments[0].endCell, 157);
  assert.equal(segments[1].firstCell, 157);
  assert.equal(segments.at(-1).endCell, 4175);
  assert.equal(segments.reduce((sum, s) => sum + s.endCell - s.firstCell, 0), life.totalWeeks);
});

test('全屏布局在手机横竖屏和120年日格下容纳每一个格子', () => {
  for (const [count, width, height] of [[43829, 272, 480], [43829, 760, 130], [29220, 1400, 720], [4175, 272, 480], [365, 100, 100]]) {
    for (const orientation of ['horizontal', 'vertical']) {
      const grid = fitGrid(count, width, height, orientation);
      assert.ok(grid.columns * grid.rows >= count);
      assert.ok(grid.columns * grid.pitch <= width + .001);
      assert.ok(grid.rows * grid.pitch <= height + .001);
      for (const index of [0, Math.floor(count / 2), count - 1]) {
        const point = cellPosition(grid, index);
        assert.ok(point.x >= 0 && point.y >= 0);
        assert.ok(point.x + grid.size <= width + .001);
        assert.ok(point.y + grid.size <= height + .001);
      }
    }
  }
});

test('横向为列优先、纵向为行优先，重新排布仍对应同一日期序号', () => {
  const horizontal = fitGrid(100, 200, 100, 'horizontal');
  assert.equal(cellPosition(horizontal, 1).x, cellPosition(horizontal, 0).x);
  assert.ok(cellPosition(horizontal, 1).y > cellPosition(horizontal, 0).y);
  const vertical = fitGrid(100, 100, 200, 'vertical');
  assert.ok(cellPosition(vertical, 1).x > cellPosition(vertical, 0).x);
  assert.equal(cellPosition(vertical, 1).y, cellPosition(vertical, 0).y);
});

test('愿望按可见字符限制，emoji不拆开，空输入有默认文案', () => {
  assert.match(normalizeWish('  '), /愿/);
  const text = '👨‍👩‍👧‍👦'.repeat(85);
  assert.equal(visibleLength(normalizeWish(text)), 80);
  assert.equal(normalizeWish('  去看海\n一起出发  '), '去看海 一起出发');
});

test('格子是有透视的水平地面，远端窄、近端宽，脚落在行走格的中心', () => {
  const ground = groundLayout(900, 650);
  const backLeft = groundPoint(ground, 0, 0), backRight = groundPoint(ground, ground.columns, 0);
  const frontLeft = groundPoint(ground, 0, ground.rows), frontRight = groundPoint(ground, ground.columns, ground.rows);
  assert.ok(backRight.x - backLeft.x < frontRight.x - frontLeft.x);
  assert.ok(frontLeft.y > backLeft.y);
  for (const progress of [0, 1 / (ground.columns - 5), 1]) {
    const foot = walkPosition(ground, progress);
    const expected = groundPoint(ground, foot.column + .5, foot.row + .5);
    assert.equal(foot.x, expected.x); assert.equal(foot.y, expected.y);
    assert.ok(foot.x > 0 && foot.x < 900 && foot.y < 650);
  }
  const first = walkPosition(ground, 0), second = walkPosition(ground, 1 / (ground.columns - 5));
  assert.equal(second.column - first.column, 1, '每次落脚前进一格');
});
