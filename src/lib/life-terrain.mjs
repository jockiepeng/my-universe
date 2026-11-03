import { calculateLife, formatDay } from './life-grid.mjs';

export function createTerrain(life, unit) {
  const span = unit === 'week' ? 7 : 1;
  const count = Math.ceil(life.totalDays / span), rows = [];
  let start = 0;
  for (let age = 1; start < count; age++) {
    const boundary = Math.min(life.endDay, calculateLife(formatDay(life.birthDay), age, formatDay(life.todayDay)).endDay);
    const end = Math.min(count, Math.ceil((boundary - life.birthDay) / span));
    rows.push({ start, end, reverse: rows.length % 2 === 1, z: rows.length * 1.35 });
    start = end;
  }
  const columns = Math.max(...rows.map(row => row.end - row.start)), period = unit === 'week' ? 4 : 30;
  const width = columns + Math.floor((columns - 1) / period) * .28;
  const rowOfCell = new Uint8Array(count);
  rows.forEach((row, i) => rowOfCell.fill(i, row.start, row.end));
  return { count, rows, columns, period, rowOfCell, width, depth: rows.at(-1).z + 1, unit };
}
export function terrainCell(terrain, index) {
  index = Math.max(0, Math.min(terrain.count - 1, Math.floor(index)));
  const rowIndex = terrain.rowOfCell[index], row = terrain.rows[rowIndex];
  const offset = index - row.start;
  const column = row.reverse ? row.end - row.start - 1 - offset : offset;
  return { x: column + Math.floor(column / terrain.period) * .28 + .5, z: row.z + .5, row: rowIndex, column, index, direction: row.reverse ? -1 : 1 };
}
export function terrainStep(terrain, index) {
  const bounded = Math.max(0, Math.min(terrain.count - 1, index));
  const first = terrainCell(terrain, bounded), next = terrainCell(terrain, Math.floor(bounded) + 1);
  const fraction = bounded - Math.floor(bounded), ease = fraction * fraction * (3 - 2 * fraction);
  return { ...first, x: first.x + (next.x - first.x) * ease, z: first.z + (next.z - first.z) * ease, fraction, frame: Math.floor((bounded % 2) * 2) % 4, lift: Math.sin(fraction * Math.PI) * .1 };
}
export function journeyDay(life, unit, index) {
  const span = unit === 'week' ? 7 : 1;
  const current = Math.min(Math.floor(life.elapsedDays / span), Math.ceil(life.totalDays / span) - 1);
  return index >= current ? Math.min(life.todayDay, life.endDay - 1) : life.birthDay + Math.max(0, Math.floor(index)) * span;
}
export function terrainCamera(terrain, width, height, focus, zoom) {
  zoom = Math.max(0, Math.min(1, zoom));
  const minX = -.48 * terrain.depth, maxX = terrain.width, maxY = .16 * terrain.width + .68 * terrain.depth;
  const far = Math.max(.01, Math.min((width - 28) / (maxX - minX), height * .68 / maxY));
  const near = Math.min(38, width / 9), scale = far + (near - far) * zoom;
  // Interpolate complete camera transforms so the focus stays between its two screen anchors.
  const farX = (width - (minX + maxX) * far) / 2, farY = height * .52 - maxY * far / 2;
  return { scale, x: farX * (1 - zoom) + (width * .5 - (focus.x - .48 * focus.z) * near) * zoom, y: farY * (1 - zoom) + (height * .66 - (.16 * focus.x + .68 * focus.z) * near) * zoom };
}
export function projectTerrain(camera, x, z) { return { x: camera.x + (x - .48 * z) * camera.scale, y: camera.y + (.16 * x + .68 * z) * camera.scale }; }
export function unprojectTerrain(camera, x, y) {
  const a = (x - camera.x) / camera.scale, b = (y - camera.y) / camera.scale;
  return { x: (.68 * a + .48 * b) / .7568, z: (-.16 * a + b) / .7568 };
}
