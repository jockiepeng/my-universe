const bars = [
  { element: document.querySelector<HTMLElement>('.u-header-shell'), property: '--u-header-height' },
];
const reserveSpace = () => {
  for (const { element, property } of bars) {
    if (element) document.documentElement.style.setProperty(property, `${Math.ceil(element.getBoundingClientRect().height)}px`);
  }
};
reserveSpace();
if (typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(reserveSpace);
  bars.forEach(({ element }) => { if (element) observer.observe(element); });
} else window.addEventListener('resize', reserveSpace);
window.addEventListener('pageshow', reserveSpace);
