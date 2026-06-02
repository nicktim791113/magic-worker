import Phaser from "phaser";
import { loadLevels, saveLevels, resetLevels, makeEmptyLevel } from "../levels/levels.js";

// ============================================================
// EditorScene = 「開發者模式」關卡編輯器
// ------------------------------------------------------------
// 用滑鼠在格線上「畫」關卡，不用碰任何數字。
//
// 進入：網址加 ?dev，或遊戲中按 E。回遊戲：按 E 或點「▶️ 試玩」。
//
// 工具：
//   🟫 地形 / 🪙 金幣 ……點或拖，一格一格放。
//   👾 敵人 ……「拖一段」決定左右巡邏範圍（放開才產生）。
//   🛗 平台 ……「拖兩點」決定移動平台來回的路徑（放開才產生）。
//   🧍 起點 / 🚩 終點 ……點一下設定位置。
//   🧽 擦除 ……清掉點到的東西（地形/金幣/敵人/平台）。
//
// 其他：➖➕ 調整關卡長度、↶ 復原（Ctrl+Z）、每一步自動存在瀏覽器。
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
    this.MAX_ROW = 7;
    this.TOOLBAR_H = 62;

    this.levels = loadLevels();
    if (this.levelIndex < 0) this.levelIndex = 0;
    if (this.levelIndex >= this.levels.length) this.levelIndex = this.levels.length - 1;
    this.level = this.levels[this.levelIndex];
    // 相容舊存檔：補上新欄位
    if (!this.level.enemies) this.level.enemies = [];
    if (!this.level.movers) this.level.movers = [];

    this.worldWidth = this.level.cols * this.TILE;
    this.worldHeight = this.scale.height;
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30);
    sky.fillGradientStyle(0x4a90d9, 0x4a90d9, 0xcdeaf7, 0xcdeaf7, 1);
    sky.fillRect(0, 0, this.scale.width, this.scale.height);

    this.loadEditState();

    this.levelLayer = this.add.container(0, 0).setDepth(3);
    this.gridGfx = this.add.graphics().setDepth(5);
    this.previewGfx = this.add.graphics().setDepth(7); // 拖曳預覽

    this.history = []; // 還原（Undo）用的狀態堆疊

    this.drawGrid();
    this.redraw();

    // --- 輸入 ---
    this.painting = false;
    this.lastCell = null;
    this.dragStart = null;

    this.input.on("pointerdown", (p) => {
      if (p.y < this.TOOLBAR_H) return;
      this.pushHistory(); // 一次操作 = 一個還原點
      this.dragStart = this.cellAt(p);
      this.painting = true;
      this.lastCell = null;
      if (this.isPaintTool()) this.applyAt(p);
    });
    this.input.on("pointermove", (p) => {
      if (!this.painting || p.y < this.TOOLBAR_H) return;
      if (this.isPaintTool()) this.applyAt(p);
      else this.drawSpanPreview(p);
    });
    this.input.on("pointerup", (p) => {
      if (!this.painting) return;
      this.painting = false;
      if (!this.isPaintTool() && p.y >= this.TOOLBAR_H) this.finishSpan(p);
      this.previewGfx.clear();
      this.persist();
    });

    this.input.on("wheel", (p, over, dx, dy) => {
      this.cameras.main.scrollX = Phaser.Math.Clamp(
        this.cameras.main.scrollX + (dy || dx),
        0,
        Math.max(0, this.worldWidth - this.scale.width)
      );
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("A,D");
    this.input.keyboard.on("keydown-E", () => this.playtest());
    this.input.keyboard.on("keydown-Z", (e) => {
      if (e.ctrlKey || e.metaKey) this.undo();
    });

    this.createToolbar();
    this.selectTool("solid");
  }

  update() {
    const cam = this.cameras.main;
    const speed = 12;
    if (this.cursors.left.isDown || this.keys.A.isDown) cam.scrollX -= speed;
    if (this.cursors.right.isDown || this.keys.D.isDown) cam.scrollX += speed;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, this.worldWidth - this.scale.width));
  }

  // ===================== 工具判斷 =====================
  isPaintTool() {
    return ["solid", "coin", "eraser", "start", "goal"].includes(this.tool);
  }

  // ===================== 放置邏輯 =====================
  cellAt(pointer) {
    const T = this.TILE;
    const col = Math.floor(pointer.worldX / T);
    const row = Math.floor((this.worldHeight - pointer.worldY) / T);
    if (col < 0 || col >= this.level.cols || row < 0 || row > this.MAX_ROW) return null;
    return { col, row };
  }

  applyAt(pointer) {
    const cell = this.cellAt(pointer);
    if (!cell) return;
    const { col, row } = cell;
    const key = col + "," + row;
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
        this.level.enemies = (this.level.enemies || []).filter(
          (en) => !(en.row === row && col >= en.col && col < en.col + Math.max(en.w || 1, 1))
        );
        this.level.movers = (this.level.movers || []).filter(
          (m) => !((m.col === col && m.row === row) || ((m.toCol ?? m.col) === col && (m.toRow ?? m.row) === row))
        );
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

  // 放開滑鼠：用「拖曳起點→終點」產生一個敵人或移動平台
  finishSpan(pointer) {
    const a = this.dragStart;
    const b = this.cellAt(pointer);
    if (!a || !b) return;
    if (this.tool === "enemy") {
      const row = a.row;
      const c0 = Math.min(a.col, b.col);
      const c1 = Math.max(a.col, b.col);
      this.level.enemies.push({ col: c0, row, w: Math.max(1, c1 - c0 + 1) });
    } else if (this.tool === "mover") {
      this.level.movers.push({ col: a.col, row: a.row, toCol: b.col, toRow: b.row });
    }
    this.redraw();
  }

  drawSpanPreview(pointer) {
    this.previewGfx.clear();
    const a = this.dragStart;
    const b = this.cellAt(pointer);
    if (!a || !b) return;
    const T = this.TILE;
    const g = this.previewGfx;
    if (this.tool === "enemy") {
      const row = a.row;
      const c0 = Math.min(a.col, b.col);
      const c1 = Math.max(a.col, b.col);
      g.lineStyle(2, 0xffd54f, 0.9);
      g.strokeRect(c0 * T, this.worldHeight - (row + 1) * T, (c1 - c0 + 1) * T, T);
    } else if (this.tool === "mover") {
      const ax = a.col * T + T / 2;
      const ay = this.worldHeight - (a.row + 0.5) * T;
      const bx = b.col * T + T / 2;
      const by = this.worldHeight - (b.row + 0.5) * T;
      g.lineStyle(3, 0xffd54f, 0.9);
      g.lineBetween(ax, ay, bx, by);
      g.fillStyle(0xffd54f, 0.85);
      g.fillCircle(ax, ay, 5);
      g.fillCircle(bx, by, 5);
    }
  }

  syncLevel() {
    this.level.solids = this.rleFromCells(this.solidCells);
    this.level.coins = this.rleFromCells(this.coinCells);
  }

  persist() {
    this.syncLevel();
    saveLevels(this.levels);
  }

  // ===================== 還原（Undo）=====================
  pushHistory() {
    this.syncLevel();
    this.history.push(
      JSON.stringify({
        solids: this.level.solids,
        coins: this.level.coins,
        enemies: this.level.enemies,
        movers: this.level.movers,
        start: this.level.start,
        goal: this.level.goal,
        cols: this.level.cols,
        name: this.level.name,
      })
    );
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    if (!this.history.length) return;
    const snap = JSON.parse(this.history.pop());
    Object.assign(this.level, snap);
    this.loadEditState();
    this.worldWidth = this.level.cols * this.TILE;
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    saveLevels(this.levels);
    this.drawGrid();
    this.redraw();
    this.updateStatus();
  }

  loadEditState() {
    this.solidCells = this.cellsFromList(this.level.solids);
    this.coinCells = this.cellsFromList(this.level.coins);
    if (!this.level.enemies) this.level.enemies = [];
    if (!this.level.movers) this.level.movers = [];
  }

  // ===================== 繪製 =====================
  drawGrid() {
    const g = this.gridGfx;
    g.clear();
    g.lineStyle(1, 0xffffff, 0.13);
    const T = this.TILE;
    const topY = this.worldHeight - (this.MAX_ROW + 1) * T;
    for (let c = 0; c <= this.level.cols; c++) g.lineBetween(c * T, topY, c * T, this.worldHeight);
    for (let row = 0; row <= this.MAX_ROW + 1; row++) {
      const y = this.worldHeight - row * T;
      g.lineBetween(0, y, this.level.cols * T, y);
    }
  }

  redraw() {
    this.levelLayer.removeAll(true);
    const T = this.TILE;
    const add = (obj) => this.levelLayer.add(obj);

    // 實心方塊
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
      add(this.add.circle(c * T + T / 2, this.worldHeight - (row + 0.5) * T, 11, 0xffe066).setStrokeStyle(3, 0xffb300));
    }

    // 移動平台（畫出路徑 + 起點實心 + 終點半透明）
    for (const m of this.level.movers || []) {
      const ax = m.col * T + T / 2;
      const ay = this.worldHeight - (m.row + 0.5) * T;
      const bx = (m.toCol ?? m.col) * T + T / 2;
      const by = this.worldHeight - ((m.toRow ?? m.row) + 0.5) * T;
      const g = this.add.graphics();
      g.lineStyle(3, 0x9b6cff, 0.6);
      g.lineBetween(ax, ay, bx, by);
      add(g);
      add(this.add.rectangle(bx, by, T - 6, 20, 0x9b6cff, 0.35).setStrokeStyle(1, 0x5a32b0));
      add(this.add.rectangle(ax, ay, T - 6, 20, 0x9b6cff).setStrokeStyle(2, 0x5a32b0));
    }

    // 敵人（紅方塊 + 巡邏範圍條）
    for (const en of this.level.enemies || []) {
      const w = Math.max(en.w || 1, 1);
      const footY = this.worldHeight - en.row * T;
      add(this.add.rectangle(en.col * T, footY - 2, w * T, 4, 0xd9534f, 0.5).setOrigin(0, 0.5));
      add(this.add.rectangle(en.col * T + T / 2, footY - 18, 36, 36, 0xd9534f).setStrokeStyle(2, 0x8a2f2c));
      add(this.add.text(en.col * T + 4, footY - 52, "敵人", { fontSize: "11px", color: "#ffb3b0", fontFamily: '"Microsoft JhengHei", sans-serif' }));
    }

    // 起點 / 終點
    const sx = this.level.start.col * T + T / 2;
    add(this.add.rectangle(sx, this.worldHeight - T - 20, 30, 40, 0xffd54f, 0.55).setStrokeStyle(2, 0xc79a16));
    add(this.add.text(sx, this.worldHeight - T - 52, "起點", { fontSize: "12px", color: "#ffd54f", fontFamily: '"Microsoft JhengHei", sans-serif' }).setOrigin(0.5));
    const gx = this.level.goal.col * T + T / 2;
    const gt = this.worldHeight - T;
    add(this.add.rectangle(gx, gt - 80, 6, 160, 0xf0f0f0));
    add(this.add.rectangle(gx + 22, gt - 150, 40, 26, 0xff5a5a));
    add(this.add.text(gx, gt - 176, "終點", { fontSize: "12px", color: "#ff8a8a", fontFamily: '"Microsoft JhengHei", sans-serif' }).setOrigin(0.5));
  }

  // ===================== 工具列 =====================
  createToolbar() {
    this.add.rectangle(0, 0, this.scale.width, this.TOOLBAR_H, 0x0d1320, 0.92).setOrigin(0, 0).setScrollFactor(0).setDepth(100);

    this.toolButtons = {};
    const tools = [
      ["solid", "🟫 地形"],
      ["coin", "🪙 金幣"],
      ["enemy", "👾 敵人"],
      ["mover", "🛗 平台"],
      ["start", "🧍 起點"],
      ["goal", "🚩 終點"],
      ["eraser", "🧽 擦除"],
    ];
    let x = 6;
    for (const [key, label] of tools) {
      const w = 80;
      this.toolButtons[key] = this.makeButton(x, 8, w, 22, label, () => this.selectTool(key));
      x += w + 4;
    }

    const actions = [
      ["▶️ 試玩", () => this.playtest()],
      ["◀ 關", () => this.gotoLevel(this.levelIndex - 1)],
      ["關 ▶", () => this.gotoLevel(this.levelIndex + 1)],
      ["➕ 關", () => this.addLevel()],
      ["💾 匯出", () => this.showExport()],
      ["🗑 清空", () => this.clearLevel()],
      ["↩ 重設", () => this.resetAll()],
      ["↶ 復原", () => this.undo()],
      ["➖ 短", () => this.changeLength(-5)],
      ["➕ 長", () => this.changeLength(5)],
    ];
    x = 6;
    for (const [label, fn] of actions) {
      const w = 74;
      this.makeButton(x, 34, w, 22, label, fn);
      x += w + 2;
    }

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

  makeButton(xLeft, yTop, w, h, label, onClick) {
    const rect = this.add
      .rectangle(xLeft, yTop, w, h, 0x33415a, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(101)
      .setStrokeStyle(1, 0x5a6b88)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(xLeft + w / 2, yTop + h / 2, label, { fontSize: "13px", color: "#ffffff", fontFamily: '"Microsoft JhengHei", sans-serif' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);
    rect.on("pointerdown", onClick);
    return { rect, text };
  }

  selectTool(tool) {
    this.tool = tool;
    for (const [key, btn] of Object.entries(this.toolButtons)) {
      btn.rect.setFillStyle(key === tool ? 0x4a90d9 : 0x33415a, 1);
    }
    this.updateStatus();
  }

  updateStatus() {
    const names = { solid: "地形", coin: "金幣", enemy: "敵人（拖一段＝巡邏範圍）", mover: "移動平台（拖兩點＝來回路徑）", start: "起點", goal: "終點", eraser: "擦除" };
    this.statusText.setText(`🛠 ${this.level.name}（${this.level.cols} 格）　|　工具：${names[this.tool]}　|　A D/滾輪平移 · Ctrl+Z 復原 · ▶️ 試玩 · 💾 匯出`);
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

  changeLength(delta) {
    this.pushHistory();
    this.level.cols = Phaser.Math.Clamp(this.level.cols + delta, 12, 160);
    // 終點/起點不要超出新長度
    this.level.goal.col = Math.min(this.level.goal.col, this.level.cols - 1);
    this.level.start.col = Math.min(this.level.start.col, this.level.cols - 1);
    this.worldWidth = this.level.cols * this.TILE;
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.persist();
    this.drawGrid();
    this.redraw();
    this.updateStatus();
  }

  clearLevel() {
    if (!window.confirm("確定清空這一關嗎？（地形/金幣/敵人/平台都會清掉，保留起點終點）")) return;
    this.pushHistory();
    this.solidCells.clear();
    this.coinCells.clear();
    this.level.enemies = [];
    this.level.movers = [];
    this.persist();
    this.redraw();
  }

  resetAll() {
    if (!window.confirm("確定把「所有關卡」重設成內建關卡嗎？你自己畫的會被清掉！")) return;
    this.levels = resetLevels();
    this.scene.restart({ levelIndex: 0 });
  }

  showExport() {
    this.persist();
    const json = JSON.stringify(this.levels, null, 2);
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:'Microsoft JhengHei',sans-serif;";
    const box = document.createElement("div");
    box.style.cssText = "background:#1b2332;color:#fff;padding:16px;border-radius:10px;width:min(680px,90vw);box-shadow:0 12px 48px rgba(0,0,0,.6);";
    box.innerHTML =
      '<div style="font-size:16px;margin-bottom:6px;">💾 匯出關卡 JSON</div>' +
      '<div style="font-size:13px;opacity:.8;margin-bottom:8px;line-height:1.5;">這是你設計的「所有關卡」。按「複製」後貼給工程師（或自己存起來），就能正式放進遊戲、上線給大家玩。<br>（你畫的關卡其實已經自動存在這台瀏覽器了。）</div>';
    const ta = document.createElement("textarea");
    ta.value = json;
    ta.readOnly = true;
    ta.style.cssText = "width:100%;height:280px;background:#0d1320;color:#cde;border:1px solid #33415a;border-radius:6px;padding:8px;font-family:monospace;font-size:12px;box-sizing:border-box;";
    box.appendChild(ta);
    const row = document.createElement("div");
    row.style.cssText = "margin-top:10px;display:flex;gap:8px;justify-content:flex-end;";
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 複製";
    copyBtn.style.cssText = "padding:8px 16px;border:0;border-radius:6px;cursor:pointer;font-size:14px;background:#4a90d9;color:#fff;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "關閉";
    closeBtn.style.cssText = "padding:8px 16px;border:0;border-radius:6px;cursor:pointer;font-size:14px;background:#33415a;color:#fff;";
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
  cellsFromList(items) {
    const set = new Set();
    for (const it of items || []) {
      for (let c = it.col; c < it.col + it.w; c++) set.add(c + "," + it.row);
    }
    return set;
  }

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
        if (c === prev + 1) prev = c;
        else {
          out.push({ col: start, row, w: prev - start + 1 });
          start = prev = c;
        }
      }
      out.push({ col: start, row, w: prev - start + 1 });
    }
    return out;
  }
}
