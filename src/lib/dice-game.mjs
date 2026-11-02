export const DEFAULT_COINS = 1000;
export const MAX_COINS = 1000000;
export const STORAGE_KEY = 'little-universe-dice-v1';
export const TOTAL_ODDS = Object.freeze({ 4: 50, 5: 18, 6: 14, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 14, 16: 18, 17: 50 });

export function createGame(initialCoins = DEFAULT_COINS) {
  if (!Number.isInteger(initialCoins) || initialCoins < 1 || initialCoins > MAX_COINS) throw new Error('初始金币请输入 1～1,000,000 的整数。');
  return { version: 1, initialCoins, balance: initialCoins, rounds: [] };
}

export function getOutcome(dice) {
  if (!Array.isArray(dice) || dice.length !== 3 || dice.some(value => !Number.isInteger(value) || value < 1 || value > 6)) throw new Error('需要三颗 1～6 点的骰子。');
  const total = dice.reduce((sum, value) => sum + value, 0);
  return { total, size: total <= 10 ? 'small' : 'big', triple: dice.every(value => value === dice[0]) };
}

function settle(balance, bets, dice, id) {
  const outcome = getOutcome(dice);
  if (!bets || typeof bets !== 'object' || Array.isArray(bets) || Object.keys(bets).length === 0) throw new Error('请先选择下注位置。');
  let stake = 0, payout = 0;
  for (const [spot, amount] of Object.entries(bets)) {
    if (!(spot === 'small' || spot === 'big' || Object.hasOwn(TOTAL_ODDS, spot))) throw new Error('下注位置无效。');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('下注金币必须是正整数。');
    stake += amount;
    const won = spot === 'small' || spot === 'big' ? !outcome.triple && outcome.size === spot : outcome.total === Number(spot);
    if (won) payout += amount * ((TOTAL_ODDS[spot] ?? 1) + 1);
  }
  if (!Number.isSafeInteger(stake) || stake > balance) throw new Error('金币不足，请减少下注或重新开始。');
  const nextBalance = balance - stake + payout;
  if (!Number.isSafeInteger(nextBalance)) throw new Error('金币已达到可计算上限，请减少下注或重新开始。');
  return { id, dice: [...dice], bets: { ...bets }, stake, payout, net: payout - stake, balance: nextBalance };
}

export function playRound(state, bets, dice) {
  const round = settle(state.balance, bets, dice, state.rounds.length + 1);
  return { ...state, balance: round.balance, rounds: [...state.rounds, round] };
}

export function getStatistics(state) {
  const counts = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 3, 0]));
  let wins = 0, small = 0, big = 0, triples = 0;
  for (const round of state.rounds) {
    const outcome = getOutcome(round.dice);
    counts[outcome.total]++;
    if (round.net > 0) wins++;
    if (outcome.triple) triples++; else if (outcome.size === 'small') small++; else big++;
  }
  const maxCount = Math.max(...Object.values(counts));
  return { roundCount: state.rounds.length, wins, net: state.balance - state.initialCoins, small, big, triples, counts, maxCount, mostFrequent: maxCount ? Object.keys(counts).filter(total => counts[total] === maxCount).map(Number) : [] };
}

export function restoreGame(raw) {
  try {
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || !Array.isArray(saved.rounds)) return null;
    const state = createGame(saved.initialCoins);
    for (const recorded of saved.rounds) {
      const round = settle(state.balance, recorded.bets, recorded.dice, state.rounds.length + 1);
      if (['id', 'stake', 'payout', 'net', 'balance'].some(key => recorded[key] !== round[key])) return null;
      state.rounds.push(round);
      state.balance = round.balance;
    }
    return saved.balance === state.balance ? state : null;
  } catch { return null; }
}

export function rollDice() {
  // Rejection sampling avoids modulo bias: 252 is evenly divisible by six.
  const dice = [];
  const bytes = new Uint8Array(1);
  while (dice.length < 3) {
    globalThis.crypto.getRandomValues(bytes);
    if (bytes[0] < 252) dice.push(bytes[0] % 6 + 1);
  }
  return dice;
}
