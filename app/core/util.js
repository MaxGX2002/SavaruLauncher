// Download, hash and unzip helpers. Plain Node, so the core can be exercised without Electron.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { Readable } = require('stream');

const UA = 'SavaruLauncher/' + require('../../package.json').version;

async function fetchJson(src) {
  if (!/^https?:/i.test(src)) return JSON.parse(await fsp.readFile(src, 'utf8'));
  const res = await fetch(src, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${src}`);
  return res.json();
}

// Fetch a JSON and keep a copy, so a later launch works offline from the copy.
async function cachedJson(url, file) {
  try {
    const j = await fetchJson(url);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, JSON.stringify(j));
    return j;
  } catch (e) {
    if (fs.existsSync(file)) return JSON.parse(await fsp.readFile(file, 'utf8'));
    throw e;
  }
}

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}
const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');

// task: { path, urls: [..], sha1?, size? }. Writes to .part, checks hash/size, then renames.
async function download(task, onBytes) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of task.urls) {
      let got = 0;
      try {
        await fsp.mkdir(path.dirname(task.path), { recursive: true });
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const h = crypto.createHash('sha1');
        const part = task.path + '.part';
        await new Promise((resolve, reject) => {
          const out = fs.createWriteStream(part);
          Readable.fromWeb(res.body)
            .on('data', d => { h.update(d); got += d.length; onBytes(d.length); })
            .on('error', reject)
            .pipe(out).on('finish', resolve).on('error', reject);
        });
        const hex = h.digest('hex');
        if (task.sha1 && hex !== task.sha1) throw new Error(`sha1 mismatch (${hex})`);
        if (task.size && got !== task.size) throw new Error(`size ${got} != ${task.size}`);
        await fsp.rename(part, task.path);
        return;
      } catch (e) {
        onBytes(-got); // give the progress bar its bytes back
        last = new Error(`${path.basename(task.path)}: ${e.message} (${url})`);
      }
    }
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw last;
}

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  });
  await Promise.all(workers);
}

// Minimal zip reader: stored + deflate, no zip64 (packs and jars are far below 4 GB).
function unzip(buf) {
  let eocd = -1;
  for (let p = buf.length - 22; p >= Math.max(0, buf.length - 65557); p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) { eocd = p; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip central directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen).replace(/\\/g, '/');
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    entries.push({
      name,
      read() {
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const raw = buf.subarray(start, start + csize);
        if (method === 0) return raw;
        if (method === 8) return zlib.inflateRawSync(raw);
        throw new Error(`zip method ${method} in ${name}`);
      },
    });
  }
  return entries;
}

// Resolve an entry name under root, refusing anything that would escape it (../, absolute paths).
function safeJoin(root, rel) {
  const out = path.resolve(root, rel);
  if (out !== root && !out.startsWith(root + path.sep)) throw new Error(`unsafe path in archive: ${rel}`);
  return out;
}

module.exports = { UA, fetchJson, cachedJson, sha1File, sha1, download, pool, unzip, safeJoin };
