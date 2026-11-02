import test from 'node:test';
import assert from 'node:assert/strict';

import { createBreakout, movePaddle, launchBall, stepBreakout, pauseBreakout, resumeBreakout, nextBreakoutLevel } from '../src/lib/breakout.mjs';

function running() {
  const game = createBreakout();
  launchBall(game);
  return game;
}

test('waiting ball follows a clamped paddle and stays still until launch', () => {
  const game = running();
  game.ball.y = game.height + 20;
  stepBreakout(game, 0.02);
  assert.equal(game.status, 'ready');
  movePaddle(game, -100);
  assert.equal(game.paddle.x, 0);
  assert.equal(game.ball.x, game.paddle.width / 2);
  const y = game.ball.y;
  stepBreakout(game, 0.1);
  assert.equal(game.ball.y, y);
  movePaddle(game, 9000);
  assert.equal(game.paddle.x + game.paddle.width, game.width);
  launchBall(game);
  assert.equal(game.status, 'running');
  assert.ok(game.ball.vy < 0);
});

test('side walls reflect horizontally and the ceiling reflects vertically', () => {
  const game = running();
  game.ball = { ...game.ball, x: 8, y: 300, vx: -300, vy: -100 };
  stepBreakout(game, 0.02);
  assert.ok(game.ball.vx > 0);
  assert.ok(game.ball.vy < 0);
  game.ball = { ...game.ball, x: 350, y: 8, vx: 60, vy: -300 };
  stepBreakout(game, 0.02);
  assert.ok(game.ball.vy > 0);
  assert.equal(game.ball.vx, 60);
});

test('paddle landing offset sends the ball towards the corresponding side', () => {
  for (const [offset, sign] of [[-0.7, -1], [0.7, 1]]) {
    const game = running();
    game.ball.x = game.paddle.x + game.paddle.width * (0.5 + offset / 2);
    game.ball.y = game.paddle.y - game.ball.radius - 2;
    game.ball.vx = 0;
    game.ball.vy = 320;
    stepBreakout(game, 0.02);
    assert.ok(game.ball.vx * sign > 0);
    assert.ok(game.ball.vy < 0);
  }
});

test('a ball below the paddle cannot bounce off its underside', () => {
  const game = running();
  game.ball.x = game.paddle.x + 30;
  game.ball.y = game.paddle.y + game.paddle.height + 10;
  game.ball.vy = 100;
  stepBreakout(game, 0.01);
  assert.ok(game.ball.vy > 0);
});

test('brick top collision removes it once and reflects only the vertical velocity', () => {
  const game = running();
  const brick = game.bricks[0];
  game.ball = { ...game.ball, x: brick.x + brick.width / 2, y: brick.y - 9, vx: 0, vy: 320 };
  stepBreakout(game, 0.025);
  assert.equal(brick.alive, false);
  assert.equal(game.score, 10);
  assert.ok(game.ball.vy < 0);
  assert.equal(game.ball.vx, 0);
  stepBreakout(game, 0.05);
  assert.equal(game.score, 10);
});

test('brick side collision reflects horizontal velocity', () => {
  const game = running();
  const brick = game.bricks[0];
  game.ball = { ...game.ball, x: brick.x - 9, y: brick.y + brick.height / 2, vx: 320, vy: 0 };
  stepBreakout(game, 0.015);
  assert.equal(brick.alive, false);
  assert.ok(game.ball.vx < 0);
  assert.equal(game.ball.vy, 0);
});

test('small physics steps prevent a fast ball tunneling through a brick', () => {
  const game = running();
  const brick = game.bricks[0];
  game.ball = { ...game.ball, x: brick.x + brick.width / 2, y: brick.y - 30, vx: 0, vy: 3000 };
  stepBreakout(game, 0.02);
  assert.equal(brick.alive, false);
  assert.equal(game.score, 10);
  assert.ok(game.ball.vy < 0);
});

test('missing the paddle loses exactly one life and waits for a fresh launch', () => {
  const game = running();
  game.ball.x = game.ball.radius + 1;
  game.ball.y = game.height - 5;
  game.ball.vy = 300;
  stepBreakout(game, 0.1);
  assert.equal(game.lives, 2);
  assert.equal(game.status, 'ready');
  for (let i = 0; i < 10; i++) stepBreakout(game, 0.1);
  assert.equal(game.lives, 2);
  assert.equal(game.ball.vy, 0);
});

test('third lost ball ends the game and cannot relaunch', () => {
  const game = running();
  for (let life = 0; life < 3; life++) {
    game.ball.y = game.height + 20;
    stepBreakout(game, 0.01);
    launchBall(game);
  }
  assert.equal(game.lives, 0);
  assert.equal(game.status, 'gameover');
});

test('clearing the final brick waits for the next level and preserves the score and lives', () => {
  const game = running();
  const brick = game.bricks[0];
  for (const other of game.bricks.slice(1)) other.alive = false;
  game.ball = { ...game.ball, x: brick.x + brick.width / 2, y: brick.y - 9, vx: 0, vy: 320 };
  stepBreakout(game, 0.025);
  assert.equal(game.status, 'cleared');
  const speed = game.speed;
  nextBreakoutLevel(game);
  assert.equal(game.level, 2);
  assert.equal(game.status, 'ready');
  assert.equal(game.score, 10);
  assert.equal(game.lives, 3);
  assert.ok(game.speed > speed);
  assert.ok(game.bricks.every(brick => brick.alive));
});

test('pause freezes the ball until an explicit resume', () => {
  const game = running();
  pauseBreakout(game);
  const { x, y } = game.ball;
  stepBreakout(game, 0.1);
  assert.equal(game.ball.x, x);
  assert.equal(game.ball.y, y);
  assert.equal(game.status, 'paused');
  resumeBreakout(game);
  stepBreakout(game, 0.01);
  assert.equal(game.status, 'running');
  assert.notEqual(game.ball.y, y);
});
