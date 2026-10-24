import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { ECharts } from 'echarts';
import type { ChartConfig, ChartConfigPayload, VisualConfig } from '../../types/chart';
import { applyVisualConfig } from '../../utils/chartVisual';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';

const COLOR_SCHEMES: Record<string, string[]> = {
  default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
  dark: ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091', '#ff8a45', '#8d48e3', '#dd79ff'],
  light: ['#9ecaff', '#b8f0c8', '#ffe89c', '#ffa5ad', '#b0ecf7', '#7edcc3', '#ffc39e', '#d0a8f0', '#f5b8e0'],
  colorful: ['#ff4d4f', '#fa8c16', '#faad14', '#a0d911', '#52c41a', '#13c2c2', '#1890ff', '#722ed1', '#eb2f96'],
  pastel: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0baff', '#ffb3e6', '#c9c9ff', '#ffd6a5'],
  vivid: ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c'],
};

interface ChartRendererProps {
  config: ChartConfig;
  width?: number | string;
  height?: number | string;
  onChartReady?: (chart: ECharts) => void;
  chartRef?: React.MutableRefObject<ECharts | null>;
  visualConfig?: VisualConfig;
}

interface EChartsModule {
  init: (container: HTMLDivElement, theme?: string, opts?: { renderer?: 'canvas' | 'svg' }) => ECharts;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  config,
  width = '100%',
  height = 400,
  onChartReady,
  chartRef: externalChartRef,
  visualConfig,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);
  const [echartsModule, setEchartsModule] = useState<EChartsModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { t } = useLocale();

  const [showGridStr] = useSetting('visualization', 'showGrid');
  const [showLegendStr] = useSetting('visualization', 'showLegend');
  const [animationStr] = useSetting('visualization', 'animation');
  const [animationDurationStr] = useSetting('visualization', 'animationDuration');
  const [toolboxFeatureStr] = useSetting('visualization', 'toolboxFeature');
  const [dataZoomStr] = useSetting('visualization', 'dataZoom');
  const [colorScheme] = useSetting('visualization', 'defaultColorScheme');
  const [enableTooltipStr] = useSetting('visualization', 'enableTooltip');

  const showGrid = showGridStr !== 'false';
  const showLegend = showLegendStr !== 'false';
  const animation = animationStr !== 'false';
  const animationDuration = parseInt(animationDurationStr || '1000', 10);
  const toolboxFeature = toolboxFeatureStr !== 'false';
  const dataZoom = dataZoomStr === 'true';
  const enableTooltip = enableTooltipStr !== 'false';
  const colorPalette = useMemo(
    () => COLOR_SCHEMES[colorScheme || 'default'] || COLOR_SCHEMES.default,
    [colorScheme]
  );

  // P2-3: 数据点 ≤ 5000 用 SVG 渲染（更流畅、可访问性好），> 5000 用 canvas（性能优先）
  const renderer = useMemo<'svg' | 'canvas'>(() => {
    const configPayloadForRenderer = config as ChartConfigPayload;
    const seriesArr = configPayloadForRenderer.series;
    const dataPoints = Array.isArray(seriesArr)
      ? seriesArr.reduce<number>(
          (sum, s) => sum + (Array.isArray(s?.data) ? s.data.length : 0),
          0
        )
      : 0;
    return dataPoints <= 5000 ? 'svg' : 'canvas';
  }, [config]);

  // 首次挂载时动态加载 echarts 模块
  useEffect(() => {
    let cancelled = false;
    import('echarts')
      .then((m) => {
        if (!cancelled) setEchartsModule(m as unknown as EChartsModule);
      })
      .catch((e: unknown) => {
        console.error('[ChartRenderer] 动态加载 echarts 失败:', e);
        if (!cancelled) setLoadError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buildEchartsConfig = React.useCallback(
    (cfg: ChartConfig, vConfig?: VisualConfig): Record<string, unknown> => {
      const titleText = Array.isArray(cfg.title)
        ? (cfg.title as unknown as Array<{ text?: string }>)[0]?.text
        : (cfg.title as unknown as { text?: string })?.text;
      const configPayload = cfg as ChartConfigPayload;
      const userGrid = configPayload.grid as Record<string, unknown> | undefined;
      const userLegend = configPayload.legend as Record<string, unknown> | undefined;

      let echartsConfig: Record<string, unknown> = {
        ...configPayload,
        grid: {
          left: '10%',
          right: '5%',
          bottom: (configPayload.dataZoom || dataZoom) ? '15%' : '8%',
          top: titleText ? '60px' : '40px',
          containLabel: true,
          show: userGrid?.show !== undefined ? userGrid.show as boolean : showGrid,
        },
        legend: userLegend
          ? { ...userLegend, show: userLegend.show !== undefined ? userLegend.show : showLegend }
          : { show: showLegend },
        animation: configPayload.animation !== undefined ? (configPayload.animation as boolean) : animation,
        animationDuration: configPayload.animationDuration !== undefined ? (configPayload.animationDuration as number) : animationDuration,
        color: configPayload.color ? (configPayload.color as string[]) : colorPalette,
      };

      if (toolboxFeature && !configPayload.toolbox) {
        echartsConfig.toolbox = {
          show: true,
          feature: {
            saveAsImage: { title: t('chart.toolbar.saveAsImage') },
            restore: { title: t('chart.toolbar.restore') },
            dataView: { title: t('chart.toolbar.dataView'), lang: [t('chart.toolbar.dataViewLang.view'), t('chart.toolbar.dataViewLang.close'), t('chart.toolbar.dataViewLang.refresh')] },
            magicType: { type: ['line', 'bar', 'stack'], title: { line: t('chart.toolbar.magicTypeLine'), bar: t('chart.toolbar.magicTypeBar'), stack: t('chart.toolbar.magicTypeStack') } },
          },
          right: 20,
          top: 5,
        };
      } else if (configPayload.toolbox) {
        echartsConfig.toolbox = configPayload.toolbox;
      }

      if (dataZoom && !configPayload.dataZoom) {
        echartsConfig.dataZoom = [
          { type: 'slider', show: true, start: 0, end: 100, bottom: 10, height: 20 },
          { type: 'inside', start: 0, end: 100 },
        ];
      } else if (configPayload.dataZoom) {
        echartsConfig.dataZoom = configPayload.dataZoom;
      }

      if (!enableTooltip) {
        echartsConfig.tooltip = false;
      } else if (configPayload.tooltip) {
        echartsConfig.tooltip = configPayload.tooltip;
      }

      if (vConfig) {
        echartsConfig = applyVisualConfig(echartsConfig, vConfig);
      }

      return echartsConfig;
    },
    [showGrid, showLegend, animation, animationDuration, toolboxFeature, dataZoom, colorPalette, enableTooltip, t],
  );

  // 初始化图表（echarts 加载完成后执行）
  useEffect(() => {
    if (!echartsModule || !containerRef.current) return;

    const chart = echartsModule.init(containerRef.current, undefined, { renderer });
    chartInstanceRef.current = chart;
    if (externalChartRef) externalChartRef.current = chart;

    chart.setOption(buildEchartsConfig(config, visualConfig) as ChartConfig);
    if (onChartReady) onChartReady(chart);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => chart.resize(), 200);
    };
    window.addEventListener('resize', handleResize);

    setTimeout(() => chart.resize(), 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      chart.dispose();
      if (externalChartRef) externalChartRef.current = null;
      chartInstanceRef.current = null;
    };
  }, [echartsModule, renderer, buildEchartsConfig, config, visualConfig]);

  // 当配置或可视化设置变化时更新图表
  React.useEffect(() => {
    if (chartInstanceRef.current && config) {
      chartInstanceRef.current.setOption(buildEchartsConfig(config, visualConfig) as ChartConfig, true);
      chartInstanceRef.current.resize();
    }
  }, [config, visualConfig, buildEchartsConfig]);

  // 加载骨架屏
  if (!echartsModule && !loadError) {
    return (
      <div
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          minHeight: 300,
          background: 'linear-gradient(120deg, var(--bg-secondary) 0%, var(--border-primary) 50%, var(--bg-secondary) 100%)',
          backgroundSize: '200% 200%',
          animation: 'echarts-skeleton-pulse 1.5s ease-in-out infinite',
          borderRadius: 4,
        }}
      />
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'var(--error)',
        }}
      >
        图表库加载失败: {loadError}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        minHeight: 300,
      }}
    />
  );
};

export default ChartRenderer;