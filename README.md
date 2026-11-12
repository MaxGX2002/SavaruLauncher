# Savaru IV Launcher

Electron 啟動器：下載並安裝 Savaru IV 模組包（Java、Minecraft 1.21.1、Fabric、模組、設定檔）、檢查更新、
啟動遊戲，以及一鍵連線 SAVARU 伺服器。

**玩家下載：** 到 [Releases](https://github.com/MaxGX2002/SavaruLauncher/releases/latest) （或 [Google 雲端硬碟](https://drive.google.com/drive/folders/1Un56ypTeW6AAHxbRl9N9nYQxPtudrF1e?usp=sharing)）下載 `SavaruLauncher-<版本>-win64.zip`，
解壓縮後執行 `SavaruLauncher.exe`。需要擁有 Minecraft Java 版的 Microsoft 帳號。

## 運作方式

- **更新清單 `launcher.json`**（`tools/build-feed.js` 產生）：記錄模組包版本、CurseForge 上的模組包 zip
  （用來取 overrides 設定檔），以及每個模組／材質包的 sha1、大小和下載網址。
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

然後把 `feed/launcher.json` 上傳到 `app/config.json` 的 `feedUrl` 指向的位置。

## 發布啟動器前需要

1. **`app/config.json` 的 `feedUrl`**：放 `launcher.json` 的公開網址。
2. **`app/config.json` 的 `msaClientId`**：Azure 應用程式 ID，需要已通過 Mojang 的 Minecraft API 審核。沒有它就無法登入正版帳號，也就無法連線伺服器。
3. `npm run dist` → 產生 `dist/SavaruLauncher-<版本>-win64.zip`。

## 開發測試（離線帳號，只用於本機測試）

```bash
SAVARU_HOME=<暫存資料夾> SAVARU_FEED=feed/launcher.json SAVARU_DEV_OFFLINE=DevTester npx electron .
node tools/dev-install.js <暫存資料夾>      # 不開視窗，只測安裝
```
