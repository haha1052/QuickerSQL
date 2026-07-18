// M7.3 Vitest 配置：统一 JS 测试框架
// 负责 React 组件 / 纯函数工具 的单元测试
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      "src-tauri",
      ".tauri",
    ],
    // 与 Tauri 前端保持一致的 tsconfig 基础路径
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage/web",
      exclude: [
        "node_modules/",
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/types/**",
        "src/vite-env.d.ts",
        "vitest.config.ts",
        "vite.config.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
