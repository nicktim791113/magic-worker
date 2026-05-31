import Phaser from "phaser";
import PlatformerScene from "./scenes/PlatformerScene.js";

// ============================================================
// 魔法小工人 Magic Worker — 遊戲總開關
// 這是一個獨立的 2.5D 橫向捲軸闖關遊戲。
// ============================================================
const config = {
  type: Phaser.AUTO, // 自動選 WebGL 或 Canvas
  width: 800,
  height: 600,
  parent: "game", // 塞進 index.html 裡 id="game" 的 div
  backgroundColor: "#05080f",
  physics: {
    default: "arcade",
    arcade: {
      // 重力交給場景自己設定（PlatformerScene 會開重力）
      debug: false, // 想看碰撞框時改成 true
    },
  },
  scene: [PlatformerScene],
};

const game = new Phaser.Game(config);

// 方便除錯：把遊戲實例掛到 window，可在瀏覽器 console 直接操作。
window.game = game;
