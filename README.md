# Savaru IV Launcher

Electron 啟動器：下載並安裝 Savaru IV 模組包（Java、Minecraft 1.21.1、Fabric、模組、設定檔）、檢查更新、
啟動遊戲。介面有繁體中文、简体中文、English（「設定 → 語言」，第一次開啟時跟著系統語言）。

**官網：** https://maxgx2002.github.io/SavaruLauncher/ （`docs/`，`node tools/build-site.js` 產生）

**玩家下載：** 到 [Releases](https://github.com/MaxGX2002/SavaruLauncher/releases/latest) （或 [Google 雲端硬碟](https://drive.google.com/drive/folders/1Un56ypTeW6AAHxbRl9N9nYQxPtudrF1e?usp=sharing)）下載 `SavaruLauncher-<版本>-win64.zip`，
解壓縮後執行 `SavaruLauncher.exe`。需要擁有 Minecraft Java 版的 Microsoft 帳號。
「設定 → 啟動方式」預設是「使用官方 Minecraft 啟動器」：「開始遊戲」會安裝模組包，然後交給官方 Minecraft Launcher 登入並啟動（需先安裝官方啟動器）。
目前統一先以官方啟動器為主；「使用 Savaru 啟動器直接啟動」需要在啟動器登入 Microsoft，等 Mojang 審核通過後才能使用。
每次按「開始遊戲」都會重新檢查模組包更新。從 0.5.0 起，啟動器有新版本時會自己下載、覆蓋並重新開啟（遊戲執行中會等遊戲關閉）。

## 運作方式

- **更新清單 `launcher.json`**（`tools/build-feed.js` 產生）：記錄模組包版本、模組包 zip（用來取 overrides 設定檔），
  以及每個模組／材質包的 sha1、大小和下載網址。
  - 模組包 zip 放在 GitHub release `pack-<版本>`（不標成 latest），所以不用等 CurseForge 審核，玩家就能更新。
  - 自己的模組在 CurseForge／Modrinth 還在審核、抓不到的，也一起放在那個 release。
  - 同一個檔案（sha1 相同）在 Modrinth 上有的，就從 Modrinth 下載；其餘從 CurseForge CDN 下載。
  - 作者關閉第三方下載、Modrinth 上又沒有的檔案，不會列進清單（目前只有 Excalibur Mutant Monsters 材質包）。
- **安裝位置**：`%APPDATA%\.savaru-iv`
  - `game\`：遊戲資料夾。
  - `minecraft\`：版本、函式庫、素材。
  - `runtime\`：Mojang 的 Java 21。
- **設定檔更新規則**：模組包這一版改了某個設定檔，才會覆蓋；沒改的，保留玩家自己的修改。

## 每次發布新模組包後

```bash
npm run feed -- v3.0_b1112 <CurseForge 檔案 ID>
```

然後 commit 並 push `feed/launcher.json`（`feedUrl` 指向 GitHub 上的 raw 檔案）。

## 發布啟動器前需要

1. **`app/config.json` 的 `feedUrl`**：放 `launcher.json` 的公開網址。
2. **`app/config.json` 的 `msaClientId`**：Azure 應用程式 ID，需要已通過 Mojang 的 Minecraft API 審核。沒有它就無法登入正版帳號，也就無法連線伺服器。
3. `npm run dist` → 產生 `dist/SavaruLauncher-<版本>-win64.zip`，最後一行印出 `download` 的 sha1 和大小。
4. 把版本和 `download`（release 上 zip 的網址、sha1、大小）寫進 `feed/launcher-release.json`，建立 GitHub release `v<版本>` 並上傳 zip，
   再把 `launcher-release.json` 的內容放進 `feed/launcher.json` 的 `launcher` 欄位並 push。舊版啟動器會看到「有新版本」，0.5.0 以後的會自動更新。
5. `node tools/build-site.js` 重建官網並 push（官網的下載按鈕本來就會讀 feed 顯示最新版，這步是讓網頁原始碼和 Google 看到的版本也一致）。

## 開發測試（離線帳號，只用於本機測試）

```bash
SAVARU_HOME=<暫存資料夾> SAVARU_FEED=feed/launcher.json SAVARU_DEV_OFFLINE=DevTester npx electron .
node tools/dev-install.js <暫存資料夾>      # 不開視窗，只測安裝
```
