// Installs and launches the pack: Mojang's Java runtime, vanilla 1.21.1, the Fabric loader profile,
// then the pack itself (CurseForge pack zip for overrides + the feed's file list for mods/resource packs).
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const U = require('./util');

const VERSION_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const JAVA_ALL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';
const FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader';
const ASSETS = 'https://resources.download.minecraft.net';

const ARCH = { x64: '', arm64: '-arm64', ia32: '-x86' }[process.arch] ?? '';
const NATIVE = 'natives-windows' + ARCH;
const JAVA_PLATFORM = 'windows' + ({ x64: '-x64', arm64: '-arm64', ia32: '-x86' }[process.arch] ?? '-x64');

function layout(base) {
  const mc = path.join(base, 'minecraft');
  return {
    base, mc,
    versions: path.join(mc, 'versions'),
    libraries: path.join(mc, 'libraries'),
    assets: path.join(mc, 'assets'),
    runtime: path.join(base, 'runtime'),
    game: path.join(base, 'game'),
    cache: path.join(base, 'cache'),
    state: path.join(base, 'state.json'),
  };
}

const fabricId = feed => `fabric-loader-${feed.loader}-${feed.minecraft}`;

// Mojang library rules, Windows only. Feature-gated rules (demo, quick play...) never apply here.
function allow(rules) {
  if (!rules || !rules.length) return true;
  let ok = false;
  for (const r of rules) {
    let m = !r.features;
    if (r.os?.name && r.os.name !== 'windows') m = false;
    if (r.os?.arch && r.os.arch !== (process.arch === 'ia32' ? 'x86' : process.arch)) m = false;
    if (m) ok = r.action === 'allow';
  }
  return ok;
}

function libPath(name) {
  const [coords, ext = 'jar'] = name.split('@');
  const [g, a, v, c] = coords.split(':');
  return path.join(...g.split('.'), a, v, `${a}-${v}${c ? '-' + c : ''}.${ext}`);
}

// Vanilla + Fabric libraries that apply on this machine, Fabric first so it wins on duplicates.
function libraries(L, vanilla, fabric) {
  const out = [], seen = new Set();
  for (const lib of [...fabric.libraries, ...vanilla.libraries]) {
    if (!allow(lib.rules)) continue;
    const [g, a, , c] = lib.name.split('@')[0].split(':');
    if (c?.startsWith('natives-') && c !== NATIVE) continue;
    const key = `${g}:${a}:${c || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const art = lib.downloads?.artifact;
    if (art) out.push({ path: path.join(L.libraries, art.path), urls: [art.url], sha1: art.sha1, size: art.size, native: c === NATIVE });
    else out.push({ path: path.join(L.libraries, libPath(lib.name)), urls: [lib.url.replace(/\/?$/, '/') + libPath(lib.name).replace(/\\/g, '/')], sha1: lib.sha1, size: lib.size, native: c === NATIVE });
  }
  return out;
}

// Immutable JSON (version files, asset index, runtime manifest): reuse the local copy when present.
async function immutableJson(url, file) {
  if (fs.existsSync(file)) return JSON.parse(await fsp.readFile(file, 'utf8'));
  return U.cachedJson(url, file);
}

async function plan(L, feed) {
  const vm = await U.cachedJson(VERSION_MANIFEST, path.join(L.cache, 'version_manifest_v2.json'));
  const ver = vm.versions.find(v => v.id === feed.minecraft);
  if (!ver) throw new Error(`Minecraft ${feed.minecraft} not found`);
  const vanilla = await immutableJson(ver.url, path.join(L.versions, feed.minecraft, feed.minecraft + '.json'));
  const fid = fabricId(feed);
  const fabric = await immutableJson(`${FABRIC_META}/${feed.minecraft}/${feed.loader}/profile/json`, path.join(L.versions, fid, fid + '.json'));

  const tasks = [];
  const c = vanilla.downloads.client;
  tasks.push({ path: path.join(L.versions, feed.minecraft, feed.minecraft + '.jar'), urls: [c.url], sha1: c.sha1, size: c.size });
  const log = vanilla.logging?.client?.file;
  if (log) tasks.push({ path: path.join(L.assets, 'log_configs', log.id), urls: [log.url], sha1: log.sha1, size: log.size });
  const libs = libraries(L, vanilla, fabric);
  tasks.push(...libs);

  const ai = vanilla.assetIndex;
  const index = await immutableJson(ai.url, path.join(L.assets, 'indexes', ai.id + '.json'));
  const seenObj = new Set();
  for (const { hash, size } of Object.values(index.objects)) {
    if (seenObj.has(hash)) continue;
    seenObj.add(hash);
    tasks.push({ path: path.join(L.assets, 'objects', hash.slice(0, 2), hash), urls: [`${ASSETS}/${hash.slice(0, 2)}/${hash}`], sha1: hash, size });
  }

  const component = vanilla.javaVersion?.component || 'java-runtime-delta';
  const all = await U.cachedJson(JAVA_ALL, path.join(L.cache, 'java-all.json'));
  const rt = all[JAVA_PLATFORM]?.[component]?.[0];
  if (!rt) throw new Error(`no Java runtime ${component} for ${JAVA_PLATFORM}`);
  const javaDir = path.join(L.runtime, component);
  const jm = await immutableJson(rt.manifest.url, path.join(L.cache, `java-${component}-${rt.manifest.sha1}.json`));
  for (const [rel, f] of Object.entries(jm.files)) {
    if (f.type !== 'file') continue;
    const raw = f.downloads.raw;
    tasks.push({ path: path.join(javaDir, rel), urls: [raw.url], sha1: raw.sha1, size: raw.size });
  }

  const zip = feed.pack.zip;
  const zipPath = path.join(L.cache, 'packs', feed.pack.version + '.zip');
  tasks.push({ path: zipPath, urls: [zip.url], sha1: zip.sha1, size: zip.size });
  for (const f of feed.files) tasks.push({ path: U.safeJoin(L.game, f.path), urls: f.urls, sha1: f.sha1, size: f.size });

  return { tasks, libs, zipPath, vanilla, fabric, javaDir };
}

async function needed(t, repair) {
  try {
    const st = await fsp.stat(t.path);
    if (t.size && st.size !== t.size) return true;
    if (repair && t.sha1) return (await U.sha1File(t.path)) !== t.sha1;
    return false;
  } catch { return true; }
}

const readState = L => { try { return JSON.parse(fs.readFileSync(L.state, 'utf8')); } catch { return {}; } };

// onProgress({ phase, done, total, files, filesTotal })
async function install(base, feed, { repair = false, onProgress = () => {} } = {}) {
  const L = layout(base);
  onProgress({ phase: 'plan' });
  const p = await plan(L, feed);
  const todo = [];
  onProgress({ phase: 'verify' });
  await U.pool(p.tasks, 16, async t => { if (await needed(t, repair)) todo.push(t); });

  const total = todo.reduce((s, t) => s + (t.size || 0), 0);
  let done = 0, files = 0, lastTick = 0;
  const tick = force => {
    const now = Date.now();
    if (force || now - lastTick > 150) { lastTick = now; onProgress({ phase: 'download', done, total, files, filesTotal: todo.length }); }
  };
  tick(true);
  await U.pool(todo, 8, async t => { await U.download(t, n => { done += n; tick(); }); files++; tick(); });
  tick(true);

  onProgress({ phase: 'extract' });
  const natives = path.join(L.versions, feed.minecraft, 'natives');
  await fsp.mkdir(natives, { recursive: true });
  for (const lib of p.libs.filter(l => l.native)) {
    for (const e of U.unzip(await fsp.readFile(lib.path))) {
      if (e.name.endsWith('.dll')) await fsp.writeFile(path.join(natives, path.basename(e.name)), e.read());
    }
  }

  const state = readState(L);
  // Overrides: a file is (re)written when it is missing or the pack changed it since the last
  // install, so a player's own config edits survive updates that leave that file alone.
  const newOv = {};
  for (const e of U.unzip(await fsp.readFile(p.zipPath))) {
    if (!e.name.startsWith('overrides/')) continue;
    const rel = e.name.slice('overrides/'.length);
    const data = e.read();
    const h = U.sha1(data);
    newOv[rel] = h;
    const dst = U.safeJoin(L.game, rel);
    if (!fs.existsSync(dst) || state.overrides?.[rel] !== h) {
      await fsp.mkdir(path.dirname(dst), { recursive: true });
      await fsp.writeFile(dst, data);
    }
  }
  for (const [rel, h] of Object.entries(state.overrides || {})) {
    if (rel in newOv) continue;
    const dst = U.safeJoin(L.game, rel);
    if (fs.existsSync(dst) && (await U.sha1File(dst)) === h) await fsp.unlink(dst);
  }
  // Feed files that left the pack (old mod versions) go, or the game would load both copies.
  const keep = new Set(feed.files.map(f => f.path));
  for (const rel of Object.keys(state.files || {})) {
    if (!keep.has(rel)) await fsp.rm(U.safeJoin(L.game, rel), { force: true });
  }
  await writeServers(L.game, feed.server);

  const next = { packVersion: feed.pack.version, installedAt: new Date().toISOString(), files: Object.fromEntries(feed.files.map(f => [f.path, f.sha1])), overrides: newOv };
  await fsp.writeFile(L.state, JSON.stringify(next));
  // Keep only the current pack zip.
  for (const z of await fsp.readdir(path.dirname(p.zipPath))) if (path.join(path.dirname(p.zipPath), z) !== p.zipPath) await fsp.rm(path.join(path.dirname(p.zipPath), z), { force: true });
  onProgress({ phase: 'done' });
  return next;
}

// Adds the pack's server to the multiplayer list when it is not there yet (servers.dat, uncompressed NBT).
async function writeServers(gameDir, server) {
  if (!server?.address) return;
  const file = path.join(gameDir, 'servers.dat');
  if (fs.existsSync(file)) return; // ponytail: never rewrite a list the player already has; the connect button covers it
  const str = (name, val) => { const n = Buffer.from(name), v = Buffer.from(val); const b = Buffer.alloc(5 + n.length + v.length); b[0] = 8; b.writeUInt16BE(n.length, 1); n.copy(b, 3); b.writeUInt16BE(v.length, 3 + n.length); v.copy(b, 5 + n.length); return b; };
  const head = Buffer.from([10, 0, 0, 9, 0, 7, ...Buffer.from('servers'), 10, 0, 0, 0, 1]);
  await fsp.writeFile(file, Buffer.concat([head, str('name', server.name || 'Savaru'), str('ip', server.address), Buffer.from([0, 0])]));
}

function isInstalled(base, feed) {
  const L = layout(base);
  const s = readState(L);
  return { version: s.packVersion || null, upToDate: !!feed && s.packVersion === feed.pack.version };
}

// Offline-mode UUID the way vanilla derives it (UUID v3 of "OfflinePlayer:<name>"), for dev runs only.
function offlineUuid(name) {
  const h = require('crypto').createHash('md5').update('OfflinePlayer:' + name).digest();
  h[6] = (h[6] & 0x0f) | 0x30; h[8] = (h[8] & 0x3f) | 0x80;
  return h.toString('hex');
}

// Builds the java command line from the installed version files.
function launchCommand(base, feed, account, { memoryMb = 8192, server, msaClientId = '' } = {}) {
  const L = layout(base);
  const vanilla = JSON.parse(fs.readFileSync(path.join(L.versions, feed.minecraft, feed.minecraft + '.json'), 'utf8'));
  const fid = fabricId(feed);
  const fabric = JSON.parse(fs.readFileSync(path.join(L.versions, fid, fid + '.json'), 'utf8'));
  const cp = libraries(L, vanilla, fabric).map(l => l.path);
  cp.push(path.join(L.versions, feed.minecraft, feed.minecraft + '.jar'));
  const component = vanilla.javaVersion?.component || 'java-runtime-delta';
  const vars = {
    natives_directory: path.join(L.versions, feed.minecraft, 'natives'),
    launcher_name: 'savaru-launcher', launcher_version: require('../../package.json').version,
    classpath: cp.join(';'), classpath_separator: ';', library_directory: L.libraries,
    version_name: fid, version_type: 'release', game_directory: L.game,
    assets_root: L.assets, assets_index_name: vanilla.assetIndex.id,
    auth_player_name: account.name, auth_uuid: account.uuid, auth_access_token: account.token,
    auth_xuid: account.xuid || '0', clientid: msaClientId || '0', user_type: account.type || 'msa',
  };
  const expand = list => {
    const out = [];
    for (const a of list || []) {
      if (typeof a === 'string') out.push(a);
      else if (allow(a.rules)) out.push(...[].concat(a.value));
    }
    return out.map(s => s.replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)));
  };
  const args = [`-Xmx${memoryMb}M`, ...expand(fabric.arguments?.jvm), ...expand(vanilla.arguments.jvm)];
  const log = vanilla.logging?.client;
  if (log) args.push(log.argument.replace('${path}', path.join(L.assets, 'log_configs', log.file.id)));
  args.push(fabric.mainClass, ...expand(vanilla.arguments.game), ...expand(fabric.arguments?.game));
  if (server) args.push('--quickPlayMultiplayer', server);
  return { java: path.join(L.runtime, component, 'bin', 'javaw.exe'), args, cwd: L.game };
}

module.exports = { layout, install, isInstalled, launchCommand, offlineUuid, writeServers };
