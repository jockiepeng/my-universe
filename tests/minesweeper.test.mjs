import test from 'node:test';
import assert from 'node:assert/strict';
import { createMines, revealCell, toggleFlag, neighbors } from '../src/lib/minesweeper.mjs';

test('first reveal excludes the cell and all neighbors from mine placement', () => {
  for (const cell of [0, 40, 80]) {
    const game = createMines(9, 9, 10);
    revealCell(game, cell, () => 0.37);
    assert.equal(game.cells.filter(c => c.mine).length, 10);
    for (const i of [cell, ...neighbors(game, cell)]) assert.equal(game.cells[i].mine, false);
    assert.equal(game.cells[cell].revealed, true);
  }
});

test('flags before first reveal do not start a game or get opened by flood fill', () => {
  const game = createMines(5, 5, 1);
  toggleFlag(game, 0);
  revealCell(game, 0);
  assert.equal(game.status, 'ready');
  revealCell(game, 12, () => 0.99);
  assert.equal(game.cells[0].flagged, true);
  assert.equal(game.cells[0].revealed, false);
  assert.equal(game.cells[12].adjacent, 0);
  assert.ok(game.cells.filter(c => c.revealed).length > 9);
});

test('all safe cells win even without flagging; a mine loses and terminal input is ignored', () => {
  const won = createMines(5, 5, 1);
  revealCell(won, 12, () => 0.99);
  for (let i = 0; i < 25; i++) if (!won.cells[i].mine) revealCell(won, i);
  assert.equal(won.status, 'won');
  const lost = createMines(5, 5, 1);
  toggleFlag(lost, 12);
  revealCell(lost, 13, () => 0.99);
  assert.equal(lost.status, 'playing');
  const mine = lost.cells.findIndex(c => c.mine);
  revealCell(lost, mine);
  assert.equal(lost.status, 'lost');
  assert.equal(lost.exploded, mine);
  toggleFlag(lost, 12);
  assert.equal(lost.cells[12].flagged, true);
});
