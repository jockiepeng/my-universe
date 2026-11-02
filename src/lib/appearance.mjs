export function normalizeAppearance(input) {
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    scene: ['galaxy', 'aurora', 'ocean'].includes(data.scene) ? data.scene : 'daily',
    opening: ['particles', 'portal'].includes(data.opening) ? data.opening : 'daily',
    selectionDate: typeof data.selectionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.selectionDate) ? data.selectionDate : null,
    theme: ['auto', 'light', 'dark'].includes(data.theme) ? data.theme : 'auto',
    motion: typeof data.motion === 'boolean' ? data.motion : true,
  };
}
