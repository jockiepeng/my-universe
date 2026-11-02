import { filterPosts, matchesCategory, topics } from '../lib/topics.mjs';

document.querySelectorAll<HTMLElement>('[data-post-filter-scope]').forEach(scope => {
  const home = scope.hasAttribute('data-filter-home');
  const defaultCategory = scope.dataset.defaultCategory || '';
  const entries = [...scope.querySelectorAll<HTMLElement>('[data-post-list] > article')].map(element => ({
    element,
    data: { category: element.dataset.category || '', kind: element.dataset.kind || 'post' },
  }));
  const links = [...scope.querySelectorAll<HTMLAnchorElement>('[data-topic-filter]')];
  const buttons = [...scope.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  let category = defaultCategory;
  let kind = 'all';

  function render() {
    const filtered = category !== defaultCategory || kind !== 'all';
    const matching = new Set(filterPosts(entries, { category, kind }).map(entry => entry.element));
    let count = 0;
    for (const { element } of entries) {
      element.hidden = !matching.has(element) || (home && !filtered && element.dataset.initial === 'false');
      if (!element.hidden) count++;
    }
    for (const link of links) {
      const selected = link.hasAttribute('data-topic-root')
        ? Boolean(category) && matchesCategory(category, link.dataset.topicFilter || '')
        : link.dataset.topicFilter === category;
      if (selected) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    scope.querySelectorAll<HTMLElement>('[data-subcategory-group]').forEach(group => {
      group.hidden = !category || group.dataset.subcategoryGroup !== category.split('/')[0];
    });
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === kind));
    const empty = scope.querySelector<HTMLElement>('[data-filter-empty]');
    if (empty) empty.hidden = count > 0 || entries.length === 0;
    const countLabel = scope.querySelector<HTMLElement>('[data-filter-count]');
    if (countLabel) countLabel.textContent = `显示 ${count} 篇`;
    const pagination = scope.querySelector<HTMLElement>('.u-pagination');
    if (pagination) pagination.hidden = filtered;
  }

  function restore() {
    const params = new URL(location.href).searchParams;
    category = home ? topics.find(topic => topic.slug === params.get('topic'))?.path || '' : defaultCategory;
    kind = ['post', 'photo'].includes(params.get('kind') || '') ? params.get('kind')! : 'all';
    render();
  }

  function save() {
    const url = new URL(location.href);
    if (home && category) url.searchParams.set('topic', topics.find(topic => topic.path === category)!.slug);
    else url.searchParams.delete('topic');
    if (kind === 'all') url.searchParams.delete('kind');
    else url.searchParams.set('kind', kind);
    if (url.href !== location.href) history.pushState(history.state, '', url);
    render();
  }

  links.forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    category = link.dataset.topicFilter || '';
    save();
  }));
  buttons.forEach(button => button.addEventListener('click', () => {
    kind = button.dataset.filter || 'all';
    save();
  }));
  window.addEventListener('popstate', restore);
  restore();
});
