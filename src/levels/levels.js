// ============================================================
// levels.js — 關卡資料中心
// ------------------------------------------------------------
// 這支檔案把「關卡」變成「資料」（而不是寫死在程式裡）。
// 遊戲場景（PlatformerScene）讀這份資料來蓋關卡，
// 開發者模式（EditorScene）則是用滑鼠去「畫」這份資料的工具。
//
// 📐 格子座標怎麼看？
//   一格 = 64 像素（和場景裡的 TILE 一致）。
//   col：第幾欄，最左邊是 0，往右越大。
//   row：第幾列，從「地面」往上算 —— row 0 是最底層（地面那一排），
//        往上一格是 row 1、再上去 row 2……（越上面數字越大）。
//
// 🧱 一塊地形、一排金幣都用 { col, row, w } 表示：
//   從第 col 欄、第 row 列開始，往右連續 w 格。
//   例：{ col: 0, row: 0, w: 12 } = 從最左邊鋪 12 格地面。
//
// 🧍 start.col = 玩家出生在第幾欄。 🚩 goal.col = 終點旗子在第幾欄。
// ============================================================

// 內建關卡（第一次玩、或清掉存檔後會用這份）。
// 第一關是從舊版「寫死的關卡」原封不動轉過來的。
export const DEFAULT_LEVELS = [
  {
    name: "第一關",
    cols: 50, // 關卡總長度（幾格）
    start: { col: 1 }, // 玩家出生欄
    goal: { col: 49 }, // 終點旗子欄
    // 實心地形（會擋住玩家、踩得上去）
    solids: [
      // --- 地面（row 0），中間留兩個坑讓你跳 ---
      { col: 0, row: 0, w: 12 }, // 第 12~14 格是坑
      { col: 15, row: 0, w: 13 }, // 第 28~30 格是坑
      { col: 31, row: 0, w: 19 },
      // --- 階梯式浮空平台 ---
      { col: 5, row: 2, w: 3 },
      { col: 9, row: 4, w: 2 },
      { col: 18, row: 2, w: 3 },
      { col: 22, row: 4, w: 2 },
      { col: 34, row: 2, w: 3 },
      { col: 38, row: 4, w: 2 },
      { col: 43, row: 2, w: 3 },
    ],
    // 金幣（碰到就收集）
    coins: [
      { col: 2, row: 1, w: 3 },
      { col: 5, row: 3, w: 3 },
      { col: 9, row: 5, w: 2 },
      { col: 16, row: 1, w: 4 },
      { col: 22, row: 5, w: 2 },
      { col: 34, row: 3, w: 3 },
      { col: 43, row: 3, w: 3 },
    ],
  },
  {
    name: "第二關",
    cols: 36,
    start: { col: 1 },
    goal: { col: 35 },
    solids: [
      { col: 0, row: 0, w: 8 },
      { col: 11, row: 0, w: 9 },
      { col: 23, row: 0, w: 13 },
      { col: 8, row: 1, w: 2 },
      { col: 14, row: 3, w: 2 },
      { col: 18, row: 2, w: 2 },
      { col: 27, row: 3, w: 3 },
    ],
    coins: [
      { col: 2, row: 1, w: 3 },
      { col: 8, row: 2, w: 2 },
      { col: 14, row: 4, w: 2 },
      { col: 24, row: 1, w: 4 },
      { col: 27, row: 4, w: 3 },
    ],
  },
];

// ------------------------------------------------------------
// 以下是「存檔」相關工具：把編輯器設計的關卡存在瀏覽器裡（localStorage），
// 這樣下次打開、甚至離線都還在；要正式上線時再「匯出」交給工程師（Claude）存進專案。
// ------------------------------------------------------------

// 瀏覽器存檔的鑰匙名稱（換版本時改 v1 → v2 可避免吃到舊格式）
const STORAGE_KEY = "magic-worker.levels.v1";

// 深拷貝：複製一份全新的資料，避免不小心改到內建關卡 DEFAULT_LEVELS
function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

// 讀關卡：優先用瀏覽器存檔；沒有存檔（或存檔壞掉）就用內建關卡
export function loadLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn("讀取關卡存檔失敗，改用內建關卡：", e);
  }
  return clone(DEFAULT_LEVELS);
}

// 存關卡：把整串關卡寫進瀏覽器（編輯器每次改動都會呼叫一次）
export function saveLevels(levels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch (e) {
    console.warn("儲存關卡失敗：", e);
  }
}

// 重設：清掉瀏覽器存檔，回到內建關卡
export function resetLevels() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* 忽略 */
  }
  return clone(DEFAULT_LEVELS);
}

// 產生一個「空白新關卡」（編輯器按「新增關卡」時用）。
// 預設先鋪滿一整排地面，方便馬上有地方站、再慢慢加東西。
export function makeEmptyLevel(name = "新關卡") {
  return {
    name,
    cols: 30,
    start: { col: 1 },
    goal: { col: 29 },
    solids: [{ col: 0, row: 0, w: 30 }],
    coins: [],
  };
}
