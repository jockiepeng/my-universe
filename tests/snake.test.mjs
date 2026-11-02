import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnake, queueDirection, stepSnake, placeFood } from '../src/lib/snake.mjs';

const fixture = (overrides = {}) => ({
  size: 5, snake: [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }],
  direction: 'right', turns: [], food: { x: 4, y: 4 }, score: 0, status: 'playing', ...overrides,
});

test('new snake moves one cell without growing or mutating the previous board', () => {
  const state = createSnake({ random: () => 0 });
  const previous = structuredClone(state);
  const next = stepSnake(state, () => 0);
  assert.equal(state.size, 20);
  assert.equal(next.snake.length, 3);
  assert.deepEqual(next.snake[0], { x: 11, y: 10 });
  assert.equal(next.score, 0);
  assert.deepEqual(state, previous);
});

test('eating food grows by one, adds ten points and leaves new food outside the snake', () => {
  const next = stepSnake(fixture({ food: { x: 3, y: 2 } }), () => 0);
  assert.equal(next.snake.length, 4);
  assert.equal(next.score, 10);
  assert.deepEqual(next.food, { x: 0, y: 0 });
});

test('food selects uniformly indexed empty cells, including the last available cell', () => {
  const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  assert.deepEqual(placeFood(2, snake, () => 0), { x: 0, y: 1 });
  assert.deepEqual(placeFood(2, [{ x: 0, y: 0 }], () => 0.999), { x: 1, y: 1 });
  assert.equal(placeFood(1, [{ x: 0, y: 0 }], () => 0), null);
});

test('all four walls end the round without moving the snake out of the board', () => {
  for (const [direction, head] of [['left', { x: 0, y: 2 }], ['right', { x: 4, y: 2 }], ['up', { x: 2, y: 0 }], ['down', { x: 2, y: 4 }]]) {
    const state = fixture({ direction, snake: [head] });
    const next = stepSnake(state);
    assert.equal(next.status, 'lost', direction);
    assert.deepEqual(next.snake, state.snake);
  }
});

test('moving into a body cell loses, but the tail cell is free during a non-growing step', () => {
  const loop = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }];
  assert.equal(stepSnake(fixture({ snake: loop, direction: 'left' })).status, 'playing');
  const body = [...loop, { x: 0, y: 2 }];
  assert.equal(stepSnake(fixture({ snake: body, direction: 'left' })).status, 'lost');
});

test('reverse and duplicate turns are ignored and rapid turns execute one per step', () => {
  const state = fixture();
  assert.deepEqual(queueDirection(state, 'left').turns, []);
  assert.deepEqual(queueDirection(state, 'right').turns, []);
  const queued = queueDirection(queueDirection(state, 'up'), 'left');
  assert.deepEqual(queued.turns, ['up', 'left']);
  assert.deepEqual(queueDirection(queued, 'down').turns, ['up', 'left']);
  const first = stepSnake(queued);
  assert.deepEqual(first.snake[0], { x: 2, y: 1 });
  const second = stepSnake(first);
  assert.deepEqual(second.snake[0], { x: 1, y: 1 });
  assert.equal(second.status, 'playing');
  assert.deepEqual(state.turns, []);
});

test('a rapid turn cannot reverse the last queued direction or accept unknown input', () => {
  const up = queueDirection(fixture(), 'up');
  assert.deepEqual(queueDirection(up, 'down').turns, ['up']);
  assert.deepEqual(queueDirection(up, 'diagonal').turns, ['up']);
});

test('eating the last empty cell wins and terminal rounds cannot move or accept turns', () => {
  const state = fixture({ size: 2, snake: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], food: { x: 1, y: 0 } });
  const next = stepSnake(state, () => 0);
  assert.equal(next.status, 'won');
  assert.equal(next.food, null);
  assert.equal(next.snake.length, 4);
  assert.equal(next.score, 10);
  assert.deepEqual(stepSnake(next), next);
  assert.deepEqual(queueDirection(next, 'down'), next);
});
