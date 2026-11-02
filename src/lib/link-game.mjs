const directions = [[0,1],[1,0],[0,-1],[-1,0]];

// The one-cell empty border represents the space outside the board.
export function findPath(game, first, second, ignoreValues = false) {
  if (first === second || game.tiles[first] == null || game.tiles[second] == null || (!ignoreValues && game.tiles[first] !== game.tiles[second])) return null;
  const start = {r:Math.floor(first/game.cols),c:first%game.cols};
  const end = {r:Math.floor(second/game.cols),c:second%game.cols};
  const queue = [{...start, dir:-1, turns:0, points:[start]}], seen = new Map();
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    for (let dir = 0; dir < 4; dir++) {
      const turns = node.turns + (node.dir !== -1 && node.dir !== dir ? 1 : 0);
      if (turns > 2) continue;
      const [dr,dc] = directions[dir], r = node.r + dr, c = node.c + dc;
      if (r < -1 || r > game.rows || c < -1 || c > game.cols) continue;
      const destination = r === end.r && c === end.c;
      if (!destination && r >= 0 && r < game.rows && c >= 0 && c < game.cols && game.tiles[r*game.cols+c] !== null) continue;
      const point = {r,c};
      const points = node.dir === dir ? [...node.points.slice(0,-1),point] : [...node.points,point];
      if (destination) return points;
      const key = `${r},${c},${dir}`;
      if (seen.has(key) && seen.get(key) <= turns) continue;
      seen.set(key,turns);
      queue.push({r,c,dir,turns,points});
    }
  }
  return null;
}

export function findPair(game) {
  for (let a = 0; a < game.tiles.length; a++) if (game.tiles[a] !== null) {
    for (let b = a+1; b < game.tiles.length; b++) if (game.tiles[a] === game.tiles[b]) {
      const path = findPath(game,a,b);
      if (path) return { first:a, second:b, path };
    }
  }
  return null;
}

export function matchTiles(game, first, second) {
  if (game.status !== 'playing') return null;
  const path = findPath(game,first,second);
  if (!path) return null;
  game.tiles[first] = null;
  game.tiles[second] = null;
  game.score += 100;
  if (game.tiles.every(t => t === null)) game.status = 'won';
  return path;
}

export function shuffleBoard(game, random = Math.random) {
  const slots = game.tiles.map((v,i) => v === null ? -1 : i).filter(i => i >= 0);
  if (slots.length < 2) return false;
  const values = slots.map(i => game.tiles[i]);
  for (let i = values.length-1; i > 0; i--) {
    const j = Math.floor(random()*(i+1));
    [values[i],values[j]] = [values[j],values[i]];
  }
  slots.forEach((index,i) => { game.tiles[index] = values[i]; });
  if (findPair(game)) return true;
  // Even a deadlock has a geometrically connected pair: find two visible
  // occupied positions, then move a duplicate icon into those positions.
  for (let a = 0; a < slots.length; a++) for (let b = a+1; b < slots.length; b++) {
    const first = slots[a], second = slots[b];
    if (!findPath(game,first,second,true)) continue;
    const duplicate = slots.find(i => i !== first && game.tiles[i] === game.tiles[first]);
    if (duplicate === undefined) continue;
    [game.tiles[second],game.tiles[duplicate]] = [game.tiles[duplicate],game.tiles[second]];
    return true;
  }
  return false;
}

export function createLink(rows = 6, cols = 6, random = Math.random) {
  if (rows < 2 || cols < 2 || rows*cols%2) throw new RangeError('Link boards need an even number of cells');
  const tiles = [];
  for (let i = 0; i < rows*cols/2; i++) tiles.push(i%8,i%8);
  const game = {rows,cols,tiles,score:0,status:'playing'};
  shuffleBoard(game,random);
  return game;
}

// Prefer the requested row/column. When that axis has no remaining tile,
// continue in reading order so isolated tiles remain keyboard reachable.
export function nextTileIndex(game, current, key) {
  const deltas = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-game.cols,ArrowDown:game.cols};
  if (!(key in deltas)) return current;
  const delta = deltas[key], horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  let index = current;
  while (index >= 0 && index < game.tiles.length) {
    const next = index+delta;
    if (next < 0 || next >= game.tiles.length || (horizontal && Math.floor(next/game.cols) !== Math.floor(index/game.cols))) break;
    index = next;
    if (game.tiles[index] !== null) return index;
  }
  const step = delta < 0 ? -1 : 1;
  for (let distance = 1; distance <= game.tiles.length; distance++) {
    const next = ((current+distance*step)%game.tiles.length+game.tiles.length)%game.tiles.length;
    if (game.tiles[next] !== null) return next;
  }
  return -1;
}
