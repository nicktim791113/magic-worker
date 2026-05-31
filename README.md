# 魔法小工人 · Magic Worker

一個用 **Vite + Phaser 4** 製作的 **2.5D 橫向捲軸闖關**小遊戲。
支援 **PWA**（可以「安裝」成 App、離線也能玩），並用 **GitHub Actions 自動部署到 GitHub Pages**。

🎮 線上遊玩：`https://<你的帳號>.github.io/magic-worker/`（部署完成後填入）

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
├─ src/
│  ├─ main.js                  ← 遊戲總設定
│  └─ scenes/PlatformerScene.js← 闖關關卡（全中文註解）
└─ .github/workflows/deploy.yml← 推上 GitHub 後自動部署
```

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

## 關於部署（GitHub Pages）

部署只要**一行指令**：

```bash
npm run deploy
```

它會自動先 `build`，再把建置好的 `dist/` 推到 `gh-pages` 分支，
GitHub Pages 就會更新線上版（約 1～2 分鐘生效）。

平常開發、改程式 → `git push` 推到 `main`（保存原始碼）；
想更新線上遊玩的版本 → 跑一次 `npm run deploy`。

> 重要：網址有 `/magic-worker/` 這層子路徑，所以 `vite.config.js` 的
> `base` 必須是 `"/magic-worker/"`。如果改了儲存庫名稱，這裡要一起改。

> 進階（之後可選）：也可以改用 GitHub Actions「推送即自動部署」，
> 但需要一組含 `workflow` 權限的 token。現成的設定檔已放在
> `.github/workflows/deploy.yml`（目前未啟用）。
