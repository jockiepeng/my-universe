import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLife } from '../src/lib/life-grid.mjs';
import { printLayout, printPoint, printHit, replayScenes, replayFrame } from '../src/lib/life-replay.mjs';

test('连续逐日逐周排版完整容纳，每格可正确命中，闰日不丢失', () => {
  for (const years of [1, 85, 120]) for (const unit of ['day', 'week']) for (const [w,h] of [[240,480],[1000,160],[1320,1450]]) {
    const life = calculateLife('2000-02-29', years, '2026-11-04');
    const g = printLayout(life, unit, w,h);
    assert.equal(g.count, unit === 'day' ? life.totalDays : life.totalWeeks);
    let last = -1;
    for (let i=0; i<g.count; i++) {
      const p = printPoint(g,i);
      assert.ok(p.x>=0 && p.y>=0 && p.x+g.cellWidth<=w+.01 && p.y+g.cellHeight<=h+.01);
      assert.equal(printHit(g,p.x+g.cellWidth/2,p.y+g.cellHeight/2),i);
      assert.ok(p.y>=last); last=p.y;
    }
    assert.equal(printHit(g,-1,0),-1);
    assert.equal(printHit(g,w+1,h),-1);
  }
});

test('全图每行连续排满同样数量的等尺寸格子，年份边界不在右侧重复留洞', () => {
  const life=calculateLife('2000-01-01',85,'2026-11-04');
  for(const unit of ['day','week']) {
    const g=printLayout(life,unit,900,600);
    for(let i=0;i<g.count;i++) {
      const p=printPoint(g,i);
      assert.ok(Math.abs(p.x-(i%g.columns+.11)*g.pitchX)<.0001);
      assert.ok(Math.abs(p.y-(Math.floor(i/g.columns)+.175)*g.pitchY)<.0001);
    }
  }
});

test('回放从零逐日递增，重要年龄短停，只走到今天', () => {
  const life = calculateLife('1990-04-15',85,'2026-11-04');
  const scenes = replayScenes(life);
  assert.deepEqual(scenes.slice(0,-1).map(s=>s.age),[0,3,7,13,18,30]);
  assert.equal(scenes[0].days,0);
  assert.equal(scenes.at(-1).days,life.elapsedDays);
  let previous=0;
  for(let t=0;t<=13000;t+=16) {
    const f=replayFrame(scenes,t);
    assert.ok(f.days>=previous && f.days<=life.elapsedDays); previous=f.days;
  }
  assert.equal(replayFrame(scenes,13000).done,true);
  assert.equal(replayFrame(scenes,13000).days,life.elapsedDays);
  assert.equal(replayFrame(scenes,1750).days,replayFrame(scenes,1950).days);
  assert.equal(replayFrame(scenes,1200).scene,0,'尚未到三岁，不提前显示进入童年');
  assert.equal(replayFrame(scenes,1750).scene,1,'到三岁停顿时进入童年场景');
});

test('人生回放覆盖童年到九十岁节点，未来年龄不提前播放', () => {
  const older=calculateLife('1930-01-01',110,'2026-11-04');
  const scenes=replayScenes(older);
  assert.deepEqual(scenes.slice(0,-1).map(s=>s.age),[0,3,7,13,18,30,40,50,60,70,80,90]);
  assert.match(scenes.find(s=>s.age===40).title,/不惑/);
  for(const scene of scenes) assert.ok(scene.days<=older.elapsedDays);
  assert.equal(replayFrame(scenes,40000).days,older.elapsedDays);
  assert.equal(replayFrame(scenes,40000).done,true);
  const leap=calculateLife('2000-02-29',80,'2018-02-28');
  const adult=replayScenes(leap).find(s=>s.age===18);
  assert.equal(adult.days,leap.elapsedDays);
});

test('出生当天和超出寿命的回放不越界，阶段日期属于设定人生', () => {
  for (const birth of ['2026-11-04','2000-01-01']) {
    const life=calculateLife(birth,1,'2026-11-04');
    const scenes=replayScenes(life);
    for(const s of scenes) assert.ok(s.days>=0&&s.days<=life.elapsedDays);
    assert.equal(replayFrame(scenes,15000).days,life.elapsedDays);
  }
});
