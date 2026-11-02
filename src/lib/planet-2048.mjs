export const STORAGE_KEY = 'little-universe-planet-2048-v1';
export const planets = [
  { value: 2, name: '星尘' }, { value: 4, name: '陨石' },
  { value: 8, name: '小行星' }, { value: 16, name: '卫星' },
  { value: 32, name: '岩石行星' }, { value: 64, name: '海洋行星' },
  { value: 128, name: '巨行星' }, { value: 256, name: '环形行星' },
  { value: 512, name: '恒星' }, { value: 1024, name: '星云' },
  { value: 2048, name: '星系' },
];
export function planetName(value) {
  return planets.find(planet => planet.value === value)?.name || '深空星系';
}

/** @typedef {{version:number, board:number[], score:number, best:number, moves:number, continued:boolean}} PlanetGame */
/** @typedef {'left'|'right'|'up'|'down'} Direction */

function spawn(board, random) {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  const next = [...board];
  if (empty.length) next[empty[Math.floor(random() * empty.length)]] = random() < .9 ? 2 : 4;
  return next;
}

/** @returns {PlanetGame} */
export function createGame(best = 0, random = Math.random) {
  return { version: 1, board: spawn(spawn(Array(16).fill(0), random), random), score: 0, best, moves: 0, continued: false };
}

/** @param {number[]} board */
export function boardStatus(board) {
  const max = Math.max(...board);
  const movable = board.some((value, index) => value === 0 ||
    (index % 4 < 3 && value === board[index + 1]) ||
    (index < 12 && value === board[index + 4]));
  return { won: max >= 2048, over: !movable, max };
}

/** @param {number[]} board @param {Direction} direction */
export function shiftBoard(board, direction) {
  if (!['left', 'right', 'up', 'down'].includes(direction)) throw new RangeError('Unknown move direction');
  const next = Array(16).fill(0);
  let gained = 0;
  /** @type {number[]} */
  const merged = [];
  /** @type {{from:number,to:number}[]} */
  const motions = [];
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, i) => direction === 'left' ? line * 4 + i :
      direction === 'right' ? line * 4 + 3 - i : direction === 'up' ? i * 4 + line : (3 - i) * 4 + line);
    const filled = indices.filter(index => board[index] !== 0);
    let target = 0;
    for (let i = 0; i < filled.length; i++) {
      const from = filled[i], to = indices[target++];
      motions.push({ from, to });
      if (i + 1 < filled.length && board[from] === board[filled[i + 1]]) {
        next[to] = board[from] * 2;
        gained += next[to]; merged.push(to);
        motions.push({ from: filled[++i], to });
      } else next[to] = board[from];
    }
  }
  return { board: next, changed: next.some((value, index) => value !== board[index]), gained, merged, motions };
}

/** @param {PlanetGame} game @param {Direction} direction */
export function moveGame(game, direction, random = Math.random) {
  const status = boardStatus(game.board);
  if (status.over || (status.won && !game.continued)) return { state: game, changed: false, gained: 0, merged: [], motions: [] };
  const shifted = shiftBoard(game.board, direction);
  if (!shifted.changed) return { ...shifted, state: game };
  const score = game.score + shifted.gained;
  return { ...shifted, state: { ...game, board: spawn(shifted.board, random), score, best: Math.max(game.best, score), moves: game.moves + 1 } };
}

/** @param {PlanetGame} game @returns {PlanetGame} */
export function continueGame(game) {
  return boardStatus(game.board).won ? { ...game, continued: true } : game;
}

/** @param {string|null} serialized @returns {PlanetGame|null} */
export function restoreGame(serialized) {
  try {
    const value = JSON.parse(serialized || 'null');
    const counter = n => Number.isSafeInteger(n) && n >= 0;
    if (!value || value.version !== 1 || !Array.isArray(value.board) || value.board.length !== 16 ||
      !value.board.every(n => n === 0 || (Number.isSafeInteger(n) && n >= 2 && Number.isInteger(Math.log2(n)))) ||
      value.board.filter(n => n > 0).length < 2 || !counter(value.score) || !counter(value.best) || !counter(value.moves) ||
      value.best < value.score || typeof value.continued !== 'boolean') return null;
    return { version: 1, board: [...value.board], score: value.score, best: value.best, moves: value.moves, continued: value.continued };
  } catch { return null; }
}
