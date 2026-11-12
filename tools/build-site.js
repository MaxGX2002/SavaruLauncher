// Builds the launcher download site (GitHub Pages, /docs): one static page per language, plus sitemap and robots.
//   node tools/build-site.js
// The download button points at feed/launcher-release.json's zip; on the page it re-reads the live feed, so a newer
// launcher shows up without rebuilding the site.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SITE = 'https://maxgx2002.github.io/SavaruLauncher/';
const FEED = 'https://raw.githubusercontent.com/MaxGX2002/SavaruLauncher/main/feed/launcher.json';
const REL = JSON.parse(fs.readFileSync(path.join(ROOT, 'feed', 'launcher-release.json'), 'utf8'));
const MB = Math.round(REL.download.size / 1048576);
const LINKS = {
  drive: 'https://drive.google.com/drive/folders/1Un56ypTeW6AAHxbRl9N9nYQxPtudrF1e?usp=sharing',
  releases: 'https://github.com/MaxGX2002/SavaruLauncher/releases',
  discord: 'https://discord.gg/frQnpEaeuv',
  curseforge: 'https://www.curseforge.com/minecraft/modpacks/savaru-iv-kohtalon-mies',
  lore: 'https://docs.google.com/document/d/1kDIe_N-GSflMmY8PkAwJJxg2RFzZhaXnldV_x2uOz9o/edit?usp=sharing',
  feedback: 'https://forms.gle/woosFJuVwbA4FJZy7',
  mcLauncher: 'https://www.minecraft.net/download',
};

const LANGS = [
  { code: 'zh-Hant', dir: '', og: 'zh_TW', label: '繁體中文',
    body: '"Microsoft JhengHei UI", "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif', serif: 'Noto Serif TC' },
  { code: 'zh-Hans', dir: 'zh-hans/', og: 'zh_CN', label: '简体中文',
    body: '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', serif: 'Noto Serif SC' },
  { code: 'en', dir: 'en/', og: 'en_US', label: 'English',
    body: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif', serif: null },
];

// [zh-Hant, zh-Hans, English]
const S = {
  title: ['Savaru IV 啟動器下載｜Kohtalon Mies Minecraft 模組包', 'Savaru IV 启动器下载｜Kohtalon Mies Minecraft 整合包', 'Savaru IV Launcher Download | Kohtalon Mies Minecraft Modpack'],
  desc: [
    '下載 Savaru IV - Kohtalon Mies 專屬啟動器：一鍵安裝 Minecraft 1.21.1 Fabric 模組包並自動更新，進遊戲就能連線 SAVARU 伺服器。免費，支援 Windows。',
    '下载 Savaru IV - Kohtalon Mies 专属启动器：一键安装 Minecraft 1.21.1 Fabric 整合包并自动更新，进游戏就能连接 SAVARU 服务器。免费，支持 Windows。',
    'Download the Savaru IV - Kohtalon Mies launcher: installs the Minecraft 1.21.1 Fabric modpack in one click, keeps it up to date, and gets you onto the SAVARU server. Free, for Windows.',
  ],
  tag1: ['探索魯瓦多大陸中沒落的阿爾格爾帝國，<br>找尋這片土地中命運的蹤跡。', '探索鲁瓦多大陆中没落的阿尔格尔帝国，<br>找寻这片土地中命运的踪迹。', 'Explore a fallen empire in Ruwado<br>and trace the fate of this land.'],
  tag2: ['孤軍奮戰這個充滿死寂、危機四伏的世界，<br>或是和餘燼中的同伴一起探險。', '孤军奋战这个充满死寂、危机四伏的世界，<br>或是和余烬中的同伴一起探险。', 'Fight alone in a silent, perilous world,<br>or with companions from the embers.'],
  download: ['下載啟動器', '下载启动器', 'Download the launcher'],
  platform: ['Windows 64 位元', 'Windows 64 位', 'Windows 64-bit'],
  mirror: ['備用下載（Google 雲端硬碟）', '备用下载（Google 云端硬盘）', 'Mirror (Google Drive)'],
  allVersions: ['所有版本', '所有版本', 'All versions'],
  needs: [
    '需要擁有 Minecraft Java 版的 Microsoft 帳號，並安裝<a href="{mc}">官方 Minecraft Launcher</a>。',
    '需要拥有 Minecraft Java 版的 Microsoft 账号，并安装<a href="{mc}">官方 Minecraft Launcher</a>。',
    'You need a Microsoft account that owns Minecraft: Java Edition, and the <a href="{mc}">official Minecraft Launcher</a>.',
  ],
  stepsH: ['三步開始遊戲', '三步开始游戏', 'Three steps to play'],
  s1h: ['下載並解壓縮', '下载并解压', 'Download and unzip'],
  s1: ['把 zip 解壓縮到任何資料夾，例如桌面。', '把 zip 解压到任意文件夹，例如桌面。', 'Unzip it into any folder, such as your desktop.'],
  s2h: ['執行 SavaruLauncher.exe', '运行 SavaruLauncher.exe', 'Run SavaruLauncher.exe'],
  s2: ['按「開始遊戲」。啟動器會裝好 Java、Minecraft 1.21.1、Fabric 和所有模組，第一次要下載的檔案比較多。',
    '按“开始游戏”。启动器会装好 Java、Minecraft 1.21.1、Fabric 和所有模组，第一次要下载的文件比较多。',
    'Press Play. The launcher installs Java, Minecraft 1.21.1, Fabric and every mod; the first run downloads the most.'],
  s3h: ['在官方啟動器按「遊玩」', '在官方启动器按“开始游戏”', 'Press Play in the official launcher'],
  s3: ['官方 Minecraft Launcher 會自動打開並選好「Savaru IV - Kohtalon Mies」。登入 Microsoft 帳號後按「遊玩」。',
    '官方 Minecraft Launcher 会自动打开并选好“Savaru IV - Kohtalon Mies”。登录 Microsoft 账号后开始游戏。',
    'The official Minecraft Launcher opens with "Savaru IV - Kohtalon Mies" selected. Sign in with your Microsoft account and press Play.'],
  server: ['進遊戲後到「多人遊戲」選 <b>SAVARU</b>，就能連線伺服器。', '进游戏后到“多人游戏”选 <b>SAVARU</b>，就能连接服务器。', 'In game, open Multiplayer and pick <b>SAVARU</b> to join the server.'],
  whyH: ['為什麼用啟動器', '为什么用启动器', 'Why the launcher'],
  f1h: ['一鍵安裝', '一键安装', 'One-click install'],
  f1: ['Java、Minecraft、Fabric、四百多個模組和設定檔，全部自動裝好。', 'Java、Minecraft、Fabric、四百多个模组和配置文件，全部自动装好。', 'Java, Minecraft, Fabric, over four hundred mods and their configs, all set up for you.'],
  f2h: ['更新最快', '更新最快', 'Updates first'],
  f2: ['新版模組包一發布就能更新，不用等 CurseForge 審核。每次按「開始遊戲」都會檢查。', '新版整合包一发布就能更新，不用等 CurseForge 审核。每次按“开始游戏”都会检查。', 'New pack versions arrive as soon as they are released, before CurseForge review. Every Play checks for one.'],
  f3h: ['啟動器自動更新', '启动器自动更新', 'Updates itself'],
  f3: ['有新版啟動器時，會自己下載、更新並重新開啟。', '有新版启动器时，会自己下载、更新并重新打开。', 'When a new launcher is out, it downloads it, updates and restarts on its own.'],
  f4h: ['保留你的設定', '保留你的设置', 'Keeps your settings'],
  f4: ['模組包這一版沒改到的設定檔，會保留你自己的修改。', '整合包这一版没改到的配置文件，会保留你自己的修改。', 'Config files the new pack version does not touch keep your own changes.'],
  shot: ['Savaru IV 遊戲畫面', 'Savaru IV 游戏画面', 'Savaru IV gameplay'],
  faqH: ['常見問題', '常见问题', 'Questions'],
  q1: ['Windows 跳出「Windows 已保護您的電腦」？', 'Windows 弹出“Windows 已保护你的电脑”？', 'Windows says "Windows protected your PC"?'],
  a1: ['啟動器沒有付費的數位簽章，第一次執行時 Windows 可能會提醒。按「其他資訊」，再按「仍要執行」。',
    '启动器没有付费的数字签名，第一次运行时 Windows 可能会提醒。点“更多信息”，再点“仍要运行”。',
    'The launcher has no paid code-signing certificate, so Windows may warn on first run. Click "More info", then "Run anyway".'],
  q2: ['需要正版 Minecraft 嗎？', '需要正版 Minecraft 吗？', 'Do I need to own Minecraft?'],
  a2: ['需要。請用擁有 Minecraft Java 版的 Microsoft 帳號，並先安裝官方 Minecraft Launcher。',
    '需要。请用拥有 Minecraft Java 版的 Microsoft 账号，并先安装官方 Minecraft Launcher。',
    'Yes. Use a Microsoft account that owns Minecraft: Java Edition, and install the official Minecraft Launcher first.'],
  q3: ['遊戲檔案存在哪裡？', '游戏文件存在哪里？', 'Where are the game files?'],
  a3: ['在 <code>%APPDATA%\\.savaru-iv</code>。啟動器放在哪個資料夾都可以，換資料夾也不會遺失遊戲、帳號和設定。',
    '在 <code>%APPDATA%\\.savaru-iv</code>。启动器放在哪个文件夹都可以，换文件夹也不会丢失游戏、账号和设置。',
    'In <code>%APPDATA%\\.savaru-iv</code>. The launcher can live in any folder; moving it keeps your game, account and settings.'],
  q4: ['可以用 CurseForge 安裝嗎？', '可以用 CurseForge 安装吗？', 'Can I use CurseForge instead?'],
  a4: ['可以，模組包也在 <a href="{cf}">CurseForge</a> 上。用 Savaru 啟動器的話，新版會比 CurseForge 更早拿到。',
    '可以，整合包也在 <a href="{cf}">CurseForge</a> 上。用 Savaru 启动器的话，新版会比 CurseForge 更早拿到。',
    'Yes, the pack is on <a href="{cf}">CurseForge</a> too. With the Savaru launcher you get new versions before CurseForge does.'],
  q5: ['支援 Mac 或 Linux 嗎？', '支持 Mac 或 Linux 吗？', 'Mac or Linux?'],
  a5: ['目前只有 Windows 64 位元版本。', '目前只有 Windows 64 位版本。', 'Only Windows 64-bit for now.'],
  discord: ['Discord 社群', 'Discord 社区', 'Discord'],
  lore: ['設定集', '设定集', 'Lore book'],
  feedback: ['意見回饋', '意见反馈', 'Feedback'],
  notOfficial: ['Minecraft 是 Mojang Synergies AB 的商標。', 'Minecraft 是 Mojang Synergies AB 的商标。', 'Minecraft is a trademark of Mojang Synergies AB.'],
  langNav: ['語言', '语言', 'Language'],
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = s => s.replace('{mc}', LINKS.mcLauncher).replace('{cf}', LINKS.curseforge);

function page(L, i) {
  const t = k => fill(S[k][i]);
  const up = L.dir ? '../' : '';
  const A = `${up}assets/`;
  const url = SITE + L.dir;
  // Headings get a serif CJK face; Google Fonts' text= subset keeps it to the few glyphs actually used.
  const heads = ['stepsH', 'whyH', 'faqH', 's1h', 's2h', 's3h', 'f1h', 'f2h', 'f3h', 'f4h'].map(k => S[k][i]).join('');
  const serifCss = L.serif ? `https://fonts.googleapis.com/css2?family=${L.serif.replace(/ /g, '+')}:wght@700&display=swap&text=${encodeURIComponent([...new Set(heads)].join(''))}` : null;
  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    name: 'Savaru IV Launcher', alternateName: 'Savaru IV - Kohtalon Mies', url, image: `${SITE}assets/shots/ruins.jpg`,
    description: S.desc[i], inLanguage: L.code, operatingSystem: 'Windows 10, Windows 11', applicationCategory: 'GameApplication',
    softwareVersion: REL.version, downloadUrl: REL.download.url, fileSize: `${MB} MB`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const shots = [['ruins', '28% 50%'], ['field', '50% 50%'], ['party', '50% 45%'], ['combat-1', '50% 50%']];
  return `<!doctype html>
<html lang="${L.code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(S.title[i])}</title>
<meta name="description" content="${esc(S.desc[i])}">
<link rel="canonical" href="${url}">
${LANGS.map(o => `<link rel="alternate" hreflang="${o.code}" href="${SITE + o.dir}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${SITE}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Savaru IV - Kohtalon Mies">
<meta property="og:title" content="${esc(S.title[i])}">
<meta property="og:description" content="${esc(S.desc[i])}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}assets/shots/ruins.jpg">
<meta property="og:locale" content="${L.og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#110f15">
<link rel="icon" type="image/png" href="${A}icon.png">
<link rel="preload" href="${A}cinzel.woff2" as="font" type="font/woff2" crossorigin>
${serifCss ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(serifCss)}">` : ''}
<link rel="stylesheet" href="${A}site.css">
<style>:root { --body: ${L.body}; --head: ${L.serif ? `"${L.serif}", ` : ''}"Cinzel", Georgia, serif; }</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="hero">
  <div class="page">
    <nav class="langs" aria-label="${t('langNav')}">
      ${LANGS.map(o => (o === L ? `<span aria-current="page">${o.label}</span>` : `<a href="${up}${o.dir}" hreflang="${o.code}" lang="${o.code}">${o.label}</a>`)).join('\n      ')}
    </nav>
    <h1><img class="logo" src="${A}logo.png" width="960" height="384" alt="Savaru IV - Kohtalon Mies"></h1>
    <div class="tagline"><p>${t('tag1')}</p><p>${t('tag2')}</p></div>
    <a class="download" id="dl" href="${REL.download.url}">
      <span class="dl-title">${t('download')}</span>
      <span class="dl-meta"><span id="dl-ver">v${REL.version}</span> · ${t('platform')} · <span id="dl-size">${MB} MB</span></span>
    </a>
    <p class="alt"><a href="${LINKS.drive}">${t('mirror')}</a><span aria-hidden="true">·</span><a href="${LINKS.releases}">${t('allVersions')}</a></p>
    <p class="needs">${t('needs')}</p>
  </div>
  <div class="reel">
    <video autoplay muted loop playsinline preload="metadata" poster="${A}reel.jpg" aria-hidden="true"><source src="${A}reel.mp4" type="video/mp4"></video>
  </div>
</header>

<main>
  <section class="steps" aria-labelledby="steps-h">
    <h2 id="steps-h">${t('stepsH')}</h2>
    <ol>
      <li><h3>${t('s1h')}</h3><p>${t('s1')}</p></li>
      <li><h3>${t('s2h')}</h3><p>${t('s2')}</p></li>
      <li><h3>${t('s3h')}</h3><p>${t('s3')}</p></li>
    </ol>
    <p class="server">${t('server')}</p>
  </section>

  <section class="why" aria-labelledby="why-h">
    <h2 id="why-h">${t('whyH')}</h2>
    <div class="grid">
      ${[1, 2, 3, 4].map(n => `<div><h3>${t(`f${n}h`)}</h3><p>${t(`f${n}`)}</p></div>`).join('\n      ')}
    </div>
  </section>

  <section class="shots" aria-label="${t('shot')}">
    ${shots.map(([s, pos]) => `<img src="${A}shots/${s}.jpg" alt="${t('shot')}" style="object-position: ${pos}" loading="lazy" decoding="async">`).join('\n    ')}
  </section>

  <section class="faq" aria-labelledby="faq-h">
    <h2 id="faq-h">${t('faqH')}</h2>
    ${[1, 2, 3, 4, 5].map(n => `<details><summary>${t(`q${n}`)}</summary><p>${t(`a${n}`)}</p></details>`).join('\n    ')}
  </section>
</main>

<footer>
  <nav class="links">
    <a href="${LINKS.discord}">${t('discord')}</a>
    <a href="${LINKS.curseforge}">CurseForge</a>
    <a href="${LINKS.lore}">${t('lore')}</a>
    <a href="${LINKS.feedback}">${t('feedback')}</a>
    <a href="https://github.com/MaxGX2002/SavaruLauncher">GitHub</a>
  </nav>
  <p class="legal">NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.<br>${t('notOfficial')}</p>
</footer>
<script>
fetch('${FEED}', { cache: 'no-store' }).then(r => r.json()).then(f => {
  const l = f.launcher, d = l && l.download;
  if (!d) return;
  document.getElementById('dl').href = d.url;
  document.getElementById('dl-ver').textContent = 'v' + l.version;
  document.getElementById('dl-size').textContent = Math.round(d.size / 1048576) + ' MB';
}).catch(() => {});
</script>
</body>
</html>
`;
}

for (const [i, L] of LANGS.entries()) {
  fs.mkdirSync(path.join(DOCS, L.dir), { recursive: true });
  fs.writeFileSync(path.join(DOCS, L.dir, 'index.html'), page(L, i));
}
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DOCS, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(L => `  <url><loc>${SITE + L.dir}</loc><lastmod>${today}</lastmod>
${LANGS.map(o => `    <xhtml:link rel="alternate" hreflang="${o.code}" href="${SITE + o.dir}"/>`).join('\n')}
  </url>`).join('\n')}
</urlset>
`);
// ponytail: no robots.txt; crawlers only read it at the domain root, which a project site does not own. Submit the sitemap in Search Console.
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
console.log(`site built for launcher ${REL.version} (${LANGS.length} languages) in ${DOCS}`);
