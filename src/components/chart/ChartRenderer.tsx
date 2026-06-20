import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface ChartRendererProps {
  config: echarts.EChartsOption;
  width?: number | string;
  height?: number | string;
  onChartReady?: (chart: echarts.ECharts) => void;
  chartRef?: React.MutableRefObject<echarts.ECharts | null>;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  config,
  width = '100%',
  height = 400,
  onChartReady,
  chartRef: externalChartRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;

    // 初始化图表实例
    const chart = echarts.init(containerRef.current);
    chartInstanceRef.current = chart;
    
    // 暴露图表实例给外部
    if (externalChartRef) {
      externalChartRef.current = chart;
    }

    // 配置图表
    const echartsConfig: echarts.EChartsOption = {
      title: config.title,
      tooltip: config.tooltip,
      legend: config.legend,
      xAxis: config.xAxis,
      yAxis: config.yAxis,
      series: config.series,
      dataZoom: config.dataZoom,
      grid: {
        left: '10%',
        right: '5%',
        bottom: config.dataZoom ? '15%' : '8%',
        top: config.title?.text ? '60px' : '40px',
        containLabel: true,
      },
      color: [
        '#5470c6',
        '#91cc75',
        '#fac858',
        '#ee6666',
        '#73c0de',
        '#3ba272',
        '#fc8452',
        '#9a60b4',
        '#ea7ccc',
      ],
    };

    chart.setOption(echartsConfig);

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
    };
  }, []); // 只在初始化时执行一次

  // 当配置变化时更新图表
  useEffect(() => {
    if (chartInstanceRef.current && config) {
      const echartsConfig: echarts.EChartsOption = {
        title: config.title,
        tooltip: config.tooltip,
        legend: config.legend,
        xAxis: config.xAxis,
        yAxis: config.yAxis,
        series: config.series,
        dataZoom: config.dataZoom,
        grid: {
          left: '10%',
          right: '5%',
          bottom: config.dataZoom ? '15%' : '8%',
          top: config.title?.text ? '60px' : '40px',
          containLabel: true,
        },
        color: [
          '#5470c6',
          '#91cc75',
          '#fac858',
          '#ee6666',
          '#73c0de',
          '#3ba272',
          '#fc8452',
          '#9a60b4',
          '#ea7ccc',
        ],
      };

      chartInstanceRef.current.setOption(echartsConfig, true);
      chartInstanceRef.current.resize();
    }
  }, [config]);

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
