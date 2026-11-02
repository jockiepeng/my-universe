const backToTop = document.querySelector<HTMLElement>('.u-back-to-top');
if (backToTop) {
  const update = () => backToTop.toggleAttribute('data-visible', window.scrollY > 240);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('pageshow', update);
  update();
}
