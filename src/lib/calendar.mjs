export const calendarTimeZone = 'Asia/Shanghai';

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: calendarTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const weekdayFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: calendarTimeZone, weekday: 'long' });

export function getZonedClock(now = new Date(), language = 'zh') {
  const parts = Object.fromEntries(clockFormat.formatToParts(now).map(part => [part.type, part.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  return {
    year, month, day,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    weekday: language === 'en' ? new Intl.DateTimeFormat('en', { timeZone: calendarTimeZone, weekday: 'long' }).format(now) : weekdayFormat.format(now),
    monthLabel: `${year} 年 ${month} 月`,
    dateLabel: language === 'en' ? new Intl.DateTimeFormat('en', { timeZone: calendarTimeZone, month: 'short', day: 'numeric' }).format(now) : `${month} 月 ${day} 日`,
  };
}

export function getMonthCalendar(year, month, todayKey) {
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const number = index - offset + 1;
    const day = number > 0 && number <= count ? number : null;
    const dateKey = day === null ? null : `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, dateKey, today: dateKey !== null && dateKey === todayKey };
  });
  return { weeks: Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7)) };
}

export function shiftMonth(year, month, offset) {
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}
