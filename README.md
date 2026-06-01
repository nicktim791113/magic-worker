# 魔法小工人 · Magic Worker

一個用 **Vite + Phaser 4** 製作的 **2.5D 橫向捲軸闖關**小遊戲。
支援 **PWA**（可以「安裝」成 App、離線也能玩），並用 **GitHub Actions 自動部署到 GitHub Pages**。

🎮 線上遊玩：<https://nicktim791113.github.io/magic-worker/>

---

## 怎麼執行（本機開發）

```bash
npm install      # 安裝套件（第一次）
npm run icons    # 產生 PWA 圖示（第一次，或想換圖示時）
npm run dev      # 啟動開發伺服器
```

然後打開終端機顯示的網址（通常是 http://localhost:5173 ）。

> 提醒：遊戲要在「看得見的分頁」才會動，背景分頁會被瀏覽器暫停。

## 操作方式

| 按鍵 | 動作 |
|------|------|
| `←` `→` 或 `A` `D` | 左右移動 |
| `空白鍵` / `↑` / `W` | 跳躍 |

收集金幣、抵達右邊的 🚩 終點過關；掉進坑裡會回到起點。

---

## 專案結構

```
魔法小工人/
├─ index.html                  ← 網頁進入點
├─ vite.config.js              ← Vite 設定（base 與 PWA 都在這）
├─ package.json
├─ public/                     ← 直接被複製到網站根目錄的檔案（圖示等）
├─ scripts/generate-icons.mjs  ← 產生 PWA 圖示的小程式
├─ docs/                       ← 開發文件
│  ├─ 開發工作規則.md          ← 每次開發的標準流程（SOP）
│  └─ 更新紀錄.md              ← 更新紀錄（Changelog）
├─ src/
│  ├─ main.js                  ← 遊戲總設定
│  └─ scenes/PlatformerScene.js← 闖關關卡（全中文註解）
└─ .github/workflows/deploy.yml← 推上 GitHub 後自動部署
```

## 開發文件

開發前請先看這兩份（在 `docs/` 資料夾）：

- 📋 [`docs/開發工作規則.md`](docs/開發工作規則.md) — 每次開發的標準流程（備份、更新紀錄、推送）
- 📝 [`docs/更新紀錄.md`](docs/更新紀錄.md) — 每次改了什麼的紀錄

## 想自己調整（新手練習）

打開 `src/scenes/PlatformerScene.js`：

- **手感**：最上面的 `MOVE_SPEED`（跑多快）、`JUMP_SPEED`（跳多高）、`GRAVITY`（掉多快）
- **關卡地形**：`addGround(起格, 迄格)`、`addPlatform(起格, 迄格, 離地高度)`
- **金幣位置**：`addCoinRow(起格, 迄格, 離地高度)`

---

## 關於 PWA

PWA（漸進式網頁應用程式）讓這個網頁可以：
- 在手機或電腦上「**安裝**」成像 App 的圖示
- **離線**也能開（第一次載入後會被快取）

設定在 `vite.config.js` 的 `VitePWA(...)`，圖示由 `npm run icons` 產生。

## 關於部署（GitHub Pages — 自動）

已設定好 **GitHub Actions 自動部署**：只要把程式碼 **`git push` 到 `main` 分支**，
GitHub 就會自動 `build` 並把網站部署上線，約 1～2 分鐘後
<https://nicktim791113.github.io/magic-worker/> 就更新了。

平常流程：

```bash
git add -A
git commit -m "你的修改說明"
git push          # 推上去後，GitHub Actions 會自動建置並部署
```

設定檔在 `.github/workflows/deploy.yml`；每次部署進度可在儲存庫的 **Actions** 分頁查看。

> 重要：網址有 `/magic-worker/` 這層子路徑，所以 `vite.config.js` 的
> `base` 必須是 `"/magic-worker/"`。如果改了儲存庫名稱，這裡要一起改。

> 備用：專案也保留了手動部署指令 `npm run deploy`（用 gh-pages 套件）。
> 但 Pages 來源已設為「GitHub Actions」，平常用 `git push` 自動部署即可，
> 這個備用指令通常用不到。
