// Builds launcher.json (the launcher's update feed) for one released pack version.
//   node tools/build-feed.js <version> <curseforgeFileId> [--out launcher.json]
// Reads the staged manifest from _tools/pack-build/pack-<version>, resolves every file through the
// test instance's minecraftinstance.json (name, sha1, size, distribution flag), prefers Modrinth's
// copy of the identical file (same sha1) and falls back to CurseForge's CDN only for files whose
// authors allow third-party distribution. Every URL is probed before the feed is written.
// The pack zip, and any of the author's own jars that CurseForge is still reviewing, go up to a GitHub release
// `pack-<version>` (not marked latest), so the launcher gets a build before CurseForge approves it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [version, fileIdArg] = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
if (!version || !fileIdArg) { console.error('usage: build-feed.js <version> <curseforgeFileId> [--out file]'); process.exit(1); }
const fileId = Number(fileIdArg);
const PB = opt('--pack-build', 'D:/minecraft/_tools/pack-build');
const INST = opt('--instance', 'D:/minecraft/Instances/TESTSAVARUIV');
const MAIN = 'D:/minecraft/Instances/Savaru IV - Kohtalon Mies';
const ZIP = opt('--zip', `C:/Users/User/Downloads/Savaru IV - Kohtalon Mies-${version}.zip`);
const CHANGELOG = opt('--changelog', `D:/minecraft/_tools/pack-changelog-${version}.md`);
const OUT = opt('--out', path.join(__dirname, '..', 'feed', 'launcher.json'));
const UA = 'SavaruLauncher-feed/1.0';
const GH = opt('--gh', 'C:/Users/User/Downloads/ModTest/_tools/gh/bin/gh.exe');
const REPO = 'MaxGX2002/SavaruLauncher';
const TAG = `pack-${version}`;
const ghUrl = name => `https://github.com/${REPO}/releases/download/${TAG}/${encodeURIComponent(name)}`;
const gh = (...args) => execFileSync(GH, [...args, '--repo', REPO], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
function ghUpload(file, name) {
  try { gh('release', 'view', TAG); } catch {
    gh('release', 'create', TAG, '--latest=false', '--title', `Modpack ${version}`, '--notes', `Savaru IV - Kohtalon Mies ${version}: files for the launcher.`);
  }
  const tmp = path.join(require('os').tmpdir(), name);
  fs.copyFileSync(file, tmp);
  try { gh('release', 'upload', TAG, tmp, '--clobber'); } finally { fs.rmSync(tmp, { force: true }); }
  return ghUrl(name);
}

const sha1 = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
const cdn = (id, name) => `https://mediafilez.forgecdn.net/files/${Math.floor(id / 1000)}/${id % 1000}/${encodeURIComponent(name)}`;

async function probe(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0', 'User-Agent': UA } });
    await r.body?.cancel();
    return r.status === 206 || r.status === 200;
  } catch { return false; }
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(`${PB}/pack-${version}/manifest.json`, 'utf8'));
  const addons = new Map();
  for (const inst of [INST, MAIN]) {
    const j = JSON.parse(fs.readFileSync(`${inst}/minecraftinstance.json`, 'utf8'));
    for (const a of j.installedAddons) if (!addons.has(a.installedFile.id)) addons.set(a.installedFile.id, a);
  }
  const extra = JSON.parse(fs.readFileSync(`${PB}/pack-extra.json`, 'utf8'));
  const refs = JSON.parse(fs.readFileSync(`${PB}/packmap-extra.json`, 'utf8')).referenced;

  const files = [];
  for (const m of manifest.files) {
    const a = addons.get(m.fileID);
    if (a) {
      const f = a.installedFile;
      const dir = path.basename(a.modFolderPath || 'mods');
      files.push({ path: `${dir}/${f.fileName}`, name: a.name, sha1: f.hashes.find(h => h.type === 1).value, size: f.fileLength, cf: cdn(f.id, f.fileName), dist: a.allowModDistribution !== false });
      continue;
    }
    const x = extra.find(e => e.fileID === m.fileID), r = refs.find(e => e.fileID === m.fileID);
    const rel = x ? `mods/${x.jar}` : r ? `${r.dir}/${r.file}` : null;
    if (!rel || !fs.existsSync(`${INST}/${rel}`)) { console.error(`unresolved manifest entry ${m.projectID}/${m.fileID}`); process.exit(1); }
    // ponytail: pack-extra files are the author's own uploads (or ones already checked), so CF distribution is allowed
    files.push({ path: rel, name: path.basename(rel), sha1: sha1(`${INST}/${rel}`), size: fs.statSync(`${INST}/${rel}`).size, cf: cdn(m.fileID, path.basename(rel)), dist: true, own: `${INST}/${rel}` });
  }

  const mr = await (await fetch('https://api.modrinth.com/v2/version_files', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ hashes: files.map(f => f.sha1), algorithm: 'sha1' }),
  })).json();

  const out = [], dropped = [];
  for (const f of files) {
    const urls = [];
    const v = mr[f.sha1];
    const mf = v?.files.find(x => x.hashes.sha1 === f.sha1);
    if (mf) urls.push(mf.url);
    if (f.dist) urls.push(f.cf);
    if (!urls.length) { dropped.push(f); continue; }
    out.push({ path: f.path, sha1: f.sha1, size: f.size, urls, own: f.own });
  }

  // Probe the first URL of every file; a dead first URL with a live second one is fine but noted.
  // The author's own jars that are dead everywhere (still in CurseForge review) are put on the GitHub release.
  let bad = 0, fallback = 0;
  const rehost = [];
  for (let i = 0; i < out.length; i += 16) {
    await Promise.all(out.slice(i, i + 16).map(async f => {
      if (await probe(f.urls[0])) return;
      if (f.urls[1] && await probe(f.urls[1])) { fallback++; f.urls.reverse(); return; }
      if (f.own) return rehost.push(f);
      bad++; console.error(`dead: ${f.path}  ${f.urls.join(' | ')}`);
    }));
  }
  for (const f of rehost) { f.urls = [ghUpload(f.own, path.basename(f.path)), ...f.urls]; console.log(`on GitHub (CurseForge still reviewing): ${f.path}`); }
  for (const f of out) delete f.own;

  const zipName = `Savaru-IV-${version}.zip`;
  const zip = { url: ghUpload(ZIP, zipName), sha1: sha1(ZIP), size: fs.statSync(ZIP).size };
  if (!(await probe(zip.url))) { console.error(`pack zip not reachable: ${zip.url}`); bad++; }

  const ml = manifest.minecraft.modLoaders[0].id; // fabric-0.19.5
  const feed = {
    format: 1,
    generated: new Date().toISOString(),
    minecraft: manifest.minecraft.version,
    loader: ml.replace(/^fabric-/, ''),
    pack: { version, fileId, zip },
    recommendedMemoryMb: 8192,
    server: { name: 'SAVARU', address: 'china-sensors.gl.joinmc.link' },
    news: fs.existsSync(CHANGELOG) ? [{ title: version, date: new Date().toISOString().slice(0, 10), markdown: fs.readFileSync(CHANGELOG, 'utf8') }] : [],
    launcher: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'feed', 'launcher-release.json'), 'utf8')),
    files: out,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(feed, null, 2));
  const mrCount = out.filter(f => f.urls[0].includes('modrinth')).length;
  console.log(`files ${out.length} (Modrinth ${mrCount}, CurseForge ${out.length - mrCount}, switched to fallback ${fallback}), dead ${bad}`);
  if (dropped.length) console.log('left out (no permitted source):\n  ' + dropped.map(f => `${f.name}  [${f.path}]`).join('\n  '));
  console.log(`wrote ${OUT}`);
  if (bad) process.exit(2);
})();
