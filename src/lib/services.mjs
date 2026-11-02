export function canCountView(production, currentOrigin, configuredOrigin) {
  if (!production) return false;
  try {
    const current = new URL(currentOrigin);
    const configured = new URL(configuredOrigin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(current.hostname) || current.hostname.endsWith('.localhost');
    return !local && current.protocol === 'https:' && current.origin === configured.origin;
  } catch { return false; }
}
