import Phaser from "phaser";
import { loadLevels } from "../levels/levels.js";
import {
  loadProfile,
  addCoins,
  effectiveStats,
  buyItem,
  equipSkin,
  resetProfile,
  SHOP_ITEMS,
} from "../game/profile.js";

// ============================================================
// PlatformerScene = 「2.5D 橫向捲軸闖關」場景
// ------------------------------------------------------------
// 玩家：左右移動、跳躍、踩平台、收金幣、踩敵人、坐移動平台，抵達終點過關。
// 關卡讀 levels.js 的資料來蓋（想改關卡用「開發者模式」EditorScene）。
//
// 這個場景支援：
//   ・敵人（左右巡邏、踩頭消滅、側撞扣愛心）＋ 愛心系統
//   ・移動平台（兩點來回、會載著玩家走）
//   ・道具商店（按 S / 點 🛒）：金幣買能力道具與造型，效果即時生效並存檔
//   ・多關卡接關、R 重玩、E 進開發者模式、手機觸控按鈕
// ============================================================
export default class PlatformerScene extends Phaser.Scene {
  constructor() {
    super("PlatformerScene");
  }

  init(data) {
    this.levelIndex = (data && data.levelIndex) || 0;
  }

  create() {
    // --- 0. 玩家檔案 + 已購道具換算成數值 ---
    this.profile = loadProfile();
    this.stats = effectiveStats(this.profile);

    // --- 0.1 手感參數（含道具加成）---
    this.BASE_MOVE = 240;
    this.BASE_JUMP = 640;
    this.MOVE_SPEED = this.BASE_MOVE + this.stats.speedBonus;
    this.JUMP_SPEED = this.BASE_JUMP + this.stats.jumpBonus;
    const GRAVITY = 1200;

    // --- 0.2 讀關卡 ---
    this.TILE = 64;
    this.levels = loadLevels();
    if (this.levelIndex >= this.levels.length) this.levelIndex = 0;
    this.level = this.levels[this.levelIndex];
    this.worldWidth = this.level.cols * this.TILE;
    this.worldHeight = this.scale.height;

    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight + 400);

    // --- 1. 背景 ---
    this.createParallaxBackground();

    // --- 2. 地形 ---
    this.solids = [];
    this.buildSolids(this.level);

    // --- 3. 玩家 ---
    const T = this.TILE;
    this.spawnPoint = {
      x: this.level.start.col * T + T / 2,
      y: this.worldHeight - T - 20 - 4,
    };
    this.player = this.add.rectangle(this.spawnPoint.x, this.spawnPoint.y, 30, 40, this.stats.skinColor);
    this.player.setStrokeStyle(2, 0xc79a16);
    this.physics.add.existing(this.player);
    this.physics.add.collider(this.player, this.solids);

    // --- 4. 移動平台（在加玩家碰撞器之後）---
    this.movers = [];
    this.buildMovers(this.level);
    this.physics.add.collider(this.player, this.movers);

    // --- 5. 金幣 ---
    this.score = 0;
    this.buildCoins(this.level);
    this.physics.add.overlap(this.player, this.coinList, this.collectCoin, null, this);

    // --- 6. 敵人 ---
    this.enemies = [];
    this.buildEnemies(this.level);
    this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);

    // --- 7. 終點 ---
    this.createGoal();

    // --- 8. 鏡頭 ---
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // --- 9. 狀態 ---
    this.maxHearts = this.stats.maxHearts;
    this.hearts = this.maxHearts;
    this.shieldActive = this.stats.shield; // 護盾：每關一次
    this.invincibleUntil = 0;
    this.jumpsLeft = 0;
    this.hasWon = false;
    this.continuing = false;
    this.shopOpen = false;

    // --- 10. 輸入 ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("A,D,W,SPACE,ENTER");
    this.input.keyboard.on("keydown-R", () => this.scene.restart({ levelIndex: this.levelIndex }));
    this.input.keyboard.on("keydown-E", () => this.scene.start("EditorScene", { levelIndex: this.levelIndex }));
    this.input.keyboard.on("keydown-S", () => this.openShop());

    // --- 11. 觸控 ---
    this.touch = { left: false, right: false, jump: false };
    this.createTouchControls();

    // --- 12. UI ---
    this.buildHud();
    if (this.stats.rainbow) this.startRainbow();
    this.updateHud();
  }

  update(time, delta) {
    if (this.shopOpen) {
      this.player.body.setVelocityX(0);
      return;
    }

    if (this.hasWon) {
      this.player.body.setVelocityX(0);
      const go =
        Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
        Phaser.Input.Keyboard.JustDown(this.keys.ENTER) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.up);
      if (go) this.continueAfterWin();
      return;
    }

    this.updateMovers(delta);
    this.updateEnemies();

    const body = this.player.body;
    const onGround = body.blocked.down;
    if (onGround) this.jumpsLeft = this.stats.doubleJump ? 2 : 1;

    // 被移動平台帶著走
    this.carryOnMover();

    // 左右移動
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touch.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touch.right;
    if (left) body.setVelocityX(-this.MOVE_SPEED);
    else if (right) body.setVelocityX(this.MOVE_SPEED);
    else body.setVelocityX(0);

    // 跳躍（含二段跳）
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      this.touch.jump;
    this.touch.jump = false;
    if (jumpPressed && this.jumpsLeft > 0) {
      body.setVelocityY(-this.JUMP_SPEED);
      this.jumpsLeft--;
    }

    // 掉坑 → 回起點（補滿愛心）
    if (this.player.y > this.worldHeight + 120) this.respawn(true);

    // 邊界
    if (this.player.x < 16) {
      this.player.x = 16;
      body.setVelocityX(0);
    }
    if (this.player.x > this.worldWidth - 16) this.player.x = this.worldWidth - 16;
  }

  // ===================== 背景 =====================
  createParallaxBackground() {
    const W = this.scale.width;
    const H = this.scale.height;
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30);
    sky.fillGradientStyle(0x4a90d9, 0x4a90d9, 0xcdeaf7, 0xcdeaf7, 1);
    sky.fillRect(0, 0, W, H);
    this.add.circle(110, 90, 44, 0xfff3b0).setScrollFactor(0.1).setDepth(-29);
    this.drawHills(0.25, 0x6aa84f, 150, 170, -28);
    this.drawHills(0.45, 0x4f8c3a, 120, 230, -27);
  }

  drawHills(scrollFactor, color, radiusY, step, depth) {
    const baseY = this.worldHeight - this.TILE;
    for (let x = -200; x <= this.worldWidth + 200; x += step) {
      this.add
        .ellipse(x, baseY, step * 1.6, radiusY * 2, color)
        .setScrollFactor(scrollFactor)
        .setDepth(depth);
    }
  }

  // ===================== 地形 =====================
  buildSolids(level) {
    const T = this.TILE;
    const occ = new Set();
    for (const s of level.solids || []) {
      for (let c = s.col; c < s.col + s.w; c++) occ.add(c + "," + s.row);
    }
    for (const run of this.mergeRuns(level.solids || [])) {
      const left = run.col * T;
      const top = this.worldHeight - (run.row + 1) * T;
      const w = run.w * T;
      const dirt = this.add.rectangle(left + w / 2, top + T / 2, w, T, 0x8a5a2b).setStrokeStyle(1, 0x6e4420);
      this.physics.add.existing(dirt, true);
      this.solids.push(dirt);
    }
    for (const key of occ) {
      const [c, row] = key.split(",").map(Number);
      if (occ.has(c + "," + (row + 1))) continue;
      const left = c * T;
      const top = this.worldHeight - (row + 1) * T;
      this.add.rectangle(left + T / 2, top + 5, T, 10, 0x5fb84d);
    }
  }

  mergeRuns(items) {
    const rowToCols = new Map();
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
        if (start === null) start = prev = c;
        else if (c === prev + 1) prev = c;
        else {
          runs.push({ col: start, row, w: prev - start + 1 });
          start = prev = c;
        }
      }
      if (start !== null) runs.push({ col: start, row, w: prev - start + 1 });
    }
    return runs;
  }

  // ===================== 金幣 =====================
  buildCoins(level) {
    const T = this.TILE;
    this.coinList = [];
    for (const cr of level.coins || []) {
      for (let c = cr.col; c < cr.col + cr.w; c++) {
        const x = c * T + T / 2;
        const y = this.worldHeight - (cr.row + 0.5) * T;
        const coin = this.add.circle(x, y, 11, 0xffe066).setStrokeStyle(3, 0xffb300);
        this.physics.add.existing(coin);
        coin.body.setAllowGravity(false);
        coin.body.setImmovable(true);
        this.coinList.push(coin);
        this.tweens.add({ targets: coin, y: y - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }
    this.totalCoins = this.coinList.length;
  }

  collectCoin(player, coin) {
    coin.destroy();
    this.score += 1;
    addCoins(this.profile, 1); // 累積到錢包並存檔
    this.updateHud();
  }

  // ===================== 敵人 =====================
  buildEnemies(level) {
    const T = this.TILE;
    for (const en of level.enemies || []) {
      const w = Math.max(en.w || 1, 1);
      const leftX = en.col * T;
      const rightX = (en.col + w) * T;
      const y = this.worldHeight - en.row * T - 18; // 站在 row 那一格的底
      const e = this.add.rectangle(leftX + T / 2, y, 36, 36, 0xd9534f).setStrokeStyle(2, 0x8a2f2c);
      this.physics.add.existing(e);
      e.body.setAllowGravity(false);
      e.body.setImmovable(true);
      e.minX = leftX + 18;
      e.maxX = rightX - 18;
      e.speed = 70;
      e.dir = 1;
      e.body.setVelocityX(e.speed);
      // 兩顆白眼睛，比較可愛
      e.eyeL = this.add.circle(0, 0, 4, 0xffffff).setDepth(2);
      e.eyeR = this.add.circle(0, 0, 4, 0xffffff).setDepth(2);
      this.enemies.push(e);
    }
  }

  updateEnemies() {
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.x <= e.minX) {
        e.x = e.minX;
        e.dir = 1;
      } else if (e.x >= e.maxX) {
        e.x = e.maxX;
        e.dir = -1;
      }
      e.body.setVelocityX(e.speed * e.dir);
      // 眼睛跟著、看著前進方向
      e.eyeL.setPosition(e.x - 7 + e.dir * 3, e.y - 4);
      e.eyeR.setPosition(e.x + 7 + e.dir * 3, e.y - 4);
    }
  }

  hitEnemy(player, enemy) {
    if (!enemy.active || this.hasWon || this.shopOpen) return;
    const pb = player.body;
    // 踩頭：玩家正在下落，且腳底在敵人上半部
    const stomping = pb.velocity.y > 60 && pb.bottom <= enemy.body.top + 20;
    if (stomping) {
      if (enemy.eyeL) enemy.eyeL.destroy();
      if (enemy.eyeR) enemy.eyeR.destroy();
      enemy.destroy();
      pb.setVelocityY(-this.JUMP_SPEED * 0.6); // 彈一下
      this.jumpsLeft = this.stats.doubleJump ? 2 : 1;
    } else {
      this.takeDamage();
    }
  }

  takeDamage() {
    const now = this.time.now;
    if (now < this.invincibleUntil) return;
    if (this.shieldActive) {
      this.shieldActive = false;
      this.invincibleUntil = now + 1000;
      this.flashPlayer(0x66ccff);
      this.updateHud();
      return;
    }
    this.hearts -= 1;
    this.invincibleUntil = now + 1200;
    this.flashPlayer(0xff3030);
    this.updateHud();
    if (this.hearts <= 0) this.respawn(true);
  }

  flashPlayer(color) {
    const original = this.stats.skinColor;
    this.player.setFillStyle(color);
    this.time.delayedCall(140, () => {
      if (this.player && this.player.active && !this.stats.rainbow) this.player.setFillStyle(original);
    });
  }

  // ===================== 移動平台 =====================
  buildMovers(level) {
    const T = this.TILE;
    for (const mv of level.movers || []) {
      const ax = mv.col * T + T / 2;
      const ay = this.worldHeight - (mv.row + 0.5) * T;
      const bx = (mv.toCol ?? mv.col) * T + T / 2;
      const by = this.worldHeight - ((mv.toRow ?? mv.row) + 0.5) * T;
      // 用「靜態 body + 自己手動移動」：靜態不會自動帶人，
      // 才能用手動補 delta 讓玩家被帶著走「剛好 1:1」（不會雙重位移）。
      const plat = this.add.rectangle(ax, ay, T - 6, 20, 0x9b6cff).setStrokeStyle(2, 0x5a32b0);
      this.physics.add.existing(plat, true); // true = 靜態
      plat.ax = ax;
      plat.ay = ay;
      plat.bx = bx;
      plat.by = by;
      plat.t = 0; // 在 A(0) 與 B(1) 之間的位置
      plat.dir = 1;
      plat.speed = 70;
      plat._dx = 0;
      plat._dy = 0;
      this.movers.push(plat);
    }
  }

  updateMovers(deltaMs) {
    const dt = (deltaMs || 16) / 1000;
    for (const m of this.movers) {
      const oldX = m.x;
      const oldY = m.y;
      const segLen = Math.hypot(m.bx - m.ax, m.by - m.ay) || 1;
      m.t += (m.dir * m.speed * dt) / segLen;
      if (m.t >= 1) {
        m.t = 1;
        m.dir = -1;
      } else if (m.t <= 0) {
        m.t = 0;
        m.dir = 1;
      }
      m.x = m.ax + (m.bx - m.ax) * m.t;
      m.y = m.ay + (m.by - m.ay) * m.t;
      m.body.updateFromGameObject(); // 靜態 body 移動後要手動同步
      m._dx = m.x - oldX;
      m._dy = m.y - oldY;
    }
  }

  carryOnMover() {
    const pb = this.player.body;
    for (const m of this.movers) {
      const mb = m.body;
      const onTop =
        pb.bottom <= mb.top + 10 &&
        pb.bottom >= mb.top - 12 &&
        pb.right > mb.left + 3 &&
        pb.left < mb.right - 3 &&
        pb.velocity.y >= -20;
      if (onTop) {
        this.player.x += m._dx || 0; // 水平：手動帶著走
        if ((m._dy || 0) > 0) this.player.y += m._dy; // 平台往下時跟著下移（往上由碰撞推）
      }
    }
  }

  // ===================== 終點 / 過關 =====================
  createGoal() {
    const gx = this.level.goal.col * this.TILE + this.TILE / 2;
    const groundTop = this.worldHeight - this.TILE;
    this.add.rectangle(gx, groundTop - 80, 8, 160, 0xf0f0f0).setDepth(1);
    this.add.rectangle(gx + 26, groundTop - 150, 44, 28, 0xff5a5a).setDepth(1);
    this.add.circle(gx, groundTop - 162, 9, 0xffd54f).setDepth(1);
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
      ? `金幣 ${this.score}/${this.totalCoins}　·　按 空白 回第一關　·　R 重玩`
      : `金幣 ${this.score}/${this.totalCoins}　·　按 空白 / 點畫面 進入下一關`;
    this.showOverlay(title, tip);
    this.input.once("pointerdown", () => this.continueAfterWin());
  }

  continueAfterWin() {
    if (!this.hasWon || this.continuing) return;
    this.continuing = true;
    const next = this.levelIndex + 1;
    this.scene.restart({ levelIndex: next < this.levels.length ? next : 0 });
  }

  showOverlay(title, tip) {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.add.rectangle(cx, cy, 520, 160, 0x000000, 0.8).setScrollFactor(0).setDepth(200).setStrokeStyle(3, 0xffd54f);
    this.add
      .text(cx, cy - 34, title, { fontSize: "40px", color: "#ffd54f", fontFamily: '"Microsoft JhengHei", sans-serif' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    this.add
      .text(cx, cy + 30, tip, { fontSize: "16px", color: "#ffffff", fontFamily: '"Microsoft JhengHei", sans-serif' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
  }

  respawn(refill) {
    this.player.body.setVelocity(0, 0);
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    if (refill) {
      this.hearts = this.maxHearts;
      this.shieldActive = this.stats.shield;
      this.invincibleUntil = this.time.now + 800;
      this.updateHud();
    }
  }

  // ===================== HUD =====================
  buildHud() {
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

    this.add
      .text(12, 48, "← → / A D 移動　·　空白 跳　·　踩敵人頭　·　R 重玩　·　S 商店", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 8, y: 4 },
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.heartsText = this.add
      .text(this.scale.width - 12, 12, "", { fontSize: "22px", fontFamily: '"Microsoft JhengHei", sans-serif' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.shopBtn = this.add
      .text(this.scale.width - 12, 46, "🛒 商店 (S)", {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#4a90d9cc",
        padding: { x: 8, y: 4 },
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });
    this.shopBtn.on("pointerdown", () => this.openShop());
  }

  updateHud() {
    const name = this.level.name || `第 ${this.levelIndex + 1} 關`;
    this.scoreText.setText(`${name}　金幣 ${this.score}/${this.totalCoins}　·　💰 ${this.profile.coins}`);
    const full = "❤️".repeat(Math.max(0, this.hearts));
    const empty = "🤍".repeat(Math.max(0, this.maxHearts - this.hearts));
    const shield = this.shieldActive ? "　🛡️" : "";
    this.heartsText.setText(full + empty + shield);
  }

  startRainbow() {
    this.stopRainbow();
    this._hue = 0;
    this._rainbowEvent = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        this._hue = (this._hue + 20) % 360;
        const c = Phaser.Display.Color.HSVToRGB(this._hue / 360, 0.85, 1).color;
        if (this.player && this.player.active) this.player.setFillStyle(c);
      },
    });
  }

  stopRainbow() {
    if (this._rainbowEvent) {
      this._rainbowEvent.remove();
      this._rainbowEvent = null;
    }
  }

  // 買完道具後，即時套用效果（不用等下一關）
  applyStatsLive() {
    this.stats = effectiveStats(this.profile);
    this.MOVE_SPEED = this.BASE_MOVE + this.stats.speedBonus;
    this.JUMP_SPEED = this.BASE_JUMP + this.stats.jumpBonus;
    this.maxHearts = this.stats.maxHearts;
    if (this.hearts > this.maxHearts) this.hearts = this.maxHearts;
    this.shieldActive = this.shieldActive || this.stats.shield;
    if (this.stats.rainbow) this.startRainbow();
    else {
      this.stopRainbow();
      this.player.setFillStyle(this.stats.skinColor);
    }
    this.updateHud();
  }

  // ===================== 商店（DOM 視窗）=====================
  openShop() {
    if (this.shopOpen || this.hasWon) return;
    this.shopOpen = true;
    this.physics.pause();
    this.player.body.setVelocity(0, 0);

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:'Microsoft JhengHei',sans-serif;";
    const box = document.createElement("div");
    box.style.cssText =
      "background:#1b2332;color:#fff;padding:16px 18px;border-radius:12px;width:min(560px,92vw);max-height:88vh;overflow:auto;box-shadow:0 12px 48px rgba(0,0,0,.6);";
    wrap.appendChild(box);
    this._shopEl = wrap;

    const render = () => {
      box.innerHTML = "";
      const head = document.createElement("div");
      head.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;";
      head.innerHTML =
        '<div style="font-size:20px;">🛒 道具商店</div>' +
        `<div style="font-size:18px;color:#ffd54f;">💰 ${this.profile.coins}</div>`;
      box.appendChild(head);

      const section = (title) => {
        const h = document.createElement("div");
        h.textContent = title;
        h.style.cssText = "font-size:14px;opacity:.8;margin:10px 0 6px;border-bottom:1px solid #33415a;padding-bottom:4px;";
        box.appendChild(h);
      };

      const row = (item, actionEl) => {
        const r = document.createElement("div");
        r.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:7px 8px;border-radius:8px;background:#0f1726;margin-bottom:6px;";
        const left = document.createElement("div");
        left.innerHTML =
          `<div style="font-size:15px;">${item.name}</div>` +
          `<div style="font-size:12px;opacity:.7;">${item.desc || (item.type === "skin" ? "造型" : "")}　·　${item.price} 💰</div>`;
        r.appendChild(left);
        r.appendChild(actionEl);
        box.appendChild(r);
      };

      const btn = (label, enabled, onClick, bg = "#4a90d9") => {
        const b = document.createElement("button");
        b.textContent = label;
        b.disabled = !enabled;
        b.style.cssText =
          `padding:7px 14px;border:0;border-radius:8px;font-size:14px;color:#fff;background:${enabled ? bg : "#3a4458"};cursor:${enabled ? "pointer" : "default"};opacity:${enabled ? 1 : 0.6};`;
        if (enabled) b.onclick = onClick;
        return b;
      };

      // 能力道具
      section("能力道具（買了永久生效）");
      for (const item of SHOP_ITEMS.filter((i) => i.type === "power")) {
        const owned = !!this.profile.owned[item.id];
        let action;
        if (owned) action = btn("已擁有", false, null);
        else
          action = btn(
            `購買`,
            this.profile.coins >= item.price,
            () => {
              if (buyItem(this.profile, item.id)) {
                this.applyStatsLive();
                render();
              }
            }
          );
        row(item, action);
      }

      // 造型
      section("造型（純裝飾，可換上）");
      // 預設造型
      const defEquipped = (this.profile.skin || "default") === "default";
      row(
        { name: "🟡 預設（黃）", price: 0, type: "skin", desc: "原本的小工人" },
        defEquipped
          ? btn("已裝備", false, null, "#2e7d32")
          : btn("換上", true, () => {
              equipSkin(this.profile, "default");
              this.applyStatsLive();
              render();
            }, "#2e7d32")
      );
      for (const item of SHOP_ITEMS.filter((i) => i.type === "skin")) {
        const owned = !!this.profile.owned[item.id];
        const equipped = this.profile.skin === item.id;
        let action;
        if (equipped) action = btn("已裝備", false, null, "#2e7d32");
        else if (owned)
          action = btn("換上", true, () => {
            equipSkin(this.profile, item.id);
            this.applyStatsLive();
            render();
          }, "#2e7d32");
        else
          action = btn("購買", this.profile.coins >= item.price, () => {
            if (buyItem(this.profile, item.id)) {
              this.applyStatsLive();
              render();
            }
          });
        row(item, action);
      }

      // 底部按鈕
      const foot = document.createElement("div");
      foot.style.cssText = "display:flex;justify-content:space-between;margin-top:14px;";
      const reset = btn("🔄 重設存檔", true, () => {
        if (window.confirm("確定把金幣和已買道具全部歸零嗎？")) {
          this.profile = resetProfile();
          this.applyStatsLive();
          render();
        }
      }, "#7a3b3b");
      const close = btn("關閉 (Esc)", true, () => this.closeShop(), "#33415a");
      foot.appendChild(reset);
      foot.appendChild(close);
      box.appendChild(foot);
    };

    render();
    document.body.appendChild(wrap);
    this._shopEsc = (ev) => {
      if (ev.key === "Escape") this.closeShop();
    };
    window.addEventListener("keydown", this._shopEsc);
  }

  closeShop() {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    if (this._shopEl) {
      this._shopEl.remove();
      this._shopEl = null;
    }
    if (this._shopEsc) {
      window.removeEventListener("keydown", this._shopEsc);
      this._shopEsc = null;
    }
    this.physics.resume();
  }

  // ===================== 觸控按鈕 =====================
  createTouchControls() {
    const hasTouch = this.sys.game.device.input.touch || (navigator && navigator.maxTouchPoints > 0);
    if (!hasTouch) return;
    this.input.addPointer(2);
    const y = this.scale.height - 70;
    this.makeTouchButton(70, y, "◀", "left");
    this.makeTouchButton(180, y, "▶", "right");
    this.makeTouchButton(this.scale.width - 80, y, "跳", "jump");
  }

  makeTouchButton(x, y, label, action) {
    const r = 44;
    const circle = this.add.circle(x, y, r, 0xffffff, 0.25).setStrokeStyle(3, 0xffffff, 0.6).setScrollFactor(0).setDepth(300);
    this.add
      .text(x, y, label, { fontSize: "28px", color: "#ffffff", fontFamily: '"Microsoft JhengHei", sans-serif' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(301);
    const zone = this.add.zone(x, y, r * 2, r * 2).setScrollFactor(0).setDepth(302).setInteractive();
    const press = () => {
      if (action === "jump") this.touch.jump = true;
      else this.touch[action] = true;
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
