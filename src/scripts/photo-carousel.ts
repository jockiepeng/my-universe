document.querySelectorAll<HTMLElement>('[data-photo-carousel]').forEach(carousel => {
  const track = carousel.querySelector<HTMLElement>('[data-photo-track]');
  const controls = carousel.querySelector<HTMLElement>('[data-photo-controls]');
  const previous = carousel.querySelector<HTMLButtonElement>('[data-photo-prev]');
  const next = carousel.querySelector<HTMLButtonElement>('[data-photo-next]');
  const position = carousel.querySelector<HTMLElement>('[data-photo-position]');
  if (!track || !controls || !previous || !next || !position) return;

  const count = track.children.length;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let width = track.clientWidth;
  let frame = 0;

  function update() {
    if (!track || !previous || !next || !position || !track.clientWidth) return;
    index = Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)));
    position.textContent = String(index + 1);
    previous.disabled = index === 0;
    next.disabled = index === count - 1;
  }

  function move(target: number) {
    track?.scrollTo({ left:Math.max(0, Math.min(count - 1, target)) * track.clientWidth, behavior:reduced.matches ? 'auto' : 'smooth' });
  }

  previous.addEventListener('click', () => move(index - 1));
  next.addEventListener('click', () => move(index + 1));
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive:true });
  track.addEventListener('keydown', event => {
    const targets: Record<string, number> = { ArrowLeft:index - 1, ArrowRight:index + 1, Home:0, End:count - 1 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    if (event.target !== track) track.focus({ preventScroll:true });
    move(targets[event.key]);
  });
  new ResizeObserver(() => {
    if (track.clientWidth === width) return;
    width = track.clientWidth;
    track.scrollTo({ left:index * width, behavior:'instant' });
    update();
  }).observe(track);
  update();
  controls.hidden = false;
});
