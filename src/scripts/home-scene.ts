// A fixed, full-viewport homepage scene. No animation library or network assets.
const canvas = document.querySelector<HTMLCanvasElement>('[data-home-scene]');
const ctx = canvas?.getContext('2d');
if (canvas && ctx) {
  const surface = canvas;
  const pen = ctx;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stars = Array.from({ length: 150 }, (_, i) => ({
    x: ((i * 73.37 + 13) % 100) / 100,
    y: ((i * 41.71 + 7) % 100) / 100,
    size: i % 11 === 0 ? 1.8 : .5 + (i % 4) * .25,
  }));
  let width = 1, height = 1, frame = 0, last = 0, elapsed = 0;
  let onScreen = true;
  let pointer = { x: 0, y: 0 };
  function glow(x: number, y: number, radius: number, color: string) {
    const gradient = pen.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
    pen.fillStyle = gradient; pen.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function space(t: number) {
    pen.fillStyle = '#080f27'; pen.fillRect(0, 0, width, height);
    const x = width * .78 + Math.sin(t * .15) * 22 + pointer.x * 8;
    const y = height * .30 + Math.cos(t * .13) * 12 + pointer.y * 6;
    glow(width * .65, height * .7, width * .5, '#433e9466');
    glow(width * .92, height * .1, width * .33, '#167c9b66');
    glow(width * .48 + Math.sin(t * .2) * 30, height * .2, width * .32, '#75467c44');
    for (const [i, star] of stars.entries()) {
      const sx = (star.x * width + t * (1 + i % 3) + width) % width;
      pen.globalAlpha = .38 + .35 * Math.sin(t * .7 + i);
      pen.fillStyle = i % 8 === 0 ? '#f6d9a0' : '#d3eaff';
      pen.beginPath(); pen.arc(sx, star.y * height, star.size, 0, Math.PI * 2); pen.fill();
    }
    pen.globalAlpha = 1;
    const radius = Math.min(width * .13, height * .31);
    glow(x, y, radius * 1.8, '#73a8e326');
    // Elliptical orbits and a moving satellite make the scene visibly alive.
    pen.save(); pen.translate(x, y); pen.rotate(-.4);
    for (let i = 0; i < 3; i++) {
      pen.strokeStyle = ['#91b7e560', '#91b7e52b', '#91b7e519'][i]; pen.lineWidth = 1;
      pen.beginPath(); pen.ellipse(0, 0, radius * (1.9 + i * .45), radius * (.58 + i * .2), 0, 0, Math.PI * 2); pen.stroke();
    }
    const orbit = t * .28;
    pen.fillStyle = '#ffe4a9'; pen.shadowColor = '#ffd68b'; pen.shadowBlur = 12;
    pen.beginPath(); pen.arc(Math.cos(orbit) * radius * 1.9, Math.sin(orbit) * radius * .58, 3, 0, Math.PI * 2); pen.fill();
    pen.restore();
    const planet = pen.createRadialGradient(x - radius * .4, y - radius * .5, radius * .05, x, y, radius);
    planet.addColorStop(0, '#b3d3ec'); planet.addColorStop(.3, '#6f91b2'); planet.addColorStop(.67, '#354f78'); planet.addColorStop(1, '#0c1833');
    pen.fillStyle = planet; pen.beginPath(); pen.arc(x, y, radius, 0, Math.PI * 2); pen.fill();
    // A short meteor every eight seconds, well away from the text.
    const meteor = (t + 2) % 8;
    if (meteor < 1.2) {
      const mx = width * (.55 + meteor * .26), my = height * (.04 + meteor * .3);
      const trail = pen.createLinearGradient(mx - 90, my - 35, mx, my);
      trail.addColorStop(0, 'transparent'); trail.addColorStop(1, '#d7ecff');
      pen.strokeStyle = trail; pen.lineWidth = 1.4; pen.beginPath(); pen.moveTo(mx - 90, my - 35); pen.lineTo(mx, my); pen.stroke();
    }
  }
  function beach(t: number) {
    const horizon = height * .43;
    const sky = pen.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#234865'); sky.addColorStop(.42, '#f3b49b'); sky.addColorStop(.44, '#497e8a'); sky.addColorStop(1, '#b4d2c5');
    pen.fillStyle = sky; pen.fillRect(0, 0, width, height);
    const sx = width * .78, sy = horizon - 25;
    glow(sx, sy, 120, '#ffdb9b77');
    pen.fillStyle = '#ffddac'; pen.beginPath(); pen.arc(sx, sy, 26, 0, Math.PI * 2); pen.fill();
    for (let i = 0; i < 24; i++) {
      const depth = i / 24, y = horizon + depth * depth * height * .6;
      pen.beginPath();
      for (let px = 0; px <= width + 8; px += 8) {
        const py = y + Math.sin(px * (.009 + depth * .014) + t * (1 + depth) + i) * (1 + depth * 8);
        if (px === 0) pen.moveTo(px, py); else pen.lineTo(px, py);
      }
      pen.strokeStyle = `rgba(225,248,235,${.08 + depth * .28})`; pen.lineWidth = 1 + depth; pen.stroke();
      if (i < 18) {
        const shimmer = Math.sin(i * 9 + t * 2) * 15;
        pen.fillStyle = `rgba(255,218,171,${.3 - depth * .2})`;
        pen.fillRect(sx - 10 - i * 2 + shimmer, y, 20 + i * 4, 1.4);
      }
    }
    pen.beginPath(); pen.moveTo(0, height * .92);
    pen.bezierCurveTo(width * .4, height * .8 + Math.sin(t * .5) * 7, width * .68, height * 1.02, width, height * .83);
    pen.lineTo(width, height); pen.lineTo(0, height); pen.closePath();
    pen.fillStyle = '#d8c7a7'; pen.fill(); pen.strokeStyle = '#f1efe0bb'; pen.lineWidth = 4; pen.stroke();
  }
  function draw() {
    if (root.dataset.scene === 'beach') beach(elapsed); else space(elapsed);
  }
  function enabled() { return root.dataset.motion !== 'off' && !reduced.matches && !document.hidden && onScreen; }
  function tick(time: number) {
    frame = 0;
    if (!enabled()) return;
    // Cap drawing to about 30fps, and never fast-forward after a hidden tab.
    if (!last || time - last >= 32) { elapsed += last ? Math.min((time - last) / 1000, .1) : 0; last = time; draw(); }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0; draw();
    surface.dataset.state = enabled() ? 'running' : 'paused';
    if (enabled()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const box = surface.getBoundingClientRect(); width = box.width; height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio);
    pen.setTransform(ratio, 0, 0, ratio, 0, 0); sync();
  }
  new ResizeObserver(resize).observe(surface);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-scene', 'data-motion'] });
  new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; sync(); }).observe(surface);
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !enabled()) return;
    const box = surface.getBoundingClientRect(); pointer = { x: (event.clientX - box.left) / box.width - .5, y: (event.clientY - box.top) / box.height - .5 };
  });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); last = 0; });
  window.addEventListener('pageshow', sync);
  resize();
}
