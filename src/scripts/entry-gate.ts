import { normalizeAppearance } from '../lib/appearance.mjs';
import { getDailyMotion, resolveMotion } from '../lib/motion.mjs';
import { t } from '../lib/i18n.mjs';

const entry = document.querySelector<HTMLElement>('[data-entry-gate]');
if (entry) {
  const gate = entry;
  const root = document.documentElement;
  const canvas = gate.querySelector<HTMLCanvasElement>('[data-entry-particles]')!;
  const pen = canvas.getContext('2d');
  const enter = gate.querySelector<HTMLButtonElement>('[data-entry-enter]')!;
  const skip = gate.querySelector<HTMLButtonElement>('[data-entry-skip]')!;
  const title = gate.querySelector<HTMLElement>('#entry-title')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const inertTargets = [...document.querySelectorAll<HTMLElement>('.u-header-shell,.u-page,.u-footer-shell,.u-skip')];
  const previousInert = new Map<HTMLElement, boolean>();
  const sessionKey = `universe-entry-v1:${import.meta.env.BASE_URL}`;
  let points: { x: number; y: number; sx: number; sy: number; phase: number; size: number }[] = [];
  let frame = 0, last = 0, seconds = 0;
  let opening = 'particles', playing = false, active = false;
  let readyTimer: ReturnType<typeof setTimeout>, closeTimer: ReturnType<typeof setTimeout>;

  function configuration() {
    let preferences = normalizeAppearance(null);
    try { preferences = normalizeAppearance(JSON.parse(localStorage.getItem('little-universe-appearance-v1') || 'null')); } catch { /* Optional storage. */ }
    const resolved = resolveMotion(preferences);
    // The live DOM also covers manual changes when localStorage is unavailable.
    if (root.dataset.motionDay === resolved.dateKey && ['particles', 'portal'].includes(root.dataset.opening || '')) resolved.opening = root.dataset.opening!;
    const enabled = root.dataset.motionDay === resolved.dateKey ? root.dataset.motion !== 'off' : preferences.motion;
    return { ...resolved, motion: enabled && !reduced.matches };
  }
  function progress(warp: number) { window.dispatchEvent(new CustomEvent('universe:entry-progress', { detail: { warp } })); }
  function ready() {
    playing = false; cancelAnimationFrame(frame); clearTimeout(readyTimer);
    gate.classList.add('is-revealed', 'is-ready'); gate.dataset.state = 'ready';
    gate.querySelector<HTMLElement>('[data-entry-welcome]')!.textContent = '欢迎来到';
    enter.hidden = false; pen?.clearRect(0, 0, canvas.width, canvas.height); progress(0);
  }
  function makePoints() {
    const width = innerWidth, height = innerHeight;
    canvas.width = width; canvas.height = height; points = [];
    if (!pen || !active || opening !== 'particles' || !configuration().motion) return;
    const off = document.createElement('canvas'); off.width = width; off.height = height;
    const paint = off.getContext('2d'); if (!paint) return;
    const rect = title.getBoundingClientRect(), font = getComputedStyle(title);
    paint.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
    paint.textAlign = 'center'; paint.textBaseline = 'middle'; paint.fillStyle = '#fff';
    paint.fillText(t(title.dataset.entryTitle || ''), width / 2, rect.y + rect.height / 2);
    const pixels = paint.getImageData(0, 0, width, height).data, step = width < 700 ? 5 : 7;
    for (let y = Math.max(0, Math.floor(rect.y)); y < Math.min(height, rect.bottom); y += step) {
      for (let x = 0; x < width; x += step) {
        if (pixels[(y * width + x) * 4 + 3] < 80) continue;
        const angle = Math.random() * Math.PI * 2, radius = Math.max(width, height) * (.3 + Math.random() * .6);
        points.push({ x, y, sx: width / 2 + Math.cos(angle) * radius, sy: height * .43 + Math.sin(angle) * radius, phase: Math.random() * 6.28, size: .65 + Math.random() * .8 });
      }
    }
  }
  function paintParticles() {
    if (!pen) return;
    pen.clearRect(0, 0, canvas.width, canvas.height);
    if (opening !== 'particles' || seconds > 3.9) return;
    const ease = 1 - Math.pow(1 - Math.min(1, seconds / 3.1), 3);
    const alpha = Math.min(1, seconds * 2) * (1 - Math.max(0, seconds - 3.1) / .8);
    for (const point of points) {
      const shake = (1 - ease) * 15;
      const x = point.sx + (point.x - point.sx) * ease + Math.sin(seconds * 1.6 + point.phase) * shake;
      const y = point.sy + (point.y - point.sy) * ease + Math.cos(seconds * 1.4 + point.phase) * shake;
      pen.fillStyle = point.phase > 3 ? `rgba(199,235,255,${alpha})` : `rgba(243,217,174,${alpha})`;
      pen.beginPath(); pen.arc(x, y, point.size, 0, Math.PI * 2); pen.fill();
    }
  }
  function tick(now: number) {
    frame = 0; if (!playing || document.hidden) return;
    if (!last || now - last >= 32) {
      seconds += last ? Math.min((now - last) / 1000, .1) : 0; last = now;
      if (seconds > 2.9) gate.classList.add('is-revealed');
      if (seconds > 4.3) { ready(); return; }
      paintParticles(); progress(opening === 'portal' ? Math.sin(seconds / 4.3 * Math.PI) : 0);
    }
    frame = requestAnimationFrame(tick);
  }
  function play() {
    clearTimeout(closeTimer); clearTimeout(readyTimer); cancelAnimationFrame(frame);
    const config = configuration(); opening = config.opening;
    active = true; playing = true; last = 0; seconds = 0;
    gate.hidden = false; gate.className = 'u-entry-gate'; gate.dataset.opening = opening; gate.dataset.state = 'playing';
    enter.hidden = true; root.dataset.entry = 'open';
    for (const target of inertTargets) { if (!previousInert.has(target)) previousInert.set(target, target.inert); target.inert = true; }
    gate.querySelector<HTMLElement>('[data-entry-welcome]')!.textContent = opening === 'particles' ? '让每一个念头，都有自己的轨道' : '穿过星光，抵达自己的小宇宙';
    window.scrollTo({ top: 0, behavior: 'instant' }); makePoints(); skip.focus({ preventScroll: true });
    if (!config.motion) { ready(); return; }
    // Reliable end state even when animation frames are throttled or graphics fail.
    readyTimer = setTimeout(ready, 5500);
    frame = requestAnimationFrame(tick);
  }
  function close() {
    if (!active) return;
    active = false; playing = false; cancelAnimationFrame(frame); clearTimeout(readyTimer); progress(0);
    try { sessionStorage.setItem(sessionKey, getDailyMotion().dateKey); } catch { /* Entry remains usable without storage. */ }
    for (const [target, wasInert] of previousInert) target.inert = wasInert; previousInert.clear();
    delete root.dataset.entry; gate.classList.add('is-leaving'); gate.dataset.state = 'closed';
    document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true });
    closeTimer = setTimeout(() => { gate.hidden = true; }, configuration().motion ? 500 : 0);
  }
  enter.addEventListener('click', close); skip.addEventListener('click', close);
  gate.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const controls = enter.hidden ? [skip] : [skip, enter];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)!.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); skip.focus(); }
    }
  });
  window.addEventListener('universe:replay-entry', play);
  window.addEventListener('universe:appearance', () => { if (active && !configuration().motion) ready(); });
  document.addEventListener('visibilitychange', () => {
    if (!active || !playing) return;
    cancelAnimationFrame(frame); last = 0;
    if (!document.hidden) frame = requestAnimationFrame(tick);
  });
  window.addEventListener('resize', makePoints);
  window.addEventListener('universe:language', makePoints);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); clearTimeout(readyTimer); });
  window.addEventListener('pageshow', () => { if (active && playing) { cancelAnimationFrame(frame); clearTimeout(readyTimer); readyTimer = setTimeout(ready, 5500); last = 0; frame = requestAnimationFrame(tick); } });
  // The head bootstrap owns the initial decision. After a timeout or an early
  // skip, a late module download must not interrupt reading with an opening.
  if (root.dataset.entry === 'pending') play();
  root.dataset.entryInitialized = 'true';
  window.dispatchEvent(new Event('universe:entry-initialized'));
}
