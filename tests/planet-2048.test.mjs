import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, shiftBoard, moveGame, continueGame, boardStatus, restoreGame } from '../src/lib/planet-2048.mjs';

const board = (...rows) => rows.flat();
const blank = () => Array(16).fill(0);
function state(cells, extra = {}) {
  return { version: 1, board: cells, score: 0, best: 0, moves: 0, continued: false, ...extra };
}
const zero = () => 0;

test('a new game creates two distinct tiles and keeps the best score', () => {
  const game = createGame(120, zero);
  assert.deepEqual(game.board, [2, 2, ...Array(14).fill(0)]);
  assert.equal(game.best, 120);
  assert.equal(game.score, 0);
  assert.equal(game.moves, 0);
});

test('rows compress before merging and a newly merged tile cannot merge twice', () => {
  const cells = board([2, 0, 2, 4], [2, 2, 2, 2], [4, 4, 8, 8], [0, 0, 0, 0]);
  const original = structuredClone(cells);
  const result = shiftBoard(cells, 'left');
  assert.deepEqual(result.board, board([4, 4, 0, 0], [4, 4, 0, 0], [8, 16, 0, 0], [0, 0, 0, 0]));
  assert.equal(result.gained, 36);
  assert.deepEqual(result.merged, [0, 4, 5, 8, 9]);
  assert.deepEqual(cells, original);
});

test('right, up and down merge nearest the requested edge', () => {
  const cells = board([2, 2, 2, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
  assert.deepEqual(shiftBoard(cells, 'right').board, board([0, 0, 2, 4], [0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0]));
  assert.deepEqual(shiftBoard(cells, 'up').board, board([4, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
  assert.deepEqual(shiftBoard(cells, 'down').board, board([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [4, 2, 2, 0]));
});

test('an invalid move does not spawn, spend randomness, change score or mutate input', () => {
  const game = state([2, ...Array(15).fill(0)]);
  const result = moveGame(game, 'left', () => { throw new Error('must not draw randomness'); });
  assert.equal(result.changed, false);
  assert.deepEqual(result.state, game);
  assert.equal(result.state.moves, 0);
});

test('a valid move adds one tile, counts merge score and preserves or updates best', () => {
  const game = state([2, 2, ...Array(14).fill(0)], { score: 12, best: 14, moves: 3 });
  const result = moveGame(game, 'left', zero);
  assert.deepEqual(result.state.board, [4, 2, ...Array(14).fill(0)]);
  assert.equal(result.state.score, 16);
  assert.equal(result.state.best, 16);
  assert.equal(result.state.moves, 4);
  assert.equal(game.score, 12);
});

test('spawn probabilities use 2 below .9 and 4 at .9, and select the last empty cell', () => {
  for (const [roll, want] of [[.8999, 2], [.9, 4]]) {
    const values = [.9999, roll];
    const result = moveGame(state([2, 2, ...Array(14).fill(0)]), 'left', () => values.shift());
    assert.equal(result.state.board[15], want);
  }
});

test('2048 pauses for congratulations and can continue without losing its board', () => {
  const cells = [1024, 1024, ...Array(14).fill(0)];
  const win = moveGame(state(cells), 'left', zero).state;
  assert.equal(boardStatus(win.board).won, true);
  assert.equal(win.score, 2048);
  assert.equal(moveGame(win, 'right', zero).changed, false);
  const continued = continueGame(win);
  assert.equal(continued.continued, true);
  assert.deepEqual(continued.board, win.board);
  assert.equal(moveGame(continued, 'right', zero).changed, true);
});

test('full boards end only when neither horizontal nor vertical merges remain', () => {
  const stuck = board([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]);
  assert.equal(boardStatus(stuck).over, true);
  const horizontal = [...stuck]; horizontal[1] = 2;
  const vertical = [...stuck]; vertical[4] = 2;
  assert.equal(boardStatus(horizontal).over, false);
  assert.equal(boardStatus(vertical).over, false);
  assert.equal(boardStatus([2, ...Array(15).fill(0)]).over, false);
  assert.equal(moveGame(state(stuck), 'left', zero).changed, false);
});

test('valid saves round-trip including a continued winning board; corrupt saves are rejected', () => {
  const game = state([2048, 2, ...Array(14).fill(0)], { score: 2048, best: 4096, moves: 100, continued: true });
  assert.deepEqual(restoreGame(JSON.stringify(game)), game);
  for (const bad of [null, '{', '{}', JSON.stringify({ ...game, board: blank() }), JSON.stringify({ ...game, board: [3, ...game.board.slice(1)] }), JSON.stringify({ ...game, board: game.board.slice(1) }), JSON.stringify({ ...game, score: -1 }), JSON.stringify({ ...game, best: 0 }), JSON.stringify({ ...game, moves: .5 }), JSON.stringify({ ...game, continued: 'yes' }), JSON.stringify({ ...game, version: 2 })]) {
    assert.equal(restoreGame(bad), null);
  }
});
