import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChartRenderer } from './ChartRenderer';
import { ChartTypeSelector, ChartType } from './ChartTypeSelector';
import { ChartConfigPanel } from './ChartConfigPanel';
import { SaveChartModal } from './SaveChartModal';
import * as echarts from 'echarts';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';
import { useQueryStore } from '../../store';

interface ChartPanelProps {
  queryResult: {
    columns: string[];
    rows: string[][];
  } | null;
}

type ChartConfigType = echarts.EChartsOption;
type ChartStage = 'config' | 'preview';

export const ChartPanel: React.FC<ChartPanelProps> = ({ queryResult }) => {
  const [stage, setStage] = useState<ChartStage>('config');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [columns, setColumns] = useState<string[]>([]);
  const [xAxisColumn, setXAxisColumn] = useState<string>('');
  const [yAxisColumns, setYAxisColumns] = useState<string[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartConfigType | null>(null);
  const [recommendedTypes, setRecommendedTypes] = useState<ChartType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const { t } = useLocale();
  const { activeQueryId, sqlQueries } = useQueryStore();
  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
  
  // 获取可视化设置
  const [defaultChartType] = useSetting('visualization', 'defaultChartType');
  const [showGrid] = useSetting('visualization', 'showGrid');
  const [showLegend] = useSetting('visualization', 'showLegend');
  const [defaultColorScheme] = useSetting('visualization', 'defaultColorScheme');

  const handleChartReady = (chart: echarts.ECharts) => {
    chartInstanceRef.current = chart;
    applyChartSettings(chart);
  };
  
  // 应用图表设置
  const applyChartSettings = useCallback((chart: echarts.ECharts | null) => {
    if (!chart || !chartConfig) return;
    
    const option = chart.getOption() as unknown as Record<string, unknown>;
    
    // 应用网格设置
    if (option.xAxis) {
      if (Array.isArray(option.xAxis)) {
        option.xAxis.forEach((x: unknown) => {
          const xAxisOpt = x as { splitLine?: { show?: boolean } };
          if (xAxisOpt && xAxisOpt.splitLine) {
            xAxisOpt.splitLine.show = showGrid === 'true';
          }
        });
      } else {
        const xAxis = option.xAxis as { splitLine?: { show?: boolean } };
        if (xAxis.splitLine) {
          xAxis.splitLine.show = showGrid === 'true';
        }
      }
    }
    
    if (option.yAxis) {
      if (Array.isArray(option.yAxis)) {
        option.yAxis.forEach((y: unknown) => {
          const yAxisOpt = y as { splitLine?: { show?: boolean } };
          if (yAxisOpt && yAxisOpt.splitLine) {
            yAxisOpt.splitLine.show = showGrid === 'true';
          }
        });
      } else {
        const yAxis = option.yAxis as { splitLine?: { show?: boolean } };
        if (yAxis.splitLine) {
          yAxis.splitLine.show = showGrid === 'true';
        }
      }
    }
    
    // 应用图例设置
    if (option.legend) {
      if (Array.isArray(option.legend)) {
        option.legend.forEach((l: unknown) => {
          const legendOpt = l as { show?: boolean };
          if (legendOpt) legendOpt.show = showLegend === 'true';
        });
      } else {
        const legend = option.legend as { show?: boolean };
        legend.show = showLegend === 'true';
      }
    }
    
    // 应用配色方案
    const colorSchemes: Record<string, string[]> = {
      default: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
      dark: ['#333', '#666', '#999', '#ccc', '#f0f0f0'],
      light: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
      colorful: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
    };
    option.color = colorSchemes[defaultColorScheme as keyof typeof colorSchemes] || colorSchemes.default;
    
    chart.setOption(option as echarts.EChartsOption);
  }, [chartConfig, showGrid, showLegend, defaultColorScheme]);

  // 当设置变化时重新应用
  useEffect(() => {
    if (chartInstanceRef.current) {
      applyChartSettings(chartInstanceRef.current);
    }
  }, [showGrid, showLegend, defaultColorScheme, applyChartSettings]);

  // 当查询结果变化时，自动初始化图表配置
  useEffect(() => {
    if (queryResult && queryResult.columns.length > 0) {
      setColumns(queryResult.columns);
      // 默认选择第一列作为X轴
      setXAxisColumn(queryResult.columns[0] || '');
      // 默认选择其余所有列作为Y轴
      const defaultYAxis = queryResult.columns.slice(1);
      setYAxisColumns(defaultYAxis.length > 0 ? defaultYAxis : [queryResult.columns[0]]);
      
      // 应用默认图表类型设置
      const typeMap: Record<string, ChartType> = {
        'bar': 'bar',
        'line': 'line',
        'pie': 'pie',
        'scatter': 'scatter',
        'area': 'area',
      };
      if (defaultChartType && typeMap[defaultChartType]) {
        setChartType(typeMap[defaultChartType]);
      }
      
      setError(null);
      setStage('config');
      setChartConfig(null);
    }
  }, [queryResult, defaultChartType]);

  // 获取推荐的图表类型
  useEffect(() => {
    if (queryResult && queryResult.columns.length > 0) {
      const fetchRecommended = async () => {
        try {
          const { tauriService } = await import('../../services');
          const response = await tauriService.getRecommendedChartTypes({
            columns: queryResult.columns,
            rows: queryResult.rows,
          });

          if (response.success && response.data) {
            const types = response.data.map((t: string) => {
              switch (t) {
                case 'stackedBar':
                  return 'stackedBar';
                case 'bar':
                  return 'bar';
                case 'line':
                  return 'line';
                case 'pie':
                  return 'pie';
                case 'area':
                  return 'area';
                case 'scatter':
                  return 'scatter';
                default:
                  return 'bar';
              }
            }) as ChartType[];
            setRecommendedTypes(types);

            // 自动选择第一个推荐类型或默认类型
            if (types.length > 0) {
              const typeMap: Record<string, ChartType> = {
                'bar': 'bar',
                'line': 'line',
                'pie': 'pie',
                'scatter': 'scatter',
                'area': 'area',
              };
              if (defaultChartType && typeMap[defaultChartType]) {
                setChartType(typeMap[defaultChartType]);
              } else {
                setChartType(types[0]);
              }
            }
          }
        } catch (e) {
          console.error('Failed to get recommended chart types:', e);
        }
      };

      fetchRecommended();
    }
  }, [queryResult, defaultChartType]);

  // 生成图表配置
  const generateChart = useCallback(async () => {
    if (!queryResult || yAxisColumns.length === 0 || !xAxisColumn) {
      setError(t('chart.selectAxes'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.generateChartConfig({
        columns: queryResult.columns,
        rows: queryResult.rows,
        chart_type: chartType,
        x_axis_column: xAxisColumn,
        y_axis_columns: yAxisColumns,
      });

      if (response.success && response.data) {
        setChartConfig(response.data as echarts.EChartsOption);
        setStage('preview');
      } else {
        setError(response.error || t('chart.generateFail'));
      }
    } catch (e) {
      console.error('Failed to generate chart:', e);
      setError(t('chart.generateError'));
    } finally {
      setLoading(false);
    }
  }, [queryResult, xAxisColumn, yAxisColumns, chartType]);

  // 当图表配置变化时应用设置
  useEffect(() => {
    if (chartInstanceRef.current && chartConfig) {
      setTimeout(() => {
        applyChartSettings(chartInstanceRef.current);
      }, 100);
    }
  }, [chartConfig, applyChartSettings]);

  // 返回配置阶段
  const backToConfig = () => {
    setStage('config');
    chartInstanceRef.current = null;
  };

  // 保存图表
  const handleSaveChart = () => {
    if (!queryResult) return;
    setShowSaveModal(true);
  };

  // 导出图表为图片
  const exportChart = async () => {
    try {
      // 先尝试通过 echarts 实例导出（最可靠）
      let base64Data: string | null = null;
      
      if (chartInstanceRef.current) {
        base64Data = chartInstanceRef.current.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff',
        });
      } else {
        // 再尝试查找 canvas 元素
        const canvas = document.querySelector('.chart-panel canvas') as HTMLCanvasElement;
        if (canvas) {
          base64Data = canvas.toDataURL('image/png');
        } else {
          // 尝试更广泛的查找
          const allCanvases = document.querySelectorAll('canvas');
          
          if (allCanvases.length > 0) {
            const lastCanvas = allCanvases[allCanvases.length - 1] as HTMLCanvasElement;
            base64Data = lastCanvas.toDataURL('image/png');
          }
        }
      }

      if (!base64Data) {
        alert(t('chart.noChartToExport'));
        return;
      }

      // 使用 Tauri 的文件保存功能
      const { tauriService } = await import('../../services');
      const defaultFileName = `chart-${Date.now()}.png`;
      const success = await tauriService.saveChartImage(base64Data, defaultFileName);

      if (!success) {
        // 回退到浏览器下载
        const link = document.createElement('a');
        link.download = defaultFileName;
        link.href = base64Data;
        link.click();
      }

    } catch (e) {
      console.error('Export failed:', e);
      alert(t('chart.exportFail') + ': ' + e);
    }
  };

  if (!queryResult) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyText}>{t('chart.runQueryFirst')}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 配置阶段 */}
      {stage === 'config' && (
        <div style={styles.configStage}>
          <div style={styles.configSection}>
            <h3 style={styles.sectionTitle}>{t('chart.selectType')}</h3>
            <ChartTypeSelector
              value={chartType}
              onChange={setChartType}
              recommended={recommendedTypes}
            />
          </div>

          <div style={styles.configSection}>
            <h3 style={styles.sectionTitle}>{t('chart.configAxes')}</h3>
            <ChartConfigPanel
              columns={columns}
              config={{
                xAxisColumn,
                yAxisColumns,
              }}
              onChange={(newConfig) => {
                if (newConfig.xAxisColumn) {
                  setXAxisColumn(newConfig.xAxisColumn);
                }
                if (newConfig.yAxisColumns) {
                  setYAxisColumns(newConfig.yAxisColumns);
                }
              }}
            />
          </div>

          {error && (
            <div style={styles.errorContainer}>
              <div style={styles.errorText}>{error}</div>
            </div>
          )}

          <div style={styles.actionButtons}>
            <button
              onClick={generateChart}
              disabled={loading}
              style={styles.generateButton}
            >
              {loading ? t('common.loading') : t('chart.generate')}
            </button>
          </div>
        </div>
      )}

      {/* 预览阶段 */}
      {stage === 'preview' && (
        <div style={styles.previewStage}>
          {/* 图表预览 */}
          <div style={styles.chartContainer}>
            {chartConfig && (
              <div style={styles.chartWrapper} className="chart-panel">
                <ChartRenderer 
                  config={chartConfig} 
                  height="100%" 
                  chartRef={chartInstanceRef}
                  onChartReady={handleChartReady}
                />
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div style={styles.actionButtons}>
            <button
              onClick={backToConfig}
              style={styles.backButton}
            >
              {t('chart.backToConfig')}
            </button>
            <button
              onClick={handleSaveChart}
              style={styles.saveButton}
            >
              💾 保存图表
            </button>
            <button
              onClick={exportChart}
              style={styles.exportButton}
            >
              {t('chart.exportImage')}
            </button>
          </div>
        </div>
      )}

      {/* 保存图表弹窗 */}
      {showSaveModal && activeQuery && (
        <SaveChartModal
          queryId={activeQuery.id}
          querySql={activeQuery.sql}
          chartType={chartType}
          xAxis={xAxisColumn}
          yAxis={yAxisColumns}
          chartConfig={chartConfig || {}}
          onSave={(chart) => {
            setShowSaveModal(false);
            console.log(`图表"${chart.name}"已保存`);
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    overflow: 'hidden',
  },

  configStage: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '16px',
  },
  configSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginTop: 'auto',
    paddingTop: '16px',
  },
  generateButton: {
    padding: '10px 32px',
    background: 'var(--primary)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  previewStage: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chartContainer: {
    flex: 1,
    padding: '16px',
    minHeight: 300,
    display: 'flex',
    flexDirection: 'column',
  },
  chartWrapper: {
    flex: 1,
    width: '100%',
    minHeight: 300,
  },
  backButton: {
    padding: '10px 24px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  saveButton: {
    padding: '10px 24px',
    background: 'var(--primary)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  exportButton: {
    padding: '10px 24px',
    background: 'var(--success)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  errorContainer: {
    padding: '12px',
    background: 'var(--error-bg)',
    border: '1px solid var(--error)',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  errorText: {
    color: 'var(--error)',
    fontSize: '13px',
  },
  emptyContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 300,
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
};

export default ChartPanel;
