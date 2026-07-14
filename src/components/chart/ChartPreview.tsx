import React, { useEffect, useRef, useState, useMemo } from 'react';
// P0-2 启动优化：将 echarts 改为运行时动态加载，避免启动时同步加载大库
import { normalizeEChartsConfig } from '../../utils/echartsNormalize';
import { useSetting } from '../../context/SettingsContext';

interface ChartPreviewProps {
  /** 已保存的 ECharts 配置 */
  config: Record<string, unknown> | null;
  /** 预览高度（px），默认 160 */
  height?: number;
}

export const ChartPreview: React.FC<ChartPreviewProps> = ({ config, height = 160 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [echartsModule, setEchartsModule] = useState<any>(null);

  const [showGridStr] = useSetting('visualization', 'showGrid');
  const [showLegendStr] = useSetting('visualization', 'showLegend');
  const [animationStr] = useSetting('visualization', 'animation');
  const [colorScheme] = useSetting('visualization', 'defaultColorScheme');

  const vizOptions = useMemo(() => ({
    showGrid: showGridStr !== 'false',
    showLegend: showLegendStr !== 'false',
    animation: animationStr !== 'false',
    defaultColorScheme: colorScheme || 'default',
  }), [showGridStr, showLegendStr, animationStr, colorScheme]);

  useEffect(() => {
    let cancelled = false;
    import('echarts')
      .then((m) => { if (!cancelled) setEchartsModule(m); })
      .catch((e) => console.error('[ChartPreview] 动态加载 echarts 失败:', e));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const hasConfig = config && typeof config === 'object' && Object.keys(config).length > 0;
    if (!hasConfig || !containerRef.current || !echartsModule) return;

    const normalized = normalizeEChartsConfig(config, vizOptions);
    if (!normalized) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echartsModule.init(containerRef.current);
    }

    try {
      chartInstanceRef.current.setOption(normalized, true);
    } catch (e) {
      console.error('[ChartPreview] ECharts 渲染失败:', e);
    }

    const handleResize = () => chartInstanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => chartInstanceRef.current?.resize(), 120);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, [config, echartsModule, vizOptions]);

  const hasConfig = config && typeof config === 'object' && Object.keys(config).length > 0;
  if (!hasConfig) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 12,
          background: 'var(--bg-secondary)',
          borderRadius: 6,
          border: '1px dashed var(--border-primary)',
        }}
      >
        无预览数据，请回到 SQL 查询页重新保存该图表
      </div>
    );
  }

  if (!echartsModule) {
    return (
      <div
        style={{
          height,
          background: 'linear-gradient(120deg, var(--bg-secondary) 0%, var(--border-primary) 50%, var(--bg-secondary) 100%)',
          backgroundSize: '200% 200%',
          animation: 'echarts-skeleton-pulse 1.5s ease-in-out infinite',
          borderRadius: 6,
        }}
      />
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height }} />;
};

export default ChartPreview;
