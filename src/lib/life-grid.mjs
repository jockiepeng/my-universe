const DAY_MS = 86_400_000;

export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDay(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) throw new RangeError('请输入有效的出生日期。');
  const stamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(stamp) || formatDay(stamp / DAY_MS) !== value) throw new RangeError('请输入有效的出生日期。');
  return stamp / DAY_MS;
}

export function calculateLife(birth, years, today = localToday()) {
  const birthDay = parseDay(birth), todayDay = parseDay(today);
  if (birthDay > todayDay) throw new RangeError('出生日期不能晚于今天。');
  if (typeof years !== 'number' || !Number.isInteger(years) || years < 1 || years > 120) throw new RangeError('预计寿命请填写 1 到 120 之间的整数。');
  const endYear = Number(birth.slice(0, 4)) + years;
  if (endYear > 9999) throw new RangeError('日期超出可计算范围。');
  const leap = endYear % 4 === 0 && (endYear % 100 !== 0 || endYear % 400 === 0);
  const anniversary = birth.slice(5) === '02-29' && !leap ? '02-28' : birth.slice(5);
  const endDay = parseDay(`${String(endYear).padStart(4, '0')}-${anniversary}`);
  const totalDays = endDay - birthDay;
  const elapsedDays = Math.min(totalDays, todayDay - birthDay);
  const totalWeeks = Math.ceil(totalDays / 7);
  const elapsedWeeks = elapsedDays === totalDays ? totalWeeks : Math.floor(elapsedDays / 7);
  return { birthDay, endDay, todayDay, totalDays, elapsedDays, remainingDays: totalDays - elapsedDays, totalWeeks, elapsedWeeks, remainingWeeks: totalWeeks - elapsedWeeks };
}

export function cellDetails(life, unit, index) {
  if (unit !== 'day' && unit !== 'week') throw new RangeError('不支持的格子单位。');
  const span = unit === 'day' ? 1 : 7;
  const count = unit === 'day' ? life.totalDays : life.totalWeeks;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError('格子超出范围。');
  const start = life.birthDay + index * span;
  const end = Math.min(start + span, life.endDay);
  const status = end <= life.todayDay ? 'past' : start <= life.todayDay && life.todayDay < end ? 'current' : 'future';
  return { start: formatDay(start), end: formatDay(end - 1), status, days: end - start };
}
