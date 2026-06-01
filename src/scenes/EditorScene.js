import Phaser from "phaser";
import { loadLevels, saveLevels, resetLevels, makeEmptyLevel } from "../levels/levels.js";

// ============================================================
// EditorScene = 「開發者模式」關卡編輯器
// ------------------------------------------------------------
// 用滑鼠在格線上「畫」關卡，不用碰任何數字。
//
// 進入方式：
//   ・網址加 ?dev （例：localhost:5173/?dev） → 直接進編輯器
//   ・遊戲中按 E → 切換進來；編輯器中按 E 或點「▶️ 試玩」→ 回遊戲
//
// 怎麼用：
//   1. 上方選工具（地形 / 金幣 / 起點 / 終點 / 擦除）
//   2. 在格子上「點一下」或「按住拖曳」就放置
//   3. A / D 或滑鼠滾輪 平移畫面，看整關
//   4. 「▶️ 試玩」直接玩玩看；「💾 匯出」把關卡複製出來存檔/上線
//
// 你畫的每一步都會「自動存在瀏覽器」，下次打開還在。
// ============================================================
export default class EditorScene extends Phaser.Scene {
  constructor() {
    super("EditorScene");
  }

  init(data) {
    this.levelIndex = (data && data.levelIndex) || 0;
  }

  create() {
    this.TILE = 64;
    this.MAX_ROW = 7; // 最高可放到第 7 列（再高就被上方工具列擋住了）
    this.TOOLBAR_H = 62; // 上方工具列高度（點這個範圍內不會放置方塊）

    // 讀關卡
    this.levels = loadLevels();
    if (this.levelIndex < 0) this.levelIndex = 0;
    if (this.levelIndex >= this.levels.length) this.levelIndex = this.levels.length - 1;
    this.level = this.levels[this.levelIndex];

    this.worldWidth = this.level.cols * this.TILE;
    this.worldHeight = this.scale.height;

    // 鏡頭可左右平移看整關
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // 簡單天空背景（讓畫面不是全黑，又不干擾格線）
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30);
    sky.fillGradientStyle(0x4a90d9, 0x4a90d9, 0xcdeaf7, 0xcdeaf7, 1);
    sky.fillRect(0, 0, this.scale.width, this.scale.height);

    // 把關卡資料拆成「格子集合」方便編輯（放置/擦除就是加/刪一格）
    this.solidCells = this.cellsFromList(this.level.solids);
    this.coinCells = this.cellsFromList(this.level.coins);

    // 圖層：格線（在上）、關卡內容（在下）
    this.levelLayer = this.add.container(0, 0).setDepth(3);
    this.gridGfx = this.add.graphics().setDepth(5);

    this.drawGrid();
    this.redraw();

    // --- 輸入：放置 / 擦除 ---
    this.painting = false;
    this.lastCell = null;
    this.input.on("pointerdown", (p) => {
      if (p.y < this.TOOLBAR_H) return; // 點到工具列 → 不放置
      this.painting = true;
      this.lastCell = null;
      this.applyAt(p);
    });
    this.input.on("pointermove", (p) => {
      if (!this.painting || p.y < this.TOOLBAR_H) return;
      this.applyAt(p);
    });
    this.input.on("pointerup", () => {
      if (this.painting) {
        this.painting = false;
        this.persist(); // 放開時存檔
      }
    });

    // 滑鼠滾輪：左右平移
    this.input.on("wheel", (p, over, dx, dy) => {
      this.cameras.main.scrollX = Phaser.Math.Clamp(
        this.cameras.main.scrollX + (dy || dx),
        0,
        Math.max(0, this.worldWidth - this.scale.width)
      );
    });

    // --- 鍵盤：A/D 與方向鍵平移、E 回到遊戲 ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("A,D");
    this.input.keyboard.on("keydown-E", () => this.playtest());

    // --- 工具列 ---
    this.createToolbar();
    this.selectTool("solid"); // 預設選「地形」
  }

  update() {
    // 左右平移畫面
    const cam = this.cameras.main;
    const speed = 12;
    if (this.cursors.left.isDown || this.keys.A.isDown) cam.scrollX -= speed;
    if (this.cursors.right.isDown || this.keys.D.isDown) cam.scrollX += speed;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, this.worldWidth - this.scale.width));
  }

  // ===================== 放置邏輯 =====================

  // 把滑鼠位置換成 (col,row)，依目前工具放置/擦除
  applyAt(pointer) {
    const T = this.TILE;
    const col = Math.floor(pointer.worldX / T);
    const row = Math.floor((this.worldHeight - pointer.worldY) / T);
    if (col < 0 || col >= this.level.cols || row < 0 || row > this.MAX_ROW) return;

    const key = col + "," + row;
    // 同一格在拖曳中不重複處理（起點/終點是設定座標，不受此限）
    if (this.lastCell === key && this.tool !== "start" && this.tool !== "goal") return;
    this.lastCell = key;

    switch (this.tool) {
      case "solid":
        this.solidCells.add(key);
        break;
      case "coin":
        this.coinCells.add(key);
        break;
      case "eraser":
        this.solidCells.delete(key);
        this.coinCells.delete(key);
        break;
      case "start":
        this.level.start.col = col;
        break;
      case "goal":
        this.level.goal.col = col;
        break;
    }
    this.syncLevel();
    this.redraw();
  }

  // 把「格子集合」寫回關卡資料（壓縮成連續橫條 {col,row,w}）
  syncLevel() {
    this.level.solids = this.rleFromCells(this.solidCells);
    this.level.coins = this.rleFromCells(this.coinCells);
  }

  // 存進瀏覽器（自動存檔）
  persist() {
    this.syncLevel();
    saveLevels(this.levels);
  }

  // ===================== 畫面繪製 =====================

  drawGrid() {
    const g = this.gridGfx;
    g.clear();
    g.lineStyle(1, 0xffffff, 0.13);
    const T = this.TILE;
    const topY = this.worldHeight - (this.MAX_ROW + 1) * T;
    for (let c = 0; c <= this.level.cols; c++) {
      const x = c * T;
      g.lineBetween(x, topY, x, this.worldHeight);
    }
    for (let row = 0; row <= this.MAX_ROW + 1; row++) {
      const y = this.worldHeight - row * T;
      g.lineBetween(0, y, this.level.cols * T, y);
    }
  }

  // 重畫關卡內容（每次編輯後呼叫）
  redraw() {
    this.levelLayer.removeAll(true); // 清掉舊的（並銷毀）
    const T = this.TILE;
    const add = (obj) => this.levelLayer.add(obj);

    // 實心方塊（泥土 + 頂端草皮）
    for (const keyStr of this.solidCells) {
      const [c, row] = keyStr.split(",").map(Number);
      const left = c * T;
      const top = this.worldHeight - (row + 1) * T;
      add(this.add.rectangle(left + T / 2, top + T / 2, T - 2, T - 2, 0x8a5a2b).setStrokeStyle(1, 0x6e4420));
      if (!this.solidCells.has(c + "," + (row + 1))) {
        add(this.add.rectangle(left + T / 2, top + 5, T - 2, 10, 0x5fb84d));
      }
    }

    // 金幣
    for (const keyStr of this.coinCells) {
      const [c, row] = keyStr.split(",").map(Number);
      const x = c * T + T / 2;
      const y = this.worldHeight - (row + 0.5) * T;
      add(this.add.circle(x, y, 11, 0xffe066).setStrokeStyle(3, 0xffb300));
    }

    // 起點標記
    const sx = this.level.start.col * T + T / 2;
    add(this.add.rectangle(sx, this.worldHeight - T - 20, 30, 40, 0xffd54f, 0.55).setStrokeStyle(2, 0xc79a16));
    add(this.add.text(sx, this.worldHeight - T - 52, "起點", { fontSize: "12px", color: "#ffd54f", fontFamily: '"Microsoft JhengHei", sans-serif' }).setOrigin(0.5));

    // 終點旗子標記
    const gx = this.level.goal.col * T + T / 2;
    const gt = this.worldHeight - T;
    add(this.add.rectangle(gx, gt - 80, 6, 160, 0xf0f0f0));
    add(this.add.rectangle(gx + 22, gt - 150, 40, 26, 0xff5a5a));
    add(this.add.text(gx, gt - 176, "終點", { fontSize: "12px", color: "#ff8a8a", fontFamily: '"Microsoft JhengHei", sans-serif' }).setOrigin(0.5));
  }

  // ===================== 工具列 =====================

  createToolbar() {
    // 背景帶
    this.add
      .rectangle(0, 0, this.scale.width, this.TOOLBAR_H, 0x0d1320, 0.92)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // 第一排：工具
    this.toolButtons = {};
    const tools = [
      ["solid", "🟫 地形"],
      ["coin", "🪙 金幣"],
      ["start", "🧍 起點"],
      ["goal", "🚩 終點"],
      ["eraser", "🧽 擦除"],
    ];
    let x = 8;
    for (const [key, label] of tools) {
      const w = 82;
      const btn = this.makeButton(x, 8, w, 22, label, () => this.selectTool(key));
      this.toolButtons[key] = btn;
      x += w + 6;
    }

    // 第二排：動作
    const actions = [
      ["▶️ 試玩", () => this.playtest()],
      ["◀ 上一關", () => this.gotoLevel(this.levelIndex - 1)],
      ["下一關 ▶", () => this.gotoLevel(this.levelIndex + 1)],
      ["➕ 新增", () => this.addLevel()],
      ["💾 匯出", () => this.showExport()],
      ["🗑 清空", () => this.clearLevel()],
      ["↩ 重設", () => this.resetAll()],
    ];
    x = 8;
    for (const [label, fn] of actions) {
      const w = 104;
      this.makeButton(x, 36, w, 22, label, fn);
      x += w + 4;
    }

    // 狀態列（工具列下方）
    this.statusText = this.add
      .text(8, this.TOOLBAR_H + 6, "", {
        fontSize: "13px",
        color: "#cde",
        backgroundColor: "#00000077",
        padding: { x: 6, y: 3 },
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  // 做一顆工具列按鈕，回傳 { rect, text } 方便之後改顏色（標示目前工具）
  makeButton(xLeft, yTop, w, h, label, onClick) {
    const rect = this.add
      .rectangle(xLeft, yTop, w, h, 0x33415a, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101)
      .setStrokeStyle(1, 0x5a6b88)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(xLeft + w / 2, yTop + h / 2, label, {
        fontSize: "13px",
        color: "#ffffff",
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);
    rect.on("pointerdown", onClick);
    return { rect, text };
  }

  selectTool(tool) {
    this.tool = tool;
    // 標示目前選到的工具
    for (const [key, btn] of Object.entries(this.toolButtons)) {
      btn.rect.setFillStyle(key === tool ? 0x4a90d9 : 0x33415a, 1);
    }
    this.updateStatus();
  }

  updateStatus() {
    const names = { solid: "地形", coin: "金幣", start: "起點", goal: "終點", eraser: "擦除" };
    this.statusText.setText(
      `🛠 開發者模式　|　工具：${names[this.tool]}　|　${this.level.name}（${this.level.cols} 格）　|　點或拖放置 · A D / 滾輪平移 · ▶️ 試玩 · 💾 匯出`
    );
  }

  // ===================== 動作 =====================

  playtest() {
    this.persist();
    this.scene.start("PlatformerScene", { levelIndex: this.levelIndex });
  }

  gotoLevel(index) {
    if (index < 0 || index >= this.levels.length || index === this.levelIndex) return;
    this.persist();
    this.scene.restart({ levelIndex: index });
  }

  addLevel() {
    this.persist();
    this.levels.push(makeEmptyLevel(`第 ${this.levels.length + 1} 關`));
    saveLevels(this.levels);
    this.scene.restart({ levelIndex: this.levels.length - 1 });
  }

  clearLevel() {
    if (!window.confirm("確定清空這一關的地形和金幣嗎？（起點/終點會保留）")) return;
    this.solidCells.clear();
    this.coinCells.clear();
    this.persist();
    this.redraw();
  }

  resetAll() {
    if (!window.confirm("確定把「所有關卡」重設成內建關卡嗎？你自己畫的會被清掉！")) return;
    this.levels = resetLevels(); // 清掉瀏覽器存檔，回到內建關卡
    this.scene.restart({ levelIndex: 0 });
  }

  // 匯出：跳出一個視窗顯示 JSON，可一鍵複製
  showExport() {
    this.persist();
    const json = JSON.stringify(this.levels, null, 2);

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:'Microsoft JhengHei',sans-serif;";
    const box = document.createElement("div");
    box.style.cssText =
      "background:#1b2332;color:#fff;padding:16px;border-radius:10px;width:min(680px,90vw);box-shadow:0 12px 48px rgba(0,0,0,.6);";
    box.innerHTML =
      '<div style="font-size:16px;margin-bottom:6px;">💾 匯出關卡 JSON</div>' +
      '<div style="font-size:13px;opacity:.8;margin-bottom:8px;line-height:1.5;">這是你設計的「所有關卡」。按「複製」後貼給工程師（或自己存起來），就能正式放進遊戲、上線給大家玩。<br>（你畫的關卡其實已經自動存在這台瀏覽器了，匯出是要「永久保存／上線」時用。）</div>';
    const ta = document.createElement("textarea");
    ta.value = json;
    ta.readOnly = true;
    ta.style.cssText =
      "width:100%;height:280px;background:#0d1320;color:#cde;border:1px solid #33415a;border-radius:6px;padding:8px;font-family:monospace;font-size:12px;box-sizing:border-box;";
    box.appendChild(ta);
    const row = document.createElement("div");
    row.style.cssText = "margin-top:10px;display:flex;gap:8px;justify-content:flex-end;";
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 複製";
    copyBtn.style.cssText =
      "padding:8px 16px;border:0;border-radius:6px;cursor:pointer;font-size:14px;background:#4a90d9;color:#fff;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "關閉";
    closeBtn.style.cssText =
      "padding:8px 16px;border:0;border-radius:6px;cursor:pointer;font-size:14px;background:#33415a;color:#fff;";
    copyBtn.onclick = () => {
      ta.select();
      try {
        navigator.clipboard.writeText(json);
      } catch (e) {
        document.execCommand("copy");
      }
      copyBtn.textContent = "✅ 已複製";
    };
    closeBtn.onclick = () => wrap.remove();
    row.appendChild(copyBtn);
    row.appendChild(closeBtn);
    box.appendChild(row);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    ta.focus();
    ta.select();
  }

  // ===================== 小工具：格子集合 ⇄ {col,row,w} =====================

  // 從 [{col,row,w}] 展開成格子集合 Set("col,row")
  cellsFromList(items) {
    const set = new Set();
    for (const it of items || []) {
      for (let c = it.col; c < it.col + it.w; c++) set.add(c + "," + it.row);
    }
    return set;
  }

  // 把格子集合壓回 [{col,row,w}]（同一列的連續格子併成一條）
  rleFromCells(cells) {
    const rowToCols = new Map();
    for (const keyStr of cells) {
      const [c, r] = keyStr.split(",").map(Number);
      if (!rowToCols.has(r)) rowToCols.set(r, []);
      rowToCols.get(r).push(c);
    }
    const out = [];
    for (const [row, cols] of rowToCols) {
      cols.sort((a, b) => a - b);
      let start = cols[0];
      let prev = cols[0];
      for (let i = 1; i < cols.length; i++) {
        const c = cols[i];
        if (c === prev + 1) {
          prev = c;
        } else {
          out.push({ col: start, row, w: prev - start + 1 });
          start = prev = c;
        }
      }
      out.push({ col: start, row, w: prev - start + 1 });
    }
    return out;
  }
}
