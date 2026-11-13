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
// The official launcher's folder (launcher_profiles.json, versions/). SAVARU_MC_DIR points tests elsewhere.
const MC_DIR = process.env.SAVARU_MC_DIR || path.join(app.getPath('appData'), '.minecraft');
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
const LANGS = ['zh-Hant', 'zh-Hans', 'en'];
// First run picks the language from Windows: any Chinese → Traditional unless it is the mainland/Singapore form.
function systemLang() {
  const zh = [...app.getPreferredSystemLanguages(), app.getSystemLocale()].map(s => s.toLowerCase()).find(s => s.startsWith('zh'));
  return !zh ? 'en' : /hans|cn|sg/.test(zh) ? 'zh-Hans' : 'zh-Hant';
}
function settings() {
  // launcher: 'official' = hand off to the official Minecraft Launcher (default), 'direct' = our own Microsoft sign-in.
  const def = { memoryMb: totalMemMb >= 15000 ? 8192 : totalMemMb >= 11000 ? 6144 : 4096, hideOnLaunch: true, uiSound: true, autoUpdate: true, launcher: 'official', lang: systemLang() };
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
    // The query string skips GitHub's 5-minute raw cache, so a pushed update shows up at once.
    feed = await U.fetchJson(/^https?:/.test(FEED_URL) ? `${FEED_URL}?t=${Date.now()}` : FEED_URL);
    writeJson(F.feed, feed);
    feedOnline = true;
    startSelfUpdate();
  } catch {
    feed = readJson(F.feed, null);
    feedOnline = false;
  }
  return feed;
}

// Self-update (packaged builds only): download the zip named in feed.launcher.download, unpack it under the cache,
// and once nothing is running, quit and let a hidden PowerShell copy it over this install and start it again.
let selfUpdate = null; // { version, state: 'download' | 'ready' | 'error', pct }
async function startSelfUpdate() {
  const L = feed?.launcher;
  if (!app.isPackaged || selfUpdate || !L?.download || !newer(L.version, app.getVersion())) return;
  const report = s => { selfUpdate = s; send('self-update', s); };
  report({ version: L.version, state: 'download', pct: 0 });
  try {
    const dir = path.join(BASE, 'cache', `launcher-${L.version}`), zip = dir + '.zip';
    let got = 0;
    if (!fs.existsSync(zip) || await U.sha1File(zip) !== L.download.sha1) {
      await U.download({ path: zip, urls: [L.download.url], sha1: L.download.sha1, size: L.download.size }, n => {
        got += n;
        const pct = Math.floor((got / L.download.size) * 100);
        if (pct !== selfUpdate.pct) report({ ...selfUpdate, pct });
      });
    }
    // Electron's fs treats any path through an .asar file as the inside of an archive, so writing
    // resources/app.asar fails unless that is switched off while unpacking.
    process.noAsar = true;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      for (const e of U.unzip(fs.readFileSync(zip))) {
        const out = U.safeJoin(dir, e.name);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, e.read());
      }
    } finally { process.noAsar = false; }
    // The zip holds one folder with the exe in it.
    const exe = path.basename(process.execPath);
    const src = [dir, ...fs.readdirSync(dir).map(d => path.join(dir, d))].find(d => fs.existsSync(path.join(d, exe)));
    if (!src) throw new Error(`no ${exe} in the update`);
    report({ ...selfUpdate, state: 'ready' });
    const apply = () => (busy || gameProc ? setTimeout(apply, 3000) : applySelfUpdate(src));
    setTimeout(apply, 2500);
  } catch (e) {
    report({ ...selfUpdate, state: 'error', error: e.message });
  }
}
function applySelfUpdate(src) {
  const q = s => `'${s.replace(/'/g, "''")}'`;
  // ponytail: copies over the old files without deleting any (the folder may hold the player's own files); stale Electron files are harmless.
  const ps = [
    `$p = ${process.pid}; while (Get-Process -Id $p -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 300 }`,
    `robocopy ${q(src)} ${q(path.dirname(process.execPath))} /E /R:20 /W:1 /NFL /NDL /NJH /NJS | Out-Null`,
    `Start-Process -FilePath ${q(process.execPath)}` + (process.argv.length > 1 ? ` -ArgumentList ${process.argv.slice(1).map(a => q(`"${a}"`)).join(',')}` : ''),
  ].join('\n');
  // A detached PowerShell exits at once (no console), and a plain child dies with libuv's kill-on-close job;
  // a Start-Process grandchild breaks away from that job, so the outer one only relays and we quit once it has.
  const relay = `Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${Buffer.from(ps, 'utf16le').toString('base64')}'`;
  const c = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', relay], { stdio: 'ignore', windowsHide: true });
  c.on('exit', () => app.quit());
  c.on('error', () => app.quit());
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
    mods: feed ? feed.files.filter(f => f.path.startsWith('mods/')).map(f => f.path.slice(5)) : [],
    launcherUpdate: feed?.launcher?.version && newer(feed.launcher.version, app.getVersion()) ? feed.launcher : null,
    selfUpdate,
    running: !!gameProc,
  };
}

// The official Minecraft Launcher: the Microsoft Store / Xbox app package, or the older standalone install.
// Returns a function that opens it; throws first when neither is installed.
function officialLauncher() {
  const pkg = 'Microsoft.4297127D64EC6_8wekyb3d8bbwe';
  const exe = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Minecraft Launcher', 'MinecraftLauncher.exe');
  const run = (cmd, args) => () => spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  if (fs.existsSync(path.join(process.env.LOCALAPPDATA || '', 'Packages', pkg))) return run('explorer.exe', [`shell:AppsFolder\\${pkg}!Minecraft`]);
  if (fs.existsSync(exe)) return run(exe, []);
  throw new Error('no_official_launcher');
}

async function exclusive(fn) {
  if (busy) throw new Error('busy');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}

// Every Play / repair checks the feed again, so a launcher left open still gets the newest pack.
async function ensureInstalled(repair) {
  await loadFeed();
  if (!feed) throw new Error('no_feed');
  await game.install(BASE, feed, { repair, onProgress: p => send('progress', p) });
}

// The game holds logs/latest.log open while it runs (from either launcher), and Windows refuses to rename an
// open file, so this also sees a game the official launcher started. Mod jars must not change under it.
function gameRunning() {
  if (gameProc) return true;
  const log = path.join(game.layout(BASE).game, 'logs', 'latest.log');
  try { fs.renameSync(log, log + '.chk'); fs.renameSync(log + '.chk', log); return false; } catch (e) { return e.code !== 'ENOENT'; }
}

// Auto-update (setting, on by default): once the pack is installed, a newer pack version is fetched in the
// background at start and every 10 minutes, unless the game is running or another task is busy.
// ponytail: a first install still waits for Play, it is several GB.
async function autoUpdate() {
  if (!settings().autoUpdate || busy || gameRunning()) return;
  await loadFeed();
  const inst = game.isInstalled(BASE, feed);
  if (!feedOnline || !inst.version || inst.upToDate || busy || gameRunning()) return;
  try {
    await exclusive(() => ensureInstalled(false));
    send('auto-update', { ok: true, view: view() });
  } catch (e) { send('auto-update', { ok: false, error: e.message, view: view() }); }
}

const handlers = {
  init: async () => { await loadFeed(); return view(); },
  refresh: async () => { await loadFeed(); return view(); },
  install: ({ repair } = {}) => exclusive(async () => { await ensureInstalled(repair); return view(); }),
  play: () => exclusive(async () => {
    if (gameProc) throw new Error('already_running');
    // Official mode: install, then hand off to the official launcher, which does its own sign-in.
    if (!DEV_OFFLINE && settings().launcher !== 'direct') {
      const launch = officialLauncher();
      await ensureInstalled(false);
      await game.officialProfile(BASE, feed, MC_DIR, { memoryMb: settings().memoryMb, icon: 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'img', 'profile-icon.png')).toString('base64') });
      launch();
      return { ...view(), official: true };
    }
    const acc = await session();
    await ensureInstalled(false);
    send('progress', { phase: 'launch' });
    const s = settings();
    const cmd = game.launchCommand(BASE, feed, acc, { memoryMb: s.memoryMb, msaClientId: CLIENT_ID });
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
    const next = { memoryMb: Math.max(2048, Math.min(Number(s.memoryMb) || cur.memoryMb, totalMemMb - 1024)), hideOnLaunch: s.hideOnLaunch ?? cur.hideOnLaunch, uiSound: s.uiSound ?? cur.uiSound, autoUpdate: s.autoUpdate ?? cur.autoUpdate,
      launcher: ['official', 'direct'].includes(s.launcher) ? s.launcher : cur.launcher, lang: LANGS.includes(s.lang) ? s.lang : cur.lang };
    writeJson(F.settings, next);
    if (next.autoUpdate && !cur.autoUpdate) setTimeout(autoUpdate, 500);
    return view();
  },
  ping: async () => { if (!feed?.server) return null; try { return await ping(feed.server.address); } catch { return null; } },
  open: what => {
    const L = game.layout(BASE);
    const target = { game: L.game, logs: path.join(L.game, 'logs'), crash: path.join(L.game, 'crash-reports') }[what];
    if (target) { fs.mkdirSync(target, { recursive: true }); return shell.openPath(target); }
  },
  link: url => { if (/^https:\/\//.test(url)) return shell.openExternal(url); },
  // Comment wall: posts go to a one-question Google Form as "【name】text"; reads come from its response
  // sheet's gviz JSON (columns A = timestamp, B = answer, newest first). null = not configured in the feed yet.
  // ponytail: no server-side moderation, the owner deletes rows in the sheet.
  comments: async () => {
    const c = feed?.launcher?.comments;
    if (!c) return null;
    const t = await (await fetch(c.read)).text();
    return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).table.rows.map(r => {
      const s = String(r.c[1]?.v ?? ''), m = s.match(/^【([^】]{1,16})】([\s\S]*)$/);
      return { at: r.c[0]?.f ?? '', name: m ? m[1] : '玩家', text: (m ? m[2] : s).trim() };
    }).filter(r => r.text);
  },
  comment: async ({ name, text } = {}) => {
    const c = feed?.launcher?.comments;
    if (!c) throw new Error('comments_off');
    name = String(name ?? '').replace(/[【】\s]+/g, ' ').trim().slice(0, 16);
    text = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!name || !text) throw new Error('comment_empty');
    const r = await fetch(c.post, { method: 'POST', body: new URLSearchParams({ [c.entry]: `【${name}】${text}` }) }).catch(() => null);
    if (!r?.ok) throw new Error('comment_failed');
  },
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
  setTimeout(autoUpdate, 10000);
  setInterval(autoUpdate, 10 * 60 * 1000);
});
app.on('window-all-closed', () => app.quit());
