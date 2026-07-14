import { describe, it, expect } from "vitest";
import { normalizeEChartsConfig, COLOR_SCHEMES } from "../utils/echartsNormalize";

describe("normalizeEChartsConfig", () => {
  it("snake_case 键名转为 camelCase", () => {
    const input = {
      x_axis: { type: "category" },
      y_axis: { type: "value" },
      data_zoom: [{ type: "slider" }],
      axis_pointer: { type: "cross" },
      area_style: { opacity: 0.5 },
    };
    const result = normalizeEChartsConfig(input)!;
    expect(result).toHaveProperty("xAxis");
    expect(result).toHaveProperty("yAxis");
    expect(result).toHaveProperty("dataZoom");
    expect(result).toHaveProperty("axisPointer");
    expect(result).toHaveProperty("areaStyle");
    expect(result).not.toHaveProperty("x_axis");
    expect(result).not.toHaveProperty("y_axis");
  });

  it("嵌套对象递归转换", () => {
    const input = {
      x_axis: {
        axis_label: {
          font_size: 12,
          text_style: {
            font_weight: "bold",
          },
        },
      },
    };
    const result = normalizeEChartsConfig(input)!;
    expect(result).toHaveProperty("xAxis.axisLabel.fontSize", 12);
    expect(result).toHaveProperty("xAxis.axisLabel.textStyle.fontWeight", "bold");
  });

  it("数组中的对象元素也被转换", () => {
    const input = {
      series: [
        {
          type: "bar",
          bar_width: 20,
          item_style: { color: "red" },
        },
        {
          type: "line",
          line_style: { width: 2 },
        },
      ],
    };
    const result = normalizeEChartsConfig(input)!;
    expect((result.series as any[])[0]).toHaveProperty("barWidth", 20);
    expect((result.series as any[])[0]).toHaveProperty("itemStyle");
    expect((result.series as any[])[1]).toHaveProperty("lineStyle");
  });

  it("原始值（string/number/boolean/null）保持不变", () => {
    const input = {
      title: "测试图表",
      width: 800,
      height: 600,
      active: true,
      disabled: false,
      data: null,
      categories: ["a", "b", "c"],
      values: [1, 2, 3],
    };
    const result = normalizeEChartsConfig(input)!;
    expect(result.title).toBe("测试图表");
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.active).toBe(true);
    expect(result.disabled).toBe(false);
    expect(result.data).toBeNull();
    expect(result.categories).toEqual(["a", "b", "c"]);
    expect(result.values).toEqual([1, 2, 3]);
  });

  it("幂等性：已经是 camelCase 的配置不变化", () => {
    const input = {
      xAxis: { type: "category" },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [1, 2, 3] }],
    };
    const result1 = normalizeEChartsConfig(input)!;
    const result2 = normalizeEChartsConfig(result1)!;
    expect(result2.xAxis).toEqual(result1.xAxis);
    expect(result2.yAxis).toEqual(result1.yAxis);
    expect(result2.series).toEqual(result1.series);
  });

  it("null 输入返回 null", () => {
    expect(normalizeEChartsConfig(null)).toBeNull();
  });

  it("undefined 输入返回 undefined", () => {
    expect(normalizeEChartsConfig(undefined as any)).toBeUndefined();
  });

  it("自动补充默认 grid", () => {
    const input = { xAxis: {}, yAxis: {} };
    const result = normalizeEChartsConfig(input)!;
    expect(result.grid).toBeDefined();
    expect((result.grid as any).containLabel).toBe(true);
    expect((result.grid as any).left).toBe("10%");
    expect((result.grid as any).right).toBe("5%");
  });

  it("自动补充默认 legend", () => {
    const input = { xAxis: {}, yAxis: {} };
    const result = normalizeEChartsConfig(input)!;
    expect(result.legend).toBeDefined();
    expect((result.legend as any).show).toBe(true);
  });

  it("自动补充默认 color 色板", () => {
    const input = { xAxis: {}, yAxis: {} };
    const result = normalizeEChartsConfig(input)!;
    expect(result.color).toEqual(COLOR_SCHEMES.default);
  });

  it("visualization options 正确应用（showGrid/showLegend/animation）", () => {
    const input = { xAxis: {}, yAxis: {} };
    const result = normalizeEChartsConfig(input, {
      showGrid: false,
      showLegend: false,
      animation: false,
    })!;
    expect((result.grid as any).show).toBe(false);
    expect((result.legend as any).show).toBe(false);
    expect(result.animation).toBe(false);
  });

  it("已有 grid 时不覆盖，只补充缺失的 show 属性", () => {
    const input = {
      grid: {
        left: "20%",
        right: "10%",
        top: "50px",
        bottom: "60px",
        containLabel: false,
      },
    };
    const result = normalizeEChartsConfig(input)!;
    expect((result.grid as any).left).toBe("20%");
    expect((result.grid as any).right).toBe("10%");
    expect((result.grid as any).top).toBe("50px");
    expect((result.grid as any).bottom).toBe("60px");
    expect((result.grid as any).containLabel).toBe(false);
    expect((result.grid as any).show).toBe(true);
  });

  it("输入对象不被修改（返回新对象）", () => {
    const input = {
      x_axis: { type: "category" },
      y_axis: { type: "value" },
    };
    const inputCopy = JSON.parse(JSON.stringify(input));
    normalizeEChartsConfig(input);
    expect(input).toEqual(inputCopy);
    expect(input).toHaveProperty("x_axis");
    expect(input).toHaveProperty("y_axis");
  });

  it("defaultColorScheme 选项正确应用色板", () => {
    const input = { xAxis: {}, yAxis: {} };
    const result = normalizeEChartsConfig(input, {
      defaultColorScheme: "dark",
    })!;
    expect(result.color).toEqual(COLOR_SCHEMES.dark);
  });

  it("有 title 时 grid.top 为 60px", () => {
    const input = { title: { text: "测试标题" } };
    const result = normalizeEChartsConfig(input)!;
    expect((result.grid as any).top).toBe("60px");
  });

  it("有 dataZoom 时 grid.bottom 为 15%", () => {
    const input = { dataZoom: [{ type: "slider" }] };
    const result = normalizeEChartsConfig(input)!;
    expect((result.grid as any).bottom).toBe("15%");
  });

  it("已有 legend 时不覆盖，只补充缺失的 show 属性", () => {
    const input = {
      legend: {
        top: "10px",
        right: "20px",
      },
    };
    const result = normalizeEChartsConfig(input)!;
    expect((result.legend as any).top).toBe("10px");
    expect((result.legend as any).right).toBe("20px");
    expect((result.legend as any).show).toBe(true);
  });

  it("已有 animation 时不覆盖", () => {
    const input = { animation: false };
    const result = normalizeEChartsConfig(input, { animation: true })!;
    expect(result.animation).toBe(false);
  });

  it("已有 color 时不覆盖默认色板", () => {
    const customColors = ["#ff0000", "#00ff00", "#0000ff"];
    const input = { color: customColors };
    const result = normalizeEChartsConfig(input)!;
    expect(result.color).toEqual(customColors);
  });
});
