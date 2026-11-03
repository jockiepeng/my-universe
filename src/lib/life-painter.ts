import { calculateLife } from './life-grid.mjs';
import { cellPosition, fitGrid, stageSegments, graphemes, groundLayout, groundPoint, walkPosition, stageAtDay } from './life-journey.mjs';
import { CHARACTER_SHEET, characterIndex } from './life-character.mjs';
import { stoneTint } from './life-stones';

export type Life = ReturnType<typeof calculateLife>;
export type Unit = 'day' | 'week';
export type Rect = { x: number; y: number; width: number; height: number };
export type Palette = { text: string; muted: string; future: string; today: string; trail: string };
export type Grid = ReturnType<typeof fitGrid>;
type PaintOptions = { fillDays?: number; selected?: number; fromRect?: Rect; morph?: number; markers?: boolean; labelScale?: number; monochrome?: boolean };
export function totalCells(life: Life, unit: Unit) { return unit === 'day' ? life.totalDays : life.totalWeeks; }
export function completedCells(life: Life, unit: Unit) { return unit === 'day' ? life.elapsedDays : life.elapsedWeeks; }

export function paintLifeGrid(ctx: CanvasRenderingContext2D, life: Life, unit: Unit, rect: Rect, palette: Palette, options: PaintOptions = {}): Grid {
  ctx.save();
  const count = totalCells(life, unit), segments = stageSegments(life, unit);
  const grid = fitGrid(count, rect.width, rect.height, 'vertical');
  const from = options.fromRect;
  const horizontal = from ? fitGrid(count, from.width, from.height, 'horizontal') : grid;
  const morph = from ? (options.morph ?? 0) : 1;
  const days = options.fillDays ?? life.elapsedDays;
  const filled = days >= life.totalDays ? count : unit === 'day' ? Math.floor(days) : Math.floor(days / 7);
  const point = (index: number) => {
    const end = cellPosition(grid, index);
    if (!from) return { x: rect.x + end.x, y: rect.y + end.y };
    const start = cellPosition(horizontal, index);
    return { x: (from.x + start.x) * (1 - morph) + (rect.x + end.x) * morph, y: (from.y + start.y) * (1 - morph) + (rect.y + end.y) * morph };
  };
  const size = horizontal.size * (1 - morph) + grid.size * morph;
  ctx.lineWidth = Math.min(.8, size * .25);
  ctx.strokeStyle = palette.future;
  const textRgb = palette.text.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0];
  const dark = textRgb.reduce((sum, n) => sum + n, 0) > 450;
  if (options.monochrome) ctx.strokeStyle = dark ? '#596367' : '#d0d3ce';
  ctx.fillStyle = options.monochrome ? (dark ? '#283237' : '#fafaf7') : dark ? '#30444c' : '#eceee9';
  for (let i = filled; i < count; i++) { const p = point(i); ctx.fillRect(p.x, p.y, size, size); ctx.strokeRect(p.x, p.y, size, size); }
  for (const segment of segments) {
    ctx.fillStyle = options.monochrome ? (dark ? '#e2e6e4' : '#303638') : stoneTint(segment.color, dark);
    for (let i = segment.firstCell; i < Math.min(segment.endCell, filled); i++) { const p = point(i); ctx.fillRect(p.x, p.y, size, size); }
  }
  if (size >= 4 && !options.monochrome) {
    ctx.strokeStyle = dark ? '#ffffff40' : '#ffffffbb'; ctx.lineWidth = Math.max(.5, size * .09);
    for (let i = 0; i < count; i++) { const p = point(i); ctx.beginPath(); ctx.moveTo(p.x + size * .15, p.y + size * .14); ctx.lineTo(p.x + size * .83, p.y + size * .14); ctx.stroke(); }
  }
  if (filled < count) {
    const now = point(filled);
    ctx.fillStyle = palette.today; ctx.fillRect(now.x, now.y, size, size);
    ctx.strokeStyle = palette.today; ctx.lineWidth = 1.8;
    ctx.strokeRect(now.x - 2, now.y - 2, size + 4, size + 4);
  }
  const selected = options.selected ?? -1;
  if (selected >= 0 && selected < count && selected !== filled) {
    const p = point(selected); ctx.strokeStyle = palette.text; ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - 1, p.y - 1, size + 2, size + 2);
  }
  if (options.markers !== false && morph === 1) {
    const scale = options.labelScale ?? 1, railX = rect.x - 12 * scale;
    const end = cellPosition(grid, Math.min(filled, count - 1));
    ctx.strokeStyle = options.monochrome ? (dark ? '#e2e6e4' : '#303638') : palette.trail; ctx.lineWidth = 1.6 * scale;
    ctx.beginPath(); ctx.moveTo(railX, rect.y + grid.y); ctx.lineTo(railX, rect.y + end.y + grid.size / 2); ctx.stroke();
    ctx.font = `${11 * scale}px "Segoe UI","Microsoft YaHei",sans-serif`;
    ctx.textBaseline = 'top';
    for (const segment of segments) {
      const p = cellPosition(grid, segment.firstCell), y = rect.y + p.y;
      ctx.fillStyle = options.monochrome ? palette.muted : segment.firstCell <= filled ? segment.color : palette.muted;
      ctx.beginPath(); ctx.arc(railX, y + 4 * scale, 2.3 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(segment.name, rect.x - 58 * scale, y, 42 * scale);
    }
    if (filled < count) {
      ctx.fillStyle = palette.today;
      ctx.beginPath(); ctx.arc(railX, rect.y + end.y + grid.size / 2, 4 * scale, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  return { ...grid, x: grid.x + rect.x, y: grid.y + rect.y };
}

const images = new Map<string, Promise<HTMLImageElement>>();
let sheet: Promise<HTMLImageElement> | null = null;
function imageFrom(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('人物图片暂时无法读取，请重试。')); img.src = src; }); }
export function characterImage(stage: string) {
  sheet ??= imageFrom(CHARACTER_SHEET).catch(error => { sheet = null; throw error; });
  if (!images.has(stage)) images.set(stage, sheet.then(atlas => {
    const cell = document.createElement('canvas'); cell.width = atlas.width / 7; cell.height = atlas.height / 4;
    const ctx = cell.getContext('2d'); if (!ctx) throw new Error('无法绘制人物。');
    ctx.drawImage(atlas, characterIndex(stage) * cell.width, cell.height, cell.width, cell.height, 0, 0, cell.width, cell.height);
    return imageFrom(cell.toDataURL('image/png'));
  }).catch(error => { images.delete(stage); throw error; }));
  return images.get(stage)!;
}

export function paintJourneyGround(ctx: CanvasRenderingContext2D, life: Life, unit: Unit, width: number, height: number, shownDays: number, progress: number, palette: Palette) {
  const ground = groundLayout(width, height), foot = walkPosition(ground, progress);
  const count = totalCells(life, unit), span = unit === 'day' ? 1 : 7;
  const current = Math.min(count - 1, Math.floor(shownDays / span));
  const anchorColumn = Math.round(foot.column);
  ctx.save();
  for (let row = 0; row < ground.rows; row++) for (let column = 0; column < ground.columns; column++) {
    const index = current + column - anchorColumn + (row - foot.row) * ground.columns;
    if (index < 0 || index >= count) continue;
    const corners = [groundPoint(ground, column + .06, row + .06), groundPoint(ground, column + .94, row + .06), groundPoint(ground, column + .94, row + .94), groundPoint(ground, column + .06, row + .94)];
    const path = () => { ctx.beginPath(); corners.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); };
    ctx.fillStyle = palette.future; ctx.globalAlpha *= .3;
    ctx.beginPath(); ctx.moveTo(corners[2].x, corners[2].y); ctx.lineTo(corners[3].x, corners[3].y); ctx.lineTo(corners[3].x, corners[3].y + 5); ctx.lineTo(corners[2].x, corners[2].y + 5); ctx.closePath(); ctx.fill();
    ctx.globalAlpha /= .3;
    path(); ctx.fillStyle = index <= current ? stageAtDay(life, life.birthDay + index * span).color : palette.future;
    const opacity = ctx.globalAlpha; ctx.globalAlpha *= index <= current ? .75 : .15; ctx.fill(); ctx.globalAlpha = opacity;
    ctx.strokeStyle = index === current ? palette.today : palette.future; ctx.lineWidth = index === current ? 1.7 : .8; ctx.stroke();
    if (row === foot.row && column < foot.column && index < current) {
      const p = groundPoint(ground, column + .5, row + .5);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha *= .65;
      ctx.beginPath(); ctx.ellipse(p.x - 3, p.y - 2, 2, 4, -.5, 0, Math.PI * 2); ctx.ellipse(p.x + 3, p.y + 2, 2, 4, -.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = opacity;
    }
  }
  ctx.fillStyle = palette.text; ctx.globalAlpha *= .16;
  ctx.beginPath(); ctx.ellipse(foot.x, foot.y, width < 500 ? 14 : 22, 5, 0, 0, 2 * Math.PI); ctx.fill();
  ctx.restore();
  return foot;
}

export function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []; let line = '';
  for (const character of graphemes(text)) {
    if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = character; }
    else line += character;
  }
  if (line) lines.push(line);
  return lines;
}
