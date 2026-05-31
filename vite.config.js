import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// ============================================================
// Vite 設定檔
// ------------------------------------------------------------
// base：部署到 GitHub Pages「專案網站」時，網址會是
//   https://<你的帳號>.github.io/magic-worker/
// 因為多了一層 /magic-worker/，所有檔案路徑都要加這個前綴，
// 所以 base 一定要設成「/儲存庫名稱/」，否則上線後會抓不到檔案（白畫面）。
// 如果之後改了儲存庫名稱，這裡也要一起改。
// ============================================================
const base = "/magic-worker/";

export default defineConfig({
  base,
  server: { open: false },
  plugins: [
    // vite-plugin-pwa：自動產生 manifest 與 service worker，
    // 讓這個網頁可以「安裝成 App」並支援離線。
    VitePWA({
      registerType: "autoUpdate", // 有新版本時自動更新
      includeAssets: ["favicon.svg", "apple-touch-icon-180.png"],
      manifest: {
        name: "魔法小工人 Magic Worker",
        short_name: "魔法小工人",
        description: "一個 2.5D 橫向捲軸闖關小遊戲",
        lang: "zh-Hant",
        theme_color: "#4a90d9",
        background_color: "#05080f",
        display: "standalone", // 像 App 一樣全螢幕、沒有瀏覽器網址列
        orientation: "landscape",
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
