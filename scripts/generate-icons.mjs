// ============================================================
// PWA 圖示產生器（零依賴，純 Node）
// ------------------------------------------------------------
// 用程式畫出 App 圖示並輸出成 PNG，不需要安裝 sharp 之類的套件。
// 圖示內容＝這個遊戲的縮影：藍天、草地、黃色小工人、金幣。
//
// 執行：npm run icons   （或 node scripts/generate-icons.mjs）
// 輸出到 public/：icon-192 / icon-512 / icon-maskable-512 / apple-touch-icon-180
// ============================================================
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---- 一個最小的 PNG 編碼器（RGBA）----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter byte
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 畫圖工具 ----
function draw(size, { rounded }) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
  };
  const fillRect = (x0, y0, x1, y1, c) => {
    for (let y = Math.round(y0); y < Math.round(y1); y++)
      for (let x = Math.round(x0); x < Math.round(x1); x++) set(x, y, c);
  };
  const border = (x0, y0, x1, y1, w, c) => {
    fillRect(x0, y0, x1, y0 + w, c); fillRect(x0, y1 - w, x1, y1, c);
    fillRect(x0, y0, x0 + w, y1, c); fillRect(x1 - w, y0, x1, y1, c);
  };
  const fillCircle = (cx, cy, r, c) => {
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++)
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) set(x, y, c);
      }
  };
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);

  // 天空漸層
  const top = [106, 176, 232], bot = [42, 93, 150];
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const c = [lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), lerp(top[2], bot[2], t)];
    for (let x = 0; x < size; x++) set(x, y, c);
  }
  // 草地
  const gy = Math.round(size * 0.70);
  fillRect(0, gy, size, size, [95, 184, 77]);
  fillRect(0, gy, size, gy + size * 0.04, [79, 140, 58]);
  // 小工人（黃色方塊）
  const pw = Math.round(size * 0.20);
  const px = Math.round(size * 0.30);
  fillRect(px, gy - pw, px + pw, gy, [255, 213, 79]);
  border(px, gy - pw, px + pw, gy, Math.max(2, Math.round(size * 0.012)), [199, 154, 22]);
  // 金幣
  const cx = Math.round(size * 0.66), cy = Math.round(size * 0.40);
  const cr = Math.round(size * 0.085);
  fillCircle(cx, cy, cr, [255, 179, 0]);
  fillCircle(cx, cy, cr - Math.max(2, Math.round(size * 0.022)), [255, 224, 102]);

  // 圓角（maskable 不做圓角，保持滿版方形）
  if (rounded) {
    const rr = Math.round(size * 0.18);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let ccx = -1, ccy = -1;
        if (x < rr && y < rr) { ccx = rr; ccy = rr; }
        else if (x >= size - rr && y < rr) { ccx = size - 1 - rr; ccy = rr; }
        else if (x < rr && y >= size - rr) { ccx = rr; ccy = size - 1 - rr; }
        else if (x >= size - rr && y >= size - rr) { ccx = size - 1 - rr; ccy = size - 1 - rr; }
        if (ccx >= 0) {
          const dx = x - ccx, dy = y - ccy;
          if (dx * dx + dy * dy > rr * rr) buf[(y * size + x) * 4 + 3] = 0;
        }
      }
  }
  return buf;
}

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const targets = [
  ["icon-192.png", 192, { rounded: true }],
  ["icon-512.png", 512, { rounded: true }],
  ["icon-maskable-512.png", 512, { rounded: false }],
  ["apple-touch-icon-180.png", 180, { rounded: false }],
];
for (const [name, size, opt] of targets) {
  writeFileSync(publicDir + name, encodePNG(size, draw(size, opt)));
  console.log("✓ wrote public/" + name + " (" + size + "x" + size + ")");
}
console.log("圖示產生完成！");
