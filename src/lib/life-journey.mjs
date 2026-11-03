import { calculateLife, formatDay } from './life-grid.mjs';

export const STAGES = [
  { id: 'baby', name: '婴儿', from: 0, color: '#c9946c', copy: '第一次抬头，世界刚刚开始。' },
  { id: 'child', name: '儿童', from: 3, color: '#77a68f', copy: '把好奇装进口袋，跑向更大的世界。' },
  { id: 'teen', name: '少年', from: 12, color: '#669cbd', copy: '慢慢长大，也慢慢发现自己。' },
  { id: 'young', name: '青年', from: 18, color: '#6484b5', copy: '带着热爱，走向自己的远方。' },
  { id: 'adult', name: '成年', from: 30, color: '#9888b5', copy: '走过一些路，仍有新的故事。' },
  { id: 'middle', name: '中年', from: 45, color: '#ad8d77', copy: '步履从容，把时间留给在意的事。' },
  { id: 'elder', name: '老年', from: 60, color: '#829a9b', copy: '看过许多风景，仍可以期待明天。' },
];
export const DEFAULT_WISH = '愿接下来的日子，多一点热爱，也多一点勇敢。';
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
export function graphemes(value) { return segmenter ? [...segmenter.segment(value)].map(s => s.segment) : Array.from(value); }
export function visibleLength(value) { return graphemes(value).length; }
export function normalizeWish(value) { return graphemes(String(value).replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim()).slice(0, 80).join('') || DEFAULT_WISH; }
function anniversary(life, age) { return age ? calculateLife(formatDay(life.birthDay), age, formatDay(life.todayDay)).endDay : life.birthDay; }
export function stageAtDay(life, day) { return STAGES.findLast(stage => day >= anniversary(life, stage.from)) || STAGES[0]; }
export function stageSegments(life, unit) {
  const span = unit === 'week' ? 7 : 1;
  const total = Math.ceil(life.totalDays / span);
  return STAGES.map((stage, i) => {
    const startDay = anniversary(life, stage.from);
    const endDay = Math.min(life.endDay, i < STAGES.length - 1 ? anniversary(life, STAGES[i + 1].from) : life.endDay);
    return { ...stage, startDay, endDay, firstCell: Math.ceil((startDay - life.birthDay) / span), endCell: Math.min(total, Math.ceil((endDay - life.birthDay) / span)) };
  }).filter(stage => stage.startDay < life.endDay);
}
export function fitGrid(count, width, height, orientation = 'vertical') {
  width = Math.max(1, width); height = Math.max(1, height);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * width / height)));
  const rows = Math.ceil(count / columns);
  const pitch = Math.min(width / columns, height / rows);
  const gap = Math.min(pitch * .27, 2.3);
  return { columns, rows, pitch, size: pitch - gap, x: (width - columns * pitch) / 2 + gap / 2, y: (height - rows * pitch) / 2 + gap / 2, width, height, orientation };
}
export function cellPosition(grid, index) {
  const column = grid.orientation === 'horizontal' ? Math.floor(index / grid.rows) : index % grid.columns;
  const row = grid.orientation === 'horizontal' ? index % grid.rows : Math.floor(index / grid.columns);
  return { x: grid.x + column * grid.pitch, y: grid.y + row * grid.pitch };
}

export function groundLayout(width, height) {
  return { width, height, columns: width < 500 ? 10 : 18, rows: 6, back: height * .43, depth: Math.min(245, height * .44), planeWidth: width - 18 };
}
export function groundPoint(ground, column, row) {
  const depth = row / ground.rows, scale = .58 + .42 * depth;
  return { x: ground.width / 2 + (column / ground.columns - .5) * ground.planeWidth * scale, y: ground.back + ground.depth * depth ** 1.25 };
}
export function walkPosition(ground, progress) {
  const raw = Math.max(0, Math.min(1, progress)) * (ground.columns - 5);
  const fraction = raw - Math.floor(raw);
  const column = 2 + Math.floor(raw) + fraction * fraction * (3 - 2 * fraction);
  const row = 3;
  return { ...groundPoint(ground, column + .5, row + .5), column, row, frame: Math.floor((raw % 2) * 2) % 4, lift: Math.sin(fraction * Math.PI) * 4 };
}
