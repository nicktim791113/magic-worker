import Phaser from "phaser";
import { loadLevels } from "../levels/levels.js";

// ============================================================
// PlatformerScene = 「2.5D 橫向捲軸闖關」場景（超級瑪利歐風格）
// ------------------------------------------------------------
// 玩家在這裡：左右移動、跳躍、踩平台、收金幣，抵達終點過關。
//
// ✨ 和舊版最大的不同：
//   關卡不再寫死在這支程式裡，而是「讀 levels.js 的資料」來蓋。
//   想改關卡 → 用「開發者模式」(EditorScene) 用滑鼠畫，或直接改 levels.js。
//
// 這個場景支援：
//   ・多關卡接關（過關自動進下一關，最後一關顯示「全部破關」）
//   ・R 鍵重玩這一關
//   ・手機/平板觸控按鈕（◀ ▶ 跳）
//   ・E 鍵切換到開發者模式（關卡編輯器）
// ============================================================
export default class PlatformerScene extends Phaser.Scene {
  constructor() {
    super("PlatformerScene"); // 場景名字，main.js 會用到
  }

  // init 在 create 之前跑，用來接收「要玩第幾關」（場景重啟時會帶進來）
  init(data) {
    this.levelIndex = (data && data.levelIndex) || 0;
  }

  create() {
    // --- 0. 手感參數（想調整跳多高、跑多快，改這三個就好）---
    this.MOVE_SPEED = 240; // 左右移動速度（像素/秒）
    this.JUMP_SPEED = 640; // 跳躍力道（越大跳越高）
    const GRAVITY = 1200; // 重力（越大掉得越快、手感越「重」）

    // --- 0.1 讀關卡資料 ---
    this.TILE = 64; // 一格的大小
    this.levels = loadLevels(); // 從瀏覽器存檔或內建關卡讀進來
    // 防呆：萬一索引超出範圍，回到第一關
    if (this.levelIndex >= this.levels.length) this.levelIndex = 0;
    this.level = this.levels[this.levelIndex];

    this.worldWidth = this.level.cols * this.TILE; // 關卡總長度
    this.worldHeight = this.scale.height; // 關卡高度 = 一個畫面高（600）

    // 這個場景要有重力。
    this.physics.world.gravity.y = GRAVITY;
    // 物理邊界比畫面高一點，這樣掉進坑裡可以一直往下掉（再觸發重生）。
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight + 400);

    // --- 1. 背景（視差，產生 2.5D 景深）---
    this.createParallaxBackground();

    // --- 2. 地形：讀資料蓋出來（合併連續格子成橫條，避免接縫卡住）---
    this.solids = [];
    this.buildSolids(this.level);

    // --- 3. 玩家（黃色方塊，先當佔位圖）---
    // 出生點：站在起點欄的地面上
    const T = this.TILE;
    this.spawnPoint = {
      x: this.level.start.col * T + T / 2,
      y: this.worldHeight - T - 20 - 4, // 比地面高一點點，輕輕落地
    };
    this.player = this.add.rectangle(this.spawnPoint.x, this.spawnPoint.y, 30, 40, 0xffd54f);
    this.player.setStrokeStyle(2, 0xc79a16);
    this.physics.add.existing(this.player); // 動態物理身體（會受重力）
    this.physics.add.collider(this.player, this.solids); // 撞到地形會停、踩得上去

    // --- 4. 金幣 ---
    this.score = 0;
    this.buildCoins(this.level);
    // overlap = 碰到但不會被擋住（穿過去並觸發 collectCoin）
    this.physics.add.overlap(this.player, this.coinList, this.collectCoin, null, this);

    // --- 5. 終點旗子 ---
    this.createGoal();

    // --- 6. 鏡頭跟著玩家（只會左右捲動，因為世界高度 = 畫面高度）---
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // --- 7. 鍵盤輸入 ---
    this.cursors = this.input.keyboard.createCursorKeys(); // 方向鍵
    this.keys = this.input.keyboard.addKeys("A,D,W,SPACE,ENTER"); // A D 移動、W/空白 跳

    // R 鍵：重玩這一關
    this.input.keyboard.on("keydown-R", () => {
      this.scene.restart({ levelIndex: this.levelIndex });
    });
    // E 鍵：切換到開發者模式（關卡編輯器）
    this.input.keyboard.on("keydown-E", () => {
      this.scene.start("EditorScene", { levelIndex: this.levelIndex });
    });

    // --- 8. 觸控按鈕（手機/平板才顯示）---
    this.touch = { left: false, right: false, jump: false };
    this.createTouchControls();

    // --- 9. UI（固定在畫面上，不跟著捲動）---
    this.scoreText = this.add
      .text(12, 12, "", {
        fontSize: "20px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 8, y: 4 },
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.updateScore();

    this.add
      .text(12, 48, "← → / A D 移動　·　空白 / ↑ / W 跳　·　R 重玩　·　收集金幣抵達 🚩", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 8, y: 4 },
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.hasWon = false;
    this.continuing = false;
  }

  // update() 每一幀都會跑：移動、跳躍、掉落判定
  update() {
    if (this.hasWon) {
      this.player.body.setVelocityX(0);
      // 過關畫面：按 空白 / Enter / ↑ 進入下一關（或從頭再玩）
      const go =
        Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
        Phaser.Input.Keyboard.JustDown(this.keys.ENTER) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.up);
      if (go) this.continueAfterWin();
      return;
    }

    const body = this.player.body;
    const onGround = body.blocked.down; // 腳下有踩到東西嗎？

    // 左右移動（鍵盤 或 觸控）
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touch.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touch.right;
    if (left) body.setVelocityX(-this.MOVE_SPEED);
    else if (right) body.setVelocityX(this.MOVE_SPEED);
    else body.setVelocityX(0);

    // 跳躍：用 JustDown 確保「按一下跳一次」，而且只有踩在地上才能跳
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      this.touch.jump;
    this.touch.jump = false; // 觸控跳：用完就清掉（一次點擊只跳一次）
    if (jumpPressed && onGround) {
      body.setVelocityY(-this.JUMP_SPEED);
    }

    // 掉進坑裡（掉出畫面下方）→ 回到起點
    if (this.player.y > this.worldHeight + 120) {
      this.respawn();
    }

    // 不要走出左右邊界
    if (this.player.x < 16) {
      this.player.x = 16;
      body.setVelocityX(0);
    }
    if (this.player.x > this.worldWidth - 16) {
      this.player.x = this.worldWidth - 16;
    }
  }

  // ===================== 以下是輔助方法 =====================

  // ---- 視差背景：越遠的圖層 scrollFactor 越小、移動越慢 ----
  createParallaxBackground() {
    const W = this.scale.width;
    const H = this.scale.height;

    // 天空漸層（固定在畫面上，scrollFactor = 0）
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30);
    sky.fillGradientStyle(0x4a90d9, 0x4a90d9, 0xcdeaf7, 0xcdeaf7, 1);
    sky.fillRect(0, 0, W, H);

    // 太陽（幾乎不動）
    this.add.circle(110, 90, 44, 0xfff3b0).setScrollFactor(0.1).setDepth(-29);

    // 遠山（移動很慢）→ 立體感的關鍵
    this.drawHills(0.25, 0x6aa84f, 150, 170, -28);
    // 近丘（移動稍快一點）
    this.drawHills(0.45, 0x4f8c3a, 120, 230, -27);
  }

  // 沿著整個世界寬度，鋪一排橢圓當作「山丘」
  drawHills(scrollFactor, color, radiusY, step, depth) {
    const baseY = this.worldHeight - this.TILE; // 山腳對齊地面
    for (let x = -200; x <= this.worldWidth + 200; x += step) {
      this.add
        .ellipse(x, baseY, step * 1.6, radiusY * 2, color)
        .setScrollFactor(scrollFactor)
        .setDepth(depth);
    }
  }

  // ---- 把資料裡的 solids 蓋成實心地形 ----
  // 做法：先把每一塊展開成格子 → 同一列的連續格子合併成一條 → 一條一個物理身體。
  // 這樣走在平地上不會卡到「格子與格子之間的接縫」。
  buildSolids(level) {
    const T = this.TILE;

    // 1) 記錄所有「被佔住的格子」(col,row)，等下畫草皮要用
    const occ = new Set();
    for (const s of level.solids || []) {
      for (let c = s.col; c < s.col + s.w; c++) occ.add(c + "," + s.row);
    }

    // 2) 合併成橫條，做物理身體 + 泥土本體
    for (const run of this.mergeRuns(level.solids || [])) {
      const left = run.col * T;
      const top = this.worldHeight - (run.row + 1) * T;
      const w = run.w * T;
      const cx = left + w / 2;
      const cy = top + T / 2;
      const dirt = this.add.rectangle(cx, cy, w, T, 0x8a5a2b).setStrokeStyle(1, 0x6e4420);
      this.physics.add.existing(dirt, true); // true = 靜態（不會被推動）
      this.solids.push(dirt);
    }

    // 3) 草皮：只長在「上方沒有方塊」的格子頂端（裝飾，無物理）
    for (const key of occ) {
      const [c, row] = key.split(",").map(Number);
      if (occ.has(c + "," + (row + 1))) continue; // 上面還有方塊 → 不長草
      const left = c * T;
      const top = this.worldHeight - (row + 1) * T;
      this.add.rectangle(left + T / 2, top + 5, T, 10, 0x5fb84d);
    }
  }

  // 把一堆 {col,row,w} 依「列」合併成連續橫條（會處理重疊與相鄰）。
  // 回傳一樣是 [{col,row,w}]，但保證同列相鄰的都黏成一條。
  mergeRuns(items) {
    const rowToCols = new Map(); // row -> Set(被佔的 col)
    for (const it of items) {
      if (!rowToCols.has(it.row)) rowToCols.set(it.row, new Set());
      const set = rowToCols.get(it.row);
      for (let c = it.col; c < it.col + it.w; c++) set.add(c);
    }
    const runs = [];
    for (const [row, set] of rowToCols) {
      const cols = [...set].sort((a, b) => a - b);
      let start = null;
      let prev = null;
      for (const c of cols) {
        if (start === null) {
          start = prev = c;
        } else if (c === prev + 1) {
          prev = c;
        } else {
          runs.push({ col: start, row, w: prev - start + 1 });
          start = prev = c;
        }
      }
      if (start !== null) runs.push({ col: start, row, w: prev - start + 1 });
    }
    return runs;
  }

  // ---- 金幣：依資料排好，會上下飄動 ----
  buildCoins(level) {
    const T = this.TILE;
    this.coinList = [];
    for (const cr of level.coins || []) {
      for (let c = cr.col; c < cr.col + cr.w; c++) {
        const x = c * T + T / 2;
        const y = this.worldHeight - (cr.row + 0.5) * T; // 放在格子中央
        const coin = this.add.circle(x, y, 11, 0xffe066).setStrokeStyle(3, 0xffb300);
        this.physics.add.existing(coin); // 動態身體（飄動時 overlap 才準）
        coin.body.setAllowGravity(false); // 金幣不受重力
        coin.body.setImmovable(true);
        this.coinList.push(coin);
        this.tweens.add({
          targets: coin,
          y: y - 8,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
      }
    }
    this.totalCoins = this.coinList.length;
  }

  // 撿到金幣
  collectCoin(player, coin) {
    coin.destroy();
    this.score += 1;
    this.updateScore();
  }

  updateScore() {
    const name = this.level.name || `第 ${this.levelIndex + 1} 關`;
    this.scoreText.setText(`${name}　金幣 ${this.score} / ${this.totalCoins}`);
  }

  // ---- 終點旗子 ----
  createGoal() {
    const gx = this.level.goal.col * this.TILE + this.TILE / 2;
    const groundTop = this.worldHeight - this.TILE;
    // 旗桿
    this.add.rectangle(gx, groundTop - 80, 8, 160, 0xf0f0f0).setDepth(1);
    // 旗子（紅）
    this.add.rectangle(gx + 26, groundTop - 150, 44, 28, 0xff5a5a).setDepth(1);
    // 頂端的星星
    this.add.circle(gx, groundTop - 162, 9, 0xffd54f).setDepth(1);
    // 透明的「過關感應區」：碰到就贏
    this.goal = this.add.rectangle(gx, groundTop - 80, 56, 170, 0xffffff, 0);
    this.physics.add.existing(this.goal, true);
    this.physics.add.overlap(this.player, this.goal, this.reachGoal, null, this);
  }

  reachGoal() {
    if (this.hasWon) return;
    this.hasWon = true;
    this.player.body.setVelocity(0, 0);

    const isLast = this.levelIndex + 1 >= this.levels.length;
    const title = isLast ? "🏆 全部破關！" : "🎉 過關！";
    const tip = isLast
      ? `金幣 ${this.score} / ${this.totalCoins}　·　按 空白 從第一關再玩　·　R 重玩這關`
      : `金幣 ${this.score} / ${this.totalCoins}　·　按 空白 / 點畫面 進入下一關　·　R 重玩`;
    this.showOverlay(title, tip);

    // 點一下畫面也能繼續
    this.input.once("pointerdown", () => this.continueAfterWin());
  }

  // 過關後：進下一關；若已是最後一關就回到第一關
  continueAfterWin() {
    if (!this.hasWon || this.continuing) return;
    this.continuing = true;
    const next = this.levelIndex + 1;
    if (next < this.levels.length) this.scene.restart({ levelIndex: next });
    else this.scene.restart({ levelIndex: 0 });
  }

  // 畫面中央的提示框（過關 / 全破共用）
  showOverlay(title, tip) {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.add
      .rectangle(cx, cy, 520, 160, 0x000000, 0.8)
      .setScrollFactor(0)
      .setDepth(200)
      .setStrokeStyle(3, 0xffd54f);
    this.add
      .text(cx, cy - 34, title, {
        fontSize: "40px",
        color: "#ffd54f",
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    this.add
      .text(cx, cy + 30, tip, {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
  }

  // 掉進坑裡 → 回到起點
  respawn() {
    this.player.body.setVelocity(0, 0);
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
  }

  // ---- 觸控按鈕（手機/平板才顯示）----
  createTouchControls() {
    // 沒有觸控螢幕（一般電腦）就不畫，免得擋住畫面
    const hasTouch =
      this.sys.game.device.input.touch || (navigator && navigator.maxTouchPoints > 0);
    if (!hasTouch) return;

    // 允許同時多指（一手按方向、一手按跳）
    this.input.addPointer(2);

    const y = this.scale.height - 70;
    this.makeTouchButton(70, y, "◀", "left");
    this.makeTouchButton(180, y, "▶", "right");
    this.makeTouchButton(this.scale.width - 80, y, "跳", "jump");
  }

  // 做一顆觸控圓鈕：按住時設定對應的 this.touch 旗標
  makeTouchButton(x, y, label, action) {
    const r = 44;
    // 圓圈與文字只是「外觀」
    const circle = this.add
      .circle(x, y, r, 0xffffff, 0.25)
      .setStrokeStyle(3, 0xffffff, 0.6)
      .setScrollFactor(0)
      .setDepth(300);
    this.add
      .text(x, y, label, {
        fontSize: "28px",
        color: "#ffffff",
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(301);
    // 真正接收觸控的是一個「看不見的方形感應區」（hit 範圍最可靠）
    const zone = this.add
      .zone(x, y, r * 2, r * 2)
      .setScrollFactor(0)
      .setDepth(302)
      .setInteractive();

    const press = () => {
      if (action === "jump") this.touch.jump = true; // 跳：設一次，update 用完清掉
      else this.touch[action] = true; // 左右：按住期間都算
      circle.setFillStyle(0xffffff, 0.45);
    };
    const release = () => {
      if (action !== "jump") this.touch[action] = false;
      circle.setFillStyle(0xffffff, 0.25);
    };
    zone.on("pointerdown", press);
    zone.on("pointerup", release);
    zone.on("pointerout", release);
  }
}
