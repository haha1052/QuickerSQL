import React, { useState, useEffect, useRef, Component, Dispatch, SetStateAction } from 'react';
import type { ECharts } from 'echarts';
// P0-2 启动优化：echarts 改为懒加载，避免启动时加载大型第三方库
// import * as echarts from 'echarts'  // ← 已移至组件内部动态 import
import { useLocale } from '../../context/LocaleContext';
import { useDashboardStore } from '../../store';
import { normalizeEChartsConfig } from '../../utils/echartsNormalize';
import { applyFiltersToSql, hasActiveFilters } from '../../utils/filterSql';
import type { DashboardItem as DashboardItemType, SavedChart, DashboardFilter } from '../../types/dashboard';
import type { ChartConfig } from '../../types/chart';

interface DashboardItemProps {
  item: DashboardItemType;
  isEditing: boolean;
  onRemove?: () => void;
  onLayoutChange?: (layout: { x: number; y: number; width: number; height: number }) => void;
  layoutSettings?: { gap: number; rowHeight: number; snapToGrid: boolean };
  onDoubleClick?: () => void;
}

/**
 * 使用 SQL 和 savedChart 配置渲染图表（三层降级策略）
 */
async function renderWithSql(
  sql: string,
  savedChart: SavedChart,
  setChartConfig: Dispatch<SetStateAction<ChartConfig | null>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
) {
  try {
    const { tauriService } = await import('../../services');

    const execResponse = await tauriService.executeSql(sql);
    if (!execResponse.success || !execResponse.data) {
      throw new Error(`执行查询失败: ${execResponse.error || '未知错误'}`);
    }

    const firstResult = execResponse.data.results?.[0];
    if (!firstResult || !firstResult.columns || !firstResult.rows) {
      throw new Error('查询结果为空');
    }

    const { columns, rows } = firstResult;

    if (!columns.includes(savedChart.xAxis)) {
      throw new Error(`图表配置的 x 轴列 "${savedChart.xAxis}" 在查询结果中不存在。可用列: ${columns.join(', ')}`);
    }

    for (const yCol of savedChart.yAxis) {
      if (!columns.includes(yCol)) {
        throw new Error(`图表配置的 y 轴列 "${yCol}" 在查询结果中不存在。可用列: ${columns.join(', ')}`);
      }
    }

    const chartResponse = await tauriService.generateChartConfig({
      columns,
      rows,
      chart_type: savedChart.chartType,
      x_axis_column: savedChart.xAxis,
      y_axis_columns: savedChart.yAxis,
    });

    if (chartResponse.success && chartResponse.data) {
      setChartConfig(chartResponse.data);
    } else {
      throw new Error(chartResponse.error || '生成图表配置失败');
    }
  } catch (e) {
    console.error('[renderWithSql] 失败:', e);
    setError(String(e));
    throw e;
  } finally {
    setLoading(false);
  }
}

class DashboardItemErrorBoundary extends Component<{ children: React.ReactNode; t?: (key: string) => string }, { hasError: boolean; error: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[DashboardItemErrorBoundary] 捕获错误:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          ...styles.item,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--error)',
          fontSize: '12px',
          textAlign: 'center',
          padding: '12px',
        }}>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{this.props.t ? this.props.t('chart.renderFailed') : '图表渲染失败'}</div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>{this.state.error}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * ECharts 画布渲染组件（仅负责图表实例的初始化和渲染，不参与 Grid 布局）
 *
 * P0-1 修复：移除了此组件中重复的 gridStyle / item 样式 / toolbar，
 *           避免与父组件 DashboardItem 的 Grid 布局产生嵌套冲突。
 */
const ChartCanvas: React.FC<{
  chartConfig: ChartConfig | null;
  /** 编辑模式下禁用 ECharts 的鼠标交互，让拖拽事件能穿透到外层卡片 */
  interactive: boolean;
}> = ({ chartConfig, interactive }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);
  const echartsModuleRef = useRef<{ init: (el: HTMLDivElement) => ECharts } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // 防抖 resize
  const debouncedResize = () => {
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }
    resizeTimerRef.current = setTimeout(() => {
      if (chartInstanceRef.current && chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        containerSizeRef.current = { width: rect.width, height: rect.height };
        chartInstanceRef.current.resize();
      }
    }, 80);
  };

  // 根据容器尺寸优化图表配置
  const optimizeConfigForSize = (config: Record<string, unknown>, width: number, height: number): Record<string, unknown> => {
    if (!config || width === 0 || height === 0) return config;

    const optimized = JSON.parse(JSON.stringify(config));
    const isSmall = width < 320 || height < 200;
    const isVerySmall = width < 240 || height < 150;

    // 调整标题
    if (optimized.title) {
      if (isVerySmall) {
        optimized.title.textStyle = {
          ...optimized.title.textStyle,
          fontSize: 11,
        };
        optimized.title.top = 4;
        optimized.title.left = 8;
      } else if (isSmall) {
        optimized.title.textStyle = {
          ...optimized.title.textStyle,
          fontSize: 12,
        };
        optimized.title.top = 6;
        optimized.title.left = 10;
      }
    }

    // 调整图例
    if (optimized.legend) {
      if (isVerySmall) {
        optimized.legend.show = false;
      } else if (isSmall) {
        optimized.legend.top = 'auto';
        optimized.legend.bottom = 4;
        optimized.legend.textStyle = {
          ...optimized.legend.textStyle,
          fontSize: 10,
        };
        optimized.legend.itemWidth = 12;
        optimized.legend.itemHeight = 8;
      }
    }

    // 调整 grid（边距）
    if (optimized.grid) {
      if (isVerySmall) {
        optimized.grid.left = 30;
        optimized.grid.right = 10;
        optimized.grid.top = 24;
        optimized.grid.bottom = 20;
      } else if (isSmall) {
        optimized.grid.left = 40;
        optimized.grid.right = 15;
        optimized.grid.top = 32;
        optimized.grid.bottom = 28;
      }
    }

    // 调整 X 轴
    if (optimized.xAxis && Array.isArray(optimized.xAxis)) {
      optimized.xAxis.forEach((axis: Record<string, unknown>) => {
        if (isVerySmall) {
          if (axis.axisLabel) {
            (axis.axisLabel as Record<string, unknown>).fontSize = 9;
            (axis.axisLabel as Record<string, unknown>).rotate = 45;
            (axis.axisLabel as Record<string, unknown>).interval = 'auto';
          }
          if (axis.axisTitle) {
            (axis.axisTitle as Record<string, unknown>).show = false;
          }
        } else if (isSmall) {
          if (axis.axisLabel) {
            (axis.axisLabel as Record<string, unknown>).fontSize = 10;
            (axis.axisLabel as Record<string, unknown>).rotate = 30;
          }
        }
      });
    }

    // 调整 Y 轴
    if (optimized.yAxis && Array.isArray(optimized.yAxis)) {
      optimized.yAxis.forEach((axis: Record<string, unknown>) => {
        if (isVerySmall) {
          if (axis.axisLabel) {
            (axis.axisLabel as Record<string, unknown>).fontSize = 9;
          }
          if (axis.axisTitle) {
            (axis.axisTitle as Record<string, unknown>).show = false;
          }
        } else if (isSmall) {
          if (axis.axisLabel) {
            (axis.axisLabel as Record<string, unknown>).fontSize = 10;
          }
        }
      });
    }

    return optimized;
  };

  useEffect(() => {
    if (!chartConfig || !chartRef.current) return;

    const containerEl: HTMLDivElement = chartRef.current;
    let localInstance: ECharts | null = chartInstanceRef.current;
    let disposed = false;

    (async () => {
      if (!echartsModuleRef.current) {
        try {
          echartsModuleRef.current = await import('echarts');
        } catch (e) {
          console.error('[ChartCanvas] 动态加载 echarts 失败:', e);
          return;
        }
      }
      if (disposed) return;

      const echarts = echartsModuleRef.current;

      try {
        if (!localInstance) {
          localInstance = echarts.init(containerEl);
          chartInstanceRef.current = localInstance;
        }

        const normalized = normalizeEChartsConfig(chartConfig);
        if (!normalized) return;

        // 根据容器尺寸优化配置
        const rect = containerEl.getBoundingClientRect();
        containerSizeRef.current = { width: rect.width, height: rect.height };
        const optimizedConfig = optimizeConfigForSize(normalized, rect.width, rect.height);

        localInstance.setOption(optimizedConfig, true);

        // 使用 ResizeObserver 监听容器尺寸变化
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserverRef.current = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const { width, height } = entry.contentRect;
              const oldSize = containerSizeRef.current;
              if (Math.abs(width - oldSize.width) > 1 || Math.abs(height - oldSize.height) > 1) {
                containerSizeRef.current = { width, height };

                // 更新图表配置以适应新尺寸
                if (chartInstanceRef.current) {
                  const currentOption = chartInstanceRef.current.getOption();
                  const reOptimized = optimizeConfigForSize(currentOption, width, height);
                  chartInstanceRef.current.setOption(reOptimized, { notMerge: false, lazyUpdate: true });
                }

                debouncedResize();
              }
            }
          });
          resizeObserverRef.current.observe(containerEl);
        }
      } catch (e) {
        console.error('[ChartCanvas] ECharts渲染失败:', e);
        if (localInstance && chartInstanceRef.current === localInstance) {
          try {
            localInstance.dispose();
          } catch {
            /* ignore */
          }
          chartInstanceRef.current = null;
          localInstance = null;
        }
      }
    })();

    return () => {
      disposed = true;
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.dispose();
        } catch {
          /* ignore */
        }
        chartInstanceRef.current = null;
      }
    };
  }, [chartConfig]);

  return (
    <div
      ref={chartRef}
      data-echarts-container="true"
      style={{
        ...styles.chart,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    />
  );
};

// 拖拽阈值：鼠标移动超过此距离才认为是拖拽（而非点击）
const DRAG_THRESHOLD_PX = 5;

export const DashboardItem: React.FC<DashboardItemProps> = ({
  item,
  isEditing,
  onRemove,
  onLayoutChange,
  layoutSettings = { gap: 16, rowHeight: 80, snapToGrid: true },
  onDoubleClick,
}) => {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const clickTimeRef = useRef<number>(0);
  const { savedCharts, selectedChartId, setSelectedChartId, loadSavedCharts, filterValues, dashboards, refreshChartsVersion } = useDashboardStore();
  const isSelected = selectedChartId === item.chartId;

  const savedChart = savedCharts.find(c => c.id === item.chartId);

  // P2-1 筛选器联动：获取当前仪表盘的筛选器定义
  const dashboardFilters: DashboardFilter[] = (() => {
    const dash = dashboards.find((d) => d.id === item.dashboardId);
    return dash?.filters || [];
  })();
  // 用 JSON.stringify 做依赖，避免对象引用变化导致频繁刷新
  const filterValuesKey = JSON.stringify(filterValues);
  const filtersActive = hasActiveFilters(JSON.parse(filterValuesKey));

  useEffect(() => {
    const renderChart = async () => {
      if (savedCharts.length === 0) {
        try {
          await loadSavedCharts();
        } catch (e) {
          console.warn('[DashboardItem] 触发 savedCharts 加载失败:', e);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (!savedChart) {
        const currentSavedCharts = useDashboardStore.getState().savedCharts;
        const latestChart = currentSavedCharts.find(c => c.id === item.chartId);
        if (!latestChart) {
          setLoading(false);
          setError('图表不存在（该图表可能已被删除，或图表库尚未加载完成）');
          return;
        }
        return;
      }

      // 策略 0（第三轮新增）：使用自动化任务刷新缓存的查询结果（跳过 SQL 查询）
      // 当筛选器未激活、且图表的 lastResult 有有效 rows/columns 时，直接调用 generateChartConfig
      if (!filtersActive && savedChart.lastResult && savedChart.lastResult.rows && savedChart.lastResult.rows.length > 0
          && savedChart.lastResult.columns && savedChart.lastResult.columns.length > 0) {
        const hasValidXAxis = savedChart.xAxis && savedChart.xAxis.trim().length > 0 && savedChart.xAxis !== '0';
        const hasValidYAxis = savedChart.yAxis && savedChart.yAxis.length > 0;
        if (hasValidXAxis && hasValidYAxis && savedChart.lastResult.columns.includes(savedChart.xAxis)) {
          try {
            const { tauriService } = await import('../../services');
            const chartResponse = await tauriService.generateChartConfig({
              columns: savedChart.lastResult.columns,
              rows: savedChart.lastResult.rows,
              chart_type: savedChart.chartType,
              x_axis_column: savedChart.xAxis,
              y_axis_columns: savedChart.yAxis,
            });
            if (chartResponse.success && chartResponse.data) {
              setChartConfig(chartResponse.data);
              setLoading(false);
              return;
            }
            console.warn('[DashboardItem] 缓存数据生成图表配置失败，继续走常规路径');
          } catch (e) {
            console.warn('[DashboardItem] 使用缓存失败，回退到正常路径:', e);
          }
        }
      }

      // 策略 1：直接使用已保存的 ECharts config
      // P2-1 修复：当筛选器激活时，跳过 config 直渲，强制走 SQL 路径以应用筛选条件
      if (!filtersActive && savedChart.config && Object.keys(savedChart.config).length > 0) {
        const cfg = savedChart.config as Record<string, unknown>;
        const hasSeries = Array.isArray(cfg.series) && cfg.series.length > 0;
        const hasAxis = 'xAxis' in cfg || 'x_axis' in cfg;

        if (hasSeries || hasAxis) {
          setChartConfig(savedChart.config);
          setLoading(false);
          return;
        }
        console.warn('[DashboardItem] config 存在但内容不完整，回退到 SQL 路径');
      }

      // 策略 2：通过 SQL + 已保存的图表参数重新生成配置
      // P2-1 修复：将筛选条件注入 SQL
      const hasSql = savedChart.sql && savedChart.sql.trim().length > 0;
      const hasValidXAxis = savedChart.xAxis && savedChart.xAxis.trim().length > 0 && savedChart.xAxis !== '0';
      const hasValidYAxis = savedChart.yAxis && savedChart.yAxis.length > 0;

      if (hasSql && hasValidXAxis && hasValidYAxis) {
        // P2-1：注入筛选条件
        const effectiveSql = filtersActive
          ? applyFiltersToSql(savedChart.sql, JSON.parse(filterValuesKey), dashboardFilters)
          : savedChart.sql;
        try {
          await renderWithSql(effectiveSql, savedChart, setChartConfig, setError, setLoading);
          return;
        } catch (e) {
          console.error('[DashboardItem] SQL 渲染失败，继续尝试回退:', e);
        }
      }

      // 策略 3：回退 —— 从 saved_queries 查找原始 SQL
      if (savedChart.queryId && savedChart.queryId.trim() !== '') {
        try {
          const { tauriService } = await import('../../services');
          const queryResponse = await tauriService.getSavedQuery(savedChart.queryId);

          if (queryResponse.success && queryResponse.data?.sql) {
            // P2-1：回退路径也注入筛选条件
            const fallbackSql = filtersActive
              ? applyFiltersToSql(queryResponse.data.sql, JSON.parse(filterValuesKey), dashboardFilters)
              : queryResponse.data.sql;
            if (savedChart.xAxis && savedChart.yAxis?.length > 0) {
              await renderWithSql(fallbackSql, savedChart, setChartConfig, setError, setLoading);
              return;
            }
          }
        } catch (fallbackError) {
          console.warn('[DashboardItem] 回退也失败:', fallbackError);
        }
      }

      // 所有策略都失败
      setLoading(false);
      const missing: string[] = [];
      if (!hasSql || !(savedChart.sql && savedChart.sql.trim().length > 0)) missing.push('SQL');
      if (!hasValidXAxis) missing.push('X 轴配置');
      if (!hasValidYAxis) missing.push('Y 轴配置');
      if (!(savedChart.config && Object.keys(savedChart.config).length > 0)) missing.push('图表配置');

      setError(
        `此图表数据不完整（缺少：${missing.join(' / ')}）。\n` +
        `请：1) 点击右上角 🗘 按钮刷新仪表盘 或 2) 回到 SQL 查询页面重新生成并保存该图表。`
      );
    };

    renderChart();
    // P2-1：filterValuesKey 变化时触发重新渲染（筛选器联动）
    // refreshChartsVersion 变化时（用户点击刷新）也重新拉取数据
  }, [savedChart, item.chartId, retryKey, filterValuesKey, filtersActive, refreshChartsVersion]);

  /**
   * P0-1 修复：拖拽启动逻辑
   *
   * 关键改进：
   * 1. 增加 DRAG_THRESHOLD_PX 阈值 —— 鼠标移动超过 5px 才认为是拖拽，否则视为点击
   * 2. 拖拽开始后才设置 isDragging 状态，避免误触
   * 3. 配合 ChartCanvas 的 pointer-events: none，编辑模式下 ECharts 不会拦截鼠标事件
   * 4. 拖拽中禁止文本选中，避免干扰
   */
  const handleDragStart = (e: React.MouseEvent) => {
    if (!isEditing || !onLayoutChange) return;
    // 不阻止默认行为和冒泡 —— 让 React onClick 能正常触发（用于点击选中）
    // 仅在确认是拖拽后才阻止

    const canvasEl = document.querySelector('[data-dashboard-canvas="true"]') as HTMLElement | null;
    if (!canvasEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const colWidth = (canvasRect.width - layoutSettings.gap * 11) / 12;
    const rowHeight = layoutSettings.rowHeight;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = item.x;
    const startY = item.y;

    let dragStarted = false; // 是否已越过阈值，进入真正的拖拽

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startMouseX;
      const dy = moveEvent.clientY - startMouseY;

      // 阈值判断：移动距离不足时，不触发拖拽（视为点击）
      if (!dragStarted) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
          return;
        }
        // 越过阈值，正式开始拖拽
        dragStarted = true;
        setIsDragging(true);
        // 拖拽开始后禁止文本选中
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'move';
      }

      const deltaCols = Math.round(dx / (colWidth + layoutSettings.gap));
      const deltaRows = Math.round(dy / (rowHeight + layoutSettings.gap));

      let newX = startX + deltaCols;
      let newY = startY + deltaRows;

      // 边界约束
      newX = Math.max(0, Math.min(12 - item.width, newX));
      newY = Math.max(0, newY);

      if (newX !== item.x || newY !== item.y) {
        onLayoutChange({ x: newX, y: newY, width: item.width, height: item.height });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // 恢复样式
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (dragStarted) {
        setIsDragging(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  /**
   * P0-2 修复：缩放手柄逻辑（保持原有逻辑，样式改进在 styles 中）
   */
  const handleResizeStart = (e: React.MouseEvent, edge: 'right' | 'bottom' | 'corner') => {
    if (!isEditing || !onLayoutChange) return;
    e.stopPropagation();
    e.preventDefault();

    const canvasEl = document.querySelector('[data-dashboard-canvas="true"]') as HTMLElement | null;
    if (!canvasEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const colWidth = (canvasRect.width - layoutSettings.gap * 11) / 12;
    const rowHeight = layoutSettings.rowHeight;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWidth = item.width;
    const startHeight = item.height;

    const MIN_W = 3;
    const MIN_H = 2;
    const MAX_W = 12;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = edge === 'corner' ? 'nwse-resize' : (edge === 'right' ? 'ew-resize' : 'ns-resize');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (edge === 'right' || edge === 'corner') {
        const dx = moveEvent.clientX - startMouseX;
        const deltaCols = Math.round(dx / (colWidth + layoutSettings.gap));
        newWidth = Math.max(MIN_W, Math.min(MAX_W, startWidth + deltaCols));
        newWidth = Math.min(newWidth, 12 - item.x);
      }

      if (edge === 'bottom' || edge === 'corner') {
        const dy = moveEvent.clientY - startMouseY;
        const deltaRows = Math.round(dy / (rowHeight + layoutSettings.gap));
        newHeight = Math.max(MIN_H, startHeight + deltaRows);
      }

      if (newWidth !== item.width || newHeight !== item.height) {
        onLayoutChange({ x: item.x, y: item.y, width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Grid 位置计算 - 只设置网格位置，不设置高度
  // 高度由 align-self: stretch 自动填充到网格单元格
  const gridStyle: React.CSSProperties = {
    gridColumn: `${item.x + 1} / span ${item.width}`,
    gridRow: `${item.y + 1} / span ${item.height}`,
  };

  // 图表内边距：与间距联动，间距为0时内边距也减小
  const itemPadding = Math.max(0, Math.min(12, layoutSettings.gap / 2 + 4));

  return (
    <DashboardItemErrorBoundary t={t}>
      <div
        onClick={() => {
        if (!isDragging) {
          const now = Date.now();
          const diff = now - clickTimeRef.current;
          if (diff < 300) {
            onDoubleClick?.();
          } else {
            setSelectedChartId(item.chartId);
          }
          clickTimeRef.current = now;
        }
      }}
        onMouseDown={isEditing && onLayoutChange ? handleDragStart : undefined}
        style={{
          ...styles.item,
          ...gridStyle,
          ...(isEditing ? styles.itemEditing : {}),
          ...(isSelected ? styles.itemSelected : {}),
          ...(isDragging ? styles.itemDragging : {}),
        }}
      >
        {/* 统一容器结构 */}
        <div style={{ ...styles.itemContainer, padding: `${itemPadding}px` }}>
          {/* 标题行 - 固定高度 */}
          {(savedChart?.title || isEditing) && (
            <div style={styles.titleRow}>
              {savedChart?.title && (
                <div style={styles.itemTitle}>{savedChart.title}</div>
              )}
              {/* 编辑模式提示 */}
              {isEditing && (
                <div style={styles.editHintBar}>
                  <span style={styles.editHintIcon}>✋</span>
                  <span style={styles.editHintText}>拖拽移动</span>
                </div>
              )}
            </div>
          )}

          {/* 工具栏 - 右上角固定 */}
          {isEditing && (
            <div style={styles.itemToolbar}>
              <button
                style={styles.removeBtn}
                onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                title={t('dashboard.removeFromDashboard')}
              >×</button>
            </div>
          )}
          {/* 非编辑模式选中时的关闭按钮 */}
          {!isEditing && isSelected && (
            <div style={styles.itemToolbar}>
              <button
                style={styles.removeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedChartId(null);
                }}
                title={t('common.cancelSelection')}
              >×</button>
            </div>
          )}

          {/* 图表内容区域 */}
          <div style={styles.chartContainer}>
            {savedChart ? (
              <>
                {loading ? (
                  <div style={styles.loading}>{t('common.loading')}</div>
                ) : error ? (
                  <div style={styles.error}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>❌ 图表加载失败</div>
                    <div style={{ fontSize: '11px', opacity: 0.8, whiteSpace: 'pre-wrap' }}>{error}</div>
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoading(true);
                          setError(null);
                          loadSavedCharts().then(() => {
                            setRetryKey(k => k + 1);
                          });
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '11px',
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        🗘 刷新重试
                      </button>
                    </div>
                    {error.includes('查询不存在') && (
                      <div style={{ fontSize: '10px', marginTop: '6px', color: 'var(--warning)' }}>
                        💡 提示：此图表是在旧版本保存的，请重新保存图表
                      </div>
                    )}
                  </div>
                ) : chartConfig ? (
                  <ChartCanvas
                    chartConfig={chartConfig}
                    interactive={!isEditing}
                  />
                ) : (
                  <div style={styles.placeholder}>
                    📈 {savedChart.chartType}
                  </div>
                )}
              </>
            ) : (
              <div style={styles.placeholder}>
                图表未找到
              </div>
            )}
          </div>
        </div>

        {/* 缩放手柄 - 编辑模式下显示 */}
        {isEditing && onLayoutChange && (
          <>
            <div
              className="resize-handle-right"
              style={styles.resizeHandleRight}
              onMouseDown={(e) => handleResizeStart(e, 'right')}
            />
            <div
              className="resize-handle-bottom"
              style={styles.resizeHandleBottom}
              onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            />
            <div
              style={styles.resizeHandleCorner}
              onMouseDown={(e) => handleResizeStart(e, 'corner')}
              title={t('dashboard.dragToResize')}
            />
          </>
        )}
      </div>
    </DashboardItemErrorBoundary>
  );
};

const styles: Record<string, React.CSSProperties> = {
  item: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border-primary)',
    // 移除 height: '100%'，改用 alignSelf: 'stretch' 让 grid 自动拉伸
    boxSizing: 'border-box',
    alignSelf: 'stretch',
  },
  // 新布局：统一的容器结构
  itemContainer: {
    display: 'flex',
    flexDirection: 'column',
    // 移除 height: '100%'，让 flex: 1 自动填充
    padding: '12px',
    boxSizing: 'border-box',
    flex: 1,
    minHeight: 0,
  },
  // 标题行 - 固定高度，不参与 flex 分配
  titleRow: {
    height: '32px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    position: 'relative',
  },
  itemEditing: {
    border: '2px dashed var(--primary)',
    cursor: 'move',
  },
  itemSelected: {
    border: '2px solid var(--primary)',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.15)',
    cursor: 'pointer',
  },
  itemDragging: {
    opacity: 0.8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    zIndex: 100,
  },
  itemToolbar: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    display: 'flex',
    gap: '4px',
    zIndex: 50,
  },
  removeBtn: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--error)',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 简化编辑提示：改为更隐蔽的 UI
  editHintBar: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '4px',
    fontSize: '11px',
    color: 'var(--primary)',
    zIndex: 50,
    pointerEvents: 'none',
  },
  editHintIcon: { fontSize: '12px' },
  editHintText: { fontWeight: 500 },
  itemTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // 图表内容区域 - flex: 1 自动填充剩余空间
  chartContainer: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-tertiary)',
    fontSize: '12px',
  },
  error: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--error)',
    fontSize: '12px',
    textAlign: 'center',
    padding: '8px',
    overflow: 'auto',
  },
  chart: {
    flex: 1,
    // 移除 minHeight: '150px'，让 flex: 1 自动适应容器
    width: '100%',
    minHeight: 0,
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-tertiary)',
    fontSize: '14px',
  },
  // 缩放手柄 - 统一样式
  resizeHandleRight: {
    position: 'absolute',
    right: '-2px',
    top: '12px',
    bottom: '12px',
    width: '6px',
    cursor: 'ew-resize',
    zIndex: 30,
    background: 'transparent',
    borderRadius: '3px',
    transition: 'background 0.15s',
  },
  resizeHandleBottom: {
    position: 'absolute',
    bottom: '-2px',
    left: '12px',
    right: '12px',
    height: '6px',
    cursor: 'ns-resize',
    zIndex: 30,
    background: 'transparent',
    borderRadius: '3px',
    transition: 'background 0.15s',
  },
  resizeHandleCorner: {
    position: 'absolute',
    right: '-8px',
    bottom: '-8px',
    width: '16px',
    height: '16px',
    background: 'var(--primary)',
    borderRadius: '50%',
    cursor: 'nwse-resize',
    zIndex: 40,
    border: '2px solid white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
};
