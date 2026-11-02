export function normalizeAppearance(input) {
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    scene: ['space', 'beach'].includes(data.scene) ? data.scene : 'space',
    theme: ['auto', 'light', 'dark'].includes(data.theme) ? data.theme : 'auto',
    motion: typeof data.motion === 'boolean' ? data.motion : true,
  };
}
