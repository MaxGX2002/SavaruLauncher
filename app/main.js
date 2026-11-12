const { app, BrowserWindow, ipcMain, shell, safeStorage, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const game = require('./core/game');
const auth = require('./core/auth');
const { ping } = require('./core/ping');
const U = require('./core/util');
const CONFIG = require('./config.json');

// Game files live beside .minecraft, not in Electron's userData (which also holds browser caches).
const BASE = process.env.SAVARU_HOME || path.join(app.getPath('appData'), '.savaru-iv');
const FEED_URL = process.env.SAVARU_FEED || CONFIG.feedUrl;
const CLIENT_ID = process.env.SAVARU_MSA_CLIENT_ID || CONFIG.msaClientId;
// Dev runs only (npx electron .): a packaged build always requires a Microsoft sign-in.
const DEV_OFFLINE = !app.isPackaged && process.env.SAVARU_DEV_OFFLINE;
const F = {
  settings: path.join(BASE, 'settings.json'),
  account: path.join(BASE, 'account.dat'),
  feed: path.join(BASE, 'cache', 'feed.json'),
};

let win, feed = null, feedOnline = false, busy = false, gameProc = null, loginCancel = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { win.show(); if (win.isMinimized()) win.restore(); win.focus(); } });

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1)); };
const send = (ch, d) => win && !win.isDestroyed() && win.webContents.send(ch, d);

const totalMemMb = Math.floor(os.totalmem() / 1048576);
function settings() {
  const def = { memoryMb: totalMemMb >= 15000 ? 8192 : totalMemMb >= 11000 ? 6144 : 4096, hideOnLaunch: true, uiSound: true };
  return { ...def, ...readJson(F.settings, {}) };
}

// Account: Microsoft refresh token + the current Minecraft session, encrypted with Windows DPAPI.
function loadAccount() {
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(F.account))); } catch { return null; }
}
function saveAccount(a) {
  fs.mkdirSync(BASE, { recursive: true });
  if (a) fs.writeFileSync(F.account, safeStorage.encryptString(JSON.stringify(a)));
  else fs.rmSync(F.account, { force: true });
}
async function session() {
  if (DEV_OFFLINE) return { name: DEV_OFFLINE, uuid: game.offlineUuid(DEV_OFFLINE), token: '0', type: 'legacy' };
  const a = loadAccount();
  if (!a) throw new Error('login_required');
  if (a.mc && a.mc.expiresAt > Date.now() + 10 * 60 * 1000) return a.mc;
  const ms = await auth.refresh(CLIENT_ID, a.refresh);
  const mc = await auth.minecraftLogin(ms.access_token);
  saveAccount({ refresh: ms.refresh_token || a.refresh, mc });
  return mc;
}

async function loadFeed() {
  try {
    if (!FEED_URL) throw new Error('no feed url');
    feed = await U.fetchJson(FEED_URL);
    writeJson(F.feed, feed);
    feedOnline = true;
  } catch {
    feed = readJson(F.feed, null);
    feedOnline = false;
  }
  return feed;
}

const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

function view() {
  const inst = game.isInstalled(BASE, feed);
  const acc = DEV_OFFLINE ? { name: DEV_OFFLINE } : loadAccount()?.mc;
  return {
    feed: feed && { version: feed.pack.version, minecraft: feed.minecraft, loader: feed.loader, server: feed.server, news: feed.news, files: feed.files.length, sizeMb: Math.round(feed.files.reduce((s, f) => s + f.size, 0) / 1048576) },
    feedOnline,
    installed: inst.version, upToDate: inst.upToDate,
    account: acc ? { name: acc.name } : null,
    loginConfigured: !!CLIENT_ID || !!DEV_OFFLINE,
    settings: settings(), totalMemMb,
    launcherVersion: app.getVersion(),
    launcherUpdate: feed?.launcher?.version && newer(feed.launcher.version, app.getVersion()) ? feed.launcher : null,
    running: !!gameProc,
  };
}

async function exclusive(fn) {
  if (busy) throw new Error('busy');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}

async function ensureInstalled(repair) {
  if (!feed) await loadFeed();
  if (!feed) throw new Error('no_feed');
  await game.install(BASE, feed, { repair, onProgress: p => send('progress', p) });
}

const handlers = {
  init: async () => { await loadFeed(); return view(); },
  refresh: async () => { await loadFeed(); return view(); },
  install: ({ repair } = {}) => exclusive(async () => { await ensureInstalled(repair); return view(); }),
  play: ({ connect } = {}) => exclusive(async () => {
    if (gameProc) throw new Error('already_running');
    const acc = await session();
    await ensureInstalled(false);
    send('progress', { phase: 'launch' });
    const s = settings();
    const cmd = game.launchCommand(BASE, feed, acc, { memoryMb: s.memoryMb, server: connect ? feed.server.address : null, msaClientId: CLIENT_ID });
    gameProc = spawn(cmd.java, cmd.args, { cwd: cmd.cwd, stdio: 'ignore', windowsHide: false });
    const started = Date.now();
    gameProc.on('exit', code => {
      gameProc = null;
      if (win && !win.isDestroyed()) { win.show(); win.focus(); }
      send('game', { running: false, code, seconds: Math.round((Date.now() - started) / 1000) });
    });
    gameProc.on('error', e => { gameProc = null; send('game', { running: false, error: e.message }); });
    send('game', { running: true });
    if (s.hideOnLaunch) setTimeout(() => gameProc && win.hide(), 4000);
    return view();
  }),
  login: async () => {
    if (!CLIENT_ID) throw new Error('login_not_configured');
    loginCancel = false;
    const dc = await auth.startDeviceLogin(CLIENT_ID);
    send('login-code', { code: dc.user_code, uri: dc.verification_uri });
    const ms = await auth.pollDeviceLogin(CLIENT_ID, dc, () => loginCancel);
    const mc = await auth.minecraftLogin(ms.access_token);
    saveAccount({ refresh: ms.refresh_token, mc });
    return view();
  },
  'login-cancel': () => { loginCancel = true; },
  logout: () => { saveAccount(null); return view(); },
  settings: s => {
    const cur = settings();
    const next = { memoryMb: Math.max(2048, Math.min(Number(s.memoryMb) || cur.memoryMb, totalMemMb - 1024)), hideOnLaunch: s.hideOnLaunch ?? cur.hideOnLaunch, uiSound: s.uiSound ?? cur.uiSound };
    writeJson(F.settings, next);
    return view();
  },
  ping: async () => { if (!feed?.server) return null; try { return await ping(feed.server.address); } catch { return null; } },
  open: what => {
    const L = game.layout(BASE);
    const target = { game: L.game, logs: path.join(L.game, 'logs'), crash: path.join(L.game, 'crash-reports') }[what];
    if (target) { fs.mkdirSync(target, { recursive: true }); return shell.openPath(target); }
  },
  link: url => { if (/^https:\/\//.test(url)) return shell.openExternal(url); },
  copy: text => clipboard.writeText(String(text)),
  win: action => { if (action === 'min') win.minimize(); else if (action === 'close') win.close(); },
};

// Errors cross IPC as plain codes so the page can show its own wording.
for (const [ch, fn] of Object.entries(handlers)) {
  ipcMain.handle(ch, async (e, arg) => {
    try { return { ok: true, value: await fn(arg) }; } catch (err) { return { ok: false, error: err.message }; }
  });
}

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1200, height: 720, minWidth: 1040, minHeight: 640,
    frame: false, backgroundColor: '#15120e', show: false,
    title: 'Savaru IV Launcher', icon: path.join(__dirname, 'img', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  // Dev only: SAVARU_DEV_SHOT=<png> captures the window once the page settles (after SAVARU_DEV_JS runs).
  if (process.env.SAVARU_DEV_SHOT) {
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      if (process.env.SAVARU_DEV_JS) await win.webContents.executeJavaScript(process.env.SAVARU_DEV_JS).catch(() => {});
      setTimeout(async () => { fs.writeFileSync(process.env.SAVARU_DEV_SHOT, (await win.webContents.capturePage()).toPNG()); if (process.env.SAVARU_DEV_QUIT) app.quit(); }, 2500);
    }, 1500));
  }
  win.webContents.setWindowOpenHandler(({ url }) => { handlers.link(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
});
app.on('window-all-closed', () => app.quit());
