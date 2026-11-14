// The feed's news entry for one pack version: the English changelog plus its Chinese versions, so the
// launcher shows the one that matches its language setting.
//   pack-changelog-<version>.md           English (also the CurseForge changelog)
//   pack-changelog-<version>.zh-Hant.md   Traditional Chinese, written by hand
//   pack-changelog-<version>.zh-Hans.md   optional; otherwise made from zh-Hant with Windows' own converter
// `node tools/news.js <version>` rewrites feed/launcher.json's news in place (no re-upload of the pack).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = 'D:/minecraft/_tools';

// Windows maps characters only (LCMapString); it leaves 後/於 alone and turns symbols such as ◀ ✕ into "?",
// so only CJK runs go through it, and a few Taiwan-only words get their mainland form afterwards.
// ponytail: character-level conversion, write a .zh-Hans.md by hand if the wording ever matters.
const WORDS = [[/後/g, '后'], [/於/g, '于'], [/滑鼠/g, '鼠标'], [/游标/g, '光标'], [/介面/g, '界面'], [/状态列/g, '状态栏'],
  [/快捷列/g, '快捷栏'], [/法术列/g, '法术栏'], [/预设/g, '默认'], [/资讯/g, '信息'], [/伺服器/g, '服务器'], [/档案/g, '文件'], [/软体/g, '软件']];
function toHans(file) {
  const out = path.join(os.tmpdir(), `zh-hans-${process.pid}.md`);
  const ps = `Add-Type -AssemblyName Microsoft.VisualBasic; $s = [IO.File]::ReadAllText($env:ZH_IN);
    $o = [regex]::Replace($s, '[\\u3400-\\u9fff]+', { param($m) [Microsoft.VisualBasic.Strings]::StrConv($m.Value, 'SimplifiedChinese', 2052) });
    [IO.File]::WriteAllText($env:ZH_OUT, $o, (New-Object Text.UTF8Encoding $false))`;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { env: { ...process.env, ZH_IN: file, ZH_OUT: out } });
  try { return WORDS.reduce((s, [a, b]) => s.replace(a, b), fs.readFileSync(out, 'utf8')); } finally { fs.rmSync(out, { force: true }); }
}

function news(version, english = `${DIR}/pack-changelog-${version}.md`) {
  if (!fs.existsSync(english)) return [];
  const base = english.replace(/\.md$/, ''), read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined;
  const hant = read(`${base}.zh-Hant.md`), hans = read(`${base}.zh-Hans.md`) ?? (hant && toHans(`${base}.zh-Hant.md`));
  if (!hant) console.warn(`no ${base}.zh-Hant.md: the launcher shows the English changelog in every language`);
  const i18n = hant ? { 'zh-Hant': hant, 'zh-Hans': hans } : undefined;
  return [{ title: version, date: new Date().toISOString().slice(0, 10), markdown: fs.readFileSync(english, 'utf8'), i18n }];
}
module.exports = { news };

if (require.main === module) {
  const [version] = process.argv.slice(2);
  const file = path.join(__dirname, '..', 'feed', 'launcher.json');
  const feed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!version || feed.pack.version !== version) { console.error(`usage: news.js <version>  (the feed is ${feed.pack.version})`); process.exit(1); }
  const date = feed.news[0]?.date;
  feed.news = news(version);
  if (date && feed.news[0]) feed.news[0].date = date;
  fs.writeFileSync(file, JSON.stringify(feed, null, 2));
  console.log(`news ${version}: ${Object.keys(feed.news[0]?.i18n || {}).join(', ') || 'English only'}`);
}
