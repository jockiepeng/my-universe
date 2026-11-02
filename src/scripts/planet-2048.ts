import { STORAGE_KEY, createGame, moveGame, continueGame, boardStatus, restoreGame, planetName } from '../lib/planet-2048.mjs';
import type { Direction } from '../lib/planet-2048.mjs';

const gameRoot = document.querySelector<HTMLElement>('[data-planet-game]');
if (gameRoot) {
  const root = gameRoot;
  const board = root.querySelector<HTMLElement>('[data-planet-board]')!;
  const cells = [...root.querySelectorAll<HTMLElement>('[data-planet-cell]')];
  const template = root.querySelector<HTMLTemplateElement>('[data-planet-template]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-planet-dialog]')!;
  const keepPlaying = root.querySelector<HTMLButtonElement>('[data-planet-continue]')!;
  const message = root.querySelector<HTMLElement>('[data-planet-message]')!;
  const saveNote = root.querySelector<HTMLElement>('[data-planet-save]')!;
  let game = createGame();
  let busy = false;
  let gesture: { x: number; y: number; id: number } | null = null;

  function savingFailed() {
    saveNote.textContent = '当前浏览器无法保存进度，本页仍可正常游玩。';
    saveNote.dataset.warning = 'true';
  }
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    const restored = restoreGame(serialized);
    if (restored) game = restored;
    else if (serialized) saveNote.textContent = '旧进度无法读取，已开始新游戏。之后的进度会自动保存。';
  } catch { savingFailed(); }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); } catch { savingFailed(); } }
  function motionEnabled() { return document.documentElement.dataset.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function render(merged: number[] = [], gained = 0) {
    for (let index = 0; index < cells.length; index++) {
      const value = game.board[index], cell = cells[index];
      cell.replaceChildren(); cell.dataset.value = String(value);
      cell.toggleAttribute('data-merged', merged.includes(index));
      cell.setAttribute('aria-label', `第 ${Math.floor(index / 4) + 1} 行第 ${index % 4 + 1} 列，${value ? `${value}，${planetName(value)}` : '空'}`);
      if (!value) continue;
      const tile = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
      tile.querySelector<HTMLElement>('[data-planet-orb]')!.dataset.value = String(value);
      tile.querySelector<HTMLElement>('[data-planet-number]')!.textContent = String(value);
      tile.querySelector<HTMLElement>('[data-planet-name]')!.textContent = planetName(value);
      cell.append(tile);
    }
    root.querySelector('[data-planet-score]')!.textContent = game.score.toLocaleString('en-US');
    root.querySelector('[data-planet-best]')!.textContent = game.best.toLocaleString('en-US');
    root.querySelector('[data-planet-moves]')!.textContent = String(game.moves);
    const status = boardStatus(game.board);
    const won = status.won && !game.continued;
    root.dataset.status = won ? 'won' : status.over ? 'over' : 'playing';
    keepPlaying.hidden = !won || status.over;
    message.textContent = won ? (status.over ? '已合成 2048！棋盘没有可移动的位置了，再开一局吧。' : '合成 2048！你的第一片星系，诞生了。') : status.over ? '没有可移动的位置了。再开一局，试试新的路线。' : gained ? `合并成功，+${gained} 分。` : game.moves ? '继续探索，给下一颗星球留一点空间。' : '滑动棋盘，让相同的星球相遇。';
    root.querySelectorAll<HTMLButtonElement>('[data-planet-direction]').forEach(button => { button.disabled = won || status.over; });
    root.querySelector<HTMLElement>('[data-planet-highest]')!.textContent = planetName(status.max);
    root.querySelector<HTMLElement>('[data-planet-highest-value]')!.textContent = String(status.max);
    root.querySelector<HTMLElement>('.p-discovery [data-planet-orb]')!.dataset.value = String(status.max);
    root.querySelectorAll<HTMLElement>('[data-planet-legend]').forEach(item => item.toggleAttribute('data-discovered', Number(item.dataset.planetLegend) <= status.max));
  }

  async function move(direction: Direction) {
    if (busy || dialog.open) return;
    const result = moveGame(game, direction);
    if (!result.changed) return;
    busy = true; root.dataset.busy = 'true';
    game = result.state; save();
    try {
      if (motionEnabled()) {
        const animations = result.motions.flatMap(({ from, to }) => {
          const tile = cells[from].firstElementChild as HTMLElement | null;
          if (!tile || from === to) return [];
          const start = cells[from].getBoundingClientRect(), end = cells[to].getBoundingClientRect();
          tile.style.zIndex = '2';
          return [tile.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${end.x - start.x}px,${end.y - start.y}px)` }], { duration: 130, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {})];
        });
        await Promise.all(animations);
      }
    } finally { render(result.merged, result.gained); busy = false; root.dataset.busy = 'false'; }
  }

  const directions: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  document.addEventListener('keydown', event => {
    const direction = directions[event.key];
    if (!direction || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || dialog.open) return;
    const target = event.target;
    if (target instanceof Element && (target.closest('input,textarea,select,button,a,[contenteditable]') || (target !== document.body && !root.contains(target)))) return;
    event.preventDefault(); void move(direction);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-planet-direction]').forEach(button => button.addEventListener('click', () => {
    board.focus({ preventScroll: true }); void move(button.dataset.planetDirection as Direction);
  }));
  board.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || busy || dialog.open) return;
    gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
    board.setPointerCapture(event.pointerId); board.focus({ preventScroll: true });
  });
  board.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    void move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  board.addEventListener('pointercancel', () => { gesture = null; });
  board.addEventListener('lostpointercapture', () => { gesture = null; });
  root.querySelector<HTMLButtonElement>('[data-planet-new]')!.addEventListener('click', () => { if (!busy) dialog.showModal(); });
  root.querySelector('[data-planet-cancel]')!.addEventListener('click', () => dialog.close());
  root.querySelector('[data-planet-confirm]')!.addEventListener('click', () => {
    game = createGame(game.best); save(); render(); dialog.close(); board.focus({ preventScroll: true });
  });
  keepPlaying.addEventListener('click', () => { game = continueGame(game); save(); render(); board.focus({ preventScroll: true }); });
  render(); save();
  root.querySelector<HTMLButtonElement>('[data-planet-new]')!.disabled = false;
  root.dataset.ready = 'true';
}
