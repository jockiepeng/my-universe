export function readJSON(key: string): unknown | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

export function writeJSON(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function readNumber(key: string, fallback = 0): number {
  const value = readJSON(key);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function writeNumber(key: string, value: number): boolean {
  return Number.isFinite(value) && value >= 0 && writeJSON(key, value);
}
