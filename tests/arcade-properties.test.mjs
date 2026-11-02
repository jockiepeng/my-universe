import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath } from '../src/lib/link-game.mjs';

// Independent oracle: enumerate every possible row/column for two corners.
// This catches paths that accidentally spend three turns or pass through a tile.
function clearSegments(board, path, start, end) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a.r !== b.r && a.c !== b.c) return false;
    const dr = Math.sign(b.r - a.r), dc = Math.sign(b.c - a.c);
    let r = a.r, c = a.c;
    for (;;) {
      if (r < -1 || c < -1 || r > board.rows || c > board.cols) return false;
      if (r >= 0 && c >= 0 && r < board.rows && c < board.cols) {
        const index = r * board.cols + c;
        if (index !== start && index !== end && board.tiles[index] !== null) return false;
      }
      if (r === b.r && c === b.c) break;
      r += dr; c += dc;
    }
  }
  return true;
}

function canConnect(board, start, end) {
  const a = { r: Math.floor(start / board.cols), c: start % board.cols };
  const b = { r: Math.floor(end / board.cols), c: end % board.cols };
  for (let r = -1; r <= board.rows; r++) if (clearSegments(board, [a, { r, c: a.c }, { r, c: b.c }, b], start, end)) return true;
  for (let c = -1; c <= board.cols; c++) if (clearSegments(board, [a, { r: a.r, c }, { r: b.r, c }, b], start, end)) return true;
  return false;
}

test('link paths agree with independent geometry for every 3×3 obstacle pattern and endpoint pair', () => {
  for (let start = 0; start < 9; start++) for (let end = start + 1; end < 9; end++) {
    const others = Array.from({ length: 9 }, (_, i) => i).filter(i => i !== start && i !== end);
    for (let pattern = 0; pattern < 128; pattern++) {
      const tiles = Array(9).fill(null);
      tiles[start] = tiles[end] = 0; // Zero is a valid icon; null alone means empty.
      others.forEach((index, bit) => { if (pattern & (1 << bit)) tiles[index] = 2; });
      const board = { rows: 3, cols: 3, tiles, score: 0, status: 'playing' };
      const path = findPath(board, start, end);
      assert.equal(Boolean(path), canConnect(board, start, end), `endpoints ${start}/${end}, obstacles ${pattern}`);
      if (path) {
        assert.ok(path.length >= 2 && path.length <= 4);
        assert.deepEqual(path[0], { r: Math.floor(start / 3), c: start % 3 });
        assert.deepEqual(path.at(-1), { r: Math.floor(end / 3), c: end % 3 });
        assert.ok(clearSegments(board, path, start, end));
      }
    }
  }
});
