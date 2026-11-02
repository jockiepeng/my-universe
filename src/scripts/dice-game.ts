import { createGame, getOutcome, getStatistics, playRound, restoreGame, rollDice, MAX_COINS, STORAGE_KEY, TOTAL_ODDS } from '../lib/dice-game.mjs';

type Round = { id: number; dice: number[]; bets: Record<string, number>; stake: number; payout: number; net: number; balance: number };
type GameState = { version: number; initialCoins: number; balance: number; rounds: Round[] };

const root = document.querySelector<HTMLElement>('[data-dice-game]');
if (root) initialize(root);

function initialize(root: HTMLElement) {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const controls = find<HTMLFieldSetElement>('[data-bet-controls]');
  const chipInput = find<HTMLInputElement>('[data-chip-amount]');
  const result = find<HTMLElement>('[data-result]');
  const rollButton = find<HTMLButtonElement>('[data-roll]');
  const clearButton = find<HTMLButtonElement>('[data-clear]');
  const resetButton = find<HTMLButtonElement>('[data-reset-open]');
  const dialog = find<HTMLDialogElement>('[data-reset-dialog]');
  const initialInput = find<HTMLInputElement>('[data-initial-coins]');
  const saveNote = find<HTMLElement>('[data-save-note]');
  const historyList = find<HTMLOListElement>('[data-history-list]');
  const spotButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-spot]')];
  const format = (value: number) => value.toLocaleString('zh-CN');
  const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value)}`;
  const errorText = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请再试一次。';
  const outcomeText = (dice: number[]) => {
    const outcome = getOutcome(dice);
    return `${outcome.total} 点 · ${outcome.size === 'small' ? '小' : '大'}${outcome.triple ? ' · 豹子' : ''}`;
  };
  const label = (spot: string) => spot === 'small' ? '小' : spot === 'big' ? '大' : `${spot}点`;
  const setText = (selector: string, text: string) => { find(selector).textContent = text; };
  let state: GameState = createGame();
  let bets: Record<string, number> = {};
  let busy = false;
  let visibleHistory = 20;
  let lastRaw: string | null = null;
  let storageAvailable = true;

  function warnStorage() {
    saveNote.textContent = '当前浏览器无法保存进度，仍可在本页继续玩；刷新或离开会丢失本次改动。';
    saveNote.dataset.warning = '';
    storageAvailable = false;
  }

  try {
    lastRaw = localStorage.getItem(STORAGE_KEY);
    if (lastRaw) {
      const restored = restoreGame(lastRaw);
      if (restored) state = restored;
      else {
        saveNote.textContent = '原有存档无法读取，已恢复为 1,000 金币的新游戏。';
        saveNote.dataset.warning = '';
      }
    }
  } catch { warnStorage(); }

  function persist() {
    if (!storageAvailable) return;
    try {
      const raw = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, raw);
      lastRaw = raw;
    } catch { warnStorage(); }
  }

  // Called inside the Web Lock before writes, so a stale tab cannot overwrite a newer game.
  function synchronize() {
    if (!storageAvailable) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === lastRaw) return false;
      state = restoreGame(raw) || createGame();
      lastRaw = raw;
      bets = {};
      visibleHistory = 20;
      return true;
    } catch { warnStorage(); return false; }
  }

  async function withLock(action: () => void) {
    if (navigator.locks) await navigator.locks.request(STORAGE_KEY, action);
    else action();
  }

  const stake = () => Object.values(bets).reduce((sum, amount) => sum + amount, 0);
  function report(text: string, error = false) {
    result.textContent = text;
    result.toggleAttribute('data-error', error);
  }

  function renderBets() {
    const total = stake();
    setText('[data-balance]', format(state.balance));
    setText('[data-stake]', format(total));
    setText('[data-remaining]', format(state.balance - total));
    for (const button of spotButtons) {
      const spot = button.dataset.spot!;
      const amount = bets[spot] || 0;
      button.toggleAttribute('data-selected', amount > 0);
      button.querySelector('[data-spot-amount]')!.textContent = amount ? format(amount) : spot === 'small' || spot === 'big' ? '未下注' : '—';
      button.setAttribute('aria-label', `${button.dataset.label}，净赢${TOTAL_ODDS[Number(spot) as keyof typeof TOTAL_ODDS] ?? 1}倍，已押${amount}金币，点击增加筹码`);
    }
    controls.disabled = busy;
    rollButton.disabled = busy || total === 0;
    clearButton.disabled = busy || total === 0;
    resetButton.disabled = busy;
    rollButton.textContent = busy ? '开骰中…' : total ? `下注 ${format(total)} · 开骰` : '下注并开骰';
  }

  function renderHistory() {
    const fragment = document.createDocumentFragment();
    for (const round of state.rounds.slice(-visibleHistory).reverse()) {
      const li = document.createElement('li');
      li.className = 'g-history-item';
      const summary = document.createElement('div');
      summary.className = 'g-history-summary';
      const number = document.createElement('span');
      number.textContent = `第 ${round.id} 局`;
      const profit = document.createElement('strong');
      profit.textContent = `${signed(round.net)} 金币`;
      profit.className = round.net > 0 ? 'g-positive' : round.net < 0 ? 'g-negative' : '';
      summary.append(number, profit);
      const dice = document.createElement('div');
      dice.className = 'g-history-dice';
      const faces = document.createElement('span');
      faces.textContent = round.dice.join(' + ');
      const total = document.createElement('b');
      total.textContent = outcomeText(round.dice);
      dice.append(faces, total);
      const details = document.createElement('p');
      details.className = 'g-history-detail';
      details.textContent = `${Object.entries(round.bets).map(([spot, amount]) => `${label(spot)} ${format(amount)}`).join(' / ')}；返还 ${format(round.payout)}；余额 ${format(round.balance)}`;
      li.append(summary, dice, details);
      fragment.append(li);
    }
    historyList.replaceChildren(fragment);
    find('[data-history-empty]').hidden = state.rounds.length > 0;
    find('[data-load-more]').hidden = state.rounds.length <= visibleHistory;
    setText('[data-history-count]', `${format(state.rounds.length)} 局`);
  }

  function render() {
    const last = state.rounds.at(-1);
    const values = last?.dice || [1, 1, 1];
    root.querySelectorAll<HTMLElement>('[data-die]').forEach((die, i) => {
      die.dataset.value = String(values[i]);
      die.setAttribute('aria-label', last ? `${values[i]} 点` : '等待开骰');
    });
    setText('[data-outcome]', last ? outcomeText(last.dice) : '等待开骰');
    setText('[data-next-round]', format(state.rounds.length + 1));
    if (last) report(`上局下注 ${format(last.stake)}，返还 ${format(last.payout)}，${last.net > 0 ? '净赢' : last.net < 0 ? '净输' : '盈亏'} ${format(Math.abs(last.net))} 金币。${state.balance === 0 ? '金币用完了，可重新开始。' : '可以继续下注。'}`);
    else report('先选筹码，再点击下方位置下注。');
    const stats = getStatistics(state);
    setText('[data-stat-rounds]', format(stats.roundCount));
    setText('[data-stat-wins]', format(stats.wins));
    setText('[data-stat-net]', signed(stats.net));
    setText('[data-frequent]', stats.mostFrequent.length ? stats.mostFrequent.join('、') + ' 点' : '还没有记录');
    setText('[data-frequent-detail]', stats.maxCount ? `各出现 ${format(stats.maxCount)} 次，占全部 ${format(stats.roundCount)} 局的 ${(stats.maxCount / stats.roundCount * 100).toFixed(1)}%。` : '开骰后开始统计，并列点数会一起显示。');
    setText('[data-size-counts]', `小 ${format(stats.small)} 次 / 大 ${format(stats.big)} 次 / 豹子 ${format(stats.triples)} 次（豹子单独计数）`);
    root.querySelectorAll<HTMLElement>('[data-total]').forEach(column => {
      const total = Number(column.dataset.total);
      const count = stats.counts[total];
      column.querySelector('.g-bar-count')!.textContent = format(count);
      column.querySelector<HTMLElement>('.g-bar')!.style.height = `${stats.maxCount ? count / stats.maxCount * 100 : 0}%`;
      column.toggleAttribute('data-most', count > 0 && count === stats.maxCount);
      column.setAttribute('aria-label', `${total}点，${count}次`);
    });
    renderHistory();
    renderBets();
  }

  root.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach(button => button.addEventListener('click', () => {
    chipInput.value = button.dataset.chip!;
    updateChips();
  }));
  function updateChips() {
    root.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.chip) === chipInput.valueAsNumber)));
  }
  chipInput.addEventListener('input', updateChips);
  for (const button of spotButtons) button.addEventListener('click', () => {
    if (busy) return;
    if (synchronize()) { render(); report('已同步另一页面的进度，请重新下注。'); return; }
    const amount = chipInput.valueAsNumber;
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_COINS) { report('每次下注请输入 1～1,000,000 的整数。', true); chipInput.focus(); return; }
    if (stake() + amount > state.balance) { report('金币不足，请减少筹码、清空下注或重新开始。', true); return; }
    const spot = button.dataset.spot!;
    bets[spot] = (bets[spot] || 0) + amount;
    renderBets();
    report(`已在${label(spot)}下注 ${format(bets[spot])} 金币，本局共 ${format(stake())}。`);
  });
  clearButton.addEventListener('click', () => { if (busy) return; bets = {}; renderBets(); report('本局下注已清空，可以重新选择。'); });

  rollButton.addEventListener('click', async event => {
    if (busy || stake() === 0) return;
    const returnFocus = event.detail === 0 ? spotButtons.find(button => button.dataset.spot === Object.keys(bets).at(-1)) : undefined;
    busy = true;
    renderBets();
    let committed = false;
    let notice = '';
    let failed = false;
    try {
      await withLock(() => {
        if (synchronize()) { notice = '已同步另一页面的进度，请重新下注。'; return; }
        state = playRound(state, bets, rollDice());
        bets = {};
        persist();
        committed = true;
      });
      if (committed) {
        root.dataset.rolling = '';
        setText('[data-outcome]', '开骰中…');
        report('筹码已下注，正在开骰。');
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
        if (!reduced) await new Promise(resolve => setTimeout(resolve, 650));
      }
    } catch (error) { notice = errorText(error); failed = true; }
    finally {
      busy = false;
      delete root.dataset.rolling;
      if (synchronize()) notice = '已同步另一页面的最新进度。';
      render();
      if (notice) report(notice, failed);
      if (committed && returnFocus && document.activeElement === document.body) returnFocus.focus({ preventScroll: true });
    }
  });

  resetButton.addEventListener('click', () => {
    if (busy) return;
    initialInput.value = String(state.initialCoins);
    setText('[data-reset-error]', '');
    dialog.showModal();
    initialInput.focus();
    initialInput.select();
  });
  find('[data-reset-cancel]').addEventListener('click', () => dialog.close());
  find<HTMLFormElement>('[data-reset-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    try {
      const fresh = createGame(initialInput.valueAsNumber);
      busy = true;
      let reset = false;
      await withLock(() => {
        if (synchronize()) return;
        state = fresh;
        bets = {};
        visibleHistory = 20;
        persist();
        reset = true;
      });
      if (!reset) {
        render();
        setText('[data-reset-error]', '另一页面已更新，已同步最新进度。请确认后再次点击「清空并开始」。');
        return;
      }
      dialog.close();
      render();
      report(`已重新开始，初始金币 ${format(state.initialCoins)}，历史和统计已清空。`);
    } catch (error) { setText('[data-reset-error]', errorText(error)); }
    finally { busy = false; renderBets(); }
  });
  find('[data-load-more]').addEventListener('click', () => { visibleHistory += 20; renderHistory(); });
  window.addEventListener('storage', event => {
    if ((event.key === STORAGE_KEY || event.key === null) && !busy && synchronize()) {
      render();
      report('已同步另一页面的进度，请重新选择本局下注。');
    }
  });
  render();
  root.dataset.ready = 'true';
}
