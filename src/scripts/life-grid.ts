import { calculateLife, cellDetails, formatDay, localToday } from '../lib/life-grid.mjs';
import { cellPosition, stageAtDay, stageSegments } from '../lib/life-journey.mjs';
import { paintLifeGrid, totalCells, completedCells, type Grid, type Palette, type Rect, type Unit } from '../lib/life-painter';
import { LifeStoneTerrain } from '../lib/life-stones';
import { journeyDay } from '../lib/life-terrain.mjs';
import { setupLifeShare } from './life-share';

const element = document.querySelector<HTMLElement>('[data-life-grid]');
if (element) {
  const root = element;
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const birth = get<HTMLInputElement>('[name="birth"]'), lifespan = get<HTMLInputElement>('[name="lifespan"]');
  const plot = get('[data-life-viewport]'), canvas = get<HTMLCanvasElement>('[data-life-canvas]');
  const fullscreen = get<HTMLDialogElement>('[data-life-fullscreen]');
  const fullPlot = get('[data-life-fullscreen-plot]'), fullCanvas = get<HTMLCanvasElement>('[data-life-fullscreen-canvas]');
  const query = get<HTMLInputElement>('[data-life-query]'), fullQuery = get<HTMLInputElement>('[data-life-fullscreen-query]');
  const walker = get('[data-life-walker]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let unit: Unit = 'day', example = true;
  let inputBirth = '2000-01-01', inputYears = 80;
  let life = calculateLife(inputBirth, inputYears);
  let selected = life.elapsedDays, animation = 0;
  let mainGrid: Grid | null = null, fullGrid: Grid | null = null;
  let terrain: LifeStoneTerrain | null = null, cameraMode: 'follow' | 'all' = 'follow';
  let playback: { paused: boolean; pauseStarted: number; pausedMs: number; frameTime: number } | null = null;
  const num = (n: number) => n.toLocaleString('en-US');
  const count = () => totalCells(life, unit);
  const complete = () => completedCells(life, unit);
  const todayCell = () => Math.min(complete(), count() - 1);
  const motionEnabled = () => !reducedMotion.matches && document.documentElement.dataset.motion !== 'off';
  let palette: Palette;
  function readPalette() {
    const next = {
      text: getComputedStyle(get('[data-life-detail]')).color,
      muted: getComputedStyle(get('.l-map-help')).color,
      future: getComputedStyle(get('[data-paint="future"]')).color,
      today: getComputedStyle(get('[data-paint="current"]')).color,
      trail: getComputedStyle(get('[data-paint="past"]')).color,
    };
    if (JSON.stringify(next) !== JSON.stringify(palette)) terrain = null;
    palette = next;
  }
  function prepare(target: HTMLCanvasElement, parent: HTMLElement) {
    const width = parent.clientWidth, height = parent.clientHeight;
    const ctx = target.getContext('2d');
    if (!width || !height || !ctx) return null;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (target.width !== Math.ceil(width * ratio) || target.height !== Math.ceil(height * ratio)) { target.width = Math.ceil(width * ratio); target.height = Math.ceil(height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }
  function overviewRect(width: number, height: number, full = false): Rect {
    const inset = width < 500 ? 60 : 75;
    const gridWidth = full ? width - inset - 10 : Math.min(width - inset - 10, (height - 40) * .77);
    return { x: inset + (width - inset - 10 - gridWidth) / 2, y: 16, width: Math.max(1, gridWidth), height: height - 36 };
  }
  function drawOverview() {
    const prepared = prepare(canvas, plot);
    if (!prepared) return;
    const { ctx, width, height } = prepared;
    mainGrid = paintLifeGrid(ctx, life, unit, overviewRect(width, height), palette, { selected, monochrome: true });
    const p = cellPosition(mainGrid, todayCell());
    const label = get('[data-life-now-label]');
    label.hidden = life.remainingDays === 0;
    label.style.left = `${Math.max(0, Math.min(width - 46, p.x + 8))}px`;
    label.style.top = `${Math.max(0, p.y - 11)}px`;
  }
  function drawFullscreen() {
    if (!fullscreen.open) return;
    const prepared = prepare(fullCanvas, fullPlot);
    if (!prepared) return;
    fullGrid = paintLifeGrid(prepared.ctx, life, unit, overviewRect(prepared.width, prepared.height, true), palette, { selected, monochrome: true });
  }
  function updateStages(day: number) {
    const stage = stageAtDay(life, day);
    root.dataset.currentStage = stage.id;
    for (const segment of stageSegments(life, unit)) {
      const item = get(`[data-life-stage="${segment.id}"]`);
      item.dataset.state = segment.id === stage.id ? 'current' : segment.endDay <= day ? 'past' : 'future';
    }
    root.querySelectorAll<HTMLElement>('[data-life-stage]').forEach(item => { item.hidden = !stageSegments(life, unit).some(s => s.id === item.dataset.lifeStage); });
  }
  function showCell(index: number, redraw = true) {
    if (!Number.isFinite(index)) return;
    selected = Math.max(0, Math.min(count() - 1, Math.floor(index)));
    const cell = cellDetails(life, unit, selected);
    const status = { past: '已走过', current: unit === 'day' ? '今天' : '本周进行中', future: '尚未展开' }[cell.status];
    const text = `第 ${num(selected + 1)} 格 · ${cell.start}${cell.start === cell.end ? '' : ` 至 ${cell.end}`} · ${status}${unit === 'week' && cell.days < 7 ? `（末格 ${cell.days} 天）` : ''}`;
    get('[data-life-detail]').textContent = text; get('[data-life-fullscreen-detail]').textContent = text;
    query.value = fullQuery.value = String(selected + 1);
    if (redraw && root.dataset.phase === 'overview') { drawOverview(); drawFullscreen(); }
  }
  function finish() {
    cancelAnimationFrame(animation); animation = 0;
    root.dataset.animating = 'false'; root.dataset.phase = 'overview';
    get('[data-life-skip]').hidden = true; get('[data-life-future]').hidden = false;
    playback = null; get('[data-life-pause]').hidden = true; get('[data-life-pause]').textContent = '暂停';
    walker.querySelectorAll('.is-walking').forEach(el => el.classList.remove('is-walking'));
    walker.style.opacity = '1';
    updateStages(life.todayDay);
    get('[data-life-story-title]').textContent = life.remainingDays ? '这一格，是今天。' : '走到这里，故事还在继续。';
    get('[data-life-story-copy]').textContent = `你已经走过 ${num(life.elapsedDays)} 天。每一段路，都留在这里。`;
    drawOverview(); drawFullscreen();
  }
  function play() {
    finish();
    if (!motionEnabled() || !life.elapsedDays) return;
    root.dataset.phase = 'journey'; root.dataset.animating = 'true';
    get('[data-life-skip]').hidden = false; get('[data-life-future]').hidden = true;
    get('[data-life-pause]').hidden = false;
    const player = playback = { paused: false, pauseStarted: 0, pausedMs: 0, frameTime: 0 };
    terrain ??= new LifeStoneTerrain(life, unit, palette);
    type Clip = { from: number; to: number; duration: number; kind: 'intro' | 'walk' | 'fly' };
    const clips: Clip[] = [{ from: 0, to: 0, duration: 850, kind: 'intro' }];
    const stops = [...new Set([...stageSegments(life, unit).filter(s => s.firstCell <= todayCell()).map(s => s.firstCell), todayCell()])];
    let cursor = 0;
    for (const stop of stops) {
      if (cursor >= todayCell()) break;
      const landing = Math.max(cursor, stop === todayCell() ? stop - 4 : stop);
      if (landing > cursor) clips.push({ from: cursor, to: landing, duration: 650, kind: 'fly' });
      const target = Math.min(todayCell(), stop === todayCell() ? stop : landing + 4);
      if (target > landing) clips.push({ from: landing, to: target, duration: Math.max(400, (target - landing) * 210), kind: 'walk' });
      cursor = target;
    }
    const walkDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    const holdDuration = 450, turnDuration = 1400;
    let started: number | null = null, lastPaint = -100, lastStage = '';
    const smooth = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x * x * (3 - 2 * x); };
    const frame = (time: number) => {
      if (!motionEnabled()) { finish(); return; }
      if (time - lastPaint < 30) { animation = requestAnimationFrame(frame); return; }
      lastPaint = time;
      if (!player.paused) player.frameTime = time;
      started ??= time;
      const elapsed = Math.max(0, (player.paused ? player.pauseStarted : time) - started - player.pausedMs);
      let localTime = Math.min(elapsed, walkDuration), clip = clips.at(-1)!;
      for (const candidate of clips) { clip = candidate; if (localTime <= candidate.duration) break; localTime -= candidate.duration; }
      const within = Math.min(1, localTime / clip.duration);
      const index = elapsed >= walkDuration ? todayCell() : clip.from + (clip.to - clip.from) * (clip.kind === 'fly' ? smooth((within - .2) / .6) : within);
      const zoom = clip.kind === 'intro' ? smooth(within) : clip.kind === 'fly' ? within < .2 ? 1 - smooth(within / .2) : within > .8 ? smooth((within - .8) / .2) : 0 : 1;
      const day = journeyDay(life, unit, index);
      const days = index >= todayCell() ? life.elapsedDays : index * (unit === 'day' ? 1 : 7);
      const segment = stageAtDay(life, day);
      const turn = Math.max(0, Math.min(1, (elapsed - walkDuration - holdDuration) / turnDuration));
      const morph = turn * turn * (3 - 2 * turn);
      root.dataset.phase = turn > 0 ? 'turn' : 'journey';
      const prepared = prepare(canvas, plot);
      if (prepared) {
        const { ctx, width, height } = prepared;
        ctx.globalAlpha = 1 - morph;
        terrain ??= new LifeStoneTerrain(life, unit, palette);
        const foot = terrain.render(ctx, width, height, index, cameraMode === 'all' ? 0 : zoom * (1 - morph), palette);
        ctx.globalAlpha = 1;
        if (morph > 0) {
          ctx.save(); ctx.globalAlpha = morph; ctx.translate(0, height * .32 * (1 - morph)); ctx.scale(1, .48 + .52 * morph);
          paintLifeGrid(ctx, life, unit, overviewRect(width, height), palette, { fillDays: days, markers: turn === 1 }); ctx.restore();
        }
        const spriteHeight = foot.spriteHeight;
        walker.style.width = walker.style.height = `${spriteHeight}px`;
        walker.style.left = `${foot.x}px`;
        walker.style.top = `${foot.y - spriteHeight * .968 - foot.lift}px`; walker.style.opacity = String(1 - turn);
        walker.querySelectorAll<HTMLElement>('[data-character]').forEach(character => {
          const active = character.dataset.character === segment.id;
          character.classList.toggle('is-active', active); character.classList.toggle('is-walking', active && clip.kind === 'walk' && elapsed < walkDuration);
          if (active) { character.style.setProperty('--sprite-y', `${(clip.kind === 'walk' ? foot.frame : 1) * 100 / 3}%`); character.style.transform = `scaleX(${foot.direction})`; }
        });
        const dateLabel = get('[data-life-walker-label]');
        dateLabel.textContent = `${clip.kind === 'fly' ? '时光快进 · ' : ''}${formatDay(day)}`;
        const halfLabel = dateLabel.offsetWidth / 2;
        const labelX = Math.max(halfLabel + 4, Math.min(width - halfLabel - 4, foot.x));
        dateLabel.style.left = `${spriteHeight / 2 + labelX - foot.x}px`;
      }
      if (lastStage !== segment.id) {
        lastStage = segment.id; updateStages(day);
        get('[data-life-story-title]').textContent = `${segment.name}时的你`;
        get('[data-life-story-copy]').textContent = segment.copy;
      }
      if (turn > 0) { get('[data-life-story-title]').textContent = '原来，一生可以这样看见。'; get('[data-life-story-copy]').textContent = '走过的时间有了形状，未来也在眼前。'; }
      if (elapsed >= walkDuration + holdDuration + turnDuration) finish();
      else animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
    get('[data-life-result]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function render(animate = false) {
    terrain = null;
    const label = unit === 'day' ? '天' : '周', percent = life.elapsedDays / life.totalDays * 100;
    root.dataset.unit = unit; root.dataset.example = String(example);
    get('[data-life-result]').hidden = false;
    get('[data-life-total]').textContent = num(count()); get('[data-life-elapsed]').textContent = num(complete()); get('[data-life-remaining]').textContent = num(count() - complete());
    root.querySelectorAll('[data-life-unit-label]').forEach(el => el.textContent = label);
    get('[data-life-percent]').textContent = `${(life.remainingDays ? Math.min(99.9, percent) : 100).toFixed(1)}%`;
    get('[data-life-progress]').setAttribute('aria-valuenow', percent.toFixed(4)); get('[data-life-progress] > span').style.width = `${percent}%`;
    get('[data-life-context]').textContent = `${example ? '示例人生' : '你的人生'} · ${inputBirth} 出生，设定 ${inputYears} 岁`;
    get('[data-life-day-summary]').textContent = unit === 'week' ? `已走过 ${num(life.elapsedDays)} 天，进度按日计算` : '';
    get('[data-life-map-title]').textContent = `每一格，都是一${unit === 'day' ? '天' : '周'}。`;
    get('[data-life-current-label]').textContent = unit === 'day' ? '今天' : '当前周';
    get('[data-life-start]').textContent = `${inputBirth} · 出生`; get('[data-life-end]').textContent = `${formatDay(life.endDay)} · 设定终点`;
    get('[data-life-count-note]').textContent = unit === 'day' ? '一格一天，包含闰日。已走过不含今天，尚有包含今天。阶段分段用于展示，不定义人生。' : '从出生起每七天一格，末格可不足七天。已走过仅计完整格子，当前周归入尚有；跨阶段周按开始日期分组。进度按日计算。';
    get('[data-life-message]').textContent = life.remainingDays ? '这一格，是今天。' : '你已走过设定的时间，可以调整预计寿命，继续看未来。';
    get('[data-life-fullscreen-summary]').textContent = `一格一${unit === 'day' ? '天' : '周'} · 共 ${num(count())} 格 · 已走过 ${num(complete())} 格 · 今天 ${localToday()}`;
    for (const input of [query, fullQuery]) input.max = String(count());
    root.querySelectorAll<HTMLButtonElement>('[data-life-unit],[data-life-fs-unit]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.lifeUnit || button.dataset.lifeFsUnit) === unit)));
    for (const target of [canvas, fullCanvas]) target.setAttribute('aria-label', `${example ? '示例' : '你的'}完整人生格子图，一格一${unit === 'day' ? '天' : '周'}，共 ${num(count())} 格，已走过 ${num(complete())} 格。方向键查询日期。`);
    readPalette(); selected = todayCell(); showCell(selected, false);
    finish(); if (animate) play();
    root.dispatchEvent(new Event('lifechange'));
  }
  function changeUnit(value: string | undefined) { unit = value === 'week' ? 'week' : 'day'; render(); }
  birth.max = localToday();
  get<HTMLFormElement>('[data-life-form]').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const next = calculateLife(birth.value, lifespan.valueAsNumber);
      life = next; inputBirth = birth.value; inputYears = lifespan.valueAsNumber; example = false;
      get('[data-life-error]').hidden = true; render(true);
    } catch (reason) { get('[data-life-error]').textContent = reason instanceof Error ? reason.message : '请检查日期和预计寿命。'; get('[data-life-error]').hidden = false; }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-life-unit]').forEach(button => button.addEventListener('click', () => changeUnit(button.dataset.lifeUnit)));
  root.querySelectorAll<HTMLButtonElement>('[data-life-fs-unit]').forEach(button => button.addEventListener('click', () => changeUnit(button.dataset.lifeFsUnit)));
  get('[data-life-skip]').addEventListener('click', finish); get('[data-life-replay]').addEventListener('click', play);
  get('[data-life-pause]').addEventListener('click', () => {
    if (!playback) return;
    playback.paused = !playback.paused;
    if (playback.paused) playback.pauseStarted = playback.frameTime || performance.now();
    else playback.pausedMs += performance.now() - playback.pauseStarted;
    get('[data-life-pause]').textContent = playback.paused ? '继续' : '暂停';
  });
  root.querySelectorAll<HTMLButtonElement>('[data-life-camera]').forEach(button => button.addEventListener('click', () => {
    cameraMode = button.dataset.lifeCamera === 'all' ? 'all' : 'follow';
    root.querySelectorAll<HTMLButtonElement>('[data-life-camera]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  get('[data-life-fullscreen-open]').addEventListener('click', () => { finish(); fullscreen.showModal(); requestAnimationFrame(drawFullscreen); });
  get('[data-life-fullscreen-close]').addEventListener('click', () => fullscreen.close());
  fullscreen.addEventListener('close', () => get<HTMLButtonElement>('[data-life-fullscreen-open]').focus({ preventScroll: true }));
  for (const [selector, input] of [['[data-life-query-form]', query], ['[data-life-fullscreen-query-form]', fullQuery]] as const) get<HTMLFormElement>(selector).addEventListener('submit', event => { event.preventDefault(); finish(); showCell(input.valueAsNumber - 1); });
  for (const selector of ['[data-life-today]', '[data-life-fullscreen-today]']) get(selector).addEventListener('click', () => { finish(); showCell(todayCell()); });
  for (const [target, grid] of [[canvas, () => mainGrid], [fullCanvas, () => fullGrid]] as const) {
    target.addEventListener('keydown', event => {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -(grid()?.columns || 1), ArrowDown: grid()?.columns || 1, Home: -count(), End: count() };
      if (!(event.key in offsets)) return;
      event.preventDefault(); finish(); showCell(selected + offsets[event.key]);
    });
    const point = (event: MouseEvent) => {
      if (root.dataset.phase !== 'overview') return;
      const layout = grid(); if (!layout) return;
      const box = target.getBoundingClientRect(), x = event.clientX - box.left - layout.x, y = event.clientY - box.top - layout.y;
      const column = Math.floor(x / layout.pitch), row = Math.floor(y / layout.pitch), index = row * layout.columns + column;
      if (x >= 0 && y >= 0 && column < layout.columns && row < layout.rows && index < count() && selected !== index) showCell(index);
    };
    target.addEventListener('click', point);
    target.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') point(event); });
  }
  new ResizeObserver(() => { if (root.dataset.phase === 'overview') drawOverview(); drawFullscreen(); }).observe(plot);
  new ResizeObserver(drawFullscreen).observe(fullPlot);
  new MutationObserver(() => { readPalette(); if (!motionEnabled()) finish(); else if (root.dataset.phase === 'overview') { drawOverview(); drawFullscreen(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-scene', 'data-motion', 'style'] });
  reducedMotion.addEventListener('change', () => { if (!motionEnabled()) finish(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readPalette(); if (root.dataset.phase === 'overview') { drawOverview(); drawFullscreen(); } });
  function refreshDate() { const today = localToday(); birth.max = today; if (formatDay(life.todayDay) !== today) { life = calculateLife(inputBirth, inputYears, today); render(); } }
  window.setInterval(refreshDate, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
  document.addEventListener('universe:language', () => { if (root.dataset.phase === 'overview') drawOverview(); drawFullscreen(); });
  if (canvas.getContext('2d')) {
    setupLifeShare(root, () => ({ life, unit, birth: inputBirth, years: inputYears, example }));
    get<HTMLButtonElement>('.l-submit').disabled = false; render(); root.dataset.ready = 'true';
  } else { get('[data-life-error]').textContent = '当前浏览器无法绘制格子图，请使用支持 Canvas 的浏览器。'; get('[data-life-error]').hidden = false; }
}
