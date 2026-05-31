import Phaser from "phaser";

// ============================================================
// PlatformerScene = 「2.5D 橫向捲軸闖關」場景（超級瑪利歐風格）
// ------------------------------------------------------------
// 玩家在這裡：左右移動、跳躍、踩平台、收金幣，抵達終點過關。
//
// 為什麼叫「2.5D」？
//   玩法是純 2D（只有左右 + 跳），但「背景」用了「視差捲動」：
//   越遠的山移動得越慢，營造出立體景深 → 這就是 2.5D 的視覺感。
//
// 和 WorldScene 的差別：
//   WorldScene 是俯視角（沒有重力，上下左右都能走）。
//   這個場景是側視角（有重力往下拉，只能左右走 + 跳）。
// ============================================================
export default class PlatformerScene extends Phaser.Scene {
  constructor() {
    super("PlatformerScene"); // 場景名字，main.js 會用到
  }

  create() {
    // --- 0. 手感參數（想調整跳多高、跑多快，改這三個就好）---
    this.MOVE_SPEED = 240; // 左右移動速度（像素/秒）
    this.JUMP_SPEED = 640; // 跳躍力道（越大跳越高）
    const GRAVITY = 1200; // 重力（越大掉得越快、手感越「重」）

    // --- 0.1 關卡尺寸 ---
    this.TILE = 64; // 一格的大小，方便用「第幾格」來排版
    this.worldWidth = 3200; // 關卡總長度（畫面會橫向捲動）
    this.worldHeight = this.scale.height; // 關卡高度 = 一個畫面高（600）

    // 這個場景要有重力（WorldScene 是俯視角所以沒有）。
    // 我們在這裡單獨設定這個物理世界的重力。
    this.physics.world.gravity.y = GRAVITY;
    // 物理邊界比畫面高一點，這樣掉進坑裡可以一直往下掉（再觸發重生）。
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight + 400);

    // --- 1. 背景（視差，產生 2.5D 景深）---
    this.createParallaxBackground();

    // --- 2. 地形：地面 + 浮空平台 ---
    // solids 收集所有「踩得到、會擋住玩家」的方塊。
    this.solids = [];
    // 地面：用「第幾格 ~ 第幾格」來鋪。中間留兩個缺口讓你跳。
    this.addGround(0, 11); // 第 12~14 格是坑
    this.addGround(15, 27); // 第 28~30 格是坑
    this.addGround(31, 49);
    // 階梯式浮空平台：addPlatform(起格, 迄格, 離地面幾格高)
    this.addPlatform(5, 7, 2);
    this.addPlatform(9, 10, 4);
    this.addPlatform(18, 20, 2);
    this.addPlatform(22, 23, 4);
    this.addPlatform(34, 36, 2);
    this.addPlatform(38, 39, 4);
    this.addPlatform(43, 45, 2);

    // --- 3. 玩家（黃色方塊，和 WorldScene 一致，先當佔位圖）---
    this.player = this.add.rectangle(80, 380, 30, 40, 0xffd54f);
    this.player.setStrokeStyle(2, 0xc79a16);
    this.physics.add.existing(this.player); // 動態物理身體（會受重力）
    // 撞到任何地形就停下、踩得上去
    this.physics.add.collider(this.player, this.solids);

    // --- 4. 金幣 ---
    this.coinList = [];
    this.score = 0;
    this.addCoinRow(2, 4, 1); // addCoinRow(起格, 迄格, 離地高度)
    this.addCoinRow(5, 7, 3);
    this.addCoinRow(9, 10, 5);
    this.addCoinRow(16, 19, 1);
    this.addCoinRow(22, 23, 5);
    this.addCoinRow(34, 36, 3);
    this.addCoinRow(43, 45, 3);
    this.totalCoins = this.coinList.length;
    // overlap = 碰到但不會被擋住（穿過去並觸發 collectCoin）
    this.physics.add.overlap(this.player, this.coinList, this.collectCoin, null, this);

    // --- 5. 終點旗子 ---
    this.createGoal();

    // --- 6. 鏡頭跟著玩家（只會左右捲動，因為世界高度 = 畫面高度）---
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // --- 7. 鍵盤輸入 ---
    this.cursors = this.input.keyboard.createCursorKeys(); // 方向鍵
    this.keys = this.input.keyboard.addKeys("A,D,W,SPACE"); // A D 移動、W/空白 跳

    // --- 8. UI（固定在畫面上，不跟著捲動）---
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
      .text(12, 48, "← → / A D 移動　·　空白鍵 / ↑ / W 跳躍　·　收集金幣抵達 🚩", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 8, y: 4 },
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.hasWon = false;
  }

  // update() 每一幀都會跑，用來處理「持續發生」的事：移動、跳躍、掉落判定
  update() {
    if (this.hasWon) {
      this.player.body.setVelocityX(0);
      return;
    }

    const body = this.player.body;
    const onGround = body.blocked.down; // 腳下有踩到東西嗎？

    // 左右移動
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    if (left) body.setVelocityX(-this.MOVE_SPEED);
    else if (right) body.setVelocityX(this.MOVE_SPEED);
    else body.setVelocityX(0);

    // 跳躍：用 JustDown 確保「按一下跳一次」，而且只有踩在地上才能跳
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
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

  // ---- 地面：在底部鋪一整條（高度 1 格）----
  addGround(fromCol, toCol) {
    const T = this.TILE;
    const x = fromCol * T;
    const w = (toCol - fromCol + 1) * T;
    const top = this.worldHeight - T;
    this.makeSolid(x, top, w, T);
  }

  // ---- 浮空平台：離地面 rowsUp 格高，做成薄薄的台子 ----
  addPlatform(fromCol, toCol, rowsUp) {
    const T = this.TILE;
    const x = fromCol * T;
    const w = (toCol - fromCol + 1) * T;
    const top = this.worldHeight - T - rowsUp * T;
    this.makeSolid(x, top, w, 28);
  }

  // 真正建立一塊「實心地形」：泥土底 + 草皮頂，並給它靜態物理身體
  makeSolid(left, top, width, height) {
    const cx = left + width / 2;
    const cy = top + height / 2;
    // 泥土本體（這塊有物理身體，會擋住玩家）
    const dirt = this.add.rectangle(cx, cy, width, height, 0x8a5a2b);
    this.physics.add.existing(dirt, true); // true = 靜態（不會被推動）
    this.solids.push(dirt);
    // 草皮（只是裝飾，疊在頂部，沒有物理身體）
    this.add.rectangle(cx, top + 5, width, 10, 0x5fb84d);
  }

  // ---- 金幣：在指定高度排一排，會上下飄動 ----
  addCoinRow(fromCol, toCol, rowsUp) {
    const T = this.TILE;
    const y = this.worldHeight - T - rowsUp * T - 26;
    for (let c = fromCol; c <= toCol; c++) {
      const x = c * T + T / 2;
      const coin = this.add.circle(x, y, 11, 0xffe066).setStrokeStyle(3, 0xffb300);
      this.physics.add.existing(coin); // 動態身體（這樣飄動時 overlap 才準）
      coin.body.setAllowGravity(false); // 金幣不受重力
      coin.body.setImmovable(true);
      this.coinList.push(coin);
      // 上下飄動，比較有生命感
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

  // 撿到金幣
  collectCoin(player, coin) {
    coin.destroy();
    this.score += 1;
    this.updateScore();
  }

  updateScore() {
    this.scoreText.setText(`金幣 ${this.score} / ${this.totalCoins}`);
  }

  // ---- 終點旗子 ----
  createGoal() {
    const gx = this.worldWidth - 80;
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

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.add
      .rectangle(cx, cy, 480, 160, 0x000000, 0.8)
      .setScrollFactor(0)
      .setDepth(200)
      .setStrokeStyle(3, 0xffd54f);
    this.add
      .text(cx, cy - 34, "🎉 過關！", {
        fontSize: "40px",
        color: "#ffd54f",
        fontFamily: '"Microsoft JhengHei", sans-serif',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    this.add
      .text(cx, cy + 28, `金幣 ${this.score} / ${this.totalCoins}　·　重新整理頁面再玩一次`, {
        fontSize: "18px",
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
    this.player.setPosition(80, 380);
  }
}
