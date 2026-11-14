'use strict';
// UI text in Traditional Chinese (as written in index.html / app.js), Simplified Chinese and English.
// Each row: [繁體 (the key), 简体, English]. {name} placeholders are filled by t(text, { name }).
const ROWS = [
  // sidebar
  ['探索魯瓦多大陸中沒落的阿爾格爾帝國，', '探索鲁瓦多大陆中没落的阿尔格尔帝国，', 'Explore a fallen empire in Ruwado'],
  ['找尋這片土地中命運的蹤跡。', '找寻这片土地中命运的踪迹。', 'and trace the fate of this land.'],
  ['孤軍奮戰這個充滿死寂、危機四伏的世界，', '孤军奋战这个充满死寂、危机四伏的世界，', 'Fight alone in a silent, perilous world,'],
  ['或是和餘燼中的同伴一起探險。', '或是和余烬中的同伴一起探险。', 'or with companions from the embers.'],
  ['頁面', '页面', 'Pages'],
  ['首頁', '首页', 'Home'],
  ['遊戲畫面', '游戏画面', 'Gallery'],
  ['社群', '社区', 'Community'],
  ['更新日誌', '更新日志', 'Changelog'],
  ['設定', '设置', 'Settings'],
  ['官方論壇 Discord', '官方论坛 Discord', 'Official Discord'],
  ['CurseForge 模組包頁面', 'CurseForge 整合包页面', 'Modpack on CurseForge'],
  ['SAVARU 伺服器', 'SAVARU 服务器', 'SAVARU server'],
  ['{name} 伺服器', '{name} 服务器', '{name} server'],
  ['查詢中…', '查询中…', 'Checking…'],
  ['{online} / {max} 人在線・{ms} ms', '{online} / {max} 人在线・{ms} ms', '{online} / {max} online · {ms} ms'],
  ['目前無法連線', '目前无法连接', 'Offline right now'],
  ['啟動器 {v}', '启动器 {v}', 'Launcher {v}'],
  ['・已安裝 {v}', '・已安装 {v}', ' · installed {v}'],
  ['Microsoft 帳號', 'Microsoft 账号', 'Microsoft account'],
  ['登入 Microsoft', '登录 Microsoft', 'Sign in with Microsoft'],
  ['直接啟動需要正版帳號', '直接启动需要正版账号', 'Needed to launch directly'],
  // window, banner, home
  ['最小化', '最小化', 'Minimize'],
  ['關閉', '关闭', 'Close'],
  ['啟動器有新版本 {v}', '启动器有新版本 {v}', 'Launcher {v} is available'],
  ['正在下載新版啟動器 {v}… {pct}%', '正在下载新版启动器 {v}… {pct}%', 'Downloading launcher {v}… {pct}%'],
  ['新版啟動器 {v} 已下載，即將重新啟動', '新版启动器 {v} 已下载，即将重新启动', 'Launcher {v} is ready. Restarting…'],
  ['新版啟動器 {v} 已下載，關閉遊戲後會自動更新', '新版启动器 {v} 已下载，关闭游戏后会自动更新', 'Launcher {v} is ready and installs after the game closes'],
  ['啟動器自動更新失敗', '启动器自动更新失败', 'The launcher could not update itself'],
  ['下載新版', '下载新版', 'Download'],
  ['切換背景圖', '切换背景图', 'Background images'],
  ['背景 {n}', '背景 {n}', 'Background {n}'],
  // gallery, community, changelog
  ['實機精華影片・3 分鐘', '实机精华视频・3 分钟', 'Gameplay highlights · 3 min'],
  ['戰鬥片段', '战斗片段', 'Combat clips'],
  ['遊戲截圖 {n}', '游戏截图 {n}', 'Screenshot {n}'],
  ['上一張', '上一张', 'Previous'],
  ['下一張', '下一张', 'Next'],
  ['官方設定集', '官方设定集', 'Lore book'],
  ['世界觀與設定', '世界观与设定', 'The world and its story'],
  ['意見回饋', '意见反馈', 'Feedback'],
  ['回報問題、提出建議', '报告问题、提出建议', 'Report a problem or suggest an idea'],
  ['留言板', '留言板', 'Comments'],
  ['名稱', '名称', 'Name'],
  ['想說點什麼？', '想说点什么？', 'Say something…'],
  ['留言', '留言', 'Comment'],
  ['送出', '发送', 'Send'],
  ['留言板即將開放。', '留言板即将开放。', 'Comments open soon.'],
  ['無法讀取留言，請檢查網路連線。', '无法读取留言，请检查网络连接。', 'Could not load comments. Check your internet connection.'],
  ['還沒有留言，來當第一個吧。', '还没有留言，来当第一个吧。', 'No comments yet. Be the first.'],
  ['每分鐘只能留言一次。', '每分钟只能留言一次。', 'One comment per minute.'],
  ['留言已送出', '留言已发送', 'Comment sent'],
  ['目前沒有更新日誌。', '目前没有更新日志。', 'No changelog yet.'],
  // settings
  ['語言', '语言', 'Language'],
  ['記憶體', '内存', 'Memory'],
  ['分配記憶體', '分配内存', 'Allocated memory'],
  ['建議 8 GB 以上（這台電腦共 {total}）。分配太多反而可能變慢。', '建议 8 GB 以上（这台电脑共 {total}）。分配太多反而可能变慢。', 'At least 8 GB is recommended (this PC has {total}). Too much can make the game slower.'],
  ['啟動方式', '启动方式', 'Launch method'],
  ['使用官方 Minecraft 啟動器', '使用官方 Minecraft 启动器', 'Use the official Minecraft Launcher'],
  ['使用 Savaru 啟動器直接啟動（跳過官方啟動器）', '使用 Savaru 启动器直接启动（跳过官方启动器）', 'Launch from the Savaru launcher (skip the official launcher)'],
  ['目前統一先以官方啟動器為主：在官方啟動器登入後，選「Savaru IV - Kohtalon Mies」按「遊玩」。直接啟動需要在這裡登入 Microsoft，等 Mojang 審核通過後才能使用。',
    '目前统一先以官方启动器为主：在官方启动器登录后，选「Savaru IV - Kohtalon Mies」按「开始游戏」。直接启动需要在这里登录 Microsoft，等 Mojang 审核通过后才能使用。',
    'For now, everyone plays through the official launcher: sign in there, pick "Savaru IV - Kohtalon Mies" and press PLAY. Launching directly needs a Microsoft sign-in here, which opens once Mojang approves this launcher.'],
  ['啟動', '启动', 'Launch'],
  ['遊戲開始後隱藏啟動器', '游戏开始后隐藏启动器', 'Hide the launcher while the game runs'],
  ['介面音效', '界面音效', 'Interface sounds'],
  ['遊戲檔案', '游戏文件', 'Game files'],
  ['開啟遊戲資料夾', '打开游戏文件夹', 'Open game folder'],
  ['開啟紀錄檔', '打开日志', 'Open logs'],
  ['檢查並修復', '检查并修复', 'Check and repair'],
  ['遊戲出錯或模組遺失時使用「檢查並修復」：逐一比對每個檔案，損壞或遺失的會重新下載。', '游戏出错或模组丢失时使用「检查并修复」：逐一比对每个文件，损坏或丢失的会重新下载。', 'Use "Check and repair" when the game breaks or mods go missing: every file is checked, and damaged or missing ones are downloaded again.'],
  ['檢查完成，遊戲檔案都正確。', '检查完成，游戏文件都正确。', 'Check finished. All game files are correct.'],
  ['帳號', '账号', 'Account'],
  ['尚未登入', '尚未登录', 'Not signed in'],
  ['登出', '退出登录', 'Sign out'],
  ['已登出', '已退出登录', 'Signed out'],
  // dock and status
  ['開始遊戲', '开始游戏', 'Play'],
  ['無法取得模組包資訊', '无法获取整合包信息', 'Could not get the modpack info'],
  ['請檢查網路連線', '请检查网络连接', 'Check your internet connection'],
  ['（離線模式）', '（离线模式）', ' (offline)'],
  ['尚未安裝', '尚未安装', 'Not installed'],
  ['第一次開始遊戲時會下載約 {size}', '第一次开始游戏时会下载约 {size}', 'Your first Play downloads about {size}'],
  ['有新版本 {v}', '有新版本 {v}', 'Update available: {v}'],
  ['目前 {v}・開始遊戲時會自動更新', '当前 {v}・开始游戏时会自动更新', 'Installed {v} · updates when you press Play'],
  ['已是最新版本', '已是最新版本', 'Up to date'],
  ['已開啟官方 Minecraft 啟動器', '已打开官方 Minecraft 启动器', 'Opened the official Minecraft Launcher'],
  ['在官方啟動器登入，選「Savaru IV - Kohtalon Mies」後按「遊玩」', '在官方启动器登录，选「Savaru IV - Kohtalon Mies」后按「开始游戏」', 'Sign in there, pick "Savaru IV - Kohtalon Mies" and press PLAY'],
  ['下載', '下载', 'Download'],
  ['讀取版本資訊…', '读取版本信息…', 'Reading version info…'],
  ['檢查遊戲檔案…', '检查游戏文件…', 'Checking game files…'],
  ['下載中 {pct}%', '下载中 {pct}%', 'Downloading {pct}%'],
  ['{files} / {total} 個檔案・{done} / {size}', '{files} / {total} 个文件・{done} / {size}', '{files} / {total} files · {done} / {size}'],
  ['安裝模組包設定…', '安装整合包设置…', 'Installing modpack settings…'],
  ['啟動遊戲中…', '启动游戏中…', 'Starting the game…'],
  ['第一次啟動約需一到兩分鐘', '第一次启动约需一到两分钟', 'The first start takes a minute or two'],
  ['遊戲執行中', '游戏运行中', 'Game running'],
  ['關閉遊戲後會回到這裡', '关闭游戏后会回到这里', 'You come back here when the game closes'],
  ['遊戲異常結束（代碼 {code}）', '游戏异常结束（代码 {code}）', 'The game stopped unexpectedly (code {code})'],
  // sign-in
  ['使用 Microsoft 帳號登入', '使用 Microsoft 账号登录', 'Sign in with Microsoft'],
  ['按「開啟登入頁面」，在瀏覽器裡輸入下方代碼', '按「打开登录页面」，在浏览器里输入下方代码', 'Press "Open sign-in page" and enter the code below in your browser'],
  ['用擁有 Minecraft Java 版的 Microsoft 帳號登入', '用拥有 Minecraft Java 版的 Microsoft 账号登录', 'Sign in with the Microsoft account that owns Minecraft: Java Edition'],
  ['完成後回到這裡，啟動器會自動繼續', '完成后回到这里，启动器会自动继续', 'Come back here when you are done; the launcher carries on by itself'],
  ['複製代碼', '复制代码', 'Copy code'],
  ['開啟登入頁面', '打开登录页面', 'Open sign-in page'],
  ['正在取得登入代碼…', '正在获取登录代码…', 'Getting a sign-in code…'],
  ['等待你在瀏覽器完成登入…', '等待你在浏览器完成登录…', 'Waiting for you to finish signing in…'],
  ['已登入：{name}', '已登录：{name}', 'Signed in: {name}'],
  ['已複製登入代碼', '已复制登录代码', 'Sign-in code copied'],
  ['取消', '取消', 'Cancel'],
  // errors
  ['這個版本的啟動器還沒有設定 Microsoft 登入。', '这个版本的启动器还没有设置 Microsoft 登录。', 'This launcher build has no Microsoft sign-in set up.'],
  ['Microsoft 登入還沒通過 Mojang 審核，暫時無法登入。', 'Microsoft 登录还没通过 Mojang 审核，暂时无法登录。', 'Microsoft sign-in is still waiting for Mojang approval and is not available yet.'],
  ['這個 Microsoft 帳號沒有 Minecraft Java 版。', '这个 Microsoft 账号没有 Minecraft Java 版。', 'This Microsoft account does not own Minecraft: Java Edition.'],
  ['這個帳號還沒有 Xbox 個人檔案，請先到 xbox.com 登入一次再回來。', '这个账号还没有 Xbox 个人档案，请先到 xbox.com 登录一次再回来。', 'This account has no Xbox profile yet. Sign in once at xbox.com, then come back.'],
  ['未成年帳號需要家長在 Xbox 家庭設定中允許。', '未成年账号需要家长在 Xbox 家庭设置中允许。', 'A child account needs a parent to allow it in Xbox family settings.'],
  ['你所在的地區無法使用 Xbox Live。', '你所在的地区无法使用 Xbox Live。', 'Xbox Live is not available in your region.'],
  ['登入代碼已過期，請重新登入。', '登录代码已过期，请重新登录。', 'The sign-in code expired. Sign in again.'],
  ['正在處理其他工作，請稍候。', '正在处理其他任务，请稍候。', 'Busy with another task. Try again in a moment.'],
  ['遊戲已經在執行中。', '游戏已经在运行中。', 'The game is already running.'],
  ['無法取得模組包資訊，請檢查網路連線後再試一次。', '无法获取整合包信息，请检查网络连接后再试一次。', 'Could not get the modpack info. Check your internet connection and try again.'],
  ['找不到官方 Minecraft 啟動器，請先安裝。', '找不到官方 Minecraft 启动器，请先安装。', 'The official Minecraft Launcher is not installed. Install it first.'],
  ['請填寫名稱和留言。', '请填写名称和留言。', 'Enter a name and a comment.'],
  ['留言送出失敗，請稍後再試。', '留言发送失败，请稍后再试。', 'The comment could not be sent. Try again later.'],
  ['留言板還沒開放。', '留言板还没开放。', 'Comments are not open yet.'],
  ['發生錯誤：', '发生错误：', 'Error: '],
  // our own mods page
  ['自製模組', '自制模组', 'Our Mods'],
  ['我們的專屬自製模組', '我们的专属自制模组', 'Our Own Mods'],
  ['Savaru IV 團隊親手打造、收錄在模組包裡的模組。點一下開啟 CurseForge 頁面。', 'Savaru IV 团队亲手打造、收录在整合包里的模组。点一下打开 CurseForge 页面。', 'Mods the Savaru IV team made for this pack. Click one to open its CurseForge page.'],
  // auto-update
  ['更新', '更新', 'Updates'],
  ['自動更新遊戲', '自动更新游戏', 'Update the game automatically'],
  ['偵測到模組包新版本時，在背景自動下載安裝；遊戲執行中會等關閉後再更新。', '检测到整合包新版本时，在后台自动下载安装；游戏运行中会等关闭后再更新。', 'When a new pack version comes out, it downloads and installs in the background; a running game is updated after it closes.'],
  ['已自動更新到 {v}', '已自动更新到 {v}', 'Updated to {v} automatically'],
];
const DICT = { 'zh-Hans': {}, en: {} };
for (const [k, hans, en] of ROWS) { DICT['zh-Hans'][k] = hans; DICT.en[k] = en; }

let LANG = 'zh-Hant';
function t(text, vars) {
  let r = DICT[LANG]?.[text] ?? text;
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return r;
}

// The page's own text: each text node and attribute keeps its Traditional Chinese original, so switching back works.
const STATIC = [];
(() => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) if (n.nodeValue.trim() && !n.parentElement.closest('script, style, [data-no-t]')) STATIC.push({ n, s: n.nodeValue });
  for (const el of document.querySelectorAll('[placeholder], [aria-label], [title]')) {
    for (const a of ['placeholder', 'aria-label', 'title']) if (el.hasAttribute(a)) STATIC.push({ el, a, s: el.getAttribute(a) });
  }
})();
function setLang(lang) {
  LANG = DICT[lang] ? lang : 'zh-Hant';
  document.documentElement.lang = LANG;
  for (const x of STATIC) {
    if (x.n) { const s = x.s.trim(); x.n.nodeValue = x.s.replace(s, t(s)); }
    else x.el.setAttribute(x.a, t(x.s));
  }
}
