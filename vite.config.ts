import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import hardcodedDetector from "./scripts/vite-plugin-hardcoded-detector";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  // i18n 硬编码检测：baseline=300（当前存量），防止新增；详见 .trae/rules/i18n.md
  plugins: [
    react(),
    hardcodedDetector({ baseline: 300 }),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // 修复 Windows 上 Vite 默认监听 IPv6 ([::1]) 而 WebView2 连接 IPv4 (127.0.0.1) 导致白屏卡死的问题
    // 显式绑定到 127.0.0.1，确保 IPv4 可达
    host: host || '127.0.0.1',
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));