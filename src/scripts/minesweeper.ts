import { createMines, revealCell, toggleFlag } from '../lib/minesweeper.mjs';
import { readNumber, writeNumber } from '../lib/arcade-storage';

const root = document.querySelector<HTMLElement>('[data-arcade="minesweeper"]');
if (root && root.dataset.ready !== 'true') {
  const query = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-mines-${name}]`)!;
  const board = query<HTMLDivElement>('board'), pause = query<HTMLButtonElement>('pause'), flag = query<HTMLButtonElement>('flag');
  const difficulty = query<HTMLSelectElement>('difficulty');
  const configs = { easy:[9,10], normal:[12,22], hard:[16,40] } as const;
  type Difficulty = keyof typeof configs;
  let level: Difficulty = 'easy', game = createMines(), paused = false, flagMode = false, elapsed = 0, last = performance.now(), focus = 0;
  let cells: HTMLButtonElement[] = [], best = 0;
  const key = () => `my-universe:minesweeper:best:${level}`;
  function clock() {
    const now = performance.now();
    if (game.status === 'playing' && !paused) elapsed += now-last;
    last = now;
    query('time').textContent = String(Math.floor(elapsed/1000));
  }
  function status(message: string) { query('status').textContent = message; }
  function render() {
    root!.dataset.status = paused ? 'paused' : game.status;
    query('remaining').textContent = String(game.mineCount-game.cells.filter(c=>c.flagged).length);
    query('best').textContent = best ? `${best} 秒` : '—';
    pause.disabled = game.status !== 'playing';
    pause.textContent = paused ? '继续' : '暂停';
    flag.disabled = paused || game.status === 'won' || game.status === 'lost';
    query('cover').hidden = !paused;
    query('scroll').inert = paused;
    board.closest<HTMLElement>('.mines-surface')!.dataset.paused = String(paused);
    cells.forEach((button,i) => {
      const cell = game.cells[i], mineVisible = cell.mine && game.status === 'lost';
      button.dataset.revealed = String(cell.revealed);
      button.dataset.flagged = String(cell.flagged);
      button.dataset.number = cell.revealed && !cell.mine ? String(cell.adjacent) : '';
      button.dataset.mine = String(mineVisible);
      button.dataset.exploded = String(game.exploded === i);
      button.textContent = mineVisible ? '✹' : cell.flagged ? '⚑' : cell.revealed && cell.adjacent ? String(cell.adjacent) : '';
      const label = mineVisible ? '地雷' : cell.flagged ? '已插旗' : cell.revealed ? (cell.adjacent ? `周围 ${cell.adjacent} 颗雷` : '空白') : '未探索';
      button.setAttribute('aria-label', `${Math.floor(i/game.cols)+1} 行 ${i%game.cols+1} 列，${label}`);
      button.tabIndex = i === focus ? 0 : -1;
    });
  }
  function act(index: number, forceFlag = false) {
    if (paused || game.status === 'won' || game.status === 'lost') return;
    clock();
    const wasReady = game.status === 'ready';
    if (forceFlag || flagMode) toggleFlag(game,index); else revealCell(game,index);
    if (wasReady && game.status !== 'ready') last = performance.now();
    if (game.status === 'won') {
      const seconds = Math.max(1,Math.ceil(elapsed/1000));
      if (!best || seconds < best) { best = seconds; if (!writeNumber(key(),best)) query('storage').textContent = '浏览器未允许保存纪录，本局仍可正常游玩。'; }
      status(`星域探索完成！用时 ${seconds} 秒，全部安全格已翻开。`);
    } else if (game.status === 'lost') status('探索遇到了地雷。重新开始，再试一次吧。');
    else if (game.status === 'playing') status(flagMode ? '插旗模式已开启。点按标记或取消旗帜。' : '探索中 · 根据周围数字判断雷的位置。');
    render();
  }
  function setPause(value: boolean) {
    if (game.status !== 'playing' || paused === value) return;
    clock(); paused = value; last = performance.now();
    status(paused ? '已暂停，棋盘与计时均已冻结。' : '继续探索。'); render();
  }
  function reset() {
    level = difficulty.value in configs ? difficulty.value as Difficulty : 'easy';
    const [size,mines] = configs[level];
    game = createMines(size,size,mines); paused = false; elapsed = 0; last = performance.now(); focus = 0; best = readNumber(key());
    if (!writeNumber(key(),best)) query('storage').textContent = '浏览器未允许保存纪录，本局仍可正常游玩。';
    board.style.setProperty('--mines-cols',String(size)); board.dataset.difficulty = level;
    board.setAttribute('aria-rowcount',String(size)); board.setAttribute('aria-colcount',String(size));
    board.replaceChildren(); cells = [];
    for (let r = 0; r < size; r++) {
      const row = document.createElement('div'); row.className = 'mines-row'; row.setAttribute('role','row');
      for (let c = 0; c < size; c++) {
        const button = document.createElement('button'), index = r*size+c;
        button.type = 'button'; button.className = 'mines-cell'; button.setAttribute('role','gridcell');
        button.dataset.minesCell = String(index); button.dataset.row = String(r); button.dataset.col = String(c);
        row.append(button); cells.push(button);
      }
      board.append(row);
    }
    query('time').textContent = '0'; status('翻开任意一格开始。第一次探索及周围一圈始终安全。'); render();
  }
  board.addEventListener('click',event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mines-cell]');
    if (button) { focus = Number(button.dataset.minesCell); act(focus); }
  });
  board.addEventListener('contextmenu',event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mines-cell]');
    if (button) { event.preventDefault(); focus = Number(button.dataset.minesCell); act(focus,true); }
  });
  board.addEventListener('focusin',event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mines-cell]');
    if (button) { cells[focus].tabIndex = -1; focus = Number(button.dataset.minesCell); button.tabIndex = 0; }
  });
  board.addEventListener('keydown',event => {
    if (paused) return;
    const r = Math.floor(focus/game.cols), c = focus%game.cols;
    const next: Record<string,number> = { ArrowLeft:r*game.cols+Math.max(0,c-1),ArrowRight:r*game.cols+Math.min(game.cols-1,c+1),ArrowUp:Math.max(0,r-1)*game.cols+c,ArrowDown:Math.min(game.rows-1,r+1)*game.cols+c };
    if (event.key in next) { event.preventDefault(); cells[focus].tabIndex = -1; focus = next[event.key]; cells[focus].tabIndex = 0; cells[focus].focus(); }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); act(focus,true); }
  });
  pause.addEventListener('click',()=>setPause(!paused));
  flag.addEventListener('click',()=> { flagMode = !flagMode; flag.setAttribute('aria-pressed',String(flagMode)); flag.textContent = `插旗模式：${flagMode?'开':'关'}`; status(flagMode ? '插旗模式已开启。点按标记或取消旗帜。' : '翻格模式已开启。点按探索安全格。'); });
  query('restart').addEventListener('click',reset); difficulty.addEventListener('change',reset);
  document.addEventListener('visibilitychange',()=> { if (document.hidden) setPause(true); });
  window.addEventListener('blur',()=>setPause(true));
  setInterval(clock,200); reset(); root.dataset.ready = 'true';
}
