import { calculateLife, formatDay } from './life-grid.mjs';
import { createTerrain } from './life-terrain.mjs';

const worlds = new WeakMap();
function worldFor(life, unit) {
  let units = worlds.get(life);
  if (!units) { units = new Map(); worlds.set(life, units); }
  if (!units.has(unit)) units.set(unit, createTerrain(life, unit));
  return units.get(unit);
}
export function printLayout(life, unit, width, height) {
  const world = worldFor(life, unit), columns = unit === 'day' ? 74 : 53;
  const rows = Math.ceil(world.count / columns), pitchX = width / columns, pitchY = height / rows;
  return { count: world.count, years: world.rows, rowOfCell: world.rowOfCell, columns, rows, pitchX, pitchY, cellWidth: pitchX * .78, cellHeight: pitchY * .65, width, height, x: 0, y: 0 };
}
export function printPoint(grid, index) {
  index = Math.max(0, Math.min(grid.count - 1, Math.floor(index)));
  return { x: grid.x + index % grid.columns * grid.pitchX + grid.pitchX * .11, y: grid.y + Math.floor(index / grid.columns) * grid.pitchY + grid.pitchY * .175 };
}
export function printHit(grid, x, y) {
  x -= grid.x; y -= grid.y;
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return -1;
  const row = Math.floor(y / grid.pitchY), column = Math.floor(x / grid.pitchX), index = row * grid.columns + column;
  return index < grid.count ? index : -1;
}
const MILESTONES = [
  { age: 0, title: '第一天，你来到这个世界。', copy: '一个小小的你，和一整个人生的可能。' },
  { age: 3, title: '进入童年，好奇开始发芽。', copy: '奔跑、探索、欢笑，慢慢成为最初的记忆。' },
  { age: 7, title: '进入少年，世界慢慢变大。', copy: '认识新的朋友，也开始拥有自己的小小梦想。' },
  { age: 13, title: '走进青春，开始寻找自己。', copy: '有热爱，有迷惘，也有不肯轻易放下的勇气。' },
  { age: 18, title: '十八岁，走向成年。', copy: '带着期待与不确定，开始为自己的人生做选择。' },
  { age: 30, title: '三十而立，走自己的路。', copy: '不必照着谁的时间表，慢慢找到自己的方向。' },
  { age: 40, title: '四十不惑，更懂得选择。', copy: '把时间留给真正重要的人，也留给真正喜欢的事。' },
  { age: 50, title: '五十知天命，也知热爱。', copy: '看过生活的许多面，仍愿意为喜欢的事认真。' },
  { age: 60, title: '六十耳顺，步履从容。', copy: '放慢一点脚步，也许能看见不一样的风景。' },
  { age: 70, title: '七十从心，日子仍有新意。', copy: '那些长久的陪伴，与今天的小小欢喜，都值得珍惜。' },
  { age: 80, title: '八十岁，岁月有了厚度。', copy: '走过的路、爱过的人，都在生命里留下回声。' },
  { age: 90, title: '九十岁，仍与生活相逢。', copy: '每一次日出，都可以是一份新的礼物。' },
  { age: 100, title: '一百岁，走过一个世纪。', copy: '许多故事汇成一生，而今天仍然属于你。' },
];
export function replayScenes(life) {
  const scenes = [];
  for (const milestone of MILESTONES) {
    const days = milestone.age ? calculateLife(formatDay(life.birthDay), milestone.age, formatDay(life.todayDay)).endDay - life.birthDay : 0;
    if (days > life.elapsedDays || days >= life.totalDays) break;
    scenes.push({ ...milestone, days });
  }
  scenes.push({ age: null, days: life.elapsedDays, title: '原来，我已经走过这么远了。', copy: '亮起的每一格，都是你已经写下的故事。' });
  return scenes;
}
export function replayFrame(scenes, elapsed) {
  const lead = 700, movement = 950, hold = 750, segment = movement + hold;
  const last = scenes.length - 1, total = lead + last * segment + 500;
  if (elapsed < lead) return { days: 0, scene: 0, done: false };
  const scene = Math.min(last, Math.floor((elapsed - lead) / segment) + 1);
  const t = Math.min(1, Math.max(0, (elapsed - lead - (scene - 1) * segment) / movement));
  const days = Math.floor(scenes[scene - 1].days + (scenes[scene].days - scenes[scene - 1].days) * t);
  return { days, scene: t < 1 ? scene - 1 : scene, done: elapsed >= total };
}
