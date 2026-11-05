import { collections, fortuneStorageKey, chineseNumber, fortuneReading, drawFortune, restoreHistory, addHistory } from '../lib/fortune.mjs';
import englishReadings from '../data/fortune-texts.en.json';
import { getLanguage } from '../lib/i18n.mjs';

type FortuneRecord = { collection: string; number: number; drawnAt: string };
type Phase = 'idle' | 'shaking' | 'drawn' | 'revealed';
type Status = Phase | 'selected' | 'error';

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
  const english = () => getLanguage() === 'en';
  const localized = (zh: string, en: string) => english() ? en : zh;
  const collectionName = (id: string) => localized(collections.find(item => item.id === id)!.name, id === 'guanyin' ? 'Guanyin lots' : 'Che Kung lots');
  const signNumber = (number: number) => localized(chineseNumber(number), String(number));
  const signLabel = (number: number) => localized(`第${chineseNumber(number)}签`, `Lot ${number}`);
  const formatDate = (date: string) => new Intl.DateTimeFormat(english() ? 'en-US' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(date));
  let selected = 'guanyin';
  let phase: Phase = 'idle';
  let statusKind: Status = 'idle';
  let storageFailed = false;
  let history: FortuneRecord[] = [];
  let current: FortuneRecord | null = null;
  let pending: FortuneRecord | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // These texts are rendered from locale-specific content. The generic UI
  // translator must not retain or replace a previous draw's text nodes.
  root.querySelectorAll('[data-result-kind], [data-result-number], [data-result-date], [data-stick-number], [data-result-grade], [data-result-poem], [data-result-interpretation], [data-tube-name], [data-tube-count], [data-history-list], [data-fortune-status], [data-paper-hint], [data-storage-note]').forEach(element => element.setAttribute('data-i18n-ignore', ''));

  function storageUnavailable() {
    storageFailed = true;
    const note = get<HTMLElement>('[data-storage-note]');
    note.textContent = localized('当前浏览器无法保存求签记录；仍可抽签和阅读签文，刷新后记录可能丢失。', 'This browser cannot save your lot history. You can still draw and read lots, but records may be lost after a refresh.');
    note.hidden = false;
  }

  function renderStatus(next: Status = statusKind) {
    statusKind = next;
    const messages = {
      idle: localized('在心里想一件事，轻轻求一支签。', 'Hold a question in your heart, then gently draw a lot.'),
      shaking: localized('竹签轻响，稍候片刻。', 'The bamboo slips are stirring. Give them a moment.'),
      drawn: localized('一支签已落定，展开看看。', 'Your lot has settled. Unfold it when you are ready.'),
      selected: localized(`这支${collections.find(item => item.id === selected)!.name}，留给此刻的你。`, `A ${selected === 'guanyin' ? 'Guanyin' : 'Che Kung'} lot for this moment.`),
      revealed: current ? localized(`${collections.find(item => item.id === current!.collection)!.name}，第${chineseNumber(current.number)}签。签诗与签意已展开。`, `${collectionName(current.collection)}, lot ${current.number}. The poem and reflection are open.`) : '',
      error: localized('当前浏览器无法抽签，请使用较新的浏览器，或通过页底链接查阅签文。', 'This browser cannot draw a lot. Try a newer browser, or read the source texts through the links below.'),
    };
    status.textContent = messages[next];
    get('[data-paper-hint]').textContent = phase === 'drawn'
      ? localized('竹签已出，点击「展开签纸」读签诗与签意。', 'Your slip is ready. Select “Unfold the fortune” to read its poem and reflection.')
      : localized('选一只签筒，让一支竹签回应此刻的心事。', 'Choose a collection and let a bamboo slip offer a moment of reflection.');
  }

  function renderCollection() {
    const collection = collections.find(item => item.id === selected)!;
    get('[data-tube-name]').textContent = collectionName(selected);
    get('[data-tube-count]').textContent = localized(`${chineseNumber(collection.count)}支竹签`, `${collection.count} bamboo slips`);
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
    const original = fortuneReading(record.collection, record.number);
    const reading = english() ? englishReadings[record.collection as keyof typeof englishReadings][record.number - 1] : original;
    get('[data-result-kind]').textContent = collectionName(record.collection);
    const number = get<HTMLElement>('[data-result-number]');
    number.textContent = signNumber(record.number);
    number.dataset.number = String(record.number);
    get('[data-result-date]').textContent = `${formatDate(record.drawnAt)} · ${localized('北京时间', 'Beijing time')}`;
    get<SVGTextElement>('[data-stick-number]').textContent = signLabel(record.number);
    get('[data-result-grade]').textContent = reading.grade;
    get('[data-result-poem]').replaceChildren(...reading.poem.map(line => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      return paragraph;
    }));
    get('[data-result-interpretation]').textContent = reading.interpretation;
    get<HTMLAnchorElement>('[data-source-link]').href = original.sourceUrl;
  }

  function reset() {
    current = null;
    setPhase('idle');
    renderStatus('idle');
  }

  function chooseCollection(id: string, record?: FortuneRecord) {
    if (phase === 'shaking') return;
    const collection = collections.find(item => item.id === id);
    if (!collection) return;
    selected = id;
    root!.dataset.collection = id;
    choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.collectionChoice === id)));
    renderCollection();
    current = record || history.find(item => item.collection === id) || null;
    if (current) {
      renderRecord(current);
      setPhase('revealed');
      renderStatus('selected');
    } else reset();
  }

  function renderHistory() {
    const section = get<HTMLElement>('[data-fortune-history]');
    section.hidden = history.length === 0;
    const list = get('[data-history-list]');
    list.replaceChildren();
    history.forEach(record => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'f-history-item';
      const title = document.createElement('span');
      title.textContent = `${collectionName(record.collection)} · ${signLabel(record.number)}`;
      const date = document.createElement('small');
      date.textContent = formatDate(record.drawnAt);
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
    renderStatus('drawn');
    revealButton.focus({ preventScroll: true });
  }

  choices.forEach(button => button.addEventListener('click', () => chooseCollection(button.dataset.collectionChoice!)));
  drawButton.addEventListener('click', () => {
    if (phase !== 'idle') return;
    try { pending = drawFortune(selected); }
    catch {
      renderStatus('error');
      return;
    }
    setPhase('shaking');
    renderStatus('shaking');
    if (motionOff()) finishDraw();
    else timer = setTimeout(finishDraw, 2200);
  });
  skipButton.addEventListener('click', finishDraw);
  revealButton.addEventListener('click', () => {
    if (phase !== 'drawn' || !current) return;
    setPhase('revealed');
    renderStatus('revealed');
    paper.focus({ preventScroll: true });
    if (matchMedia('(max-width: 600px)').matches) paper.scrollIntoView({ behavior: motionOff() ? 'instant' : 'smooth', block: 'nearest' });
  });
  againButton.addEventListener('click', () => { reset(); drawButton.focus({ preventScroll: true }); });
  const motionChanged = () => { if (motionOff()) finishDraw(); };
  reducedMotion.addEventListener('change', motionChanged);
  new MutationObserver(motionChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  window.addEventListener('universe:language', () => {
    renderCollection();
    if (current) renderRecord(current);
    renderHistory();
    renderStatus();
    if (storageFailed) storageUnavailable();
  });
  renderHistory();
  chooseCollection(history[0]?.collection || selected);
  root.dataset.ready = 'true';
}
