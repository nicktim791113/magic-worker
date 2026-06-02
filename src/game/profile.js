// ============================================================
// profile.js — 玩家檔案 ＋ 道具商店清單
// ------------------------------------------------------------
// 「玩家檔案」存在瀏覽器（localStorage），記錄：
//   ・coins  金幣錢包（收金幣會累積，商店花這個）
//   ・owned  已購買的道具 { 道具id: true }
//   ・skin   目前裝備的造型 id（'default' = 原本的黃色）
//
// 道具分兩種：
//   ・power（能力道具）：買了「永久生效」，例如跳更高、二段跳。
//   ・skin （造型）：買了可以「換上」，純裝飾、不影響玩法。
// ============================================================

const KEY = "magic-worker.profile.v1";

// ---- 商店道具清單（想加新道具、改價錢，改這裡就好）----
export const SHOP_ITEMS = [
  // 能力道具
  { id: "jump", type: "power", name: "🦘 高跳鞋", price: 30, desc: "跳得更高" },
  { id: "speed", type: "power", name: "💨 風之鞋", price: 30, desc: "跑得更快" },
  { id: "double", type: "power", name: "🪽 二段跳", price: 50, desc: "空中能再跳一次" },
  { id: "shield", type: "power", name: "🛡️ 護盾", price: 40, desc: "每關擋一次敵人攻擊" },
  { id: "heart", type: "power", name: "❤️ 多一顆愛心", price: 60, desc: "最大愛心 +1" },
  // 造型（純裝飾）
  { id: "skin_red", type: "skin", name: "🔴 紅色", price: 15, color: 0xff5a5a },
  { id: "skin_blue", type: "skin", name: "🔵 藍色", price: 15, color: 0x5a9cff },
  { id: "skin_green", type: "skin", name: "🟢 綠色", price: 15, color: 0x5fd16a },
  { id: "skin_pink", type: "skin", name: "🌸 粉紅", price: 25, color: 0xff9ed2 },
  { id: "skin_rainbow", type: "skin", name: "🌈 彩虹", price: 80, color: 0xffd54f, rainbow: true },
];

const DEFAULT_PROFILE = { coins: 0, owned: {}, skin: "default" };

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function getItem(id) {
  return SHOP_ITEMS.find((i) => i.id === id) || null;
}

// 讀玩家檔案（沒有就給一份全新的）
export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...clone(DEFAULT_PROFILE), ...p, owned: { ...(p.owned || {}) } };
    }
  } catch (e) {
    console.warn("讀取玩家檔案失敗：", e);
  }
  return clone(DEFAULT_PROFILE);
}

export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    console.warn("儲存玩家檔案失敗：", e);
  }
}

// 把錢包與已購清空（商店裡的「重設」用）
export function resetProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* 忽略 */
  }
  return clone(DEFAULT_PROFILE);
}

// 收金幣：累積到錢包並存檔
export function addCoins(profile, n) {
  profile.coins += n;
  saveProfile(profile);
}

// 買道具：成功回 true（會扣金幣、記為已擁有、買造型順便換上）
export function buyItem(profile, id) {
  const item = getItem(id);
  if (!item) return false;
  if (profile.owned[id]) return false; // 已經有了
  if (profile.coins < item.price) return false; // 金幣不夠
  profile.coins -= item.price;
  profile.owned[id] = true;
  if (item.type === "skin") profile.skin = id; // 買了造型就直接穿上
  saveProfile(profile);
  return true;
}

// 換造型（只能換「已擁有」或預設）
export function equipSkin(profile, id) {
  if (id === "default" || profile.owned[id]) {
    profile.skin = id;
    saveProfile(profile);
    return true;
  }
  return false;
}

// 把已購道具換算成「實際生效的數值」，給場景建關時用
export function effectiveStats(profile) {
  const owned = profile.owned || {};
  return {
    jumpBonus: owned.jump ? 130 : 0, // 高跳鞋：跳躍力加成
    speedBonus: owned.speed ? 80 : 0, // 風之鞋：移動速度加成
    doubleJump: !!owned.double, // 二段跳
    shield: !!owned.shield, // 護盾（每關一次）
    maxHearts: 3 + (owned.heart ? 1 : 0), // 最大愛心
    skin: profile.skin || "default",
    skinColor: skinColor(profile.skin),
    rainbow: profile.skin === "skin_rainbow",
  };
}

function skinColor(skin) {
  if (!skin || skin === "default") return 0xffd54f; // 預設黃
  const item = getItem(skin);
  return item && item.color ? item.color : 0xffd54f;
}
