/** Logical coordinates never change with CSS size or device pixel ratio. */
export function createBreakout() {
  const game = {
    width: 720, height: 560, level: 1, score: 0, lives: 3, speed: 320,
    status: 'ready',
    paddle: { x: 305, y: 516, width: 110, height: 12 },
    ball: { x: 360, y: 507, radius: 7, vx: 0, vy: 0 },
    bricks: /** @type {{id:number,row:number,x:number,y:number,width:number,height:number,alive:boolean}[]} */ ([]),
  };
  fillBricks(game);
  dockBall(game);
  return game;
}

function fillBricks(game) {
  const columns = 9;
  const rows = 5 + Math.min(game.level - 1, 2);
  const width = (game.width - 60 - (columns - 1) * 8) / columns;
  game.bricks = Array.from({ length: rows * columns }, (_, id) => ({
    id, row: Math.floor(id / columns),
    x: 30 + (id % columns) * (width + 8),
    y: 64 + Math.floor(id / columns) * 30,
    width, height: 22, alive: true,
  }));
}

function dockBall(game) {
  game.ball.x = game.paddle.x + game.paddle.width / 2;
  game.ball.y = game.paddle.y - game.ball.radius - 2;
  game.ball.vx = 0;
  game.ball.vy = 0;
}

/** Move by paddle center; waiting balls remain attached. */
export function movePaddle(game, centerX) {
  if (game.status !== 'ready' && game.status !== 'running') return;
  game.paddle.x = Math.max(0, Math.min(game.width - game.paddle.width, centerX - game.paddle.width / 2));
  if (game.status === 'ready') dockBall(game);
}

export function launchBall(game) {
  if (game.status !== 'ready') return;
  game.status = 'running';
  game.ball.vx = game.speed * 0.28;
  game.ball.vy = -Math.sqrt(game.speed ** 2 - game.ball.vx ** 2);
}

export function pauseBreakout(game) {
  if (game.status === 'running') game.status = 'paused';
}

export function resumeBreakout(game) {
  if (game.status === 'paused') game.status = 'running';
}

export function nextBreakoutLevel(game) {
  if (game.status !== 'cleared') return;
  game.level++;
  game.speed = Math.min(760, 320 + (game.level - 1) * 42);
  game.paddle.width = Math.max(78, 110 - (game.level - 1) * 4);
  game.paddle.x = (game.width - game.paddle.width) / 2;
  game.status = 'ready';
  fillBricks(game);
  dockBall(game);
}

function collideBrick(ball, brick, previousX, previousY) {
  const right = brick.x + brick.width;
  const bottom = brick.y + brick.height;
  const nearestX = Math.max(brick.x, Math.min(right, ball.x));
  const nearestY = Math.max(brick.y, Math.min(bottom, ball.y));
  if ((ball.x - nearestX) ** 2 + (ball.y - nearestY) ** 2 > ball.radius ** 2) return false;

  // Use the previous side of entry before falling back to penetration depth.
  if (previousY + ball.radius <= brick.y && ball.vy > 0) {
    ball.y = brick.y - ball.radius;
    ball.vy = -Math.abs(ball.vy);
  } else if (previousY - ball.radius >= bottom && ball.vy < 0) {
    ball.y = bottom + ball.radius;
    ball.vy = Math.abs(ball.vy);
  } else if (previousX + ball.radius <= brick.x && ball.vx > 0) {
    ball.x = brick.x - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  } else if (previousX - ball.radius >= right && ball.vx < 0) {
    ball.x = right + ball.radius;
    ball.vx = Math.abs(ball.vx);
  } else {
    const xDepth = Math.min(ball.x + ball.radius - brick.x, right - ball.x + ball.radius);
    const yDepth = Math.min(ball.y + ball.radius - brick.y, bottom - ball.y + ball.radius);
    if (xDepth < yDepth) {
      ball.x = ball.x < brick.x + brick.width / 2 ? brick.x - ball.radius : right + ball.radius;
      ball.vx *= -1;
    } else {
      ball.y = ball.y < brick.y + brick.height / 2 ? brick.y - ball.radius : bottom + ball.radius;
      ball.vy *= -1;
    }
  }
  return true;
}

/** Advance no more than 100ms, subdivided by both time and distance to avoid tunneling. */
export function stepBreakout(game, seconds) {
  if (game.status !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  const ball = game.ball;
  const paddle = game.paddle;
  while (remaining > 1e-8 && game.status === 'running') {
    const dt = Math.min(remaining, 1 / 240, ball.radius * 0.45 / Math.max(1, Math.hypot(ball.vx, ball.vy)));
    remaining -= dt;
    const previousX = ball.x;
    const previousY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
    if (ball.x > game.width - ball.radius) { ball.x = game.width - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.radius) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }

    if (ball.vy > 0 && previousY + ball.radius <= paddle.y && ball.y + ball.radius >= paddle.y && ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width) {
      const offset = Math.max(-1, Math.min(1, (ball.x - paddle.x - paddle.width / 2) / (paddle.width / 2)));
      const angle = offset * Math.PI / 3;
      ball.vx = game.speed * Math.sin(angle);
      ball.vy = -game.speed * Math.cos(angle);
      ball.y = paddle.y - ball.radius;
    }

    for (const brick of game.bricks) {
      if (!brick.alive || !collideBrick(ball, brick, previousX, previousY)) continue;
      brick.alive = false;
      game.score += 10;
      if (!game.bricks.some(other => other.alive)) game.status = 'cleared';
      break;
    }
    if (ball.y - ball.radius > game.height) {
      game.lives--;
      game.status = game.lives > 0 ? 'ready' : 'gameover';
      dockBall(game);
    }
  }
}
