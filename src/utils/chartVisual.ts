import type { VisualConfig, AxisVisualConfig } from '../types/chart';

/**
 * 深拷贝 JSON 对象（安全用于 ECharts option）
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T;
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    result[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  return result as T;
}

/**
 * 将视觉配置合流到骨架配置中，返回完整的 ECharts option
 *
 * 设计原则：
 * 1. 严格区分数据字段和视觉字段 —— series data、xAxis.data 等数据不覆盖
 * 2. 视觉字段按 visualConfig 优先级覆盖骨架和全局设置
 * 3. seriesOverrides 按 series name 精确匹配单个系列的颜色
 *
 * @param baseOption 后端 generateChartConfig 返回的骨架配置
 * @param visualConfig 用户的视觉配置
 * @returns 合流后的 ECharts option
 */
export function applyVisualConfig(
  baseOption: Record<string, unknown>,
  visualConfig: VisualConfig
): Record<string, unknown> {
  const result = deepClone(baseOption);

  // --- 颜色方案 ---
  if (visualConfig.color) {
    const { customPalette, seriesOverrides } = visualConfig.color;
    if (customPalette && customPalette.length > 0) {
      result.color = customPalette;
    }
    if (seriesOverrides && Object.keys(seriesOverrides).length > 0 && result.series) {
      const seriesArr = result.series as Array<Record<string, unknown>>;
      const COLOR_ITEM_TYPES = new Set(['pie', 'doughnut', 'funnel', 'gauge']);

      seriesArr.forEach((seriesItem) => {
        const seriesType = seriesItem.type as string | undefined;
        const seriesName = seriesItem.name as string | undefined;

        if (seriesType && COLOR_ITEM_TYPES.has(seriesType)) {
          const dataArr = Array.isArray(seriesItem.data)
            ? (seriesItem.data as Array<Record<string, unknown>>)
            : [];
          dataArr.forEach((dataItem) => {
            const itemName = dataItem.name as string | undefined;
            if (itemName && seriesOverrides[itemName]) {
              const override = seriesOverrides[itemName];
              dataItem.itemStyle = dataItem.itemStyle || {};
              const itemStyle = dataItem.itemStyle as Record<string, unknown>;
              if (override.color) {
                itemStyle.color = override.color;
              }
              if (override.opacity !== undefined) {
                itemStyle.opacity = override.opacity;
              }
            }
          });
        } else if (seriesName && seriesOverrides[seriesName]) {
          const override = seriesOverrides[seriesName];
          if (override.color) {
            seriesItem.itemStyle = seriesItem.itemStyle || {};
            (seriesItem.itemStyle as Record<string, unknown>).color = override.color;
          }
          if (override.opacity !== undefined) {
            seriesItem.itemStyle = seriesItem.itemStyle || {};
            (seriesItem.itemStyle as Record<string, unknown>).opacity = override.opacity;
          }
        }
      });
    }
  }

  // --- 标题 ---
  if (visualConfig.title) {
    const titleCfg = visualConfig.title;
    const existingTitle = (result.title && typeof result.title === 'object')
      ? deepClone(result.title) as Record<string, unknown>
      : {};

    if (titleCfg.text !== undefined) existingTitle.text = titleCfg.text;

    if (titleCfg.fontSize !== undefined || titleCfg.color !== undefined || titleCfg.fontWeight !== undefined) {
      existingTitle.textStyle = existingTitle.textStyle || {};
      const ts = existingTitle.textStyle as Record<string, unknown>;
      if (titleCfg.fontSize !== undefined) ts.fontSize = titleCfg.fontSize;
      if (titleCfg.color !== undefined) ts.color = titleCfg.color;
      if (titleCfg.fontWeight !== undefined) ts.fontWeight = titleCfg.fontWeight;
    }

    if (titleCfg.align || titleCfg.verticalAlign || titleCfg.position) {
      delete existingTitle.left;
      delete existingTitle.right;
      delete existingTitle.top;
      delete existingTitle.bottom;

      if (titleCfg.align) {
        existingTitle.left = titleCfg.align;
      } else if (titleCfg.position === 'left') {
        existingTitle.left = 0;
      } else if (titleCfg.position === 'right') {
        existingTitle.right = 0;
      } else if (titleCfg.position === 'center') {
        existingTitle.left = 'center';
      }

      if (titleCfg.verticalAlign) {
        existingTitle.top = titleCfg.verticalAlign;
      } else if (titleCfg.position === 'bottom') {
        existingTitle.bottom = 0;
      } else if (titleCfg.position === 'center') {
        existingTitle.top = 'middle';
      } else {
        existingTitle.top = 0;
      }
    }

    result.title = existingTitle;
  }

  // --- 图例 ---
  if (visualConfig.legend) {
    const legendCfg = visualConfig.legend;
    const existingLegend = (result.legend && typeof result.legend === 'object')
      ? deepClone(result.legend) as Record<string, unknown>
      : {};
    if (legendCfg.show !== undefined) existingLegend.show = legendCfg.show;
    if (legendCfg.position) {
      if (legendCfg.position === 'bottom') {
        delete existingLegend.top;
        delete existingLegend.left;
        delete existingLegend.right;
        existingLegend.bottom = 0;
      } else if (legendCfg.position === 'top') {
        delete existingLegend.bottom;
        delete existingLegend.left;
        delete existingLegend.right;
        existingLegend.top = 0;
      } else if (legendCfg.position === 'left') {
        delete existingLegend.bottom;
        delete existingLegend.top;
        delete existingLegend.right;
        existingLegend.left = 0;
      } else if (legendCfg.position === 'right') {
        delete existingLegend.bottom;
        delete existingLegend.top;
        delete existingLegend.left;
        existingLegend.right = 0;
      }
    }
    if (legendCfg.orient) existingLegend.orient = legendCfg.orient;
    if (legendCfg.fontSize !== undefined) {
      existingLegend.textStyle = existingLegend.textStyle || {};
      (existingLegend.textStyle as Record<string, unknown>).fontSize = legendCfg.fontSize;
    }
    result.legend = existingLegend;
  }

  // --- X 轴 ---
  if (visualConfig.xAxis) {
    result.xAxis = applyAxisVisual(result.xAxis, visualConfig.xAxis);
  }

  // --- Y 轴 ---
  if (visualConfig.yAxis) {
    result.yAxis = applyAxisVisual(result.yAxis, visualConfig.yAxis);
  }

  // --- 数据标签 ---
  if (visualConfig.label && result.series) {
    const labelCfg = visualConfig.label;
    const seriesArr = result.series as Array<Record<string, unknown>>;
    seriesArr.forEach((seriesItem) => {
      const labelObj: Record<string, unknown> = {};
      if (labelCfg.show !== undefined) labelObj.show = labelCfg.show;
      if (labelCfg.position) labelObj.position = labelCfg.position;
      if (labelCfg.fontSize !== undefined) {
        labelObj.fontSize = labelCfg.fontSize;
        labelObj.textStyle = { fontSize: labelCfg.fontSize };
      }
      if (labelCfg.color !== undefined) {
        labelObj.color = labelCfg.color;
        labelObj.textStyle = labelObj.textStyle || {};
        (labelObj.textStyle as Record<string, unknown>).color = labelCfg.color;
      }
      if (labelCfg.format && labelCfg.format.length > 0) {
        labelCfg.format.forEach((f) => {
          if (f === 'value') labelObj.formatter = '{c}';
          if (f === 'name') labelObj.formatter = labelObj.formatter ? `${labelObj.formatter} | {b}` : '{b}';
          if (f === 'percent') labelObj.formatter = labelObj.formatter ? `${labelObj.formatter} ({d}%)` : '{d}%';
        });
      }
      seriesItem.label = { ...(seriesItem.label as Record<string, unknown> | undefined), ...labelObj };
    });
  }

  // --- 网格 ---
  if (visualConfig.grid) {
    const gridCfg = visualConfig.grid;
    const gridObj: Record<string, unknown> = {};
    if (gridCfg.show !== undefined) gridObj.show = gridCfg.show;
    if (gridCfg.left !== undefined) gridObj.left = gridCfg.left;
    if (gridCfg.right !== undefined) gridObj.right = gridCfg.right;
    if (gridCfg.top !== undefined) gridObj.top = gridCfg.top;
    if (gridCfg.bottom !== undefined) gridObj.bottom = gridCfg.bottom;
    gridObj.containLabel = true;
    result.grid = { ...(result.grid as Record<string, unknown> | undefined), ...gridObj };
  }

  // --- 动画 ---
  if (visualConfig.animation) {
    if (visualConfig.animation.show !== undefined) {
      result.animation = visualConfig.animation.show;
    }
    if (visualConfig.animation.duration !== undefined) {
      result.animationDuration = visualConfig.animation.duration;
    }
  }

  // --- Tooltip ---
  if (visualConfig.tooltip) {
    if (visualConfig.tooltip.show === false) {
      result.tooltip = false;
    } else if (visualConfig.tooltip.trigger) {
      result.tooltip = result.tooltip && typeof result.tooltip === 'object'
        ? { ...(result.tooltip as Record<string, unknown>), trigger: visualConfig.tooltip.trigger }
        : { trigger: visualConfig.tooltip.trigger };
    }
  }

  return result;
}

/**
 * 应用坐标轴视觉配置
 */
function applyAxisVisual(
  baseAxis: unknown,
  axisCfg: AxisVisualConfig
): Record<string, unknown> | Record<string, unknown>[] | undefined {
  // 处理坐标轴为数组的情况（多个轴）
  if (Array.isArray(baseAxis)) {
    return baseAxis.map((ax) => applySingleAxisVisual(ax as Record<string, unknown>, axisCfg));
  }
  if (baseAxis && typeof baseAxis === 'object') {
    return applySingleAxisVisual(baseAxis as Record<string, unknown>, axisCfg);
  }
  // baseAxis 为 undefined 时，创建新轴配置
  return applySingleAxisVisual({}, axisCfg);
}

/**
 * 应用单个坐标轴视觉配置
 */
function applySingleAxisVisual(
  baseAxis: Record<string, unknown>,
  axisCfg: AxisVisualConfig
): Record<string, unknown> {
  const result = deepClone(baseAxis);

  if (axisCfg.show !== undefined) result.show = axisCfg.show;
  if (axisCfg.inverse !== undefined) result.inverse = axisCfg.inverse;

  if (axisCfg.min !== undefined) {
    result.min = axisCfg.min === 'auto' ? undefined : axisCfg.min;
  }
  if (axisCfg.max !== undefined) {
    result.max = axisCfg.max === 'auto' ? undefined : axisCfg.max;
  }

  if (axisCfg.title) {
    result.name = axisCfg.title.text ?? '';
    result.nameLocation = 'middle';
    result.nameGap = 40;
    const textStyle: Record<string, unknown> = {};
    if (axisCfg.title.fontSize !== undefined) textStyle.fontSize = axisCfg.title.fontSize;
    if (axisCfg.title.color !== undefined) textStyle.color = axisCfg.title.color;
    if (Object.keys(textStyle).length > 0) {
      result.nameTextStyle = textStyle;
    }
  }

  if (axisCfg.labelRotate !== undefined) {
    result.axisLabel = result.axisLabel || {};
    (result.axisLabel as Record<string, unknown>).rotate = axisCfg.labelRotate;
  }
  if (axisCfg.labelFontSize !== undefined) {
    result.axisLabel = result.axisLabel || {};
    (result.axisLabel as Record<string, unknown>).fontSize = axisCfg.labelFontSize;
  }
  if (axisCfg.labelColor !== undefined) {
    result.axisLabel = result.axisLabel || {};
    (result.axisLabel as Record<string, unknown>).color = axisCfg.labelColor;
  }

  if (axisCfg.showGrid !== undefined) {
    result.splitLine = result.splitLine || {};
    (result.splitLine as Record<string, unknown>).show = axisCfg.showGrid;
  }

  if (axisCfg.showTick !== undefined) {
    result.axisTick = result.axisTick || {};
    (result.axisTick as Record<string, unknown>).show = axisCfg.showTick;
  }

  if (axisCfg.numberFormat) {
    result.axisLabel = result.axisLabel || {};
    (result.axisLabel as Record<string, unknown>).formatter = (value: number) => {
      switch (axisCfg.numberFormat) {
        case '0%': return `${(value * 100).toFixed(0)}%`;
        case '0.00': return value.toFixed(2);
        case '0.0': return value.toFixed(1);
        case 'auto':
        default: return String(value);
      }
    };
  }

  return result;
}