// M7.3 Vitest 全局 setup：扩展 matchers + mock Tauri 环境
import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

// 清空每次测试之间的 mock 调用
beforeEach(() => {
  vi.clearAllMocks();
});

// 避免 jsdom 环境下 Tauri IPC 触发实际 Rust 函数
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve({ success: true })),
}));

// 某些组件使用 CSS 变量 / window.matchMedia，jsdom 下提供基础实现
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}
