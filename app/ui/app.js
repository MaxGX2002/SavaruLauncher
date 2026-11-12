'use strict';
const api = window.savaru;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n).toLocaleString('zh-TW');
const mb = b => `${num(Math.round(b / 1048576))} MB`;
const gb = m => `${(m / 1024).toFixed(1)} GB`;

// The pack's cover art, a 30 s loop of v3.0 combat (media/reel-loop.mp4), then combat frames from the dungeon reels.
// pos keeps each picture's subject in frame. Reduced motion skips the video.
const ART = [
  { src: 'ruins.jpg', pos: '28% 50%' },
  { video: true },
  { src: 'combat-1.jpg', pos: '50% 50%' },
  { src: 'combat-2.jpg', pos: '50% 50%' },
  { src: 'combat-3.jpg', pos: '45% 50%' },
  { src: 'combat-4.jpg', pos: '50% 50%' },
].filter(a => !a.video || !matchMedia('(prefers-reduced-motion: reduce)').matches);

const ERR = {
  login_not_configured: '這個版本的啟動器還沒有設定 Microsoft 登入。',
  app_not_approved: 'Microsoft 登入還沒通過 Mojang 審核，暫時無法登入。',
  no_minecraft: '這個 Microsoft 帳號沒有 Minecraft Java 版。',
  no_xbox_profile: '這個帳號還沒有 Xbox 個人檔案，請先到 xbox.com 登入一次再回來。',
  child_account: '未成年帳號需要家長在 Xbox 家庭設定中允許。',
  region_blocked: '你所在的地區無法使用 Xbox Live。',
  expired: '登入代碼已過期，請重新登入。',
  busy: '正在處理其他工作，請稍候。',
  already_running: '遊戲已經在執行中。',
  no_feed: '無法取得模組包資訊，請檢查網路連線後再試一次。',
  no_official_launcher: '找不到官方 Minecraft 啟動器，請先安裝。',
  comment_empty: '請填寫名稱和留言。',
  comment_failed: '留言送出失敗，請稍後再試。',
  comments_off: '留言板還沒開放。',
};
const errText = e => { const m = e?.message || String(e); return ERR[m] || '發生錯誤：' + m; };

let V = null, phase = null, running = false, pendingConnect = null, loginUri = null;

/* ---------- status line ---------- */
function setStatus(text, detail = '', { error = false, action } = {}) {
  const s = $('#status');
  s.textContent = text;
  s.classList.toggle('error', error);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = action.label; b.onclick = action.run;
    s.append(b);
  }
  $('#status-detail').textContent = detail;
}
function setBar(pct, mode = '') {
  const t = $('#bar-track');
  t.className = 'bar ' + mode;
  $('#bar').style.width = (pct ?? 0) + '%';
}
function setButtons() {
  const off = !!phase || running || !V?.feed;
  $('#play').disabled = off;
  $('#connect').disabled = off;
  $('#repair').disabled = off;
}
function idleStatus() {
  if (!V.feed) return setStatus('無法取得模組包資訊', '請檢查網路連線', { error: true }), setBar(0);
  const offline = V.feedOnline ? '' : '（離線模式）';
  if (!V.installed) { setStatus('尚未安裝', `第一次開始遊戲時會下載約 ${gb(V.feed.sizeMb + 1000)}`); return setBar(0); }
  if (!V.upToDate) { setStatus(`有新版本 ${V.feed.version}`, `目前 ${V.installed}・開始遊戲時會自動更新`); return setBar(0); }
  setStatus('已是最新版本', V.feed.version + offline);
  setBar(100, 'full');
}

/* ---------- view ---------- */
function render(v) {
  V = v;
  $('#nav-version').textContent = v.feed?.version || '';
  $('#build').textContent = `啟動器 ${v.launcherVersion}` + (v.installed ? `・已安裝 ${v.installed}` : '');

  const acc = $('#account');
  acc.classList.toggle('signed-out', !v.account);
  acc.innerHTML = v.account
    ? `<span class="avatar">${esc(v.account.name[0].toUpperCase())}</span><span><b>${esc(v.account.name)}</b><small>Microsoft 帳號</small></span>`
    : `<span class="avatar">✦</span><span><b>登入 Microsoft</b><small>連線伺服器需要正版帳號</small></span>`;
  $('#acct-name').textContent = v.account ? v.account.name : '尚未登入';
  $('#logout').hidden = !v.account;

  if (v.feed?.server) {
    $('#server-name').textContent = `${v.feed.server.name} 伺服器`;
    $('#connect-sub').textContent = `進入 ${v.feed.server.name}`;
  }
  renderNews(v.feed?.news || []);

  const max = Math.max(4096, Math.min(32768, Math.floor((v.totalMemMb - 2048) / 512) * 512));
  const mem = $('#mem');
  mem.max = max; mem.value = Math.min(v.settings.memoryMb, max);
  $('#mem-out').textContent = gb(mem.value);
  $('#mem-hint').textContent = `建議 8 GB 以上（這台電腦共 ${gb(v.totalMemMb)}）。分配太多反而可能變慢。`;
  $('#hide-on-launch').checked = v.settings.hideOnLaunch;
  $$('input[name="launcher"]').forEach(r => { r.checked = r.value === v.settings.launcher; });
  $('#ui-sound').checked = v.settings.uiSound;
  if (v.account && !$('#c-name').value) $('#c-name').value = v.account.name;

  const up = v.launcherUpdate;
  $('#launcher-update').hidden = !up;
  if (up) $('#launcher-update-version').textContent = up.version;

  if (!phase && !running) idleStatus();
  setButtons();
}

/* ---------- changelog (small markdown subset: headings, nested bullets, bold, code) ---------- */
function inline(s) {
  return s.split(/(``.+?``|`[^`]+`)/).map((part, i) => i % 2
    ? `<code>${esc(part.startsWith('``') ? part.slice(2, -2).trim() : part.slice(1, -1))}</code>`
    : esc(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)\*(\S.*?)\*(?=\W|$)/g, '$1<em>$2</em>')).join('');
}
function md(src) {
  const out = [];
  const stack = []; // open <ul> indents
  let para = [];
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const closeLists = (to = -1) => { while (stack.length && stack[stack.length - 1] > to) { out.push('</li></ul>'); stack.pop(); } };
  for (const line of src.replace(/\r/g, '').split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)/);
    const li = line.match(/^(\s*)[-*]\s+(.*)/);
    if (h) { flushPara(); closeLists(); out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); }
    else if (li) {
      flushPara();
      const ind = li[1].length;
      if (!stack.length || ind > stack[stack.length - 1]) { out.push('<ul><li>'); stack.push(ind); }
      else { closeLists(ind); out.push('</li><li>'); }
      out.push(inline(li[2]));
    } else if (!line.trim()) { flushPara(); }
    else if (stack.length && /^\s+/.test(line)) out.push(' ' + inline(line.trim()));
    else { closeLists(); para.push(line.trim()); }
  }
  flushPara(); closeLists();
  return out.join('');
}
function renderNews(news) {
  $('#news').innerHTML = news.length
    ? news.map(n => `<div class="entry"><p class="date">${esc(n.date || '')}</p>${md(n.markdown || '')}</div>`).join('')
    : '<p>目前沒有更新日誌。</p>';
}

/* ---------- navigation ---------- */
function go(view) {
  for (const b of $$('.nav button')) {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  const cur = $(`.nav button[data-view="${view}"]`), mark = $('.nav-mark');
  mark.style.height = cur.offsetHeight + 'px';
  mark.style.transform = `translateY(${cur.offsetTop}px)`;
  for (const id of ['home', 'gallery', 'community', 'notes', 'settings']) $('#view-' + id).hidden = id !== view;
  if (view !== 'gallery') $('#reel').pause();
  clearInterval(commentTimer);
  if (view === 'community') { loadComments(); commentTimer = setInterval(() => { if (!document.hidden) loadComments(); }, 20000); }
}

/* ---------- community: links + a comment wall backed by a Google Form and its response sheet (feed.launcher.comments) ---------- */
let commentTimer, lastPost = 0;
async function loadComments() {
  const list = await api.call('comments').catch(() => undefined);
  const box = $('#comments');
  $('#comment-form').hidden = list === null;
  if (list === null) return void (box.innerHTML = '<li class="empty">留言板即將開放。</li>');
  if (!list) return void (box.dataset.loaded || (box.innerHTML = '<li class="empty">無法讀取留言，請檢查網路連線。</li>'));
  box.dataset.loaded = 1;
  box.innerHTML = list.length
    ? list.map(c => `<li><p class="c-head"><b>${esc(c.name)}</b><time>${esc(c.at)}</time></p><p class="c-text">${esc(c.text)}</p></li>`).join('')
    : '<li class="empty">還沒有留言，來當第一個吧。</li>';
}
$('#comment-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (Date.now() - lastPost < 60000) return toast('每分鐘只能留言一次。', true);
  const b = $('#comment-send');
  b.disabled = true;
  try {
    await api.call('comment', { name: $('#c-name').value, text: $('#c-text').value });
    lastPost = Date.now();
    $('#c-text').value = '';
    toast('留言已送出');
    setTimeout(loadComments, 1500);
  } catch (err) { toast(errText(err), true); }
  b.disabled = false;
});
$$('[data-link]').forEach(b => b.addEventListener('click', () => api.call('link', b.dataset.link)));
// Nav spacing shrinks on short windows, so the sliding block re-measures its button.
addEventListener('resize', () => {
  const cur = $('.nav button[aria-current="page"]'), mark = $('.nav-mark');
  if (cur) { mark.style.height = cur.offsetHeight + 'px'; mark.style.transform = `translateY(${cur.offsetTop}px)`; }
});
document.addEventListener('click', e => {
  const v = e.target.closest('[data-view]');
  if (v) go(v.dataset.view);
});

/* ---------- background art ---------- */
let slide = 0, front = 0, timer;
const layers = $$('div.bg-img'), bgReel = $('#bg-reel');
const slideMs = a => (a.video ? 30000 : 9000);
function show(i) {
  slide = (i + ART.length) % ART.length;
  const a = ART[slide];
  if (a.video) {
    bgReel.currentTime = 0;
    bgReel.play().catch(() => {});
    bgReel.classList.add('on');
  } else {
    const el = layers[1 - front];
    el.style.transition = 'none';
    el.classList.remove('on');
    el.style.backgroundImage = `url("../img/art/${a.src}")`;
    el.style.backgroundPosition = a.pos;
    void el.offsetWidth;
    el.style.transition = '';
    el.classList.add('on');
    front = 1 - front;
    bgReel.classList.remove('on');
    setTimeout(() => bgReel.classList.contains('on') || bgReel.pause(), 1700);
  }
  layers[a.video ? front : 1 - front].classList.remove('on');
  $$('#slides button').forEach((b, k) => b.setAttribute('aria-current', String(k === slide)));
  clearTimeout(timer);
  timer = setTimeout(() => show(slide + 1), slideMs(a));
}
$('#slides').innerHTML = ART.map((a, i) => `<button type="button" aria-label="背景 ${i + 1}"></button>`).join('');
$$('#slides button').forEach((b, i) => { b.style.setProperty('--dur', slideMs(ART[i]) + 'ms'); b.addEventListener('click', () => show(i)); });
ART.forEach(a => { if (a.src) new Image().src = `../img/art/${a.src}`; });

// The art drifts a few pixels against the mouse (.bg is oversized by 16 px so no edge shows).
$('.main').addEventListener('mousemove', e => {
  const r = e.currentTarget.getBoundingClientRect(), bg = $('.bg');
  bg.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5) * -14 + 'px');
  bg.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5) * -10 + 'px');
});

/* ---------- embers: flat pixel sparks drifting up over the art, and a burst from the play buttons ---------- */
const embers = (() => {
  const cv = $('#embers'), g = cv.getContext('2d');
  const COLORS = ['#e8743b', '#f2a65a', '#b3322d', '#ffd27a'];
  let parts = [], W = 0, H = 0, dpr = 1;
  const fit = () => { dpr = devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  addEventListener('resize', fit); fit();
  const add = (x, y, burst) => {
    const a = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    const v = burst ? 1.5 + Math.random() * 4.5 : 0.35 + Math.random() * 0.8;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 3 + Math.floor(Math.random() * 4), t: 0,
      life: burst ? 45 + Math.random() * 45 : 300 + Math.random() * 300, c: COLORS[Math.floor(Math.random() * 4)], w: Math.random() * 6.3, burst });
  };
  const frame = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (parts.length < 85 && Math.random() < 0.45) add(Math.random() * W, H + 8, false);
    parts = parts.filter(p => p.t < p.life && p.y > -10);
    for (const p of parts) {
      p.t++;
      if (p.burst) { p.vx *= 0.94; p.vy = p.vy * 0.94 - 0.04; }
      p.x += p.vx + Math.sin(p.t / 40 + p.w) * 0.25; p.y += p.vy;
      const k = p.t / p.life;
      g.globalAlpha = Math.min(1, k * 8, (1 - k) * 2) * 0.9;
      g.fillStyle = p.c;
      g.save(); g.translate(p.x, p.y); g.rotate(Math.PI / 4 + p.t * 0.01); g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); g.restore();
    }
    requestAnimationFrame(frame);
  };
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(frame);
  return {
    burst(el) {
      const r = el.getBoundingClientRect(), c = cv.getBoundingClientRect();
      for (let i = 0; i < 60; i++) add(r.left + r.width * (0.2 + Math.random() * 0.6) - c.left, r.top + r.height / 2 - c.top, true);
    },
  };
})();

/* ---------- gameplay screenshots ---------- */
// The user's own v3.0 play: 01-11 from Savaru IV - Kohtalon Mies/screenshots (2026-11-05..09),
// 12-19 combat frames from the 11-01/11-05/11-09 reels. No captions by request.
const SHOTS = 19;
const shotSrc = i => `../img/shots/${String(i + 1).padStart(2, '0')}.jpg`;
let shot = 0;
function showShot(i) {
  shot = (i + SHOTS) % SHOTS;
  $('#viewer-img').src = shotSrc(shot);
  $('#viewer-cap').textContent = `${shot + 1} / ${SHOTS}`;
  $('#viewer-img').animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
}
$('#shots').innerHTML = Array.from({ length: SHOTS }, (_, i) => `<button type="button" class="shot" data-shot="${i}" aria-label="遊戲截圖 ${i + 1}"><img src="${shotSrc(i)}" alt="" loading="lazy" decoding="async"></button>`).join('');
$$('.shot').forEach((b, i) => b.style.setProperty('--i', i));
$('#shots').addEventListener('click', e => { const b = e.target.closest('.shot'); if (b) { showShot(+b.dataset.shot); $('#viewer').showModal(); } });
$('#viewer-prev').addEventListener('click', () => showShot(shot - 1));
$('#viewer-next').addEventListener('click', () => showShot(shot + 1));
$('#viewer-close').addEventListener('click', () => $('#viewer').close());
$('#viewer').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#viewer').addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { sfx('click'); showShot(shot + (e.key === 'ArrowLeft' ? -1 : 1)); }
});

/* ---------- interface sounds: synthesized with Web Audio, no sound files ---------- */
let ac, master, noiseBuf;
function sfx(name) {
  if (!V?.settings?.uiSound) return;
  if (!ac) {
    ac = new AudioContext();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime;
  const env = (node, vol, dur, at) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(vol, t + at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    node.connect(g).connect(master);
  };
  const osc = (type, f0, f1, vol, dur, at = 0) => {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
    env(o, vol, dur, at); o.start(t + at); o.stop(t + at + dur + 0.05);
  };
  const hiss = (vol, dur, f0, f1 = f0, q = 1, at = 0) => {
    const b = ac.createBufferSource(); b.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t + at); f.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
    b.connect(f); env(f, vol, dur, at); b.start(t + at); b.stop(t + at + dur + 0.05);
  };
  switch (name) {
    case 'hover': hiss(0.05, 0.045, 4200, 4200, 2.5); break;
    case 'click': osc('triangle', 520, 190, 0.16, 0.09); hiss(0.07, 0.03, 2600); break;
    case 'page': hiss(0.09, 0.22, 700, 3200, 0.8); osc('sine', 330, 495, 0.03, 0.18); break;
    case 'open': hiss(0.07, 0.2, 3000, 800, 0.9); osc('sine', 660, 990, 0.04, 0.16); break;
    case 'play': // an ember catching: low drone, struck bell, rising air
      osc('sine', 98, 96, 0.2, 1.7); osc('sine', 147, 145, 0.1, 1.5, 0.04);
      osc('sine', 784, 784, 0.07, 1.3, 0.06); osc('sine', 2164, 2164, 0.025, 0.7, 0.06);
      hiss(0.08, 0.7, 350, 5200, 0.6); break;
    case 'ok': osc('sine', 880, 880, 0.08, 0.32); osc('sine', 1320, 1320, 0.07, 0.5, 0.08); break;
    case 'error': osc('triangle', 180, 110, 0.18, 0.26); osc('triangle', 190, 112, 0.1, 0.26, 0.07); break;
  }
}
let hovered = null;
document.addEventListener('mouseover', e => {
  const b = e.target.closest('button, .check');
  if (b !== hovered) { hovered = b; if (b && !b.disabled) sfx('hover'); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.id === 'play' || b.id === 'connect') embers.burst(b);
  sfx(b.id === 'play' || b.id === 'connect' ? 'play' : b.classList.contains('shot') ? 'open' : b.dataset.view ? 'page' : 'click');
}, true);
document.addEventListener('change', e => { if (e.target.type === 'checkbox') sfx('click'); });

/* ---------- actions ---------- */
async function start(connect) {
  if (phase || running) return;
  $('#reel').pause();
  try {
    const v = await api.call('play', { connect });
    render(v);
    phase = null;
    if (v.official) {
      sfx('ok');
      setStatus('已開啟官方 Minecraft 啟動器', '在官方啟動器登入，選「Savaru IV - Kohtalon Mies」後按「遊玩」' + (connect ? '，進遊戲後到「多人遊戲」選 SAVARU' : ''));
      setBar(100, 'full');
      setButtons();
    }
  } catch (e) {
    phase = null;
    if (e.message === 'login_required') { pendingConnect = connect; idleStatus(); setButtons(); return openLogin(); }
    if (e.message === 'no_official_launcher') {
      failed(e);
      return setStatus(errText(e), '', { error: true, action: { label: '下載', run: () => api.call('link', 'https://www.minecraft.net/download') } });
    }
    failed(e);
  }
}
function failed(e) {
  sfx('error');
  setStatus(errText(e), '', { error: true });
  setBar(0);
  setButtons();
}
$('#play').addEventListener('click', () => start(false));
$('#connect').addEventListener('click', () => start(true));

$('#repair').addEventListener('click', async () => {
  if (phase || running) return;
  try { render(await api.call('install', { repair: true })); phase = null; idleStatus(); toast('檢查完成，遊戲檔案都正確。'); }
  catch (e) { phase = null; failed(e); }
});

let speed = { t: 0, b: 0, v: 0 };
api.on('progress', p => {
  phase = p.phase === 'done' ? null : p.phase;
  setButtons();
  switch (p.phase) {
    case 'plan': setStatus('讀取版本資訊…'); setBar(0, 'indeterminate'); break;
    case 'verify': setStatus('檢查遊戲檔案…'); setBar(0, 'indeterminate'); speed = { t: 0, b: 0, v: 0 }; break;
    case 'download': {
      if (!p.filesTotal) break;
      const now = performance.now();
      if (speed.t && now - speed.t > 400) { const inst = (p.done - speed.b) / ((now - speed.t) / 1000); speed.v = speed.v ? speed.v * 0.7 + inst * 0.3 : inst; speed.t = now; speed.b = p.done; }
      if (!speed.t) { speed.t = now; speed.b = p.done; }
      const pct = p.total ? Math.min(100, (p.done / p.total) * 100) : (p.files / p.filesTotal) * 100;
      setStatus(`下載中 ${Math.floor(pct)}%`, `${num(p.files)} / ${num(p.filesTotal)} 個檔案・${mb(Math.min(p.done, p.total))} / ${mb(p.total)}` + (speed.v ? `・${mb(speed.v)}/s` : ''));
      setBar(pct);
      break;
    }
    case 'extract': setStatus('安裝模組包設定…'); setBar(100, 'indeterminate'); break;
    case 'launch': setStatus('啟動遊戲中…', '第一次啟動約需一到兩分鐘'); setBar(100, 'indeterminate'); break;
    case 'done': setBar(100); break;
  }
});

api.on('game', g => {
  running = g.running;
  if (g.running) { setStatus('遊戲執行中', '關閉遊戲後會回到這裡'); setBar(100, 'full'); }
  else if (g.error) failed(new Error(g.error));
  else if (g.code) { setStatus(`遊戲異常結束（代碼 ${g.code}）`, '', { error: true, action: { label: '開啟紀錄檔', run: () => api.call('open', 'logs') } }); setBar(0); }
  else idleStatus();
  setButtons();
});

/* ---------- login ---------- */
async function openLogin() {
  const m = $('#login');
  m.hidden = false;
  const msg = $('#login-msg'), body = $('#login-body');
  if (!V.loginConfigured) { msg.textContent = ERR.login_not_configured; msg.hidden = false; body.hidden = true; return; }
  msg.hidden = true; body.hidden = false;
  $('#login-code').textContent = '· · · · · · · ·';
  $('#login-wait').textContent = '正在取得登入代碼…';
  $('.wait .spin').hidden = false;
  try {
    const v = await api.call('login');
    m.hidden = true;
    render(v);
    toast(`已登入：${v.account.name}`);
    if (pendingConnect !== null) { const c = pendingConnect; pendingConnect = null; start(c); }
  } catch (e) {
    if (e.message === 'cancelled') return;
    $('#login-wait').textContent = errText(e);
    $('.wait .spin').hidden = true;
  }
}
api.on('login-code', d => {
  $('#login-code').textContent = d.code;
  $('#login-wait').textContent = '等待你在瀏覽器完成登入…';
  loginUri = d.uri;
});
$('#login-open').addEventListener('click', () => api.call('link', loginUri || 'https://www.microsoft.com/link'));
$('#login-copy').addEventListener('click', async () => { await api.call('copy', $('#login-code').textContent); toast('已複製登入代碼'); });
$('#login-cancel').addEventListener('click', () => { api.call('login-cancel'); $('#login').hidden = true; pendingConnect = null; });
$('#account').addEventListener('click', () => (V.account ? go('settings') : openLogin()));
$('#logout').addEventListener('click', async () => { render(await api.call('logout')); toast('已登出'); });

/* ---------- settings ---------- */
$('#mem').addEventListener('input', e => { $('#mem-out').textContent = gb(e.target.value); });
$('#mem').addEventListener('change', async e => render(await api.call('settings', { memoryMb: Number(e.target.value) })));
$('#hide-on-launch').addEventListener('change', async e => render(await api.call('settings', { hideOnLaunch: e.target.checked })));
$$('input[name="launcher"]').forEach(r => r.addEventListener('change', async e => render(await api.call('settings', { launcher: e.target.value }))));
$('#ui-sound').addEventListener('change', async e => render(await api.call('settings', { uiSound: e.target.checked })));
$$('[data-open]').forEach(b => b.addEventListener('click', () => api.call('open', b.dataset.open)));
$$('[data-win]').forEach(b => b.addEventListener('click', () => api.call('win', b.dataset.win)));
$('#launcher-update-get').addEventListener('click', () => V.launcherUpdate?.url && api.call('link', V.launcherUpdate.url));

/* ---------- server status ---------- */
async function pingServer() {
  const r = await api.call('ping').catch(() => null);
  const el = $('#server');
  el.classList.toggle('online', !!r);
  el.classList.toggle('offline', !r && !!V?.feed);
  $('#server-line').textContent = r ? `${r.online} / ${r.max} 人在線・${r.ms} ms` : V?.feed ? '目前無法連線' : '—';
}

/* ---------- toast ---------- */
let toastTimer;
function toast(text, error = false) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.toggle('error', error);
  t.classList.add('show');
  sfx(error ? 'error' : 'ok');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- boot ---------- */
(async () => {
  show(0);
  go('home');
  try { render(await api.call('init')); } catch (e) { failed(e); }
  pingServer();
  setInterval(() => { if (!document.hidden) pingServer(); }, 30000);
})();
