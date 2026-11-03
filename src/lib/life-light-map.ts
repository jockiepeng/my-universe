import { printLayout, printPoint } from './life-replay.mjs';
import type { Life, Unit, Rect } from './life-painter';
export const LIGHT_COLORS = { background: '#101417', text: '#eef1f3', muted: '#9aa2aa', past: '#59bcb0', future: '#2d343c', today: '#e4b86e' };
export type LightGrid = ReturnType<typeof printLayout>;

export class LifeLightMap {
  readonly grid: LightGrid;
  private base: HTMLCanvasElement;
  private past: HTMLCanvasElement;
  constructor(readonly life: Life, readonly unit: Unit, readonly width: number, readonly height: number) {
    this.grid = printLayout(life, unit, width, height);
    const resolution = width < 1100 ? 2 : 1;
    const make = () => { const c = document.createElement('canvas'); c.width = Math.ceil(width * resolution); c.height = Math.ceil(height * resolution); return c; };
    this.base = make(); this.past = make();
    const a = this.base.getContext('2d')!, b = this.past.getContext('2d')!;
    a.scale(resolution, resolution); b.scale(resolution, resolution);
    a.fillStyle = LIGHT_COLORS.future; b.fillStyle = LIGHT_COLORS.past;
    for (let i = 0; i < this.grid.count; i++) {
      const p = printPoint(this.grid, i);
      a.fillRect(p.x, p.y, this.grid.cellWidth, this.grid.cellHeight);
      b.fillRect(p.x, p.y, this.grid.cellWidth, this.grid.cellHeight);
    }
  }
  paint(ctx: CanvasRenderingContext2D, rect: Rect, days: number, options: { selected?: number; glowing?: boolean; labelScale?: number; today?: boolean } = {}) {
    const g = this.grid, filled = days >= this.life.totalDays ? g.count : Math.floor(days / (this.unit === 'week' ? 7 : 1));
    ctx.save(); ctx.translate(rect.x, rect.y);
    ctx.drawImage(this.base, 0, 0, g.width, g.height);
    ctx.save(); ctx.beginPath();
    if (filled >= g.count) ctx.rect(0, 0, g.width, g.height);
    else {
      const p = printPoint(g, filled);
      ctx.rect(0, 0, g.width, p.y);
      ctx.rect(0, p.y, p.x, g.cellHeight);
    }
    ctx.clip(); ctx.drawImage(this.past, 0, 0, g.width, g.height); ctx.restore();
    if (options.glowing && filled > 0) {
      ctx.fillStyle = '#b4f2e1'; ctx.shadowColor = LIGHT_COLORS.past; ctx.shadowBlur = 8;
      for (let i = Math.max(0, filled - (this.unit === 'day' ? 18 : 4)); i < filled; i++) { const p = printPoint(g, i); ctx.fillRect(p.x, p.y, g.cellWidth, g.cellHeight); }
      ctx.shadowBlur = 0;
    }
    if (options.today !== false && filled < g.count) {
      const p = printPoint(g, filled);
      ctx.fillStyle = LIGHT_COLORS.today; ctx.shadowColor = LIGHT_COLORS.today; ctx.shadowBlur = 5;
      ctx.fillRect(p.x, p.y, Math.max(g.cellWidth, 2), Math.max(g.cellHeight, 1.5)); ctx.shadowBlur = 0;
    }
    if (options.selected !== undefined && options.selected !== filled) {
      const p = printPoint(g, options.selected); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 1, p.y - 1, g.cellWidth + 2, g.cellHeight + 2);
    }
    const scale = options.labelScale || 1;
    ctx.fillStyle = LIGHT_COLORS.muted; ctx.font = `${11 * scale}px "Segoe UI","Microsoft YaHei",sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const interval = g.years.length > 15 ? 10 : Math.max(1, Math.ceil(15 * scale / (g.height / g.years.length)));
    for (let age = 0; age < g.years.length; age += interval) ctx.fillText(String(age), -14 * scale, printPoint(g, g.years[age].start).y + g.cellHeight / 2);
    ctx.restore();
    return { ...g, x: rect.x, y: rect.y };
  }
}
