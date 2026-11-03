import { calculateLife, cellDetails, formatDay, localToday } from '../lib/life-grid.mjs';
import { totalCells, completedCells, type Unit } from '../lib/life-painter';
import { printLayout, printHit, replayScenes, replayFrame } from '../lib/life-replay.mjs';
import { LifeLightMap, LIGHT_COLORS, type LightGrid } from '../lib/life-light-map';
import { setupReplayShare } from './life-replay-share';

const element = document.querySelector<HTMLElement>('[data-life-replay-page]');
if (element) {
  const root = element;
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const birth = get<HTMLInputElement>('[name="birth"]'), lifespan = get<HTMLInputElement>('[name="lifespan"]');
  const plot = get('[data-life-viewport]'), canvas = get<HTMLCanvasElement>('[data-life-canvas]');
  const fullscreen = get<HTMLDialogElement>('[data-life-fullscreen]');
  const fullPlot = get('[data-life-fullscreen-plot]'), fullCanvas = get<HTMLCanvasElement>('[data-life-fullscreen-canvas]');
  const query = get<HTMLInputElement>('[data-life-query]'), fullQuery = get<HTMLInputElement>('[data-life-fullscreen-query]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let unit: Unit = 'day', example = true, firstSubmitted = false;
  let inputBirth = '2000-01-01', inputYears = 80, life = calculateLife(inputBirth, inputYears);
  let selected = life.elapsedDays, animation = 0, shownDays = life.elapsedDays, activeScene = 0;
  let scenes = replayScenes(life);
  let mainGrid: LightGrid | null = null, fullGrid: LightGrid | null = null;
  let mainMap: LifeLightMap | null = null, fullMap: LifeLightMap | null = null;
  let playback: { paused: boolean; pauseStarted: number; pausedMs: number; frameTime: number } | null = null;
  const num = (n: number) => n.toLocaleString('en-US');
  const count = () => totalCells(life, unit), complete = () => completedCells(life, unit);
  const todayCell = () => Math.min(complete(), count() - 1);
  const motionEnabled = () => !reducedMotion.matches && document.documentElement.dataset.motion !== 'off';
  function prepare(target: HTMLCanvasElement, parent: HTMLElement) {
    const width = parent.clientWidth, height = parent.clientHeight, ctx = target.getContext('2d');
    if (!width || !height || !ctx) return null;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (target.width !== Math.ceil(width * ratio) || target.height !== Math.ceil(height * ratio)) { target.width = Math.ceil(width * ratio); target.height = Math.ceil(height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.fillStyle = LIGHT_COLORS.background; ctx.fillRect(0, 0, width, height);
    return { ctx, width, height };
  }
  function draw(full = false) {
    if (full && !fullscreen.open) return;
    const prepared = prepare(full ? fullCanvas : canvas, full ? fullPlot : plot); if (!prepared) return;
    const { ctx, width, height } = prepared;
    const rect = { x: width < 500 ? 28 : 42, y: 10, width: Math.max(1, width - (width < 500 ? 36 : 54)), height: Math.max(1, height - 22) };
    let map = full ? fullMap : mainMap;
    if (!map || map.life !== life || map.unit !== unit || map.width !== rect.width || map.height !== rect.height) map = new LifeLightMap(life, unit, rect.width, rect.height);
    const layout = map.paint(ctx, rect, full ? life.elapsedDays : shownDays, { selected: full || activeScene === scenes.length - 1 && !playback ? selected : undefined, glowing: !full && !!playback && !playback.paused, today: full || !playback && activeScene === scenes.length - 1 });
    if (full) { fullMap = map; fullGrid = layout; } else { mainMap = map; mainGrid = layout; }
  }
  function story(scene: number, days: number, ended = false) {
    activeScene = scene; shownDays = days; root.dataset.sceneIndex = String(scene); root.dataset.shownDays = String(days);
    const yearGrid = printLayout(life, 'day', 1, 1), age = yearGrid.rowOfCell[Math.min(days, life.totalDays - 1)];
    get('[data-replay-age]').textContent = `${age} 岁 · ${formatDay(Math.min(life.birthDay + days, life.endDay - 1))}`;
    get('[data-replay-counter]').textContent = `${num(days)} 个日夜，已经写进人生。`;
    get('[data-life-story-title]').textContent = scenes[scene].title;
    get('[data-life-story-copy]').textContent = ended ? '刚刚这几秒，是你已经走过的人生。' : scenes[scene].copy;
    get('[data-replay-scene]').textContent = `场景 ${scene + 1} / ${scenes.length}`;
    get<HTMLButtonElement>('[data-replay-prev]').disabled = scene === 0;
    get<HTMLButtonElement>('[data-replay-next]').disabled = scene === scenes.length - 1;
  }
  function stop() {
    cancelAnimationFrame(animation); animation = 0; playback = null;
    root.dataset.animating = 'false'; root.dataset.phase = 'overview';
    get('[data-life-skip]').hidden = true; get('[data-life-pause]').hidden = true; get('[data-life-pause]').textContent = '暂停';
    get('[data-life-future]').hidden = false;
  }
  function finish(ended = false) { stop(); story(scenes.length - 1, life.elapsedDays, ended); draw(); draw(true); }
  function showScene(scene: number) { stop(); const index = Math.max(0, Math.min(scenes.length - 1, scene)); story(index, scenes[index].days); draw(); }
  function showCell(index: number, redraw = true) {
    if (!Number.isFinite(index)) return;
    selected = Math.max(0, Math.min(count() - 1, Math.floor(index)));
    const cell = cellDetails(life, unit, selected);
    const status = { past: '已走过', current: unit === 'day' ? '今天' : '本周进行中', future: '尚未展开' }[cell.status];
    const text = `第 ${num(selected + 1)} 格 · ${cell.start}${cell.start === cell.end ? '' : ` 至 ${cell.end}`} · ${status}${unit === 'week' && cell.days < 7 ? `（末格 ${cell.days} 天）` : ''}`;
    get('[data-life-detail]').textContent = text; get('[data-life-fullscreen-detail]').textContent = text;
    query.value = fullQuery.value = String(selected + 1);
    if (redraw && !playback) { draw(); draw(true); }
  }
  function play() {
    finish();
    if (!motionEnabled() || !life.elapsedDays) return;
    root.dataset.phase = 'journey'; root.dataset.animating = 'true';
    get('[data-life-skip]').hidden = false; get('[data-life-pause]').hidden = false; get('[data-life-future]').hidden = true;
    const player = playback = { paused: false, pauseStarted: 0, pausedMs: 0, frameTime: 0 };
    let started: number | null = null, lastPaint = -100;
    story(0, 0); draw();
    const frame = (time: number) => {
      if (!motionEnabled()) { finish(); return; }
      if (time - lastPaint < 30) { animation = requestAnimationFrame(frame); return; }
      lastPaint = time; started ??= time;
      if (!player.paused) player.frameTime = time;
      const elapsed = Math.max(0, (player.paused ? player.pauseStarted : time) - started - player.pausedMs);
      const state = replayFrame(scenes, elapsed); story(state.scene, state.days); draw();
      if (state.done) finish(true); else animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
    get('[data-life-result]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function render(animate = false) {
    mainMap = fullMap = null; scenes = replayScenes(life); root.dataset.sceneCount = String(scenes.length);
    const percent = life.elapsedDays / life.totalDays * 100;
    root.dataset.unit = unit; root.dataset.example = String(example); get('[data-life-result]').hidden = false;
    get('[data-life-total]').textContent = num(count()); get('[data-life-elapsed]').textContent = num(life.elapsedDays); get('[data-life-remaining]').textContent = num(life.remainingDays);
    get('[data-life-total-unit]').textContent = unit === 'day' ? '天' : '周';
    get('[data-life-percent]').textContent = `${(life.remainingDays ? Math.min(99.9, percent) : 100).toFixed(1)}%`;
    get('[data-life-progress]').setAttribute('aria-valuenow', percent.toFixed(4)); get('[data-life-progress] > span').style.width = `${percent}%`;
    get('[data-life-context]').textContent = `${example ? '示例人生' : '你的人生'} · 设定 ${inputYears} 岁`;
    get('[data-life-day-summary]').textContent = unit === 'week' ? `已走过 ${num(complete())} 周 · 按设定尚有 ${num(count() - complete())} 周` : '每一个日夜，都不可重复。';
    get('[data-life-map-title]').textContent = `一格一${unit === 'day' ? '天' : '周'} · 按日期顺序排列`;
    get('[data-life-current-label]').textContent = unit === 'day' ? '今天' : '当前周';
    get('[data-life-count-note]').textContent = unit === 'day' ? '一格一天，连续排列，包含闰日。已走过不含今天，尚有包含今天。左侧年龄刻度按真实生日定位。' : '从出生起每七天一格，连续排列；末格可不足七天。年龄刻度按真实生日定位，进度按日计算。';
    get('[data-life-message]').textContent = life.remainingDays ? `你的人生已经写下 ${num(life.elapsedDays)} 天的故事。` : '你已走过设定的时间，可以调整预计寿命，继续看未来。';
    get('[data-life-fullscreen-summary]').textContent = `一格一${unit === 'day' ? '天' : '周'} · 共 ${num(count())} 格 · 已走过 ${num(complete())} 格 · 今天 ${localToday()}`;
    for (const input of [query, fullQuery]) input.max = String(count());
    root.querySelectorAll<HTMLButtonElement>('[data-life-unit],[data-life-fs-unit]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.lifeUnit || button.dataset.lifeFsUnit) === unit)));
    for (const target of [canvas, fullCanvas]) target.setAttribute('aria-label', `${example ? '示例' : '你的'}完整人生格子图，一格一${unit === 'day' ? '天' : '周'}，共 ${num(count())} 格，已走过 ${num(complete())} 格。方向键查询日期。`);
    selected = todayCell(); showCell(selected, false); finish(); if (animate) play(); root.dispatchEvent(new Event('lifechange'));
  }
  function changeUnit(value: string | undefined) { unit = value === 'week' ? 'week' : 'day'; render(); }
  birth.max = localToday();
  get<HTMLFormElement>('[data-life-form]').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const next = calculateLife(birth.value, lifespan.valueAsNumber), animate = !firstSubmitted;
      life = next; inputBirth = birth.value; inputYears = lifespan.valueAsNumber; example = false; firstSubmitted = true;
      get('[data-life-error]').hidden = true; render(animate);
    } catch (reason) { get('[data-life-error]').textContent = reason instanceof Error ? reason.message : '请检查日期和预计寿命。'; get('[data-life-error]').hidden = false; }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-life-unit]').forEach(button => button.addEventListener('click', () => changeUnit(button.dataset.lifeUnit)));
  root.querySelectorAll<HTMLButtonElement>('[data-life-fs-unit]').forEach(button => button.addEventListener('click', () => changeUnit(button.dataset.lifeFsUnit)));
  get('[data-life-skip]').addEventListener('click', () => finish()); get('[data-life-replay]').addEventListener('click', play);
  get('[data-replay-prev]').addEventListener('click', () => showScene(activeScene - 1)); get('[data-replay-next]').addEventListener('click', () => showScene(activeScene + 1));
  get('[data-life-pause]').addEventListener('click', () => {
    if (!playback) return;
    playback.paused = !playback.paused;
    if (playback.paused) playback.pauseStarted = playback.frameTime || performance.now();
    else playback.pausedMs += performance.now() - playback.pauseStarted;
    get('[data-life-pause]').textContent = playback.paused ? '继续' : '暂停';
  });
  get('[data-life-fullscreen-open]').addEventListener('click', () => { finish(); fullscreen.showModal(); requestAnimationFrame(() => draw(true)); });
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
      if (playback || activeScene !== scenes.length - 1) return;
      const layout = grid(); if (!layout) return;
      const box = target.getBoundingClientRect(), index = printHit(layout, event.clientX - box.left, event.clientY - box.top);
      if (index >= 0 && selected !== index) showCell(index);
    };
    target.addEventListener('click', point); target.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') point(event); });
  }
  new ResizeObserver(() => { draw(); draw(true); }).observe(plot); new ResizeObserver(() => draw(true)).observe(fullPlot);
  new MutationObserver(() => { if (playback && !motionEnabled()) finish(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  reducedMotion.addEventListener('change', () => { if (!motionEnabled()) finish(); });
  function refreshDate() { const today = localToday(); birth.max = today; if (formatDay(life.todayDay) !== today) { life = calculateLife(inputBirth, inputYears, today); render(); } }
  window.setInterval(refreshDate, 60_000); document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
  if (canvas.getContext('2d')) {
    setupReplayShare(root, () => ({ life, unit, birth: inputBirth, years: inputYears, example }));
    get<HTMLButtonElement>('[data-life-submit]').disabled = false; render(); root.dataset.ready = 'true';
  } else { get('[data-life-error]').textContent = '当前浏览器无法绘制格子图，请使用支持 Canvas 的浏览器。'; get('[data-life-error]').hidden = false; }
}
