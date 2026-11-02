import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance } from '../src/lib/appearance.mjs';

test('malformed stored data restores safe appearance defaults', () => {
  for (const value of [null, [], 'invalid', { scene: '__proto__', theme: 'unknown' }]) {
    assert.deepEqual(normalizeAppearance(value), { scene: 'daily', opening: 'daily', selectionDate: null, theme: 'auto', motion: true });
  }
});

test('scene is independent of light/dark mode and motion can stay off', () => {
  assert.deepEqual(normalizeAppearance({ scene: 'ocean', opening: 'portal', selectionDate: '2026-11-02', theme: 'dark', motion: false }), { scene: 'ocean', opening: 'portal', selectionDate: '2026-11-02', theme: 'dark', motion: false });
  assert.deepEqual(normalizeAppearance({ scene: 'beach', theme: 'light', motion: 'no' }), { scene: 'daily', opening: 'daily', selectionDate: null, theme: 'light', motion: true });
});
