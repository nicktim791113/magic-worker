// ============================================================
// levels.js — 關卡資料中心
// ------------------------------------------------------------
// 這支檔案把「關卡」變成「資料」（而不是寫死在程式裡）。
// 遊戲場景（PlatformerScene）讀這份資料來蓋關卡，
// 開發者模式（EditorScene）則是用滑鼠去「畫」這份資料的工具。
//
// 📐 格子座標怎麼看？
//   一格 = 64 像素。col：第幾欄（最左 0，往右增）。
//   row：第幾列，從「地面」往上算（row 0 = 最底層那一排，往上越大）。
//
// 一筆資料的意思：
//   solids  實心地形：{ col, row, w } 從 col 往右連續 w 格。
//   coins   金幣：    { col, row, w } 同上。
//   enemies 敵人：    { col, row, w } 在第 row 列、col~col+w 之間左右巡邏。
//   movers  移動平台：{ col, row, toCol, toRow } 在(起點格)和(終點格)之間來回。
//   start.col 玩家出生欄。 goal.col 終點旗子欄。
// ============================================================

export const DEFAULT_LEVELS = [
  {
    name: "第一關",
    cols: 50,
    start: { col: 1 },
    goal: { col: 49 },
    solids: [
      { col: 0, row: 0, w: 12 },
      { col: 15, row: 0, w: 13 },
      { col: 31, row: 0, w: 19 },
      { col: 5, row: 2, w: 3 },
      { col: 9, row: 4, w: 2 },
      { col: 18, row: 2, w: 3 },
      { col: 22, row: 4, w: 2 },
      { col: 34, row: 2, w: 3 },
      { col: 38, row: 4, w: 2 },
      { col: 43, row: 2, w: 3 },
    ],
    coins: [
      { col: 2, row: 1, w: 3 },
      { col: 5, row: 3, w: 3 },
      { col: 9, row: 5, w: 2 },
      { col: 16, row: 1, w: 4 },
      { col: 22, row: 5, w: 2 },
      { col: 34, row: 3, w: 3 },
      { col: 43, row: 3, w: 3 },
    ],
    enemies: [],
    movers: [],
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
    enemies: [{ col: 24, row: 1, w: 7 }],
    movers: [],
  },
  {
    name: "小心敵人",
    cols: 44,
    start: { col: 1 },
    goal: { col: 43 },
    solids: [
      { col: 0, row: 0, w: 10 },
      { col: 13, row: 0, w: 12 },
      { col: 27, row: 0, w: 17 },
      { col: 6, row: 2, w: 2 },
      { col: 17, row: 2, w: 3 },
      { col: 20, row: 4, w: 2 },
      { col: 31, row: 2, w: 3 },
      { col: 36, row: 3, w: 2 },
    ],
    coins: [
      { col: 2, row: 1, w: 3 },
      { col: 6, row: 3, w: 2 },
      { col: 17, row: 3, w: 3 },
      { col: 20, row: 5, w: 2 },
      { col: 31, row: 3, w: 3 },
      { col: 38, row: 1, w: 4 },
    ],
    enemies: [
      { col: 4, row: 1, w: 4 },
      { col: 14, row: 1, w: 6 },
      { col: 28, row: 1, w: 8 },
    ],
    movers: [],
  },
  {
    name: "跳上平台",
    cols: 46,
    start: { col: 1 },
    goal: { col: 45 },
    solids: [
      { col: 0, row: 0, w: 7 },
      { col: 17, row: 0, w: 9 },
      { col: 34, row: 0, w: 12 },
      { col: 30, row: 3, w: 2 },
    ],
    coins: [
      { col: 2, row: 1, w: 3 },
      { col: 11, row: 2, w: 2 },
      { col: 21, row: 5, w: 1 },
      { col: 29, row: 2, w: 2 },
      { col: 38, row: 1, w: 5 },
    ],
    enemies: [{ col: 18, row: 1, w: 6 }],
    movers: [
      { col: 8, row: 1, toCol: 15, toRow: 1 },
      { col: 27, row: 1, toCol: 32, toRow: 1 },
      { col: 21, row: 1, toCol: 21, toRow: 4 },
    ],
  },
  {
    name: "大冒險",
    cols: 60,
    start: { col: 1 },
    goal: { col: 59 },
    solids: [
      { col: 0, row: 0, w: 9 },
      { col: 14, row: 0, w: 10 },
      { col: 28, row: 0, w: 8 },
      { col: 42, row: 0, w: 18 },
      { col: 6, row: 2, w: 2 },
      { col: 18, row: 3, w: 3 },
      { col: 31, row: 2, w: 3 },
      { col: 45, row: 2, w: 3 },
      { col: 50, row: 4, w: 2 },
    ],
    coins: [
      { col: 2, row: 1, w: 3 },
      { col: 6, row: 3, w: 2 },
      { col: 18, row: 4, w: 3 },
      { col: 31, row: 3, w: 3 },
      { col: 45, row: 3, w: 3 },
      { col: 50, row: 5, w: 2 },
      { col: 54, row: 1, w: 5 },
    ],
    enemies: [
      { col: 15, row: 1, w: 8 },
      { col: 29, row: 1, w: 6 },
      { col: 44, row: 1, w: 8 },
    ],
    movers: [
      { col: 10, row: 1, toCol: 12, toRow: 3 },
      { col: 37, row: 1, toCol: 40, toRow: 1 },
    ],
  },
];

// ------------------------------------------------------------
// 存檔工具：把編輯器設計的關卡存在瀏覽器（localStorage）。
// ------------------------------------------------------------

const STORAGE_KEY = "magic-worker.levels.v1";

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

// 讀關卡：優先用瀏覽器存檔；沒有（或壞掉）就用內建關卡
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

// 存關卡（編輯器每次改動都會呼叫）
export function saveLevels(levels) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch (e) {
    console.warn("儲存關卡失敗：", e);
  }
}

// 重設：清掉存檔，回到內建關卡
export function resetLevels() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* 忽略 */
  }
  return clone(DEFAULT_LEVELS);
}

// 產生一個空白新關卡（編輯器「新增關卡」用，預設先鋪滿地面）
export function makeEmptyLevel(name = "新關卡") {
  return {
    name,
    cols: 30,
    start: { col: 1 },
    goal: { col: 29 },
    solids: [{ col: 0, row: 0, w: 30 }],
    coins: [],
    enemies: [],
    movers: [],
  };
}
