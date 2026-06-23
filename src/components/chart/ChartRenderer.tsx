import React, { useEffect, useRef, useState } from 'react';
import type { ECharts } from 'echarts';
import type { ChartConfig, ChartConfigPayload } from '../../types/chart';
// P0-2 启动优化：echarts 懒加载 —— 启动时不再 import * as echarts
// 模块改为首次渲染时动态 import，降低首屏启动开销

interface ChartRendererProps {
  config: ChartConfig;
  width?: number | string;
  height?: number | string;
  onChartReady?: (chart: ECharts) => void;
  chartRef?: React.MutableRefObject<ECharts | null>;
}

interface EChartsModule {
  init: (container: HTMLDivElement) => ECharts;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  config,
  width = '100%',
  height = 400,
  onChartReady,
  chartRef: externalChartRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);
  const [echartsModule, setEchartsModule] = useState<EChartsModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // 初始化图表（echarts 加载完成后执行）
  useEffect(() => {
    if (!echartsModule || !containerRef.current) return;

    // 初始化图表实例
    const chart = echartsModule.init(containerRef.current);
    chartInstanceRef.current = chart;

    // 暴露图表实例给外部
    if (externalChartRef) {
      externalChartRef.current = chart;
    }

    // 配置图表
    const titleText = Array.isArray(config.title)
      ? (config.title as unknown as Array<{ text?: string }>)[0]?.text
      : (config.title as unknown as { text?: string })?.text;
    const echartsConfig: ChartConfigPayload & {
      grid: {
        left: string;
        right: string;
        bottom: string;
        top: string;
        containLabel: boolean;
      };
    } = {
      ...(config as ChartConfigPayload),
      grid: {
        left: '10%',
        right: '5%',
        bottom: (config as ChartConfigPayload).dataZoom ? '15%' : '8%',
        top: titleText ? '60px' : '40px',
        containLabel: true,
      },
    };

    chart.setOption(echartsConfig as ChartConfig);

    // 触发回调
    if (onChartReady) {
      onChartReady(chart);
    }

    // 响应窗口大小变化
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    // 初始调整一次大小
    setTimeout(() => {
      chart.resize();
    }, 100);

    // 清理
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      if (externalChartRef) {
        externalChartRef.current = null;
      }
      chartInstanceRef.current = null;
    };
  }, [echartsModule]);

  // 当配置变化时更新图表
  useEffect(() => {
    if (chartInstanceRef.current && config) {
      const titleText = Array.isArray(config.title)
        ? (config.title as unknown as Array<{ text?: string }>)[0]?.text
        : (config.title as unknown as { text?: string })?.text;
      const echartsConfig: ChartConfigPayload & {
        grid: {
          left: string;
          right: string;
          bottom: string;
          top: string;
          containLabel: boolean;
        };
      } = {
        ...(config as ChartConfigPayload),
        grid: {
          left: '10%',
          right: '5%',
          bottom: (config as ChartConfigPayload).dataZoom ? '15%' : '8%',
          top: titleText ? '60px' : '40px',
          containLabel: true,
        },
      };

      chartInstanceRef.current.setOption(echartsConfig as ChartConfig, true);
      chartInstanceRef.current.resize();
    }
  }, [config]);

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
