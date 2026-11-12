// Dev check: install the feed into a scratch folder without Electron.  node tools/dev-install.js <base> [--repair]
const game = require('../app/core/game');
const feed = require('../feed/launcher.json');
const t0 = Date.now(); let next = 0;
const log = s => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
game.install(process.argv[2], feed, { repair: process.argv.includes('--repair'), onProgress: p => {
  if (p.phase !== 'download') return log(p.phase);
  if (Date.now() < next && p.files !== p.filesTotal) return;
  next = Date.now() + 5000;
  log(`download ${p.files}/${p.filesTotal} files, ${(p.done / 1048576).toFixed(0)}/${(p.total / 1048576).toFixed(0)} MB`);
} }).then(s => log(`installed ${s.packVersion}: ${Object.keys(s.files).length} files, ${Object.keys(s.overrides).length} overrides`), e => { console.error('FAILED', e); process.exit(1); });
