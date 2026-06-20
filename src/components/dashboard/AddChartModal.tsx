import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/dashboardStore';
import { useToastStore } from '../../store/toastStore';
import { calculateNextPosition } from '../../utils/gridLayout';

interface AddChartModalProps {
  dashboardId: string;
  onClose: () => void;
  onAdded?: () => void;
}

export const AddChartModal: React.FC<AddChartModalProps> = ({
  dashboardId,
  onClose,
  onAdded,
}) => {
  const { savedCharts, dashboards, loadSavedCharts, addChartToDashboard, error } = useDashboardStore();
  const { addToast } = useToastStore();
  const [search, setSearch] = useState('');
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('[AddChartModal] 正在加载 savedCharts...');
    loadSavedCharts().then(() => {
      const { savedCharts } = useDashboardStore.getState();
      console.log('[AddChartModal] 加载完成，图表数量:', savedCharts.length);
      console.log('[AddChartModal] savedCharts 内容:', savedCharts);
    });
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
        addToast('已将图表添加到仪表盘', 'success');
      } else {
        addToast('添加图表失败', 'error');
      }
      onAdded?.();
      onClose();
    } catch (e) {
      console.error('Add chart failed:', e);
      addToast('添加图表失败', 'error');
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
          <h3 style={styles.title}>添加图表</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <input
            style={styles.search}
            placeholder="搜索图表..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {filtered.length === 0 ? (
            <div style={styles.empty}>
              {error ? (
                <div style={{ color: '#e74c3c', marginBottom: '8px' }}>错误: {error}</div>
              ) : null}
              <div>暂无保存的图表</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                当前已保存 {savedCharts.length} 个图表
              </div>
              {savedCharts.length === 0 && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px', lineHeight: '1.6' }}>
                  <strong>如何添加图表到仪表盘？</strong><br/>
                  1. 进入「SQL 查询」页面<br/>
                  2. 执行 SQL 查询并生成图表<br/>
                  3. 点击「保存图表」按钮<br/>
                  4. 返回仪表盘，点击「添加图表」
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
          <button style={styles.cancelBtn} onClick={onClose}>取消</button>
          <button
            style={styles.confirmBtn}
            onClick={handleAdd}
            disabled={!selectedChartId || loading}
          >
            {loading ? '添加中...' : '添加'}
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
