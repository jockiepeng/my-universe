import { createSnake, queueDirection, stepSnake } from '../lib/snake.mjs';
import { readNumber, writeNumber } from '../lib/arcade-storage';
import { bindAction } from '../lib/arcade-input';

type Direction = 'up' | 'down' | 'left' | 'right';
type Phase = 'ready' | 'playing' | 'paused' | 'over' | 'won';
type Speed = 'easy' | 'normal' | 'fast';
const intervals: Record<Speed, number> = { easy: 160, normal: 120, fast: 85 };
const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

function initSnake(root: HTMLElement) {
  if (root.dataset.ready === 'true') return;
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const board = find<HTMLDivElement>('[data-snake-board]');
  const canvas = find<HTMLCanvasElement>('[data-snake-canvas]');
  const context = canvas.getContext('2d');
  const start = find<HTMLButtonElement>('[data-snake-start]');
  const pause = find<HTMLButtonElement>('[data-snake-pause]');
  const reset = find<HTMLButtonElement>('[data-snake-new]');
  const speedSelect = find<HTMLSelectElement>('[data-snake-speed]');
  const directionButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-snake-direction]')];
  const overlay = find<HTMLDivElement>('[data-snake-overlay]');
  const save = find<HTMLParagraphElement>('[data-snake-save]');
  if (!context) {
    find('[data-snake-status]').textContent = '当前浏览器无法绘制游戏画面，请使用支持 Canvas 的浏览器。';
    return;
  }
  const ctx = context;
  let speed: Speed = 'normal';
  let state = createSnake();
  let phase: Phase = 'ready';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline = 0;
  let remaining = intervals[speed];
  let best = 0;
  let pauseReason = '';
  const bestBySpeed = new Map<Speed, number>();
  const storageKey = () => `my-universe:snake:best:${speed}:v1`;
  const setText = (selector: string, value: string | number) => {
    const element = find(selector);
    if (element.textContent !== String(value)) element.textContent = String(value);
  };

  function storeBest() {
    bestBySpeed.set(speed, best);
    if (!writeNumber(storageKey(), best)) {
      save.textContent = '浏览器暂时无法保存记录，本次页面内仍会保留各档最高分。游戏可正常继续。';
    }
  }

  function loadBest() {
    best = bestBySpeed.get(speed) ?? readNumber(storageKey());
    storeBest();
  }

  function star(x: number, y: number, radius: number) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 ? radius * .43 : radius;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    const side = 600;
    const cell = side / state.size;
    ctx.setTransform(canvas.width / side, 0, 0, canvas.height / side, 0, 0);
    ctx.clearRect(0, 0, side, side);
    ctx.fillStyle = '#081b2d';
    ctx.fillRect(0, 0, side, side);
    const glow = ctx.createRadialGradient(320, 260, 10, 300, 300, 430);
    glow.addColorStop(0, '#173a51');
    glow.addColorStop(1, '#0a1e30');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, side, side);
    ctx.strokeStyle = '#6a91aa16';
    ctx.lineWidth = .8;
    ctx.beginPath();
    for (let i = 1; i < state.size; i++) {
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, side);
      ctx.moveTo(0, i * cell); ctx.lineTo(side, i * cell);
    }
    ctx.stroke();
    // Fixed stars keep the board calm, including under reduced motion settings.
    for (let i = 0; i < 38; i++) {
      ctx.fillStyle = i % 3 ? '#b7d2e645' : '#d8eaff80';
      ctx.beginPath();
      ctx.arc((i * 137 + 21) % 590 + 5, (i * 197 + 71) % 580 + 10, i % 3 ? .9 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.food) {
      ctx.save();
      ctx.fillStyle = '#efcc8a';
      ctx.shadowColor = '#efcc8a';
      ctx.shadowBlur = 17;
      star((state.food.x + .5) * cell, (state.food.y + .5) * cell, cell * .34);
      ctx.restore();
    }
    state.snake.forEach((part: { x: number; y: number }, index: number) => {
      ctx.fillStyle = index === 0 ? (phase === 'over' ? '#ed9685' : '#b6f0da') : `rgba(112, 205, 175, ${Math.max(.4, .91 - index * .012)})`;
      ctx.beginPath();
      ctx.roundRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4, index === 0 ? 8 : 6);
      ctx.fill();
    });
    const head = state.snake[0];
    const hx = (head.x + .5) * cell;
    const hy = (head.y + .5) * cell;
    const vertical = state.direction === 'up' || state.direction === 'down';
    const sign = state.direction === 'up' || state.direction === 'left' ? -1 : 1;
    ctx.fillStyle = '#103c3a';
    for (const offset of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + (vertical ? offset * 5 : sign * 5), hy + (vertical ? sign * 5 : offset * 5), 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render() {
    root.dataset.status = phase;
    setText('[data-snake-score]', state.score);
    setText('[data-snake-best]', best);
    setText('[data-snake-length]', state.snake.length);
    start.disabled = phase === 'playing' || phase === 'paused';
    start.textContent = phase === 'over' || phase === 'won' ? '再来一局' : '开始飞行';
    pause.disabled = phase !== 'playing' && phase !== 'paused';
    pause.textContent = phase === 'paused' ? '继续' : '暂停';
    reset.disabled = false;
    speedSelect.disabled = false;
    directionButtons.forEach(button => { button.disabled = phase !== 'playing'; });
    overlay.hidden = phase === 'playing';
    const messages = {
      ready: ['20 × 20 星域', '下一颗星星，在前方', '点击「开始飞行」，沿着星轨出发。', '准备就绪。选择速度，开始你的星际漫游。'],
      playing: ['', '', '', '正在飞行。寻找金色星星，避开边界和自己的航迹。'],
      paused: ['已暂停', '星轨已为你停留', '点击「继续」或按空格，接着这段旅程。', pauseReason || '已暂停，点击「继续」或按空格返回飞行。'],
      over: ['本局成绩', '这次飞行，到这里', `收集了 ${state.score / 10} 颗星星，获得 ${state.score} 分。下一次，试试另一条路线。`, `飞行结束，获得 ${state.score} 分。点击「再来一局」重新出发。`],
      won: ['星域完成', '整片星空，都是你的', `你已填满 400 格星轨，获得 ${state.score} 分。`, `恭喜！你吃满了星空，获得 ${state.score} 分。`],
    }[phase];
    setText('[data-snake-eyebrow]', messages[0]);
    setText('[data-snake-overlay-title]', messages[1]);
    setText('[data-snake-overlay-copy]', messages[2]);
    setText('[data-snake-status]', messages[3]);
    canvas.setAttribute('aria-label', `20 行 20 列棋盘，飞船头在第 ${headRow()} 行、第 ${state.snake[0].x + 1} 列，长度 ${state.snake.length}，得分 ${state.score}。`);
    draw();
  }

  const headRow = () => state.snake[0].y + 1;
  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    clearTimer();
    deadline = performance.now() + remaining;
    timer = setTimeout(tick, remaining);
  }

  function tick() {
    timer = undefined;
    if (phase !== 'playing') return;
    if (document.hidden) { pauseGame('页面已离开，飞行自动暂停。点击「继续」再出发。'); return; }
    state = stepSnake(state);
    if (state.score > best) { best = state.score; storeBest(); }
    if (state.status === 'lost') phase = 'over';
    if (state.status === 'won') phase = 'won';
    remaining = intervals[speed];
    render();
    if (phase === 'playing') schedule();
  }

  function newRound() {
    clearTimer();
    state = createSnake();
    phase = 'ready';
    pauseReason = '';
    remaining = intervals[speed];
    render();
  }

  function startGame() {
    if (phase === 'playing' || phase === 'paused' || document.hidden) return;
    if (phase === 'over' || phase === 'won') newRound();
    phase = 'playing';
    render();
    board.focus({ preventScroll: true });
    schedule();
  }

  function pauseGame(reason = '') {
    if (phase !== 'playing') return;
    remaining = Math.max(0, deadline - performance.now());
    clearTimer();
    phase = 'paused';
    pauseReason = reason;
    render();
  }

  function togglePause() {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused' && !document.hidden) {
      phase = 'playing';
      render();
      schedule();
    }
    board.focus({ preventScroll: true });
  }

  function turn(direction: Direction) {
    if (phase === 'playing') state = queueDirection(state, direction);
  }

  bindAction(start, startGame);
  bindAction(pause, togglePause);
  bindAction(reset, () => { newRound(); board.focus({ preventScroll: true }); });
  speedSelect.addEventListener('change', () => {
    speed = speedSelect.value as Speed;
    loadBest();
    newRound();
  });
  directionButtons.forEach(button => button.addEventListener('click', () => {
    turn(button.dataset.snakeDirection as Direction);
    board.focus({ preventScroll: true });
  }));
  // The listener lives inside the game; navigating elsewhere never captures page keys.
  root.addEventListener('keydown', event => {
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = keys[event.key] ?? keys[event.key.toLowerCase()];
    if (direction && (phase === 'playing' || event.target === board)) {
      event.preventDefault();
      turn(direction);
      return;
    }
    if (event.key === 'Escape' && phase === 'playing') {
      event.preventDefault();
      pauseGame();
    }
    if ((event.key === ' ' || event.key === 'Enter') && event.target === board && !event.repeat) {
      event.preventDefault();
      if (phase === 'ready' || phase === 'over' || phase === 'won') startGame(); else togglePause();
    }
  });

  let pointer: { id: number; x: number; y: number } | null = null;
  board.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    board.setPointerCapture(event.pointerId);
    board.focus({ preventScroll: true });
  });
  board.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 15) {
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }
  });
  board.addEventListener('pointercancel', () => { pointer = null; });
  board.addEventListener('lostpointercapture', () => { pointer = null; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame('页面已离开，飞行自动暂停。点击「继续」再出发。');
  });
  window.addEventListener('blur', () => pauseGame('窗口已切换，飞行自动暂停。点击「继续」再出发。'));
  window.addEventListener('pagehide', () => pauseGame('页面已离开，飞行自动暂停。点击「继续」再出发。'));

  function resize() {
    const width = Math.max(1, canvas.getBoundingClientRect().width);
    const pixels = Math.round(width * Math.min(window.devicePixelRatio || 1, 3));
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    draw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(board);
  window.addEventListener('resize', resize);
  loadBest();
  render();
  resize();
  root.dataset.ready = 'true';
}

document.querySelectorAll<HTMLElement>('[data-arcade="snake"]').forEach(initSnake);
