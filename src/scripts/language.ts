import { getLanguage, languageStorageKey, normalizeLanguage, translate } from '../lib/i18n.mjs';

const root = document.documentElement;
const skip = 'script,style,noscript,textarea,[data-i18n-ignore],[data-i18n-skip],[translate="no"]';
const attributes = ['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'title', 'placeholder', 'alt'];
type Original = { source: string; rendered: string };
const texts = new WeakMap<Text, Original>();
const attrs = new WeakMap<Element, Map<string, Original>>();

function translated(value: string, previous?: Original, english?: string): Original {
  const source = previous && value === previous.rendered ? previous.source : value;
  return { source, rendered: getLanguage() === 'en' && english !== undefined ? english : translate(source, getLanguage()) };
}

function updateNode(node: Node) {
  if (node instanceof Text) {
    if (!node.parentElement || node.parentElement.closest(skip)) return;
    const next = translated(node.data, texts.get(node), node.parentElement.dataset.i18nEn);
    texts.set(node, next);
    if (node.data !== next.rendered) node.data = next.rendered;
  } else if (node instanceof Element && !node.closest(skip)) {
    const saved = attrs.get(node) || new Map<string, Original>();
    for (const name of attributes) {
      const value = node.getAttribute(name);
      if (value === null) { saved.delete(name); continue; }
      const next = translated(value, saved.get(name), node.getAttribute(`data-i18n-en-${name}`) ?? undefined);
      saved.set(name, next);
      if (next.rendered !== value) node.setAttribute(name, next.rendered);
    }
    attrs.set(node, saved);
  }
}

function updateTree(node: Node) {
  if (node instanceof Element && node.closest(skip)) return;
  updateNode(node);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: child => child instanceof Element && child.matches(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode()) updateNode(walker.currentNode);
}

const observer = new MutationObserver(records => {
  observer.disconnect();
  const added = new Set<Node>();
  for (const record of records) {
    if (record.type === 'childList') record.addedNodes.forEach(node => added.add(node));
    else added.add(record.target);
  }
  for (const node of added) if (node.isConnected) updateTree(node);
  observe();
});
function observe() {
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
}

// Metadata is kept separate: an article's title and description are editorial content.
const title = document.querySelector('title')!;
const pageTitle = title.dataset.pageTitle || '';
const brand = title.dataset.siteTitle || '';
const article = title.hasAttribute('data-article-title');
const metadata = [...document.querySelectorAll<HTMLMetaElement>('meta[name="description"],meta[property="og:description"],meta[property="og:site_name"]')]
  .map(element => ({ element, source: element.content }));
function updateMetadata() {
  const language = getLanguage();
  document.title = pageTitle ? `${article ? pageTitle : translate(pageTitle, language)} · ${translate(brand, language)}` : translate(brand, language);
  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = document.title;
  for (const { element, source } of metadata) {
    if (!article || element.getAttribute('property') === 'og:site_name') element.content = translate(source, language);
  }
  const ogLocale = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
  if (ogLocale) ogLocale.content = language === 'en' ? 'en_US' : 'zh_CN';
}

function setLanguage(value: unknown, persist = false) {
  observer.disconnect();
  const language = normalizeLanguage(value);
  root.dataset.language = language;
  root.lang = language === 'en' ? 'en' : 'zh-CN';
  if (persist) {
    try { localStorage.setItem(languageStorageKey, language); } catch { /* Switching still works when storage is unavailable. */ }
  }
  updateTree(document.body);
  document.querySelectorAll('head link[title]').forEach(updateNode);
  updateMetadata();
  document.querySelectorAll<HTMLButtonElement>('[data-language-toggle]').forEach(button => {
    button.textContent = language === 'en' ? '中文' : 'EN';
    button.lang = language === 'en' ? 'zh-CN' : 'en';
    button.setAttribute('aria-label', language === 'en' ? '切换为中文' : 'Switch to English');
    button.title = language === 'en' ? '切换为中文' : 'Switch to English';
  });
  delete root.dataset.i18nPending;
  root.dataset.languageReady = 'true';
  observe();
  // Bubbling reaches both document-level and window-level consumers.
  document.dispatchEvent(new CustomEvent('universe:language', { detail: { language }, bubbles: true }));
}

document.querySelectorAll('[data-language-toggle]').forEach(button => button.addEventListener('click', () => setLanguage(getLanguage() === 'en' ? 'zh' : 'en', true)));
window.addEventListener('storage', event => { if (event.key === languageStorageKey) setLanguage(event.newValue); });
window.addEventListener('pageshow', () => {
  try { setLanguage(localStorage.getItem(languageStorageKey)); } catch { setLanguage(getLanguage()); }
});
setLanguage(getLanguage());
