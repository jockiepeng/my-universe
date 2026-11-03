import test from 'node:test';
import assert from 'node:assert/strict';
import { formatVisitorLocation } from '../src/lib/visitor-location.mjs';

test('formats country in Chinese and preserves the provider region and city', () => {
  assert.equal(formatVisitorLocation({ country_code: 'US', region: 'California', city: 'Los Angeles' }), '美国 · California · Los Angeles');
  assert.equal(formatVisitorLocation({ country_code: 'CN', region: '广东省', city: '深圳市' }), '中国 · 广东省 · 深圳市');
});

test('country-only responses work and repeated locations appear once', () => {
  assert.equal(formatVisitorLocation({ country_code: 'JP' }), '日本');
  assert.equal(formatVisitorLocation({ country_code: 'SG', region: ' Singapore ', city: 'Singapore' }), '新加坡 · Singapore');
});

test('errors and missing or unknown country codes cannot become a location', () => {
  for (const value of [null, [], 'China', {}, { error: true, country_code: 'US' }, { country_code: 'XX' }, { country_code: 'ZZ' }, { country_code: 'USA' }]) {
    assert.equal(formatVisitorLocation(value), null);
  }
});

test('ignores invalid optional regions and never displays provider markup or control characters', () => {
  assert.equal(formatVisitorLocation({ country_code: 'CN', region: '<img src=x>', city: '深圳\n市' }), '中国');
  assert.equal(formatVisitorLocation({ country_code: 'US', region: { name: 'California' }, city: 'x'.repeat(81) }), '美国');
  assert.equal(formatVisitorLocation({ country_code: 'US', region: 'unknown', city: '-' }), '美国');
});
