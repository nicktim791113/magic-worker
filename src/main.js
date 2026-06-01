import Phaser from "phaser";
import PlatformerScene from "./scenes/PlatformerScene.js";
import EditorScene from "./scenes/EditorScene.js";

// ============================================================
// 魔法小工人 Magic Worker — 遊戲總開關
// 這是一個 2.5D 橫向捲軸闖關遊戲。
//
// 兩個場景：
//   PlatformerScene … 玩遊戲（闖關）
//   EditorScene     … 開發者模式（用滑鼠畫關卡）
//
// 怎麼進開發者模式？
//   ・網址加 ?dev（例：localhost:5173/?dev）→ 開機就進編輯器
//   ・遊戲中按 E → 切換進編輯器；編輯器中按 E / 點「▶️ 試玩」→ 回遊戲
// ============================================================

// 偵測網址有沒有 ?dev
const isDev = new URLSearchParams(window.location.search).has("dev");

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
  // 場景清單的「第一個」會自動啟動：
  //   有 ?dev → 先進編輯器；沒有 → 正常玩遊戲。
  //   （兩個場景都有註冊，所以按 E 可以互相切換。）
  scene: isDev ? [EditorScene, PlatformerScene] : [PlatformerScene, EditorScene],
};

const game = new Phaser.Game(config);

// 方便除錯：把遊戲實例掛到 window，可在瀏覽器 console 直接操作。
window.game = game;
