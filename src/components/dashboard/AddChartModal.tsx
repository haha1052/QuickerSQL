import React, { useState, useEffect } from 'react';
import { useDashboardStore, useToastStore } from '../../store';
import { calculateNextPosition } from '../../utils/gridLayout';
import { useLocale } from '../../context/LocaleContext';

interface AddChartModalProps {
  /** 目标仪表盘 ID，用于过滤授权图表并定位添加位置 */
  dashboardId: string;
  /** 关闭弹窗的回调；点击遮罩、× 或取消按钮时触发 */
  onClose: () => void;
  /** 添加成功后的回调（可选）；在 onClose 之前触发 */
  onAdded?: () => void;
}

/**
 * 添加图表到仪表盘的模态框组件
 *
 * 职责：
 * - 弹出模态框展示当前可添加到指定仪表盘的图表列表
 * - 根据图表 visibility 与 authorizedDashboardIds 过滤可用图表
 * - 支持按名称与标签搜索过滤
 * - 选中图表后通过 calculateNextPosition 计算下一个网格位置并调用 addChartToDashboard
 * - 通过 useToastStore 反馈成功/失败状态
 *
 * 副作用：
 * - 挂载时调用 loadSavedCharts 加载图表列表
 *
 * @param props - 见 AddChartModalProps
 */
export const AddChartModal: React.FC<AddChartModalProps> = ({
  dashboardId,
  onClose,
  onAdded,
}) => {
  const { savedCharts, dashboards, loadSavedCharts, addChartToDashboard, error, errorKey } = useDashboardStore();
  const { addToast } = useToastStore();
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedCharts();
  }, []);

  const filtered = savedCharts
    .filter((c) => {
      if (c.visibility === 'restricted' && dashboardId) {
        return (c.authorizedDashboardIds || []).includes(dashboardId);
      }
      return true;
    })
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    );

  const handleAdd = async () => {
    if (!selectedChartId) return;
    setLoading(true);
    try {
      const dashboard = dashboards.find((d) => d.id === dashboardId);
      const position = calculateNextPosition(dashboard?.layout || []);
      const ok = await addChartToDashboard(dashboardId, selectedChartId, position);
      if (ok) {
        addToast({ key: 'chart.add.add_success' }, 'success');
      } else {
        addToast({ key: 'chart.add.add_failed' }, 'error');
      }
      onAdded?.();
      onClose();
    } catch (e) {
      console.error('Add chart failed:', e);
      addToast({ key: 'chart.add.add_failed' }, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getChartIcon = (chartType: string) => {
    switch (chartType) {
      case 'line': return '📈';
      case 'bar': return '📊';
      case 'pie': return '🥧';
      case 'scatter': return '🔵';
      case 'area': return '📉';
      case 'stackedBar': return '📊';
      default: return '📊';
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{t('chart.add.title')}</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <input
            style={styles.search}
            placeholder={t('chart.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {filtered.length === 0 ? (
            <div style={styles.empty}>
              {error ? (
                <div style={{ color: '#e74c3c', marginBottom: '8px' }}>
                  {errorKey ? t(errorKey) : `${t('chart.add.error_label')}: ${error}`}
                </div>
              ) : null}
              <div>{t('chart.noSavedCharts')}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                {t('chart.add.saved_count', { count: savedCharts.length })}
              </div>
              {savedCharts.length === 0 && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}>
                  <strong>{t('chart.add.how_to_title')}</strong><br/>
                  {t('chart.add.how_to_step1')}<br/>
                  {t('chart.add.how_to_step2')}<br/>
                  {t('chart.add.how_to_step3')}<br/>
                  {t('chart.add.how_to_step4')}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.list}>
              {filtered.map(chart => (
                <div
                  key={chart.id}
                  style={{
                    ...styles.chartItem,
                    ...(selectedChartId === chart.id ? styles.chartItemSelected : {}),
                  }}
                  onClick={() => setSelectedChartId(chart.id)}
                >
                  <div style={styles.chartIcon}>
                    {getChartIcon(chart.chartType)}
                  </div>
                  <div style={styles.chartInfo}>
                    <div style={styles.chartName}>{chart.name}</div>
                    <div style={styles.chartMeta}>
                      {(chart.tags || []).join(', ')} · {chart.chartType}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button
            style={styles.confirmBtn}
            onClick={handleAdd}
            disabled={!selectedChartId || loading}
          >
            {loading ? t('chart.add.adding') : t('chart.add.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: '12px',
    width: '520px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: { margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' },
  body: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  search: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  chartItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid var(--border-primary)',
    transition: 'all 0.2s',
  },
  chartItemSelected: {
    border: '2px solid var(--primary)',
    background: 'var(--primary-bg)',
  },
  chartIcon: { fontSize: '24px' },
  chartInfo: { flex: 1 },
  chartName: { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' },
  chartMeta: { fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' },
  empty: { textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '13px' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '16px 20px',
    borderTop: '1px solid var(--border-primary)',
  },
  cancelBtn: {
    padding: '8px 20px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  confirmBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '6px',
    background: 'var(--primary)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
  },
};
