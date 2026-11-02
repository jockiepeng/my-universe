/** Native compatibility clicks may be suppressed after a canvas drag. Handle a
 * short touch release directly and ignore only its following compatibility click. */
export function bindAction(button: HTMLButtonElement, action: () => void) {
  let touch: { id: number; x: number; y: number } | null = null;
  let lastTouch = -Infinity;
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && event.isPrimary && !button.disabled) touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  button.addEventListener('pointercancel', () => { touch = null; });
  button.addEventListener('pointerup', event => {
    const start = touch;
    touch = null;
    if (!start || event.pointerId !== start.id) return;
    lastTouch = performance.now();
    const bounds = button.getBoundingClientRect();
    if (button.disabled || Math.max(Math.abs(event.clientX - start.x), Math.abs(event.clientY - start.y)) > 12 || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    action();
  });
  button.addEventListener('click', event => {
    // Keyboard activation has detail=0 and remains available immediately.
    if (button.disabled || (event.detail > 0 && performance.now() - lastTouch < 750)) return;
    action();
  });
}
