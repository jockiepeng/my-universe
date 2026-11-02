export function createMines(rows = 9, cols = 9, mineCount = 10) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 4 || cols < 4 || mineCount < 1 || mineCount > rows * cols - 9) throw new RangeError('Invalid mine field');
  return { rows, cols, mineCount, status: 'ready', exploded: -1, cells: Array.from({length: rows * cols}, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false })) };
}

export function neighbors(game, index) {
  const r = Math.floor(index / game.cols), c = index % game.cols, result = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if ((dr || dc) && r + dr >= 0 && r + dr < game.rows && c + dc >= 0 && c + dc < game.cols) result.push((r + dr) * game.cols + c + dc);
  }
  return result;
}

export function toggleFlag(game, index) {
  const cell = game.cells[index];
  if (!cell || cell.revealed || game.status === 'won' || game.status === 'lost') return false;
  cell.flagged = !cell.flagged;
  return true;
}

export function revealCell(game, index, random = Math.random) {
  const cell = game.cells[index];
  if (!cell || cell.flagged || cell.revealed || game.status === 'won' || game.status === 'lost') return false;
  if (game.status === 'ready') {
    const excluded = new Set([index, ...neighbors(game, index)]);
    const available = game.cells.map((_, i) => i).filter(i => !excluded.has(i));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    for (const i of available.slice(0, game.mineCount)) game.cells[i].mine = true;
    game.cells.forEach((c, i) => { c.adjacent = neighbors(game, i).filter(n => game.cells[n].mine).length; });
    game.status = 'playing';
  }
  if (cell.mine) { cell.revealed = true; game.exploded = index; game.status = 'lost'; return true; }
  const queue = [index];
  while (queue.length) {
    const i = queue.pop(), current = game.cells[i];
    if (current.revealed || current.flagged || current.mine) continue;
    current.revealed = true;
    if (current.adjacent === 0) queue.push(...neighbors(game, i));
  }
  if (game.cells.every(c => c.mine || c.revealed)) game.status = 'won';
  return true;
}
