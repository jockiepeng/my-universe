import { collections, fortuneStorageKey, chineseNumber, fortuneReading, drawFortune, restoreHistory, addHistory } from '../lib/fortune.mjs';

type FortuneRecord = { collection: string; number: number; drawnAt: string };
type Phase = 'idle' | 'shaking' | 'drawn' | 'revealed';

const root = document.querySelector<HTMLElement>('[data-fortune]');
if (root) {
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const drawButton = get<HTMLButtonElement>('[data-draw]');
  const revealButton = get<HTMLButtonElement>('[data-reveal]');
  const againButton = get<HTMLButtonElement>('[data-again]');
  const skipButton = get<HTMLButtonElement>('[data-skip]');
  const paper = get<HTMLElement>('[data-fortune-paper]');
  const rest = get<HTMLElement>('[data-paper-rest]');
  const status = get<HTMLElement>('[data-fortune-status]');
  const choices = [...root.querySelectorAll<HTMLButtonElement>('[data-collection-choice]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dates = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let selected = 'guanyin';
  let phase: Phase = 'idle';
  let history: FortuneRecord[] = [];
  let current: FortuneRecord | null = null;
  let pending: FortuneRecord | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function storageUnavailable() {
    const note = get<HTMLElement>('[data-storage-note]');
    note.textContent = '当前浏览器无法保存求签记录；仍可抽签和阅读签文，刷新后记录可能丢失。';
    note.hidden = false;
  }

  try { history = restoreHistory(localStorage.getItem(fortuneStorageKey) || ''); }
  catch { storageUnavailable(); }

  function setPhase(next: Phase) {
    phase = next;
    root!.dataset.phase = next;
    root!.setAttribute('aria-busy', String(next === 'shaking'));
    choices.forEach(button => { button.disabled = next === 'shaking'; });
    drawButton.hidden = !['idle', 'shaking'].includes(next);
    drawButton.disabled = next === 'shaking';
    revealButton.hidden = next !== 'drawn';
    againButton.hidden = next !== 'revealed';
    skipButton.hidden = next !== 'shaking';
    paper.hidden = next !== 'revealed';
    rest.hidden = next === 'revealed';
    const step = next === 'drawn' ? 'revealed' : next;
    root!.querySelectorAll('[data-step]').forEach(element => {
      if (element.getAttribute('data-step') === step) element.setAttribute('aria-current', 'step');
      else element.removeAttribute('aria-current');
    });
  }

  function renderRecord(record: FortuneRecord) {
    const collection = collections.find(item => item.id === record.collection)!;
    const reading = fortuneReading(record.collection, record.number);
    get('[data-result-kind]').textContent = collection.name;
    const number = get<HTMLElement>('[data-result-number]');
    number.textContent = chineseNumber(record.number);
    number.dataset.number = String(record.number);
    get('[data-result-date]').textContent = `${dates.format(new Date(record.drawnAt))} · 北京时间`;
    get<SVGTextElement>('[data-stick-number]').textContent = `第${chineseNumber(record.number)}签`;
    get('[data-result-grade]').textContent = reading.grade;
    get('[data-result-poem]').replaceChildren(...reading.poem.map(line => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      return paragraph;
    }));
    get('[data-result-interpretation]').textContent = reading.interpretation;
    get<HTMLAnchorElement>('[data-source-link]').href = reading.sourceUrl;
  }

  function reset() {
    current = null;
    setPhase('idle');
    status.textContent = '在心里想一件事，轻轻求一支签。';
    get('[data-paper-hint]').textContent = '选一只签筒，让一支竹签回应此刻的心事。';
  }

  function chooseCollection(id: string, record?: FortuneRecord) {
    if (phase === 'shaking') return;
    const collection = collections.find(item => item.id === id);
    if (!collection) return;
    selected = id;
    root!.dataset.collection = id;
    choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.collectionChoice === id)));
    get('[data-tube-name]').textContent = collection.name;
    get('[data-tube-count]').textContent = `${chineseNumber(collection.count)}支竹签`;
    current = record || history.find(item => item.collection === id) || null;
    if (current) {
      renderRecord(current);
      setPhase('revealed');
      status.textContent = `这支${collection.name}，留给此刻的你。`;
    } else reset();
  }

  function renderHistory() {
    const section = get<HTMLElement>('[data-fortune-history]');
    section.hidden = history.length === 0;
    const list = get('[data-history-list]');
    list.replaceChildren();
    history.forEach(record => {
      const collection = collections.find(item => item.id === record.collection)!;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'f-history-item';
      const title = document.createElement('span');
      title.textContent = `${collection.name} · 第${chineseNumber(record.number)}签`;
      const date = document.createElement('small');
      date.textContent = dates.format(new Date(record.drawnAt));
      button.append(title, date);
      button.addEventListener('click', () => {
        if (phase === 'shaking') return;
        chooseCollection(record.collection, record);
        paper.focus({ preventScroll: true });
        paper.scrollIntoView({ behavior: motionOff() ? 'instant' : 'smooth', block: 'nearest' });
      });
      list.append(button);
    });
  }

  function motionOff() { return reducedMotion.matches || document.documentElement.dataset.motion === 'off'; }

  function finishDraw() {
    if (phase !== 'shaking' || !pending) return;
    clearTimeout(timer);
    current = pending;
    pending = null;
    history = addHistory(history, current);
    try { localStorage.setItem(fortuneStorageKey, JSON.stringify({ version: 1, entries: history })); }
    catch { storageUnavailable(); }
    renderRecord(current);
    renderHistory();
    setPhase('drawn');
    status.textContent = '一支签已落定，展开看看。';
    get('[data-paper-hint]').textContent = '竹签已出，点击「展开签纸」读签诗与签意。';
    revealButton.focus({ preventScroll: true });
  }

  choices.forEach(button => button.addEventListener('click', () => chooseCollection(button.dataset.collectionChoice!)));
  drawButton.addEventListener('click', () => {
    if (phase !== 'idle') return;
    try { pending = drawFortune(selected); }
    catch {
      status.textContent = '当前浏览器无法抽签，请使用较新的浏览器，或通过页底链接查阅签文。';
      return;
    }
    setPhase('shaking');
    status.textContent = '竹签轻响，稍候片刻。';
    if (motionOff()) finishDraw();
    else timer = setTimeout(finishDraw, 2200);
  });
  skipButton.addEventListener('click', finishDraw);
  revealButton.addEventListener('click', () => {
    if (phase !== 'drawn' || !current) return;
    setPhase('revealed');
    const name = collections.find(item => item.id === current!.collection)!.name;
    status.textContent = `${name}，第${chineseNumber(current.number)}签。签诗与签意已展开。`;
    paper.focus({ preventScroll: true });
    if (matchMedia('(max-width: 600px)').matches) paper.scrollIntoView({ behavior: motionOff() ? 'instant' : 'smooth', block: 'nearest' });
  });
  againButton.addEventListener('click', () => { reset(); drawButton.focus({ preventScroll: true }); });
  const motionChanged = () => { if (motionOff()) finishDraw(); };
  reducedMotion.addEventListener('change', motionChanged);
  new MutationObserver(motionChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  renderHistory();
  chooseCollection(history[0]?.collection || selected);
  root.dataset.ready = 'true';
}
