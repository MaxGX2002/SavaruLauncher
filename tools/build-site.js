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
  introH: ['一個與眾不同的 Minecraft 模組整合包', '一个与众不同的 Minecraft 模组整合包', 'A Minecraft modpack unlike any other'],
  i1h: ['主打 MOBA 俯視角的 ARPG 體驗', '主打 MOBA 俯视角的 ARPG 体验', 'A top-down ARPG, MOBA-style'],
  i1: ['如同「Minecraft Dungeons」、「Diablo」系列以及「Path of Exile」的純正 ARPG 玩法視角，帶給你截然不同的 Minecraft 體驗。',
    '如同“Minecraft Dungeons”、“Diablo”系列以及“Path of Exile”的纯正 ARPG 玩法视角，带给你截然不同的 Minecraft 体验。',
    'The true ARPG view of Minecraft Dungeons, the Diablo series and Path of Exile, for a Minecraft that plays like nothing you have seen.'],
  i2h: ['獨特的操作方式與沉浸式互動介面', '独特的操作方式与沉浸式互动界面', 'Click to move, and an immersive interface'],
  i2: ['點擊畫面進行移動，取代傳統 WASD 移動方式。遊戲中將帶給你更加豐富的交互方式與動畫，身歷其境的置身於奇幻世界之中。',
    '点击画面进行移动，取代传统 WASD 移动方式。游戏中将带给你更加丰富的交互方式与动画，身临其境地置身于奇幻世界之中。',
    'Click where you want to go instead of walking with WASD. Richer interactions and animations put you right inside a world of fantasy.'],
  i3h: ['完整的世界觀與設定', '完整的世界观与设定', 'A whole world and its lore'],
  i3: ['擁有專屬的世界觀、故事設定，在這片土地上的故事將由你親手挖掘、開拓。完善的世界歷史將使你漫遊在名為「魯瓦多」的大陸中，並且成為命運的一部分。',
    '拥有专属的世界观、故事设定，在这片土地上的故事将由你亲手挖掘、开拓。完善的世界历史将使你漫游在名为“鲁瓦多”的大陆中，并且成为命运的一部分。',
    'Its own world and story, for you to dig up and carve out yourself. A full history lets you roam the continent of Ruwado and become part of its fate.'],
  outro: ['孤身奮鬥於這片充滿謎團的土地，或是與餘燼中的生命一起並肩作戰。', '孤身奋斗于这片充满谜团的土地，或是与余烬中的生命一起并肩作战。',
    'Fight alone across this land of mysteries, or stand together with the lives left in the embers.'],
  featH: ['遊戲特色', '游戏特色', 'Features'],
  f1h: ['專屬打造的機制系統模組', '专属打造的机制系统模组', 'Systems made for Savaru'],
  f1: ['多達 20 個以上的自製核心系統模組，組成薩瓦魯最獨特的 RPG 遊戲體驗。', '多达 20 个以上的自制核心系统模组，组成萨瓦鲁最独特的 RPG 游戏体验。',
    'More than 20 core system mods of our own make up the RPG experience only Savaru has.'],
  f2h: ['視角與操作融合切換', '视角与操作融合切换', 'Switch the view, switch the controls'],
  f2: ['不用擔心操作的不習慣。F5 隨意變換第三與第一人稱，連同操作方式也一起變化。', '不用担心操作不习惯。F5 随意切换第三与第一人称，操作方式也一起变化。',
    'Not used to it? Press F5 to switch between third and first person, and the controls switch with it.'],
  f3h: ['活躍的社群反饋', '活跃的社区反馈', 'An active community'],
  f3: ['快速且方便的意見反饋方式與社群連結，問題的回報不再拖延。', '快速且方便的意见反馈方式与社区链接，问题的反馈不再拖延。',
    'Quick, easy ways to give feedback and reach the community, so a reported problem never sits waiting.'],
  f4h: ['獨有的角色帳號存取檔機制', '独有的角色账号存取档机制', 'Character saves'],
  f4: ['擁有角色存檔功能，讓你橫跨不同世界打造同一隻專屬角色。', '拥有角色存档功能，让你横跨不同世界打造同一个专属角色。',
    'Save your character and build the same one across different worlds.'],
  shot: ['Savaru IV 遊戲畫面', 'Savaru IV 游戏画面', 'Savaru IV gameplay'],
  clips: ['Savaru IV 戰鬥片段', 'Savaru IV 战斗片段', 'Savaru IV combat clips'],
  faqH: ['常見問題', '常见问题', 'Questions'],
  q1: ['伺服器無法加入，怎麼辦？', '服务器无法加入，怎么办？', 'I can\'t join the server. What now?'],
  a1: ['請檢查遊戲版本是否為最新測試版，本模組包專屬伺服器以官方最新發布的測試版本為主。',
    '请检查游戏版本是否为最新测试版，本整合包专属服务器以官方最新发布的测试版本为主。',
    'Check that you are on the latest test build. The pack\'s own server always runs the newest official test release.'],
  q2: ['這是 Minecraft 模組包嗎？', '这是 Minecraft 整合包吗？', 'Is this a Minecraft modpack?'],
  a2: ['是，這是 Minecraft 的 Fabric 模組包，遊戲版本為 1.21.1。', '是的，这是 Minecraft 的 Fabric 整合包，游戏版本为 1.21.1。', 'Yes. It is a Fabric modpack for Minecraft 1.21.1.'],
  q3: ['需要正式版 Minecraft 嗎？', '需要正版 Minecraft 吗？', 'Do I need to own Minecraft?'],
  a3: ['是，需要正式版本的 Minecraft 帳號才可以進行連線與開啟遊玩。', '是的，需要正版 Minecraft 账号才能联机和开始游戏。', 'Yes. You need an account that owns Minecraft to play and to join the server.'],
  q4: ['可以單人遊玩嗎？', '可以单人游玩吗？', 'Can I play solo?'],
  a4: ['可以。我們的模組包以多人社群功能為主，但也能用單人離線模式遊玩。', '可以。我们的整合包以多人社区功能为主，但也能用单人离线模式游玩。',
    'Yes. The pack is built around multiplayer and community, but you can also play it in single-player.'],
  q5: ['可以在哪裡進行反饋？', '可以在哪里反馈？', 'Where can I give feedback?'],
  a5: ['你可以前往<a href="{fb}">意見回饋表單</a>進行問題反饋，也可以加入我們專屬的 <a href="{dc}">Discord 群</a>進行意見回饋。',
    '你可以前往<a href="{fb}">意见反馈表单</a>反馈问题，也可以加入我们专属的 <a href="{dc}">Discord 群</a>提出意见。',
    'Report a problem on the <a href="{fb}">feedback form</a>, or join our <a href="{dc}">Discord</a> to share your thoughts.'],
  discord: ['Discord 社群', 'Discord 社区', 'Discord'],
  lore: ['設定集', '设定集', 'Lore book'],
  feedback: ['意見回饋', '意见反馈', 'Feedback'],
  notOfficial: ['Minecraft 是 Mojang Synergies AB 的商標。', 'Minecraft 是 Mojang Synergies AB 的商标。', 'Minecraft is a trademark of Mojang Synergies AB.'],
  langNav: ['語言', '语言', 'Language'],
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = s => s.replace('{mc}', LINKS.mcLauncher).replace('{cf}', LINKS.curseforge).replace('{fb}', LINKS.feedback).replace('{dc}', LINKS.discord);

function page(L, i) {
  const t = k => fill(S[k][i]);
  const up = L.dir ? '../' : '';
  const A = `${up}assets/`;
  const url = SITE + L.dir;
  // Headings get a serif CJK face; Google Fonts' text= subset keeps it to the few glyphs actually used.
  const heads = ['introH', 'featH', 'faqH', 'i1h', 'i2h', 'i3h', 'f1h', 'f2h', 'f3h', 'f4h'].map(k => S[k][i]).join('');
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
  <section class="intro" aria-labelledby="intro-h">
    <h2 id="intro-h">${t('introH')}</h2>
    <ol>
      ${[1, 2, 3].map(n => `<li><h3>${t(`i${n}h`)}</h3><p>${t(`i${n}`)}</p></li>`).join('\n      ')}
    </ol>
    <p class="outro">${t('outro')}</p>
  </section>

  <section class="why" aria-labelledby="why-h">
    <h2 id="why-h">${t('featH')}</h2>
    <div class="grid">
      ${[1, 2, 3, 4].map(n => `<div><h3>${t(`f${n}h`)}</h3><p>${t(`f${n}`)}</p></div>`).join('\n      ')}
    </div>
  </section>

  <section class="shots" aria-label="${t('shot')}">
    ${shots.map(([s, pos]) => `<img src="${A}shots/${s}.jpg" alt="${t('shot')}" style="object-position: ${pos}" loading="lazy" decoding="async">`).join('\n    ')}
  </section>

  <section class="clips" aria-label="${t('clips')}">
    ${[1, 2, 3, 4].map(n => `<video autoplay muted loop playsinline preload="metadata" poster="${A}clips/combat-${n}.jpg"><source src="${A}clips/combat-${n}.mp4" type="video/mp4"></video>`).join('\n    ')}
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
