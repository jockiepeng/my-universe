import { getZonedClock, getMonthCalendar, shiftMonth } from '../lib/calendar.mjs';
import { countdownTargets, getCountdown } from '../lib/countdown.mjs';
import { getLanguage } from '../lib/i18n.mjs';

const snapshotNow = () => getZonedClock(new Date(), getLanguage());

const widget = document.querySelector<HTMLElement>('.u-calendar-widget');
if (widget) {
  const clock = widget.querySelector<HTMLTimeElement>('[data-clock-time]')!;
  const date = widget.querySelector<HTMLElement>('[data-clock-date]')!;
  const month = widget.querySelector<HTMLElement>('[data-calendar-month]')!;
  const caption = widget.querySelector<HTMLElement>('[data-calendar-caption]')!;
  const days = widget.querySelector<HTMLElement>('[data-calendar-days]')!;
  const live = widget.querySelector<HTMLElement>('[data-live-clock]')!;
  const status = widget.querySelector<HTMLElement>('[data-clock-status]')!;
  const details = widget.querySelector<HTMLDetailsElement>('.u-calendar-details')!;
  const control = document.querySelector<HTMLElement>('.u-calendar-control')!;
  const trigger = control.querySelector<HTMLButtonElement>('[data-clock-toggle]')!;
  const compactTime = control.querySelector<HTMLTimeElement>('[data-clock-compact-time]')!;
  const compactDate = control.querySelector<HTMLElement>('[data-clock-compact-date]')!;
  const jump = widget.querySelector<HTMLInputElement>('[data-calendar-jump]')!;
  const previous = widget.querySelector<HTMLButtonElement>('[data-calendar-prev]')!;
  const next = widget.querySelector<HTMLButtonElement>('[data-calendar-next]')!;
  let viewed: { year: number; month: number } | null = null;
  let followToday = true;
  let lastDate = '';
  let timer: ReturnType<typeof setInterval> | undefined;
  details.open = true;
  function setOpen(open: boolean, focus = false) {
    widget!.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (focus) trigger.focus();
  }
  trigger.addEventListener('click', () => setOpen(widget!.hasAttribute('hidden')));
  document.addEventListener('click', event => {
    if (event.target instanceof Node && !control.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !widget!.hidden) { event.preventDefault(); setOpen(false, true); }
  });
  control.addEventListener('focusout', event => {
    // Clicking calendar text can move focus to BODY (relatedTarget = null).
    // Outside pointer clicks are already handled by the document click listener.
    if (event.relatedTarget instanceof Node && !control.contains(event.relatedTarget)) setOpen(false);
  });

  function renderCalendar(snapshot: ReturnType<typeof getZonedClock>) {
    if (!viewed) viewed = { year: snapshot.year, month: snapshot.month };
    const label = getLanguage() === 'en' ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(viewed.year, viewed.month - 1, 1))) : String(viewed.year) + ' 年 ' + viewed.month + ' 月';
    month.textContent = label;
    jump.value = String(viewed.year) + '-' + String(viewed.month).padStart(2, '0');
    previous.disabled = viewed.year <= 1900 && viewed.month === 1;
    next.disabled = viewed.year >= 2100 && viewed.month === 12;
    caption.textContent = `${label}，今天是 ${snapshot.dateLabel}，${snapshot.weekday}`;
    days.replaceChildren();
    for (const week of getMonthCalendar(viewed.year, viewed.month, snapshot.dateKey).weeks) {
      const row = document.createElement('tr');
      for (const cell of week) {
        const td = document.createElement('td');
        if (cell.day !== null && cell.dateKey) {
          const day = document.createElement('time');
          day.dateTime = cell.dateKey; day.textContent = String(cell.day);
          if (cell.today) {
            day.className = 'u-calendar-today';
            day.setAttribute('aria-current', 'date');
            day.setAttribute('aria-label', `今天，${snapshot.year}年${snapshot.month}月${snapshot.day}日`);
          }
          td.append(day);
        } else td.setAttribute('aria-hidden', 'true');
        row.append(td);
      }
      days.append(row);
    }
  }
  function navigate(offset: number) {
    const snapshot = snapshotNow();
    const current = viewed || snapshot;
    viewed = shiftMonth(current.year, current.month, offset);
    followToday = false; renderCalendar(snapshot);
  }
  previous.addEventListener('click', () => navigate(-1));
  next.addEventListener('click', () => navigate(1));
  jump.addEventListener('change', () => {
    const [year, month] = jump.value.split('-').map(Number);
    if (!Number.isInteger(year) || year < 1900 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return;
    viewed = { year, month }; followToday = false; renderCalendar(snapshotNow());
  });
  widget.querySelector('[data-calendar-current]')!.addEventListener('click', () => {
    const snapshot = snapshotNow();
    viewed = { year: snapshot.year, month: snapshot.month }; followToday = true; renderCalendar(snapshot);
  });

  function update() {
    const now = new Date();
    const snapshot = getZonedClock(now, getLanguage());
    clock.textContent = snapshot.time;
    clock.dateTime = `${snapshot.dateKey}T${snapshot.time}+08:00`;
    compactTime.textContent = snapshot.time.slice(0, 5);
    compactTime.dateTime = clock.dateTime;
    compactDate.textContent = `${snapshot.month}/${snapshot.day}`;
    trigger.setAttribute('aria-label', `${snapshot.dateLabel} ${snapshot.weekday} ${snapshot.time.slice(0, 5)}，打开日历与倒计时（北京时间）`);
    for (const target of countdownTargets) {
      const countdown = widget!.querySelector<HTMLElement>(`[data-countdown="${target.id}"]`)!;
      const remaining = getCountdown(target.target, now);
      countdown.querySelector<HTMLElement>('[data-countdown-days]')!.textContent = String(remaining.days);
      countdown.querySelector<HTMLElement>('[data-countdown-clock]')!.textContent = [remaining.hours, remaining.minutes, remaining.seconds].map(value => String(value).padStart(2, '0')).join(':');
      countdown.querySelector<HTMLElement>('[data-countdown-value]')!.hidden = remaining.reached;
      countdown.querySelector<HTMLElement>('[data-countdown-reached]')!.hidden = !remaining.reached;
    }
    if (snapshot.dateKey !== lastDate) {
      date.textContent = `${snapshot.dateLabel} · ${snapshot.weekday}`;
      if (followToday) viewed = { year: snapshot.year, month: snapshot.month };
      renderCalendar(snapshot);
      lastDate = snapshot.dateKey;
    }
    live.hidden = false; status.hidden = true;
  }

  function start() {
    if (timer !== undefined) clearInterval(timer);
    update();
    if (!document.hidden) timer = setInterval(update, 1000);
  }
  document.addEventListener('visibilitychange', start);
  document.addEventListener('universe:language', () => { lastDate = ''; update(); });
  window.addEventListener('pageshow', start);
  window.addEventListener('pagehide', () => { if (timer !== undefined) clearInterval(timer); });
  start();
}
