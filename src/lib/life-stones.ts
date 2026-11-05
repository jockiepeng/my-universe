import { createTerrain, terrainCell, terrainStep, terrainCamera, projectTerrain, unprojectTerrain } from './life-terrain.mjs';
import { stageSegments } from './life-journey.mjs';
import type { Life, Unit, Palette } from './life-painter';
import { t } from './i18n.mjs';

type Terrain = ReturnType<typeof createTerrain>;
function blend(a: string, b: string, ratio: number) {
  const parse = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const x = parse(a), y = parse(b);
  return `rgb(${x.map((n, i) => Math.round(n * ratio + y[i] * (1 - ratio))).join(',')})`;
}
export function stoneTint(stageColor: string, dark = false) { return blend(stageColor, dark ? '#33454b' : '#eeefea', dark ? .55 : .58); }
function stone(ctx: CanvasRenderingContext2D, x: number, z: number, color: string, detail: boolean, seed: number, worn: boolean, dark: boolean) {
  const margin = .065, size = 1 - margin * 2, radius = detail ? .09 : .04;
  ctx.fillStyle = dark ? '#14282e' : '#bbc3c0';
  ctx.beginPath(); ctx.roundRect(x + margin + .012, z + margin + .09, size, size, radius); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x + margin, z + margin, size, size, radius); ctx.fill();
  ctx.strokeStyle = dark ? '#a5b8b24d' : '#ffffffbd'; ctx.lineWidth = detail ? .045 : .025;
  ctx.beginPath(); ctx.moveTo(x + .13, z + .12); ctx.lineTo(x + .86, z + .12); ctx.stroke();
  if (!detail) return;
  ctx.strokeStyle = dark ? '#071e274d' : '#748a8140'; ctx.lineWidth = .025;
  ctx.beginPath(); ctx.moveTo(x + .86, z + .2); ctx.lineTo(x + .86, z + .83); ctx.lineTo(x + .18, z + .83); ctx.stroke();
  const hash = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  ctx.fillStyle = dark ? '#c2cebf1f' : '#63736818';
  for (let p = 0; p < 4; p++) { ctx.beginPath(); ctx.arc(x + .18 + (hash * (p + 2) % .6), z + .2 + (hash * (p + 5) % .55), .012, 0, Math.PI * 2); ctx.fill(); }
  if (worn) {
    ctx.strokeStyle = dark ? '#ffffff17' : '#fafbf28c'; ctx.lineWidth = .02;
    ctx.beginPath(); ctx.moveTo(x + .18, z + .69); ctx.lineTo(x + .42, z + .58); ctx.moveTo(x + .57, z + .2); ctx.lineTo(x + .72, z + .26); ctx.stroke();
    ctx.fillStyle = dark ? '#e5e7db65' : '#526b6357';
    ctx.beginPath(); ctx.ellipse(x + .39, z + .43, .055, .12, -.35, 0, Math.PI * 2); ctx.ellipse(x + .61, z + .61, .055, .12, -.35, 0, Math.PI * 2); ctx.fill();
  }
}

export class LifeStoneTerrain {
  readonly world: Terrain;
  private base: HTMLCanvasElement;
  private walked: HTMLCanvasElement;
  private colors: string[];
  private dark: boolean;
  private readonly resolution = 6;
  constructor(readonly life: Life, readonly unit: Unit, palette: Palette) {
    this.world = createTerrain(life, unit);
    const rgb = palette.text.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [0];
    this.dark = rgb.reduce((sum, n) => sum + n, 0) > 450;
    const segments = stageSegments(life, unit);
    this.colors = Array.from({ length: this.world.count }, (_, i) => stoneTint(segments.find(s => i < s.endCell)!.color, this.dark));
    const make = () => { const target = document.createElement('canvas'); target.width = Math.ceil(this.world.width * this.resolution); target.height = Math.ceil(this.world.depth * this.resolution); return target; };
    this.base = make(); this.walked = make();
    const a = this.base.getContext('2d')!, b = this.walked.getContext('2d')!;
    a.scale(this.resolution, this.resolution); b.scale(this.resolution, this.resolution);
    for (let i = 0; i < this.world.count; i++) {
      const p = terrainCell(this.world, i);
      stone(a, p.x - .5, p.z - .5, this.dark ? '#33464b' : '#eceee9', false, i, false, this.dark);
      stone(b, p.x - .5, p.z - .5, this.colors[i], false, i, true, this.dark);
    }
  }
  private paintWorld(ctx: CanvasRenderingContext2D, camera: ReturnType<typeof terrainCamera>, filled: number) {
    const { scale, x, y } = camera;
    ctx.save(); ctx.transform(scale, .16 * scale, -.48 * scale, .68 * scale, x, y);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, this.base.width / this.resolution, this.base.height / this.resolution);
    ctx.save(); ctx.beginPath();
    if (filled >= this.world.count) ctx.rect(0, 0, this.world.width, this.world.depth + .15);
    else {
      const p = terrainCell(this.world, filled), row = this.world.rows[p.row];
      ctx.rect(0, 0, this.world.width, row.z);
      if (row.reverse) ctx.rect(p.x + .5, row.z, this.world.width - p.x - .5, 1.2);
      else ctx.rect(0, row.z, p.x - .5, 1.2);
    }
    ctx.clip(); ctx.drawImage(this.walked, 0, 0, this.walked.width / this.resolution, this.walked.height / this.resolution); ctx.restore();
    ctx.restore();
  }
  render(ctx: CanvasRenderingContext2D, width: number, height: number, index: number, zoom: number, palette: Palette) {
    const foot = terrainStep(this.world, index), camera = terrainCamera(this.world, width, height, foot, zoom);
    const ended = this.life.remainingDays === 0 && index >= this.world.count - 1;
    const filled = ended ? this.world.count : Math.max(0, Math.min(this.world.count, Math.floor(index)));
    this.paintWorld(ctx, camera, filled);
    ctx.save(); ctx.transform(camera.scale, .16 * camera.scale, -.48 * camera.scale, .68 * camera.scale, camera.x, camera.y);
    if (camera.scale > 7) {
      const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => unprojectTerrain(camera, x, y));
      const minX = Math.min(...corners.map(p => p.x)) - 2, maxX = Math.max(...corners.map(p => p.x)) + 2;
      const minZ = Math.min(...corners.map(p => p.z)) - 2, maxZ = Math.max(...corners.map(p => p.z)) + 2;
      this.world.rows.forEach(row => {
        if (row.z < minZ || row.z > maxZ) return;
        const start = Math.max(0, Math.floor(minX) - 5), end = Math.min(row.end - row.start - 1, Math.ceil(maxX));
        for (let col = start; col <= end; col++) {
          const i = row.reverse ? row.end - 1 - col : row.start + col;
          const p = terrainCell(this.world, i);
          if (p.x < minX || p.x > maxX) continue;
          stone(ctx, p.x - .5, p.z - .5, i < filled ? this.colors[i] : this.dark ? '#33464b' : '#eceee9', true, i, i < filled, this.dark);
        }
      });
    }
    const current = terrainCell(this.world, index);
    const glow = ctx.createRadialGradient(current.x, current.z, .1, current.x, current.z, 1.5);
    glow.addColorStop(0, '#e8c5758c'); glow.addColorStop(1, '#e8c57500'); ctx.fillStyle = glow; ctx.fillRect(current.x - 1.5, current.z - 1.5, 3, 3);
    stone(ctx, current.x - .5, current.z - .5, ended ? this.colors[current.index] : this.dark ? '#a18b58' : '#ead6a1', camera.scale > 7, current.index, ended, this.dark);
    ctx.fillStyle = this.dark ? '#00000055' : '#30443a2b'; ctx.beginPath(); ctx.ellipse(foot.x, foot.z, .52, .15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const screen = projectTerrain(camera, foot.x, foot.z);
    if (zoom < .12) {
      ctx.fillStyle = palette.today; ctx.beginPath(); ctx.arc(screen.x, screen.y, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    if (zoom > .35 && width > 500) {
      const mapWidth = 165, mapHeight = 100;
      const mini = terrainCamera(this.world, mapWidth, mapHeight, foot, 0);
      ctx.save(); ctx.translate(width - mapWidth - 12, 10);
      ctx.fillStyle = this.dark ? '#11292be8' : '#f7f9f4e8'; ctx.fillRect(0, 0, mapWidth, mapHeight);
      this.paintWorld(ctx, mini, filled);
      const p = projectTerrain(mini, foot.x, foot.z); ctx.fillStyle = palette.today; ctx.beginPath(); ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = palette.muted; ctx.font = '10px "Microsoft YaHei",sans-serif'; ctx.fillText(t('完整人生地面'), 8, 15); ctx.restore();
    }
    return { ...foot, ...screen, zoom, scale: camera.scale, spriteHeight: Math.max(22, Math.min(width < 500 ? 110 : 156, camera.scale * 3)), lift: foot.lift * camera.scale };
  }
}
