// 2027 lunar new year: https://www.info.gov.hk/gia/general/202605/15/P2026051400300.htm
export const countdownTargets = [
  { id: 'year-2027', label: '距 2027 元旦', dateLabel: '2027.01.01', target: '2027-01-01T00:00:00+08:00', reachedLabel: '2027 已经到来' },
  { id: 'spring-2027', label: '距 2027 农历新年', dateLabel: '2027.02.06', target: '2027-02-06T00:00:00+08:00', reachedLabel: '2027 农历新年已到' },
];

export function getCountdown(target, now = new Date()) {
  const remaining = new Date(target).getTime() - now.getTime();
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds % 86400 / 3600),
    minutes: Math.floor(seconds % 3600 / 60),
    seconds: seconds % 60,
    reached: remaining <= 0,
  };
}
