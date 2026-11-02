import test from 'node:test';
import assert from 'node:assert/strict';
import { canCountView } from '../src/lib/services.mjs';

test('only the configured HTTPS production origin can record a view', () => {
  assert.equal(canCountView(true, 'https://jockiepeng.github.io', 'https://jockiepeng.github.io'), true);
  assert.equal(canCountView(false, 'https://jockiepeng.github.io', 'https://jockiepeng.github.io'), false);
  assert.equal(canCountView(true, 'http://localhost:4321', 'https://jockiepeng.github.io'), false);
  assert.equal(canCountView(true, 'https://preview.example.com', 'https://jockiepeng.github.io'), false);
  assert.equal(canCountView(true, 'http://localhost:4321', 'http://localhost:4321'), false);
  assert.equal(canCountView(true, 'file://', 'https://jockiepeng.github.io'), false);
});
