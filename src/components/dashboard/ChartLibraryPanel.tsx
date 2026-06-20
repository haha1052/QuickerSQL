import React, { useState, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboardStore';
import { useToastStore } from '../../store/toastStore';
import { ChartPreview } from '../chart/ChartPreview';
import { calculateNextPosition } from '../../utils/gridLayout';
import type { SavedChart } from '../../types/dashboard';
import { TaskEditorModal } from '../automation/TaskEditorModal';

interface ChartLibraryPanelProps {
  open: boolean;
  onClose: () => void;
}

const getChartIcon = (chartType: string) => {
  switch (chartType) {
    case 'bar': return '📊';
    case 'line': return '📈';
    case 'pie': return '🥧';
    case 'scatter': return '🔵';
    case 'area': return '📉';
    case 'stackedBar': return '📊';
    case 'table': return '📋';
    default: return '📊';
  }
};

export const ChartLibraryPanel: React.FC<ChartLibraryPanelProps> = ({ open, onClose }) => {
  const {
    savedCharts,
    selectedChartId,
    setSelectedChartId,
    deleteSavedChart,
    dashboards,
    loadSavedCharts,
    activeDashboardId,
    addChartToDashboard,
  } = useDashboardStore();
  const { addToast } = useToastStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name'>('updatedAt');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleChart, setScheduleChart] = useState<SavedChart | null>(null);

  React.useEffect(() => {
    if (open && savedCharts.length === 0) {
      loadSavedCharts();
    }
  }, [open]);

  // 判定某图表对当前仪表盘是否可用
  const isChartAvailableTo = (chart: SavedChart): boolean => {
    if (chart.visibility === 'all') return true;
    if (chart.visibility === 'restricted') {
      if (!activeDashboardId) return false;
      return (chart.authorizedDashboardIds || []).includes(activeDashboardId);
    }
    return true;
  };

  // 筛选和排序
  const filteredCharts = useMemo(() => {
    let list = [...savedCharts];
    // 按授权范围筛选
    if (scopeFilter === 'available') {
      list = list.filter((c) => isChartAvailableTo(c));
    } else if (scopeFilter === 'unavailable') {
      list = list.filter((c) => !isChartAvailableTo(c));
    }
    // 搜索
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(s) ||
        c.description.toLowerCase().includes(s) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(s))
      );
    }
    // 类型筛选
    if (filterType !== 'all') {
      list = list.filter((c) => c.chartType === filterType);
    }
    // 排序
    if (sortBy === 'updatedAt') {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [savedCharts, search, filterType, sortBy, scopeFilter, activeDashboardId]);

  const handleDeleteChart = async (chart: SavedChart, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确认删除图表 "${chart.name}"？\n此操作无法撤销，且该图表将从所有仪表盘中移除。`)) {
      return;
    }
    await deleteSavedChart(chart.id);
    addToast(`已删除图表 "${chart.name}"`, 'success');
    if (selectedChartId === chart.id) {
      setSelectedChartId(null);
    }
  };

  const handleAddToDashboard = async (chart: SavedChart, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeDashboardId) {
      addToast('请先选择一个仪表盘', 'warning');
      return;
    }
    if (!isChartAvailableTo(chart)) {
        addToast(`图表"${chart.name}"未授权给当前仪表盘，请在"编辑图表"中修改授权范围`, 'warning');
      return;
    }
    const dashboard = dashboards.find((d) => d.id === activeDashboardId);
    const position = calculateNextPosition(dashboard?.layout || []);
    const ok = await addChartToDashboard(activeDashboardId, chart.id, position);
    if (ok) {
      addToast(`已将图表 "${chart.name}" 添加到仪表盘`, 'success');
    } else {
      addToast('添加到仪表盘失败', 'error');
    }
  };

  const handleChartClick = (chart: SavedChart) => {
    setSelectedChartId(chart.id === selectedChartId ? null : chart.id);
  };

  const getDashboardName = (id: string) => dashboards.find((d) => d.id === id)?.name || id;

  if (!open) return null;

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.panel}>
        <div style={styles.header}>
          <h3 style={styles.title}>📚 图表库</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.searchRow}>
          <input
            style={styles.searchInput}
            placeholder="🔍 搜索图表名称、标签..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={styles.select}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">全部类型</option>
            <option value="bar">柱状图</option>
            <option value="line">折线图</option>
            <option value="pie">饼图</option>
            <option value="scatter">散点图</option>
            <option value="area">面积图</option>
            <option value="stackedBar">堆叠图</option>
            <option value="table">表格</option>
          </select>
          <select
            style={styles.select}
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as 'all' | 'available' | 'unavailable')}
            title="按图表对当前仪表盘的授权范围筛选"
          >
            <option value="all">全部授权</option>
            <option value="available">仅对当前仪表盘可用</option>
            <option value="unavailable">未授权给当前仪表盘</option>
          </select>
          <select
            style={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'updatedAt' | 'name')}
          >
            <option value="updatedAt">按更新时间</option>
            <option value="name">按名称</option>
          </select>
        </div>

        <div style={styles.statBar}>
          共 <span style={styles.statNum}>{filteredCharts.length}</span> 个图表
          {activeDashboardId && (
            <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              当前仪表盘：{dashboards.find((d) => d.id === activeDashboardId)?.name || '-'}
            </span>
          )}
        </div>

        <div style={styles.listContainer}>
          {filteredCharts.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {search || filterType !== 'all' ? '没有匹配的图表' : '暂无保存的图表'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                在 SQL 查询页面中生成图表并保存
              </div>
            </div>
          ) : (
            <div style={styles.list}>
              {filteredCharts.map((chart) => {
                const isSelected = selectedChartId === chart.id;
                const available = isChartAvailableTo(chart);
                return (
                  <div
                    key={chart.id}
                    style={{
                      ...styles.chartItem,
                      ...(isSelected ? styles.chartItemSelected : {}),
                      ...(available ? {} : { opacity: 0.55 }),
                    }}
                    onClick={() => handleChartClick(chart)}
                  >
                    <div style={styles.chartItemRow}>
                      <div style={styles.chartIcon}>{getChartIcon(chart.chartType)}</div>
                      <div style={styles.chartInfo}>
                        <div style={styles.chartName}>{chart.name}</div>
                        <div style={styles.chartMeta}>
                          {chart.chartType} · 最后更新{' '}
                          {new Date(chart.updatedAt * 1000).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div style={styles.chartMeta}>
                          {available
                            ? '🌐 可添加到当前仪表盘'
                            : '🔒 未授权给当前仪表盘'}
                          {chart.visibility === 'restricted' && chart.authorizedDashboardIds?.length > 0 && (
                            <span style={{ marginLeft: '6px', color: 'var(--text-tertiary)' }}>
                              （授权给：{chart.authorizedDashboardIds.slice(0, 2).map(getDashboardName).join('、')}
                              {chart.authorizedDashboardIds.length > 2 ? '等' : ''}）
                            </span>
                          )}
                        </div>
                        {chart.tags?.length > 0 && (
                          <div style={styles.tagRow}>
                            {chart.tags.slice(0, 3).map((t) => (
                              <span key={t} style={styles.tag}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={styles.chartItemActions}>
                        <button
                          style={styles.addBtn}
                          onClick={(e) => handleAddToDashboard(chart, e)}
                          disabled={!available || !activeDashboardId}
                          title={available ? '添加到当前仪表盘' : '未授权，无法添加'}
                        >➕ 添加</button>
                        <button
                          style={styles.scheduleBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setScheduleChart(chart);
                            setShowScheduleModal(true);
                          }}
                          title="定时刷新此图表"
                        >⚡ 定时刷新</button>
                        <button
                          style={styles.deleteBtn}
                          onClick={(e) => handleDeleteChart(chart, e)}
                          title="删除此图表"
                        >🗑️</button>
                      </div>
                    </div>
                    {isSelected && (
                      <div style={styles.previewWrapper}>
                        <ChartPreview config={chart.config} height={180} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            💡 点击图表查看预览，并在右侧编辑面板修改属性
          </div>
        </div>
      </div>
      <TaskEditorModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        initialTaskType="refresh_chart"
        initialPayload={{ chartId: scheduleChart?.id || '' }}
        initialName={'定时刷新图表: ' + (scheduleChart?.name || '')}
      />
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    zIndex: 800,
  },
  panel: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: 400,
    background: 'var(--bg-primary)',
    borderRight: '1px solid var(--border-primary)',
    boxShadow: '2px 0 12px rgba(0,0,0,0.1)',
    zIndex: 900,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: { fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '0 8px',
  },
  searchRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 20px',
    borderBottom: '1px solid var(--border-primary)',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    fontSize: 13,
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  select: {
    padding: '8px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  statBar: {
    padding: '8px 20px',
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--bg-secondary)',
  },
  statNum: { color: 'var(--primary)', fontWeight: 600, fontSize: 14 },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
  },
  chartItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    border: '1px solid var(--border-primary)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'var(--bg-primary)',
  },
  chartItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  chartItemSelected: {
    borderColor: 'var(--primary)',
    background: 'var(--primary-bg)',
  },
  previewWrapper: {
    width: '100%',
    paddingTop: 4,
  },
  chartIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  chartInfo: {
    flex: 1,
    minWidth: 0,
  },
  chartName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chartMeta: {
    fontSize: 11,
    color: 'var(--text-tertiary)',
    marginTop: 2,
  },
  tagRow: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    fontSize: 10,
    padding: '2px 6px',
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    borderRadius: 4,
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    fontSize: 14,
    padding: '6px 10px',
    cursor: 'pointer',
    opacity: 0.7,
    color: 'var(--text-secondary)',
  },
  addBtn: {
    background: 'var(--primary)',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    padding: '6px 10px',
    cursor: 'pointer',
    color: 'white',
    fontWeight: 500,
  },
  scheduleBtn: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    fontSize: 12,
    padding: '6px 10px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  chartItemActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-end',
  },
  empty: {
    textAlign: 'center',
    padding: 48,
    color: 'var(--text-tertiary)',
  },
  footer: {
    padding: 12,
    borderTop: '1px solid var(--border-primary)',
    textAlign: 'center',
  },
};
