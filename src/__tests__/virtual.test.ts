// M7.3 前端测试：虚拟滚动工具 (virtual.ts)
import { describe, it, expect } from "vitest";
import {
  computeVisibleRange,
  indexToOffset,
  estimateScrollToIndex,
} from "../utils/virtual";

describe("computeVisibleRange", () => {
  it("正常情况下返回合理的可见范围", () => {
    // 视口 500px，每项 50px，总数 100，滚动 100px
    const range = computeVisibleRange(100, 500, 50, 100, 0);
    // startRaw = 100/50 = 2，visibleCount = 500/50 = 10
    // start = 2 - 0 = 2，end = min(2 + 10 + 0, 100) = 12
    expect(range.start).toBe(2);
    expect(range.end).toBe(12);
    expect(range.totalHeight).toBe(100 * 50);
    expect(range.itemHeight).toBe(50);
  });

  it("不滚动时 start = 0", () => {
    const range = computeVisibleRange(0, 500, 50, 100, 0);
    expect(range.start).toBe(0);
  });

  it("overscan 会扩展可见范围", () => {
    const r1 = computeVisibleRange(200, 500, 50, 100, 0);
    const r2 = computeVisibleRange(200, 500, 50, 100, 10);
    expect(r2.start).toBeLessThanOrEqual(r1.start);
    expect(r2.end).toBeGreaterThanOrEqual(r1.end);
  });

  it("总数为 0 时返回空范围", () => {
    const range = computeVisibleRange(0, 500, 50, 0, 0);
    expect(range.start).toBe(0);
    expect(range.end).toBe(0);
    expect(range.totalHeight).toBe(0);
  });

  it("滚动超过尾部时 end 不超过 totalCount", () => {
    const range = computeVisibleRange(10000, 500, 50, 100, 5);
    expect(range.end).toBe(100);
    expect(range.start).toBeLessThanOrEqual(range.end);
  });

  it("负数滚动位置安全回退到 0", () => {
    const range = computeVisibleRange(-50, 500, 50, 100, 0);
    expect(range.start).toBe(0);
  });

  it("itemHeight <= 0 时返回安全空范围", () => {
    const range = computeVisibleRange(0, 500, 0, 100, 0);
    expect(range.start).toBe(0);
    expect(range.end).toBe(0);
    expect(range.totalHeight).toBe(0);
  });

  it("start 绝不会大于 end", () => {
    const range = computeVisibleRange(10000, 1, 100, 1, 5);
    expect(range.start).toBeLessThanOrEqual(range.end);
  });
});

describe("indexToOffset", () => {
  it("正索引正确计算", () => {
    expect(indexToOffset(3, 50)).toBe(150);
  });

  it("索引 0 返回 0", () => {
    expect(indexToOffset(0, 50)).toBe(0);
  });

  it("负索引回退到 0", () => {
    expect(indexToOffset(-5, 50)).toBe(0);
  });
});

describe("estimateScrollToIndex", () => {
  it("索引 <= 0 时返回 0", () => {
    expect(estimateScrollToIndex(0, 50, 500)).toBe(0);
    expect(estimateScrollToIndex(-5, 50, 500)).toBe(0);
  });

  it("itemHeight <= 0 时返回 0", () => {
    expect(estimateScrollToIndex(10, 0, 500)).toBe(0);
  });

  it("结果总是 >= 0", () => {
    expect(estimateScrollToIndex(1, 1, 1000)).toBeGreaterThanOrEqual(0);
  });

  it("大索引时滚动位置居中到视口", () => {
    // index=100, item=50, viewport=500：100*50 - 500/2 = 4750
    expect(estimateScrollToIndex(100, 50, 500)).toBe(4750);
  });
});
