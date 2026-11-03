const toggle = document.querySelector<HTMLButtonElement>('[data-header-menu-toggle]');
const controls = document.querySelector<HTMLElement>('[data-header-controls]');
if (toggle && controls) {
  const close = () => {
    controls.querySelector<HTMLButtonElement>('[data-clock-toggle][aria-expanded="true"]')?.click();
    controls.querySelector<HTMLButtonElement>('[data-scene-toggle][aria-expanded="true"]')?.click();
    controls.removeAttribute('data-open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    if (controls.hasAttribute('data-open')) close();
    else {
      controls.setAttribute('data-open', '');
      toggle.setAttribute('aria-expanded', 'true');
    }
  });
  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Node && !controls.contains(event.target) && !toggle.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && controls.hasAttribute('data-open') && !document.querySelector('dialog[open]')) {
      close(); toggle.focus();
    }
  });
  controls.querySelectorAll('nav a').forEach(link => link.addEventListener('click', close));
  matchMedia('(max-width: 1000px)').addEventListener('change', close);
}
