'use strict';
const api = window.savaru;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n).toLocaleString('zh-TW');
const mb = b => `${num(Math.round(b / 1048576))} MB`;
const gb = m => `${(m / 1024).toFixed(1)} GB`;

// The pack's own art (FancyMenu title-screen backgrounds); pos keeps each picture's subject in frame.
const ART = [
  { src: 'ruins.jpg', pos: '28% 50%' },
  { src: 'golden-valley.jpg', pos: '50% 62%' },
  { src: 'mages.jpg', pos: '30% 50%' },
  { src: 'night-siege-a.jpg', pos: '50% 50%' },
  { src: 'tapestry.jpg', pos: '50% 50%' },
  { src: 'night-siege-b.jpg', pos: '46% 50%' },
];

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
  $('#latest-version').textContent = news.length ? `最新版本 ${news[0].title || V.feed.version}・查看更新日誌` : '查看更新日誌';
}

/* ---------- navigation ---------- */
function go(view) {
  for (const b of $$('.nav button')) {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  for (const id of ['home', 'notes', 'settings']) $('#view-' + id).hidden = id !== view;
}
document.addEventListener('click', e => {
  const v = e.target.closest('[data-view]');
  if (v) go(v.dataset.view);
});

/* ---------- background art ---------- */
let slide = 0, front = 0, timer;
const layers = $$('.bg-img');
function show(i) {
  slide = (i + ART.length) % ART.length;
  const a = ART[slide], el = layers[1 - front];
  el.style.transition = 'none';
  el.classList.remove('on');
  el.style.backgroundImage = `url("../img/art/${a.src}")`;
  el.style.backgroundPosition = a.pos;
  void el.offsetWidth;
  el.style.transition = '';
  el.classList.add('on');
  layers[front].classList.remove('on');
  front = 1 - front;
  $$('#slides button').forEach((b, k) => b.setAttribute('aria-current', String(k === slide)));
  clearTimeout(timer);
  timer = setTimeout(() => show(slide + 1), 9000);
}
$('#slides').innerHTML = ART.map((a, i) => `<button type="button" aria-label="背景 ${i + 1}"></button>`).join('');
$$('#slides button').forEach((b, i) => b.addEventListener('click', () => show(i)));
ART.forEach(a => { new Image().src = `../img/art/${a.src}`; });

/* ---------- actions ---------- */
async function start(connect) {
  if (phase || running) return;
  try {
    render(await api.call('play', { connect }));
    phase = null;
  } catch (e) {
    phase = null;
    if (e.message === 'login_required') { pendingConnect = connect; idleStatus(); setButtons(); return openLogin(); }
    failed(e);
  }
}
function failed(e) {
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
