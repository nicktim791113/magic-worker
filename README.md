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
| `R` | 重玩這一關 |
| `E` | 開 / 關「開發者模式」（關卡編輯器） |

- 收集金幣、抵達右邊的 🚩 終點過關；掉進坑裡會回到起點。
- **過關**後自動進下一關；全部破關會顯示祝賀畫面。
- **手機 / 平板**：畫面會自動出現 ◀ ▶ 跳 觸控按鈕。

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
│  ├─ main.js                  ← 遊戲總設定（含 ?dev 偵測）
│  ├─ levels/levels.js         ← 關卡資料（用格子座標描述，可被編輯器讀寫）
│  └─ scenes/
│     ├─ PlatformerScene.js    ← 闖關遊戲（讀關卡資料來蓋關，全中文註解）
│     └─ EditorScene.js        ← 開發者模式：用滑鼠畫關卡
└─ .github/workflows/deploy.yml← 推上 GitHub 後自動部署
```

## 開發文件

開發前請先看這兩份（在 `docs/` 資料夾）：

- 📋 [`docs/開發工作規則.md`](docs/開發工作規則.md) — 每次開發的標準流程（備份、更新紀錄、推送）
- 📝 [`docs/更新紀錄.md`](docs/更新紀錄.md) — 每次改了什麼的紀錄

## 開發者模式（關卡編輯器）🛠️

不用寫程式，用滑鼠就能設計關卡：

- **進入**：在網址後面加 `?dev`（例：`http://localhost:5173/?dev`），或在遊戲中按 `E`。
- **工具（上排）**：🟫 地形、🪙 金幣、🧍 起點、🚩 終點、🧽 擦除。
  選好工具後，在格子上**點一下**或**按住拖曳**就能放置。
- **動作（下排）**：
  - **▶️ 試玩**：立刻玩玩看這一關（再按 `E` 回編輯器）。
  - **◀ 上一關 / 下一關 ▶ / ➕ 新增**：在多個關卡間切換、加新關卡。
  - **💾 匯出**：把你設計的所有關卡複製出來（JSON）。
  - **🗑 清空 / ↩ 重設**：清掉這一關、或全部還原成內建關卡。
- `A` `D` 或滑鼠**滾輪**可左右平移畫面，看完整一關。
- 你畫的每一步都會**自動存在這台瀏覽器**，下次打開還在。

### 設計好的關卡怎麼「正式上線」？

編輯器的「自動存」只存在你自己的瀏覽器。要讓**線上版所有人**都玩到新關卡：

1. 在編輯器按 **💾 匯出**，點「複製」。
2. 把內容貼進 `src/levels/levels.js` 的 `DEFAULT_LEVELS`（或交給工程師處理）。
3. 照下面「部署」的流程 `git push`，等自動部署完成即可。

## 想自己微調手感（新手練習）

打開 `src/scenes/PlatformerScene.js` 最上面三個參數：

- `MOVE_SPEED`（跑多快）、`JUMP_SPEED`（跳多高）、`GRAVITY`（掉多快）

關卡的**地形 / 金幣 / 起點 / 終點**，建議直接用上面的「開發者模式」來改，
或在 `src/levels/levels.js` 裡編輯關卡資料。

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
