import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { normalizeEChartsConfig } from '../../utils/echartsNormalize';

interface ChartPreviewProps {
  /** 已保存的 ECharts 配置（可能为旧 snake_case 格式，内部会自动归一化） */
  config: Record<string, unknown> | null;
  /** 预览高度（px），默认 160 */
  height?: number;
}

/**
 * 轻量级图表预览组件。
 *
 * 用于图表库面板等需要紧凑展示图表的场景。与 SQL 查询页的 ChartRenderer 不同，
 * 本组件面向「只读预览」：
 *   - 自动对保存的 config 做键名归一化（snake_case → camelCase），兼容旧数据
 *   - 不接受外部交互回调，渲染后自动 resize 适配容器
 *   - config 缺失或为空时显示友好提示，而非报错
 */
export const ChartPreview: React.FC<ChartPreviewProps> = ({ config, height = 160 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    // config 为空时无需初始化 ECharts
    const hasConfig = config && typeof config === 'object' && Object.keys(config).length > 0;
    if (!hasConfig || !containerRef.current) return;

    const normalized = normalizeEChartsConfig(config);
    if (!normalized) return;

    // 初始化图表实例
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(containerRef.current);
    }

    try {
      // 第二个参数 true = 不合并，完全覆盖（预览场景每次全量刷新）
      chartInstanceRef.current.setOption(normalized, true);
    } catch (e) {
      console.error('[ChartPreview] ECharts 渲染失败:', e);
    }

    const handleResize = () => chartInstanceRef.current?.resize();
    window.addEventListener('resize', handleResize);

    // 延迟 resize 一次：容器在 flex 布局中可能延迟获得最终尺寸
    const timer = setTimeout(() => chartInstanceRef.current?.resize(), 120);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, [config]);

  // config 缺失：显示提示而非空白
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

  return <div ref={containerRef} style={{ width: '100%', height }} />;
};

export default ChartPreview;
