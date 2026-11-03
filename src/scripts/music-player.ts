interface MusicTrack { id: string; title: string; artist: string; url: string; source: string }
type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

const root = document.querySelector<HTMLDetailsElement>('[data-music]');
if (root) initialize(root);

function initialize(root: HTMLDetailsElement) {
  const audio = root.querySelector<HTMLAudioElement>('[data-music-audio]')!;
  const tracks: MusicTrack[] = JSON.parse(root.querySelector('[data-music-playlist]')?.textContent || '[]');
  if (!tracks.length) return;
  const playButton = root.querySelector<HTMLButtonElement>('[data-music-play]')!;
  const seek = root.querySelector<HTMLInputElement>('[data-music-seek]')!;
  const volume = root.querySelector<HTMLInputElement>('[data-music-volume]')!;
  const summary = root.querySelector<HTMLElement>('[data-music-summary]')!;
  const status = root.querySelector<HTMLElement>('[data-music-status]')!;
  const source = root.querySelector<HTMLAnchorElement>('[data-music-source]')!;
  const preferenceKey = 'little-universe-music-v1';
  const sessionKey = 'little-universe-music-playing-v1';
  let selected = 0;
  let position = 0;
  let level = .2;
  let wanted = false;
  let state: PlayerState = 'idle';
  let version = 0;
  let pendingSeek: number | null = null;
  let lastSave = 0;
  try {
    const stored = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
    if (stored && typeof stored === 'object') {
      const storedIndex = tracks.findIndex(track => track.id === stored.track);
      selected = Math.max(0, storedIndex);
      if (storedIndex >= 0 && typeof stored.time === 'number' && Number.isFinite(stored.time) && stored.time >= 0) position = stored.time;
      if (typeof stored.volume === 'number' && Number.isFinite(stored.volume)) level = Math.min(1, Math.max(0, stored.volume));
    }
  } catch { /* A private/blocked storage environment can still play music. */ }
  try { wanted = sessionStorage.getItem(sessionKey) === 'true'; } catch { /* Start quietly. */ }
  audio.volume = level;
  volume.value = String(level);

  function text(selector: string, value: string) { root.querySelector(selector)!.textContent = value; }
  function clock(seconds: number) {
    const n = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  }
  function save() {
    try { localStorage.setItem(preferenceKey, JSON.stringify({ track: tracks[selected].id, time: position, volume: level })); } catch { /* Optional preference storage. */ }
    try { sessionStorage.setItem(sessionKey, String(wanted)); } catch { /* Optional cross-page resume. */ }
  }
  function sync() {
    root.dataset.state = state;
    text('[data-music-title]', tracks[selected].title);
    text('[data-music-mini]', state === 'playing' ? '正在播放' : state === 'loading' ? '加载中' : state === 'idle' ? '点播' : '已暂停');
    text('[data-music-play-label]', wanted ? '暂停' : '播放');
    playButton.setAttribute('aria-label', wanted ? '暂停背景音乐' : '播放背景音乐');
    playButton.setAttribute('aria-busy', String(state === 'loading'));
    root.querySelectorAll<HTMLButtonElement>('[data-music-track]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.musicTrack === tracks[selected].id)));
    source.href = tracks[selected].source;
    text('[data-music-credit]', `${tracks[selected].title} by ${tracks[selected].artist}`);
    text('[data-music-volume-label]', `${Math.round(level * 100)}%`);
    text('[data-music-elapsed]', clock(position));
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    text('[data-music-duration]', clock(duration));
    seek.disabled = duration <= 0;
    seek.max = String(Math.max(1, Math.floor(duration)));
    seek.value = String(Math.min(position, Math.max(1, duration)));
  }
  function prepare() {
    if (audio.getAttribute('src') !== tracks[selected].url) {
      pendingSeek = position;
      audio.src = tracks[selected].url;
      audio.load();
    } else if (audio.error) {
      pendingSeek = position;
      audio.load();
    }
  }
  async function play() {
    const action = ++version;
    wanted = true;
    state = 'loading';
    status.textContent = '正在加载音乐…';
    prepare(); sync(); save();
    try {
      await audio.play();
      if (action !== version) return;
      state = 'playing';
      status.textContent = '顺序循环播放，随时可以暂停。';
      sync();
    } catch (error) {
      if (action !== version) return;
      wanted = false;
      const blocked = error instanceof DOMException && error.name === 'NotAllowedError';
      state = blocked ? 'paused' : 'error';
      status.textContent = blocked ? '浏览器需要手动确认，请点击播放。' : '这首音乐暂时无法播放，请重试或换一首。';
      sync(); save();
    }
  }
  function pause() {
    ++version; wanted = false; audio.pause(); state = 'paused';
    status.textContent = '已暂停，点击播放继续。';
    sync(); save();
  }
  function choose(index: number) {
    if (index === selected && state !== 'error') return;
    const resume = wanted;
    ++version; audio.pause(); selected = (index + tracks.length) % tracks.length;
    position = 0; pendingSeek = null; state = 'paused';
    // Clear a previous track without downloading a newly selected, paused track.
    audio.removeAttribute('src'); audio.load();
    status.textContent = '已选好曲目，点击播放。';
    sync(); save();
    if (resume) void play();
  }
  playButton.addEventListener('click', () => { if (wanted) pause(); else void play(); });
  root.querySelector('[data-music-prev]')!.addEventListener('click', () => choose((selected + tracks.length - 1) % tracks.length));
  root.querySelector('[data-music-next]')!.addEventListener('click', () => choose((selected + 1) % tracks.length));
  root.querySelectorAll<HTMLButtonElement>('[data-music-track]').forEach(button => button.addEventListener('click', () => choose(tracks.findIndex(track => track.id === button.dataset.musicTrack))));
  volume.addEventListener('input', () => { level = Number(volume.value); audio.volume = level; sync(); save(); });
  seek.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    position = Math.min(audio.duration, Math.max(0, Number(seek.value)));
    audio.currentTime = position; sync(); save();
  });
  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null && Number.isFinite(audio.duration)) {
      position = Math.min(pendingSeek, Math.max(0, audio.duration - .1));
      audio.currentTime = position;
      pendingSeek = null;
    }
    sync();
  });
  audio.addEventListener('timeupdate', () => {
    if (pendingSeek !== null || !audio.getAttribute('src')) return;
    position = audio.currentTime; sync();
    if (Date.now() - lastSave > 2000) { save(); lastSave = Date.now(); }
  });
  audio.addEventListener('pause', () => {
    // Source changes queue pause events too: inspect the current element state,
    // so an old event cannot cancel playback of the newly selected track.
    if (wanted && audio.paused && !audio.ended && !audio.error) pause();
  });
  audio.addEventListener('playing', () => {
    if (audio.paused) return;
    wanted = true; state = 'playing';
    status.textContent = '顺序循环播放，随时可以暂停。';
    sync(); save();
  });
  audio.addEventListener('ended', () => { if (wanted) choose((selected + 1) % tracks.length); });
  audio.addEventListener('error', () => {
    if (!audio.error || !audio.getAttribute('src')) return;
    ++version; wanted = false; state = 'error';
    status.textContent = '这首音乐暂时无法播放，请重试或换一首。';
    sync(); save();
  });
  function close() { root.open = false; summary.focus({ preventScroll: true }); }
  root.querySelector('[data-music-close]')!.addEventListener('click', close);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && root.open) { event.preventDefault(); close(); } });
  document.addEventListener('pointerdown', event => { if (root.open && event.target instanceof Node && !root.contains(event.target)) root.open = false; });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  sync(); root.hidden = false;
  if (wanted) void play();
}
