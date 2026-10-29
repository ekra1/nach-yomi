(() => {
'use strict';
const $ = s => document.querySelector(s);
const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 2.5, 0.75];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const SEF = {}; SEFARIM.forEach((s, i) => { SEF[s[0]] = { key: s[0], name: s[1], heb: s[2], chapters: s[3], order: i }; });

let items = [];                 // catalog, newest first
let byId = new Map();
let pos = store.get('ny.pos', {});        // id -> seconds
let played = store.get('ny.played', {});  // id -> timestamp
let speed = store.get('ny.speed', 1);
let view = store.get('ny.view', 'latest');
let hidePlayed = store.get('ny.hidePlayed', false);
let current = null;
let lastSync = null;

const audio = $('#audio'), listEl = $('#list'), statusEl = $('#status'), emptyEl = $('#empty'), q = $('#q');
const playerEl = $('#player'), seek = $('#seek'), playBtn = $('#play'), msg = $('#msg');

const fmt = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtDate = d => { if (!d) return ''; const t = new Date(d); if (isNaN(t)) return '';
  return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(t.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }); };
const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + ' hr ago'; return Math.round(h / 24) + ' days ago'; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function normalize(raw) {
  return raw.map(r => {
    const p = (r.sefer && r.perek) ? { sefer: r.sefer, perek: r.perek } : (parseNach(r.title) || {});
    const sef = SEF[p.sefer];
    return { id: r.id, title: String(r.title || '').trim(), sefer: p.sefer || null, perek: p.perek || null, sef,
      label: sef ? sef.name + ' ' + p.perek : String(r.title || '').trim(), sub: cap(shiurSubtitle(r.title)),
      published: r.published || (r.first_seen ? new Date(r.first_seen).toISOString() : null), duration: r.duration || 0, audio: !!r.audio };
  }).sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
}
function setItems(raw) {
  items = normalize(raw); byId = new Map(items.map(i => [i.id, i]));
  render(); renderContinue();
  if (current && byId.has(current.id)) current = byId.get(current.id);
}
function status(text, err) { statusEl.textContent = text; statusEl.classList.toggle('err', !!err); }
function statusLine(extra) {
  const n = items.length, range = n ? (fmtDate(items[n - 1].published) + ' – ' + fmtDate(items[0].published)) : '';
  let s = n + ' shiurim' + (range ? ' · ' + range : '');
  if (lastSync) s += ' · checked ' + ago(lastSync);
  if (extra) s += ' · ' + extra;
  status(s);
}

// ---------- catalog ----------
async function loadCatalog(force) {
  const btn = $('#refresh'); btn.classList.add('spin'); btn.disabled = true;
  if (force) status('Checking for new shiurim…');
  try {
    const r = await fetch('catalog.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const before = new Set(items.map(i => i.id));
    lastSync = j.last_ok || null;
    store.set('ny.catalog', { at: Date.now(), items: j.items, last_ok: j.last_ok });
    setItems(j.items);
    const fresh = items.filter(i => !before.has(i.id)).length;
    statusLine(force ? (fresh ? fresh + ' new' : 'up to date') : '');
  } catch (e) {
    statusLine(force ? 'couldn’t reach the server, showing saved list' : '');
  } finally { btn.classList.remove('spin'); btn.disabled = false; }
}

// ---------- rendering ----------
function matches(it, terms) {
  if (!terms.length) return true;
  const hay = (it.label + ' ' + it.title + ' ' + (it.sef ? it.sef.heb + ' ' + it.sef.name : '')).toLowerCase();
  return terms.every(t => /^\d+$/.test(t) ? String(it.perek) === t || hay.includes(t) : hay.includes(t));
}
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>';
function rowHtml(it, mode) {
  const p = pos[it.id] || 0, done = !!played[it.id];
  const pct = (!done && p > 5 && it.duration) ? Math.min(100, p / it.duration * 100) : 0;
  const meta = [mode === 'sefer' ? '' : (it.sef ? it.sef.name + ' ' + it.perek : ''), fmtDate(it.published),
    pct ? fmt(it.duration - p) + ' left' : (it.duration ? fmt(it.duration) : ''), it.audio ? '' : 'audio coming'].filter(Boolean).join(' · ');
  const title = it.sub || (it.sef ? it.sef.name + ' ' + it.perek : it.title);
  return `<li class="row${done ? ' done' : ''}${current && current.id === it.id ? ' now' : ''}" data-id="${esc(it.id)}">
    <button type="button" class="open" aria-label="Play ${esc(it.label)}${it.sub ? ': ' + esc(it.sub) : ''}">
      <span class="pk"><b>${it.perek || '·'}</b></span>
      <span class="tx"><span class="t">${esc(title)}</span><span class="s">${esc(meta)}</span>${pct ? `<span class="prog"><i style="width:${pct.toFixed(1)}%"></i></span>` : ''}</span>
    </button>
    <button type="button" class="mark" aria-pressed="${done}" aria-label="${done ? 'Played. Tap to mark unplayed' : 'Mark as played'}: ${esc(it.label)}">${CHECK}</button>
  </li>`;
}
function render() {
  const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = items.filter(it => matches(it, terms));
  if (hidePlayed) list = list.filter(it => !played[it.id]);
  emptyEl.hidden = list.length > 0 || !items.length;
  emptyEl.textContent = hidePlayed && !terms.length ? 'All played. Nice.' : 'No shiurim match that search.';
  if (view === 'latest') {
    listEl.innerHTML = `<ul class="rows">${list.map(it => rowHtml(it, 'latest')).join('')}</ul>`;
  } else {
    const groups = new Map();
    for (const it of list) { const k = it.sefer || 'other'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    const keys = [...groups.keys()].sort((a, b) => (SEF[a] ? SEF[a].order : 99) - (SEF[b] ? SEF[b].order : 99));
    const open = store.get('ny.open', null);
    const newest = items[0] && items[0].sefer;
    listEl.innerHTML = keys.map(k => {
      const g = groups.get(k).sort((a, b) => (a.perek || 0) - (b.perek || 0) || (Date.parse(a.published) - Date.parse(b.published)));
      const s = SEF[k]; const all = items.filter(i => (i.sefer || 'other') === k);
      const nPlayed = all.filter(i => played[i.id]).length; const perakim = new Set(all.map(i => i.perek)).size;
      const isOpen = terms.length || (open ? open.includes(k) : k === newest);
      return `<details class="grp" data-k="${esc(k)}"${isOpen ? ' open' : ''}>
        <summary><span class="g-name">${esc(s ? s.name : 'Other shiurim')}</span>${s ? `<span class="g-heb" lang="he">${esc(s.heb)}</span>` : ''}
          <span class="g-meta">${s ? perakim + ' of ' + s.chapters + ' perakim' : all.length + ' shiurim'}${nPlayed ? ' · ' + nPlayed + ' played' : ''}</span></summary>
        ${s ? `<div class="g-bar" aria-hidden="true"><i style="width:${(nPlayed / s.chapters * 100).toFixed(1)}%"></i></div>` : ''}
        <ul class="rows">${g.map(it => rowHtml(it, 'sefer')).join('')}</ul>
      </details>`;
    }).join('') + (keys.length ? '<p class="note">Rabbi Motzen started this series with Yirmiyahu on Rosh Hashana 5787. New sefarim show up here as he posts them.</p>' : '');
  }
}
function renderContinue() {
  const last = store.get('ny.last', null); const it = last && byId.get(last);
  const box = $('#continue');
  if (!it || played[it.id] || !(pos[it.id] > 5) || (current && current.id === it.id)) { box.hidden = true; return; }
  $('#contT').textContent = it.label + (it.sub ? ' · ' + it.sub : '') + (it.duration ? ' · ' + fmt(it.duration - pos[it.id]) + ' left' : '');
  box.hidden = false;
}

// ---------- events ----------
listEl.addEventListener('click', e => {
  const row = e.target.closest('.row'); if (!row) return; const it = byId.get(row.dataset.id); if (!it) return;
  if (e.target.closest('.mark')) { togglePlayed(it.id); return; }
  if (e.target.closest('.open')) { if (current && current.id === it.id) { audio.paused ? audio.play().catch(() => {}) : audio.pause(); expand(true); } else start(it, true); }
});
listEl.addEventListener('toggle', e => {
  const d = e.target; if (!d.classList || !d.classList.contains('grp') || q.value.trim()) return;
  const open = [...listEl.querySelectorAll('details.grp[open]')].map(x => x.dataset.k); store.set('ny.open', open);
}, true);
q.addEventListener('input', render);
document.querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; store.set('ny.view', view); syncTabs(); render(); }));
function syncTabs() { document.querySelectorAll('.seg').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view))); }
$('#hidePlayed').checked = hidePlayed;
$('#hidePlayed').addEventListener('change', e => { hidePlayed = e.target.checked; store.set('ny.hidePlayed', hidePlayed); render(); });
$('#refresh').addEventListener('click', () => loadCatalog(true));
$('#contBtn').addEventListener('click', () => { const it = byId.get(store.get('ny.last', null)); if (it) start(it, true); });

function togglePlayed(id, val) {
  const now = val === undefined ? !played[id] : val;
  if (now) played[id] = Date.now(); else delete played[id];
  if (now) delete pos[id];
  store.set('ny.played', played); store.set('ny.pos', pos);
  render(); renderContinue(); syncPlayer();
}

// ---------- player ----------
const canHls = !!audio.canPlayType('application/vnd.apple.mpegurl');
let loadToken = 0, lastSave = 0;
function expand(open) { playerEl.classList.toggle('min', !open); document.body.classList.toggle('min', !open); $('#plMin').setAttribute('aria-expanded', String(open)); }
$('#plMin').addEventListener('click', () => expand(playerEl.classList.contains('min')));
$('.pl-titles').addEventListener('click', () => expand(playerEl.classList.contains('min')));
function syncPlayer() {
  if (!current) return;
  const done = !!played[current.id];
  $('#plPlayed').setAttribute('aria-pressed', String(done)); $('#plPlayed').textContent = done ? '✓ Played' : 'Mark played';
}
async function start(it, autoplay) {
  if (current && current.id !== it.id) savePos(true);
  current = it; const token = ++loadToken;
  store.set('ny.last', it.id);
  playerEl.hidden = false; document.body.classList.add('playing'); expand(true);
  $('#plT').textContent = it.label; $('#plS').textContent = it.sub || 'Rabbi Yisrael Motzen';
  $('#plImg').src = 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg';
  $('#plVideo').href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(it.id);
  syncPlayer(); render(); renderContinue();
  seek.value = 0; seek.max = it.duration || 100; $('#cur').textContent = fmt(pos[it.id] || 0); $('#rem').textContent = '-' + fmt((it.duration || 0) - (pos[it.id] || 0));
  setMediaSession(it);
  msg.textContent = 'Loading…';
  current._failed = false;
  load(it, token, autoplay);
}
// Set the source and call play() in the same tap (iOS only lets a tap start audio); if the
// backend is busy the element errors, and we warm the stream and try again on the same element.
function load(it, token, autoplay) {
  const startAt = played[it.id] ? 0 : (pos[it.id] || 0);
  // Every shiur's audio is a plain file in this repo; one without audio yet links to YouTube.
  if (!it.audio) { audio.removeAttribute('src'); unavailable(it); return; }
  audio.src = `audio/${it.id}.m4a`;
  audio.addEventListener('loadedmetadata', () => {
    if (token !== loadToken) return;
    if (startAt > 3 && (!audio.duration || startAt < audio.duration - 5)) { try { audio.currentTime = startAt; } catch (e) {} }
    audio.playbackRate = speed; audio.defaultPlaybackRate = speed;
  }, { once: true });
  audio.load();
  if (autoplay) { const p = audio.play(); if (p && p.catch) p.catch(err => { if (token === loadToken && err && err.name === 'NotAllowedError') msg.textContent = 'Tap ▶ to start.'; }); }
}
function unavailable(it) {
  it._failed = true; it._tries = 0;
  msg.innerHTML = 'Audio for this one isn’t ready yet. <a href="https://www.youtube.com/watch?v=' + encodeURIComponent(it.id) + '" rel="noopener">Watch on YouTube</a>';
}
function savePos(force) {
  if (!current || !audio.duration) return; const now = Date.now(); if (!force && now - lastSave < 4000) return; lastSave = now;
  const t = audio.currentTime;
  if (t > audio.duration * 0.95 || audio.duration - t < 8) { if (!played[current.id]) togglePlayed(current.id, true); return; }
  if (t > 3) { pos[current.id] = Math.floor(t); store.set('ny.pos', pos); }
}
function nextOf(it) {
  if (!it) return null;
  if (it.sef) {
    const same = items.filter(x => x.sefer === it.sefer && x.perek > it.perek).sort((a, b) => a.perek - b.perek);
    if (same.length) return same[0];
    const later = items.filter(x => x.sef && x.sef.order > it.sef.order).sort((a, b) => a.sef.order - b.sef.order || a.perek - b.perek);
    if (later.length) return later[0];
    return null;
  }
  const i = items.indexOf(it); return i > 0 ? items[i - 1] : null;
}
function prevOf(it) {
  if (!it || !it.sef) return null;
  const same = items.filter(x => x.sefer === it.sefer && x.perek < it.perek).sort((a, b) => b.perek - a.perek);
  return same[0] || null;
}
playBtn.addEventListener('click', () => {
  if (!current) return;
  if (current._failed || !audio.src) { start(current, true); return; }
  audio.paused ? audio.play().catch(() => {}) : audio.pause();
});
$('#back').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
$('#fwd').addEventListener('click', () => { audio.currentTime = Math.min((audio.duration || 1e9) - 1, audio.currentTime + 30); });
$('#next').addEventListener('click', () => { const n = nextOf(current); if (n) { savePos(true); start(n, true); } else msg.textContent = 'That’s the newest perek so far.'; });
$('#plPlayed').addEventListener('click', () => current && togglePlayed(current.id));
const speedBtn = $('#speed');
const showSpeed = () => { speedBtn.textContent = (speed % 1 ? speed : speed.toFixed(0)) + '×'; speedBtn.setAttribute('aria-label', 'Playback speed ' + speed + 'x'); };
showSpeed();
speedBtn.addEventListener('click', () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; store.set('ny.speed', speed); audio.playbackRate = speed; audio.defaultPlaybackRate = speed; showSpeed(); });
const autoEl = $('#auto'); autoEl.checked = store.get('ny.auto', true);
autoEl.addEventListener('change', () => store.set('ny.auto', autoEl.checked));
let seeking = false;
seek.addEventListener('input', () => { seeking = true; $('#cur').textContent = fmt(+seek.value); });
seek.addEventListener('change', () => { seeking = false; if (audio.duration) audio.currentTime = +seek.value; });
audio.addEventListener('timeupdate', () => {
  if (!current) return; const d = audio.duration || current.duration || 0;
  if (!seeking) { seek.max = Math.floor(d) || 100; seek.value = Math.floor(audio.currentTime); $('#cur').textContent = fmt(audio.currentTime); }
  $('#rem').textContent = '-' + fmt(d - audio.currentTime);
  savePos(false);
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && audio.duration) {
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) }); } catch (e) {}
  }
});
audio.addEventListener('playing', () => { msg.textContent = ''; playBtn.classList.add('on'); playBtn.setAttribute('aria-label', 'Pause'); if (audio.playbackRate !== speed) audio.playbackRate = speed; });
audio.addEventListener('pause', () => { playBtn.classList.remove('on'); playBtn.setAttribute('aria-label', 'Play'); savePos(true); render(); renderContinue(); });
audio.addEventListener('waiting', () => { msg.textContent = 'Buffering…'; });
audio.addEventListener('ended', () => {
  if (current) togglePlayed(current.id, true);
  const n = autoEl.checked ? nextOf(current) : null; if (n) start(n, true);
});
audio.addEventListener('error', async () => {
  if (!current || !audio.src || audio.src.startsWith('data:')) return;
  const it = current, token = loadToken;
  if ((it._tries || 0) >= 2) { if (it.audio) { msg.textContent = 'Playback failed. Tap ▶ to retry.'; it._failed = true; it._tries = 0; } else unavailable(it); return; }
  it._tries = (it._tries || 0) + 1; msg.textContent = 'Connecting…';
  if (audio.currentTime > 3) { pos[it.id] = Math.floor(audio.currentTime); store.set('ny.pos', pos); }
  if (it.audio) { await new Promise(r => setTimeout(r, 800)); if (token === loadToken) load(it, token, true); return; }
  if (token === loadToken) unavailable(it);
});
audio.addEventListener('canplay', () => { if (current) current._tries = 0; });
window.addEventListener('pagehide', () => savePos(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) savePos(true); });
function setMediaSession(it) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: it.label + (it.sub ? ' – ' + it.sub : ''), artist: 'Rabbi Yisrael Motzen', album: 'Nach Yomi',
      artwork: [{ src: 'https://i.ytimg.com/vi/' + it.id + '/hqdefault.jpg', sizes: '480x360', type: 'image/jpeg' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    const ms = navigator.mediaSession, h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
    h('play', () => audio.play()); h('pause', () => audio.pause());
    h('seekbackward', d => { audio.currentTime = Math.max(0, audio.currentTime - ((d && d.seekOffset) || 15)); });
    h('seekforward', d => { audio.currentTime = Math.min(audio.duration || 1e9, audio.currentTime + ((d && d.seekOffset) || 30)); });
    h('seekto', d => { if (d && d.seekTime != null) audio.currentTime = d.seekTime; });
    h('nexttrack', () => { const n = nextOf(current); if (n) start(n, true); });
    h('previoustrack', () => { const p = prevOf(current); if (p) start(p, true); else audio.currentTime = 0; });
  } catch (e) {}
}

// ---------- boot ----------
syncTabs();
const cached = store.get('ny.catalog', null);
if (cached && cached.items && cached.items.length) { lastSync = cached.last_ok || null; setItems(cached.items); }
else if (window.SEED_CATALOG) setItems(window.SEED_CATALOG.items);
statusLine();
loadCatalog(false);
})();
