import { createBreakout, movePaddle, launchBall, stepBreakout, pauseBreakout, resumeBreakout, nextBreakoutLevel } from '../lib/breakout.mjs';
import { readNumber, writeNumber } from '../lib/arcade-storage';
import { bindAction } from '../lib/arcade-input';

const root = document.querySelector<HTMLElement>('[data-arcade="breakout"]');
if (root) initializeBreakout(root);

function initializeBreakout(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-breakout-canvas]');
  const start = root.querySelector<HTMLButtonElement>('[data-breakout-start]');
  const pause = root.querySelector<HTMLButtonElement>('[data-breakout-pause]');
  const fresh = root.querySelector<HTMLButtonElement>('[data-breakout-new]');
  const message = root.querySelector<HTMLElement>('[data-breakout-message]');
  const save = root.querySelector<HTMLElement>('[data-breakout-save]');
  if (!canvas || !start || !pause || !fresh || !message || !save) return;
  const context = canvas.getContext('2d');
  if (!context) { message.textContent = '此浏览器暂不支持 Canvas，请换一个浏览器再试。'; return; }
  const board = canvas;
  const ctx = context;
  const startButton = start;
  const pauseButton = pause;
  const newButton = fresh;
  const statusMessage = message;
  const saveMessage = save;
  const bestKey = 'my-universe.breakout.best.v1';
  let game = createBreakout();
  let best = readNumber(bestKey);
  let storageOK = writeNumber(bestKey, best);
  let frame = 0;
  let lastTime = 0;
  let previousStatus = '';
  let savedScore = 0;
  const pressedKeys = new Set<string>();
  const pointers = new Map<number, 'left' | 'right'>();
  let dragging: number | null = null;
  const directionButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-breakout-direction]'));
  const scoreElement = root.querySelector<HTMLElement>('[data-breakout-score]');
  const bestElement = root.querySelector<HTMLElement>('[data-breakout-best]');
  const levelElement = root.querySelector<HTMLElement>('[data-breakout-level]');
  const livesElement = root.querySelector<HTMLElement>('[data-breakout-lives]');
  const stars = Array.from({ length: 42 }, (_, i) => ({ x: (i * 137 + 43) % 720, y: (i * 97 + 19) % 560, r: i % 5 === 0 ? 1.5 : 0.8 }));

  function setText(element: HTMLElement | null, value: string) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function sync() {
    if (game.score > best) {
      best = game.score;
      if (game.score !== savedScore) { storageOK = writeNumber(bestKey, best) && storageOK; savedScore = game.score; }
    }
    setText(scoreElement, String(game.score));
    setText(bestElement, String(best));
    setText(levelElement, String(game.level).padStart(2, '0'));
    setText(livesElement, String(game.lives));
    root.dataset.status = game.status;
    startButton.disabled = game.status === 'running';
    startButton.textContent = game.status === 'paused' ? '继续' : game.status === 'cleared' ? '下一关' : game.status === 'gameover' ? '再玩一局' : game.lives === 3 && game.level === 1 ? '开始 / 发球' : '发球';
    pauseButton.disabled = game.status !== 'running' && game.status !== 'paused';
    pauseButton.textContent = game.status === 'paused' ? '继续' : '暂停';
    newButton.disabled = false;
    directionButtons.forEach(button => {
      button.disabled = game.status !== 'ready' && game.status !== 'running';
      button.toggleAttribute('data-held', [...pointers.values()].includes(button.dataset.breakoutDirection as 'left' | 'right'));
    });
    setText(saveMessage, storageOK ? '最高分自动保存在此浏览器。' : '浏览器暂时无法保存记录，当前游戏和最高分仍可正常显示。');
    if (previousStatus !== game.status) {
      const messages: Record<string, string> = {
        ready: game.lives < 3 ? `还有 ${game.lives} 条生命。调整挡板，点击「发球」再试一次。` : `第 ${game.level} 关准备好了。移动挡板，点击「${game.level === 1 ? '开始 / 发球' : '发球'}」出发。`,
        running: '接住星光！击中挡板两侧可以改变反弹方向。',
        paused: '已暂停。点击「继续」或聚焦画布后按空格接着玩。',
        cleared: `第 ${game.level} 关完成！点击「下一关」进入更快的星域。`,
        gameover: `本次获得 ${game.score} 分。星光暂歇，点击「再玩一局」重新出发。`,
      };
      statusMessage.textContent = messages[game.status];
      previousStatus = game.status;
    }
  }

  function roundedRect(x: number, y: number, width: number, height: number, radius: number, fill: string) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function draw() {
    ctx.setTransform(board.width / game.width, 0, 0, board.height / game.height, 0, 0);
    const background = ctx.createLinearGradient(0, 0, 720, 560);
    background.addColorStop(0, '#142f48'); background.addColorStop(1, '#071a2b');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 720, 560);
    for (const star of stars) {
      ctx.fillStyle = '#edf5ff35'; ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#edf5ff06'; ctx.lineWidth = 1;
    for (let x = 40; x < 720; x += 40) { ctx.beginPath(); ctx.moveTo(x, 240); ctx.lineTo(x, 560); ctx.stroke(); }
    for (let y = 240; y < 560; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(720, y); ctx.stroke(); }
    ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillStyle = '#b8cbdc'; ctx.textAlign = 'left';
    ctx.fillText(`第 ${game.level} 关`, 30, 36);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8fa9bf';
    ctx.fillText(`剩余 ${game.bricks.filter(brick => brick.alive).length} 块`, 690, 36);
    const colors = ['#efad9b', '#ed9685', '#cb8192', '#a391ba', '#83a9c5', '#79b7be', '#9ccabf'];
    for (const brick of game.bricks) {
      if (!brick.alive) continue;
      roundedRect(brick.x, brick.y + 3, brick.width, brick.height, 4, '#00000030');
      roundedRect(brick.x, brick.y, brick.width, brick.height, 4, colors[brick.row % colors.length]);
      roundedRect(brick.x + 4, brick.y + 3, brick.width - 8, 2, 1, '#ffffff38');
    }
    // The landing guide makes the launch location clear without animation.
    if (game.status === 'ready') {
      ctx.save(); ctx.strokeStyle = '#ed96855c'; ctx.setLineDash([4, 7]);
      ctx.beginPath(); ctx.moveTo(game.ball.x, game.ball.y - 20); ctx.lineTo(game.ball.x + 18, game.ball.y - 83); ctx.stroke(); ctx.restore();
    }
    roundedRect(game.paddle.x - 5, game.paddle.y - 4, game.paddle.width + 10, game.paddle.height + 8, 12, '#ed968518');
    roundedRect(game.paddle.x, game.paddle.y, game.paddle.width, game.paddle.height, 6, '#ed9685');
    roundedRect(game.paddle.x + 10, game.paddle.y + 2, game.paddle.width - 20, 2, 1, '#fff0e7b3');
    ctx.fillStyle = '#edf5ff16'; ctx.beginPath(); ctx.arc(game.ball.x, game.ball.y, game.ball.radius + 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3e6'; ctx.beginPath(); ctx.arc(game.ball.x, game.ball.y, game.ball.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ed96853b'; ctx.fillRect(30, 548, 660, 1);
    if (game.status !== 'running') {
      const paused = game.status === 'paused';
      if (paused) { ctx.fillStyle = '#071a2bbd'; ctx.fillRect(0, 0, 720, 560); }
      roundedRect(155, 284, 410, 113, 14, '#081b2de8');
      ctx.textAlign = 'center'; ctx.fillStyle = '#edf5ff'; ctx.font = '600 26px "Segoe UI","Microsoft YaHei",sans-serif';
      const heading = paused ? '星光暂停' : game.status === 'cleared' ? '星域已点亮' : game.status === 'gameover' ? '这次航行已结束' : '准备发射';
      ctx.fillText(heading, 360, 328);
      ctx.fillStyle = '#bacbd9'; ctx.font = '15px "Segoe UI","Microsoft YaHei",sans-serif';
      ctx.fillText(paused ? '点击继续，接住下一道星光' : game.status === 'cleared' ? '点击下一关，继续探索' : game.status === 'gameover' ? `获得 ${game.score} 分 · 再玩一局` : '先移动挡板，再点击发球或按空格', 360, 362);
    }
  }

  function direction() {
    const left = pressedKeys.has('arrowleft') || pressedKeys.has('a') || [...pointers.values()].includes('left');
    const right = pressedKeys.has('arrowright') || pressedKeys.has('d') || [...pointers.values()].includes('right');
    return Number(right) - Number(left);
  }

  function stopLoop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  function startLoop() { if (!frame) { lastTime = 0; frame = requestAnimationFrame(tick); } }
  function tick(time: number) {
    frame = 0;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    if (game.status === 'running' || game.status === 'ready') {
      movePaddle(game, game.paddle.x + game.paddle.width / 2 + direction() * 490 * dt);
      stepBreakout(game, dt);
    }
    sync(); draw();
    if (game.status === 'running' || (game.status === 'ready' && direction())) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function clearInput() {
    pressedKeys.clear(); pointers.clear(); dragging = null;
    directionButtons.forEach(button => button.removeAttribute('data-held'));
  }

  function reset() {
    stopLoop(); clearInput(); game = createBreakout(); previousStatus = ''; savedScore = 0;
    sync(); draw(); board.focus({ preventScroll: true });
  }

  function primaryAction() {
    if (game.status === 'gameover') reset();
    else if (game.status === 'cleared') { stopLoop(); clearInput(); nextBreakoutLevel(game); }
    else if (game.status === 'paused') resumeBreakout(game);
    else if (game.status === 'ready') launchBall(game);
    sync(); draw();
    if (game.status === 'running') startLoop();
    board.focus({ preventScroll: true });
  }

  function togglePause() {
    if (game.status === 'paused') { resumeBreakout(game); startLoop(); }
    else if (game.status === 'running') { pauseBreakout(game); stopLoop(); clearInput(); }
    sync(); draw();
  }

  function suspend() {
    clearInput();
    if (game.status === 'running') pauseBreakout(game);
    stopLoop(); sync(); draw();
  }

  function followPointer(event: PointerEvent) {
    if (event.pointerType !== 'mouse' && dragging !== event.pointerId) return;
    const rect = board.getBoundingClientRect();
    if (rect.width > 0) movePaddle(game, (event.clientX - rect.left) / rect.width * game.width);
    draw();
  }
  board.addEventListener('pointerdown', event => {
    dragging = event.pointerId; board.setPointerCapture(event.pointerId); board.focus({ preventScroll: true }); followPointer(event);
  });
  board.addEventListener('pointermove', followPointer);
  board.addEventListener('pointerup', event => { if (dragging === event.pointerId) dragging = null; });
  board.addEventListener('pointercancel', () => { dragging = null; });
  board.addEventListener('lostpointercapture', () => { dragging = null; });
  directionButtons.forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      pointers.set(event.pointerId, button.dataset.breakoutDirection as 'left' | 'right');
      button.setPointerCapture(event.pointerId); board.focus({ preventScroll: true }); sync(); startLoop();
    });
    const release = (event: PointerEvent) => { pointers.delete(event.pointerId); sync(); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('click', event => {
      if (event.detail !== 0) return;
      movePaddle(game, game.paddle.x + game.paddle.width / 2 + (button.dataset.breakoutDirection === 'left' ? -55 : 55)); draw();
    });
  });
  root.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
      event.preventDefault();
      if (game.status === 'running' || game.status === 'ready') { pressedKeys.add(key); startLoop(); }
    } else if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      if (event.repeat) return;
      if (game.status === 'running' || game.status === 'paused') togglePause(); else primaryAction();
    }
  });
  window.addEventListener('keyup', event => { pressedKeys.delete(event.key.toLowerCase()); });
  root.addEventListener('focusout', event => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    if (pressedKeys.size || pointers.size) clearInput();
  });
  bindAction(startButton, primaryAction);
  bindAction(pauseButton, () => { togglePause(); board.focus({ preventScroll: true }); });
  bindAction(newButton, reset);
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });

  function resize() {
    const width = board.getBoundingClientRect().width;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    board.width = Math.max(1, Math.round(width * dpr));
    board.height = Math.max(1, Math.round(width * game.height / game.width * dpr));
    draw();
  }
  new ResizeObserver(resize).observe(board);
  window.addEventListener('resize', resize);
  sync(); resize(); root.dataset.ready = 'true';
}
