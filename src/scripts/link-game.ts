import { createLink, findPair, matchTiles, shuffleBoard, nextTileIndex } from '../lib/link-game.mjs';
import { readNumber, writeNumber } from '../lib/arcade-storage';

const root = document.querySelector<HTMLElement>('[data-arcade="link"]');
if (root && root.dataset.ready !== 'true') {
  const query = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-link-${name}]`)!;
  const board = query<HTMLDivElement>('board'), pause = query<HTMLButtonElement>('pause'), startButton = query<HTMLButtonElement>('start');
  const hintButton = query<HTMLButtonElement>('hint'), shuffleButton = query<HTMLButtonElement>('shuffle');
  const difficulty = query<HTMLSelectElement>('difficulty');
  const icons = ['✦','☾','☀','♄','✧','◆','◎','△'];
  const names = ['四芒星','月亮','太阳','土星','星光','晶石','轨道','三角星'];
  const storageKey = 'my-universe:link:best';
  let game = createLink(), ready = true, paused = false, remaining = 180000, last = performance.now();
  let hints = 3, shuffles = 3, selected = -1, focus = 0, hinted: number[] = [], busy = false, feedbackTimer = 0;
  let cells: HTMLButtonElement[] = [], best = readNumber(storageKey);
  const line = root.querySelector<SVGPolylineElement>('[data-link-line]')!;
  const pathSvg = root.querySelector<SVGSVGElement>('[data-link-path]')!;
  function status(message: string) { query('status').textContent = message; }
  function clock() {
    const now = performance.now();
    if (!ready && game.status === 'playing' && !paused) remaining = Math.max(0,remaining-(now-last));
    last = now;
    query('time').textContent = String(Math.ceil(remaining/1000));
    if (remaining === 0 && game.status === 'playing') {
      game.status = 'lost'; selected = -1; hinted = []; line.setAttribute('points','');
      status('时间到了。重新开始，让下一次连线更从容。'); render();
    }
  }
  function render() {
    root!.dataset.status = paused ? 'paused' : ready ? 'ready' : game.status;
    query('score').textContent = String(game.score); query('best').textContent = String(best);
    pause.disabled = ready || game.status !== 'playing'; pause.textContent = paused ? '继续' : '暂停';
    startButton.hidden = !ready;
    hintButton.textContent = `提示 · ${hints}`; shuffleButton.textContent = `洗牌 · ${shuffles}`;
    hintButton.disabled = ready || paused || busy || hints === 0 || game.status !== 'playing';
    shuffleButton.disabled = ready || paused || busy || shuffles === 0 || game.status !== 'playing';
    query('cover').hidden = !paused; board.inert = paused;
    board.closest<HTMLElement>('.link-surface')!.dataset.paused = String(paused);
    if (game.tiles[focus] === null) focus = game.tiles.findIndex(value => value !== null);
    cells.forEach((button,i) => {
      const value = game.tiles[i], empty = value === null;
      button.dataset.empty = String(empty); button.dataset.value = empty ? '' : String(value);
      button.dataset.hint = String(hinted.includes(i)); button.textContent = empty ? '' : icons[value];
      button.setAttribute('aria-selected',String(selected===i));
      button.setAttribute('aria-label',`${Math.floor(i/game.cols)+1} 行 ${i%game.cols+1} 列，${empty?'已消除':names[value]}${selected===i?'，已选中':''}`);
      button.setAttribute('aria-disabled',String(empty || paused || busy || game.status !== 'playing'));
      button.disabled = empty; button.tabIndex = i===focus ? 0 : -1;
    });
  }
  function start() { if (!ready) return; ready = false; last = performance.now(); status('选择两个相同图案，寻找不超过两次转弯的路径。'); render(); }
  function ensurePlayable() {
    if (game.status === 'playing' && !findPair(game)) { shuffleBoard(game); status('没有可连接的图案，已自动免费洗牌。'); }
  }
  function act(index: number) {
    if (paused || busy || game.status !== 'playing' || game.tiles[index] === null) return;
    if (ready) start(); clock(); if (game.status !== 'playing') return;
    hinted = [];
    if (selected === index) { selected = -1; status('已取消选择。'); render(); return; }
    if (selected < 0) { selected = index; status(`已选中${names[game.tiles[index]]}，再选择一个相同图案。`); render(); return; }
    const path = matchTiles(game,selected,index);
    if (!path) { selected = index; status('这两个图案暂时无法连接。已选中新图案，错配不扣分。'); render(); return; }
    selected = -1; busy = true;
    line.setAttribute('points',path.map(point=>`${point.c+1.5},${point.r+1.5}`).join(' '));
    // matchTiles mutates status; TypeScript retains the pre-call 'playing' narrowing.
    if ((game.status as string) === 'won') {
      const bonus = Math.floor(remaining/1000)*10; game.score += bonus;
      status(`星图全部连接！时间奖励 ${bonus} 分，总分 ${game.score}。`);
    } else status('连接成功，+100 分。');
    if (game.score > best) { best = game.score; if (!writeNumber(storageKey,best)) query('storage').textContent = '浏览器未允许保存纪录，本局仍可正常游玩。'; }
    const hadFocus = board.contains(document.activeElement);
    render();
    // When a focused tile disappears, keep keyboard play inside the grid.
    if (hadFocus && focus >= 0) cells[focus].focus();
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(()=> { line.setAttribute('points',''); busy = false; if (!paused && game.status === 'playing') ensurePlayable(); render(); },400);
  }
  function setPause(value: boolean) {
    if (ready || game.status !== 'playing' || paused === value) return;
    clock(); if (game.status !== 'playing') return;
    paused = value; last = performance.now(); status(paused ? '已暂停，图案与倒计时均已冻结。' : '继续连接星图。');
    if (!paused && !busy) ensurePlayable();
    render();
  }
  function reset() {
    window.clearTimeout(feedbackTimer);
    const rows = difficulty.value === 'normal' ? 8 : 6;
    game = createLink(rows,6); ready = true; paused = false; remaining = rows===8 ? 240000 : 180000; last = performance.now();
    hints = 3; shuffles = 3; selected = -1; focus = 0; hinted = []; busy = false;
    const stage = query('stage'); stage.style.aspectRatio = `8 / ${rows+2}`;
    board.style.setProperty('--link-rows',String(rows)); board.style.top = `${100/(rows+2)}%`; board.style.bottom = `${100/(rows+2)}%`;
    board.setAttribute('aria-rowcount',String(rows)); board.setAttribute('aria-colcount','6');
    pathSvg.setAttribute('viewBox',`0 0 8 ${rows+2}`); line.setAttribute('points','');
    board.replaceChildren(); cells = [];
    for (let r = 0; r < rows; r++) {
      const row = document.createElement('div'); row.className = 'link-row'; row.setAttribute('role','row');
      for (let c = 0; c < 6; c++) {
        const button = document.createElement('button'), index = r*6+c;
        button.type = 'button'; button.className = 'link-cell'; button.setAttribute('role','gridcell');
        button.dataset.linkCell = String(index); button.dataset.row = String(r); button.dataset.col = String(c);
        row.append(button); cells.push(button);
      }
      board.append(row);
    }
    query('time').textContent = String(remaining/1000); status('点击开始，或选择任意图案开始本局。'); render();
  }
  board.addEventListener('click',event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-link-cell]');
    if (button) { focus = Number(button.dataset.linkCell); act(focus); }
  });
  board.addEventListener('focusin',event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-link-cell]');
    if (button) { if (cells[focus]) cells[focus].tabIndex = -1; focus = Number(button.dataset.linkCell); button.tabIndex = 0; }
  });
  board.addEventListener('keydown',event => {
    if (paused || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next = nextTileIndex(game,focus,event.key);
    if (next >= 0) { if (cells[focus]) cells[focus].tabIndex = -1; focus = next; cells[focus].tabIndex = 0; cells[focus].focus(); }
  });
  startButton.addEventListener('click',start); pause.addEventListener('click',()=>setPause(!paused));
  hintButton.addEventListener('click',()=> {
    if (hintButton.disabled) return; clock(); if (game.status !== 'playing') return;
    const pair = findPair(game); if (!pair) { ensurePlayable(); render(); return; }
    hints--; hinted = [pair.first,pair.second]; selected = -1; status('已照亮一对可连接的图案。'); render();
  });
  shuffleButton.addEventListener('click',()=> {
    if (shuffleButton.disabled) return; clock(); if (game.status !== 'playing') return;
    shuffles--; selected = -1; hinted = []; shuffleBoard(game); status('星图已重新排列，至少有一对可以连接。'); render();
  });
  query('restart').addEventListener('click',reset); difficulty.addEventListener('change',reset);
  document.addEventListener('visibilitychange',()=> { if (document.hidden) setPause(true); });
  window.addEventListener('blur',()=>setPause(true));
  // Re-save the validated record to check whether this browser permits storage.
  if (!writeNumber(storageKey,best)) query('storage').textContent = '浏览器未允许保存纪录，本局仍可正常游玩。';
  setInterval(clock,200); reset(); root.dataset.ready = 'true';
}
