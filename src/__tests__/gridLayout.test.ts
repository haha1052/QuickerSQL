// M7.3 前端测试：仪表盘网格布局工具 (gridLayout.ts)
import { describe, it, expect } from "vitest";
import { calculateNextPosition, GRID_COLUMNS } from "../utils/gridLayout";

describe("calculateNextPosition", () => {
  it("没有任何图表时放在 (0, 0)", () => {
    const pos = calculateNextPosition([], { width: 6, height: 4 });
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it("最后一行右侧还有空间时放到该行右侧", () => {
    // 单个 6x4 图表：占用 (0, 0) - (6, 4)
    // 下一个 4x4 应该放到 (6, 0)，最后一行即 row 0..3
    const items = [{ x: 0, y: 0, width: 6, height: 4 }];
    const pos = calculateNextPosition(items, { width: 4, height: 4 });
    expect(pos.x).toBe(6);
    expect(pos.y).toBe(3); // maxBottom - 1 = 3
  });

  it("最后一行右侧空间不足时追加到新行", () => {
    // 单个 10x3 图表：右侧剩余 2 列
    // 下一个 4x4 会放到新行 (0, 3)
    const items = [{ x: 0, y: 0, width: 10, height: 3 }];
    const pos = calculateNextPosition(items, { width: 4, height: 4 });
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(3); // maxBottom = 3
  });

  it("列数约束 = 12", () => {
    expect(GRID_COLUMNS).toBe(12);
  });

  it("传入 null 时当作空处理", () => {
    const pos = calculateNextPosition(null as any, { width: 6, height: 4 });
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it("默认 size 为 6x4", () => {
    const pos = calculateNextPosition([]);
    expect(pos.width).toBe(6);
    expect(pos.height).toBe(4);
  });

  it("多个图表拼接最后一行时，计算最右列取所有重叠项的最大值", () => {
    // 场景：两个 4x4 放在 (0, 0) 和 (4, 0)，maxBottom=4，最后一行 = row 3
    // 两者都与 row 3 重叠。它们的最右 = max(4, 8) = 8
    // 下一个 4x4 应该放到 (8, 3)
    const items = [
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 4, y: 0, width: 4, height: 4 },
    ];
    const pos = calculateNextPosition(items, { width: 4, height: 4 });
    expect(pos.x).toBe(8);
    expect(pos.y).toBe(3);
  });
});
