import test from 'node:test';
import assert from 'node:assert/strict';

import * as game from '../src/lib/dice-game.mjs';

test('a fresh game starts with configurable integer coins and empty history', () => {
  assert.equal(typeof game.createGame, 'function');
  const state = game.createGame(2500);
  assert.equal(state.balance, 2500);
  assert.equal(state.initialCoins, 2500);
  assert.deepEqual(state.rounds, []);
  for (const invalid of [0, -1, 1.5, NaN, Infinity, 1000001, '1000']) {
    assert.throws(() => game.createGame(invalid));
  }
});

test('all 216 outcomes classify correctly and every triple loses size bets', () => {
  assert.equal(typeof game.playRound, 'function');
  let small = 0, big = 0, triples = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
    const dice = [a, b, c];
    const result = game.getOutcome(dice);
    assert.equal(result.total, a + b + c);
    assert.equal(result.size, a + b + c <= 10 ? 'small' : 'big');
    assert.equal(result.triple, a === b && b === c);
    const state = game.playRound(game.createGame(), { small: 10, big: 10 }, dice);
    assert.equal(state.balance, result.triple ? 980 : 1000);
    if (result.triple) triples++; else if (result.size === 'small') small++; else big++;
  }
  assert.deepEqual([small, big, triples], [105, 105, 6]);
});

test('exact totals pay their published net odds plus the returned stake', () => {
  assert.equal(typeof game.playRound, 'function');
  const cases = [[4, 50, [1, 1, 2]], [5, 18, [1, 2, 2]], [6, 14, [2, 2, 2]], [7, 12, [1, 2, 4]], [8, 8, [1, 3, 4]], [9, 6, [3, 3, 3]], [10, 6, [1, 3, 6]], [11, 6, [1, 4, 6]], [12, 6, [4, 4, 4]], [13, 8, [2, 5, 6]], [14, 12, [3, 5, 6]], [15, 14, [5, 5, 5]], [16, 18, [4, 6, 6]], [17, 50, [5, 6, 6]]];
  for (const [total, odds, dice] of cases) {
    const state = game.playRound(game.createGame(), { [total]: 10 }, dice);
    assert.equal(state.balance, 1000 + 10 * odds);
    assert.equal(state.rounds[0].payout, 10 * (odds + 1));
    assert.equal(state.rounds[0].net, 10 * odds);
  }
});

test('multiple spots settle once without mutating the earlier game or bets', () => {
  assert.equal(typeof game.playRound, 'function');
  const initial = game.createGame();
  const bets = { small: 100, 6: 20, 7: 30 };
  const result = game.playRound(initial, bets, [1, 2, 3]);
  assert.equal(result.balance, 1350); // 1000 - 150 + 200 + 300
  assert.deepEqual(initial.rounds, []);
  bets.small = 999;
  assert.equal(result.rounds[0].bets.small, 100);
  const next = game.playRound(result, { big: 50 }, [1, 2, 3]);
  assert.equal(next.balance, 1300);
  assert.deepEqual(next.rounds.map(r => r.id), [1, 2]);
  assert.equal(result.rounds.length, 1);
});

test('invalid stakes and dice cannot spend coins or corrupt a game', () => {
  assert.equal(typeof game.playRound, 'function');
  const state = game.createGame();
  for (const bets of [{}, { small: 0 }, { big: -1 }, { small: 0.5 }, { 3: 1 }, { 18: 1 }, { 19: 1 }, { wat: 1 }, { big: 1001 }, { small: 600, big: 600 }, { small: NaN }, { small: '10' }, { small: Number.MAX_SAFE_INTEGER }]) {
    assert.throws(() => game.playRound(state, bets, [1, 2, 3]));
  }
  for (const dice of [[], [1, 2], [1, 2, 3, 4], [0, 1, 2], [1, 2, 7], [1, 2, 1.5]]) {
    assert.throws(() => game.playRound(state, { small: 10 }, dice));
  }
  const broke = game.playRound(game.createGame(10), { big: 10 }, [1, 2, 3]);
  assert.equal(broke.balance, 0);
  assert.throws(() => game.playRound(broke, { small: 1 }, [1, 2, 3]));
  assert.equal(state.balance, 1000);
});

test('statistics keep tied most frequent totals and reset clears every round', () => {
  assert.equal(typeof game.getStatistics, 'function');
  let state = game.createGame();
  assert.deepEqual(game.getStatistics(state).mostFrequent, []);
  for (const dice of [[1, 2, 3], [1, 3, 3], [2, 2, 2], [1, 2, 4]]) state = game.playRound(state, { small: 10 }, dice);
  const stats = game.getStatistics(state);
  assert.deepEqual(stats.mostFrequent, [6, 7]);
  assert.equal(stats.maxCount, 2);
  assert.equal(stats.roundCount, 4);
  assert.equal(stats.wins, 3);
  assert.equal(stats.net, 20);
  assert.deepEqual([stats.small, stats.big, stats.triples], [3, 0, 1]);
  assert.equal(stats.counts[6], 2);
  assert.deepEqual(game.createGame(500).rounds, []);
});

test('saved games restore exactly and reject malformed or inconsistent balances', () => {
  assert.equal(typeof game.restoreGame, 'function');
  const state = game.playRound(game.createGame(500), { small: 50, 6: 10 }, [1, 2, 3]);
  assert.deepEqual(game.restoreGame(JSON.stringify(state)), state);
  for (const raw of ['{', 'null', '{}', '[]', JSON.stringify({ ...state, version: 88 }), JSON.stringify({ ...state, balance: 99999 }), JSON.stringify({ ...state, rounds: [{ ...state.rounds[0], payout: 99999 }] })]) {
    assert.equal(game.restoreGame(raw), null);
  }
});

test('dice random generation rejects the biased tail and maps bytes to faces', t => {
  const bytes = [252, 255, 0, 5, 7];
  t.mock.method(globalThis.crypto, 'getRandomValues', array => {
    array[0] = bytes.shift();
    return array;
  });
  assert.deepEqual(game.rollDice(), [1, 6, 2]);
  assert.equal(bytes.length, 0);
});
