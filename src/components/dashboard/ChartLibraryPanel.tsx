import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDashboardStore, useToastStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { ChartPreview } from '../chart/ChartPreview';
import { calculateNextPosition } from '../../utils/gridLayout';
import type { SavedChart } from '../../types/dashboard';
import { TaskEditorModal } from '../automation/TaskEditorModal';
import './ChartLibraryPanel.css';

const CHART_ITEM_HEIGHT = 96;
const CHART_ITEM_EXPANDED_HEIGHT = 280;
/** P2-8：虚拟滚动上下过度扫描行数 */
const VIRTUAL_OVERSCAN = 5;

interface ChartLibraryPanelProps {
  /** 是否显示面板；为 false 时直接返回 null */
  open: boolean;
  /** 关闭面板的回调；点击遮罩或右上角 × 按钮时触发 */
  onClose: () => void;
}

/**
 * 根据图表类型返回对应的 emoji 图标
 * @param chartType - 图表类型字符串（bar/line/pie/scatter/area/stackedBar/table）
 * @returns 对应的 emoji 字符串，未知类型默认返回 📊
 */
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

interface ChartPreviewWithConfigFallbackProps {
  chart: SavedChart;
  height?: number;
}

const ChartPreviewWithConfigFallback: React.FC<ChartPreviewWithConfigFallbackProps> = ({ chart, height = 180 }) => {
  const [dynamicConfig, setDynamicConfig] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    if (chart.config && Object.keys(chart.config).length > 0) {
      setDynamicConfig(null);
      return;
    }

    if (!chart.lastResult || !chart.lastResult.columns || !chart.lastResult.rows) {
      setDynamicConfig(null);
      return;
    }

    const cols = chart.lastResult.columns;
    const rows = chart.lastResult.rows;

    let cancelled = false;
    (async () => {
      try {
        const { tauriService } = await import('../../services');
        const response = await tauriService.generateChartConfig({
          columns: cols,
          rows,
          chart_type: chart.chartType,
          x_axis_column: chart.xAxis,
          y_axis_columns: chart.yAxis,
        });
        if (!cancelled && response.success && response.data) {
          setDynamicConfig(response.data as Record<string, unknown>);
        }
      } catch {
        if (!cancelled) setDynamicConfig(null);
      }
    })();

    return () => { cancelled = true; };
  }, [chart.id, chart.config, chart.lastResult, chart.chartType, chart.xAxis, chart.yAxis]);

  const effectiveConfig = (chart.config && Object.keys(chart.config).length > 0)
    ? chart.config
    : dynamicConfig;

  return (
    <ChartPreview
      config={effectiveConfig}
      visualConfig={chart.visualConfig}
      height={height}
    />
  );
};

/**
 * 图表库面板组件
 *
 * 职责：
 * - 以左侧抽屉形式展示所有已保存的图表
 * - 支持搜索（按名称/描述/标签）、类型筛选、授权范围筛选与排序
 * - 虚拟滚动优化：通过 computeVisibleRange 只渲染可见区域内的图表项
 * - 选中图表后展开预览（ChartPreview），并提供「添加到当前仪表盘」入口
 * - 提供「定时刷新」入口（打开 TaskEditorModal 创建 refresh_chart 任务）
 *
 * 副作用：
 * - open 变为 true 且 savedCharts 为空时触发 loadSavedCharts
 * - 滚动事件更新 scrollTop / viewportHeight 用于虚拟滚动计算
 *
 * @param props.open - 是否显示面板
 * @param props.onClose - 关闭回调
 */
export const ChartLibraryPanel: React.FC<ChartLibraryPanelProps> = ({ open, onClose }) => {
  // P1-13：useShallow 仅订阅必要字段
  const {
    savedCharts,
    selectedChartId,
    setSelectedChartId,
    deleteSavedChart,
    dashboards,
    loadSavedCharts,
    activeDashboardId,
    addChartToDashboard,
  } = useDashboardStore(
    useShallow((s) => ({
      savedCharts: s.savedCharts,
      selectedChartId: s.selectedChartId,
      setSelectedChartId: s.setSelectedChartId,
      deleteSavedChart: s.deleteSavedChart,
      dashboards: s.dashboards,
      loadSavedCharts: s.loadSavedCharts,
      activeDashboardId: s.activeDashboardId,
      addChartToDashboard: s.addChartToDashboard,
    }))
  );
  const { addToast } = useToastStore();
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name'>('updatedAt');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleChart, setScheduleChart] = useState<SavedChart | null>(null);
  // P2-13: 删除图表确认弹窗状态（替代原生 confirm）
  const [chartToDelete, setChartToDelete] = useState<SavedChart | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (e.currentTarget.clientHeight !== viewportHeight) {
      setViewportHeight(e.currentTarget.clientHeight);
    }
  }, [viewportHeight]);

  // P1-12：基于 Lite 数据判断（sql 为空字符串）而非仅看 length
  // 启动时可能已注入 Lite 数据（savedCharts.length > 0 但 sql === ''），需重新加载完整数据
  React.useEffect(() => {
    if (!open) return;
    const hasLiteData = savedCharts.length > 0 && savedCharts.every(c => !c.sql || c.sql.trim().length === 0);
    if (savedCharts.length === 0 || hasLiteData) {
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

  // P2-8：虚拟滚动支持展开项的可变高度。
  // 旧实现假定所有项等高（CHART_ITEM_HEIGHT），选中项展开为 CHART_ITEM_EXPANDED_HEIGHT 时，
  // 后续项的 top offset 计算错误，导致列表项重叠或留白。
  // 新实现：维护每项高度数组 + 前缀偏移数组，正确计算可见窗口与绝对定位 top。
  const itemHeights = useMemo(
    () => filteredCharts.map((c) => (c.id === selectedChartId ? CHART_ITEM_EXPANDED_HEIGHT : CHART_ITEM_HEIGHT)),
    [filteredCharts, selectedChartId]
  );

  // 前缀偏移：offsets[i] = 第 i 项的 top（offsets[0] = 0，offsets[length] = 总高度）
  const offsets = useMemo(() => {
    const result = new Array<number>(itemHeights.length + 1);
    result[0] = 0;
    for (let i = 0; i < itemHeights.length; i++) {
      result[i + 1] = result[i] + itemHeights[i];
    }
    return result;
  }, [itemHeights]);

  const totalHeight = offsets.length > 0 ? offsets[offsets.length - 1] : 0;

  // 计算 visibleRange（基于可变高度）
  const visibleRange = useMemo(() => {
    if (itemHeights.length === 0) {
      return { start: 0, end: 0 };
    }
    // 二分查找第一个 end >= scrollTop 的索引（即首个可见项）
    let start = 0;
    let lo = 0, hi = itemHeights.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] < scrollTop) lo = mid + 1;
      else hi = mid;
    }
    start = lo;
    // 找到第一个 start > scrollTop + viewportHeight 的索引（首个不可见项）
    const viewportEnd = scrollTop + viewportHeight;
    lo = start; hi = itemHeights.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] <= viewportEnd) lo = mid + 1;
      else hi = mid;
    }
    let end = lo;
    // 应用 overscan
    start = Math.max(0, start - VIRTUAL_OVERSCAN);
    end = Math.min(itemHeights.length, end + VIRTUAL_OVERSCAN);
    return { start, end };
  }, [offsets, scrollTop, viewportHeight, itemHeights.length]);

  // P2-13: 删除图表改为弹窗确认（替代原生 confirm）
  const handleDeleteChart = (chart: SavedChart, e: React.MouseEvent) => {
    e.stopPropagation();
    setChartToDelete(chart);
  };

  // P2-13: 用户确认删除后实际执行
  const handleConfirmDeleteChart = async () => {
    if (!chartToDelete) return;
    const chart = chartToDelete;
    setChartToDelete(null);
    try {
      await deleteSavedChart(chart.id);
      addToast({ key: 'chart.library.deleted', vars: { name: chart.name } }, 'success');
      if (selectedChartId === chart.id) {
        setSelectedChartId(null);
      }
    } catch (e) {
      console.error('[ChartLibraryPanel] 删除图表失败:', e);
      addToast(`${t('chart.library.delete_failed')}: ${(e as Error).message}`, 'error');
    }
  };

  const handleAddToDashboard = async (chart: SavedChart, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeDashboardId) {
      addToast({ key: 'chart.library.select_dashboard_first' }, 'warning');
      return;
    }
    if (!isChartAvailableTo(chart)) {
        addToast(t('dashboard.unauthorized'), 'warning');
      return;
    }
    const dashboard = dashboards.find((d) => d.id === activeDashboardId);
    const position = calculateNextPosition(dashboard?.layout || []);
    const ok = await addChartToDashboard(activeDashboardId, chart.id, position);
    if (ok) {
      addToast({ key: 'chart.library.added_to_dashboard', vars: { name: chart.name } }, 'success');
    } else {
      addToast({ key: 'chart.library.add_failed' }, 'error');
    }
  };

  const handleChartClick = (chart: SavedChart) => {
    setSelectedChartId(chart.id === selectedChartId ? null : chart.id);
  };

  const getDashboardName = (id: string) => dashboards.find((d) => d.id === id)?.name || id;

  if (!open) return null;

  return (
    <>
      <div className="clp-overlay" onClick={onClose} />
      <div className="clp-panel">
        <div className="clp-header">
          <h3 className="clp-title">{t('chart.library.title')}</h3>
          <button className="clp-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="clp-search-row">
          <input
            className="clp-search-input"
            placeholder={`🔍 ${t('chart.searchPlaceholder')}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="clp-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">{t('chart.library.all_types')}</option>
            <option value="bar">{t('chart.library.type_bar')}</option>
            <option value="line">{t('chart.library.type_line')}</option>
            <option value="pie">{t('chart.library.type_pie')}</option>
            <option value="scatter">{t('chart.library.type_scatter')}</option>
            <option value="area">{t('chart.library.type_area')}</option>
            <option value="stackedBar">{t('chart.library.type_stacked_bar')}</option>
            <option value="table">{t('chart.library.type_table')}</option>
          </select>
          <select
            className="clp-select"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as 'all' | 'available' | 'unavailable')}
            title={t('chart.authFilterHint')}
          >
            <option value="all">{t('chart.library.all_scopes')}</option>
            <option value="available">{t('chart.library.available_only')}</option>
            <option value="unavailable">{t('dashboard.unauthorized')}</option>
          </select>
          <select
            className="clp-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'updatedAt' | 'name')}
          >
            <option value="updatedAt">{t('chart.library.sort_updated')}</option>
            <option value="name">{t('chart.library.sort_name')}</option>
          </select>
        </div>

        <div className="clp-stat-bar">
          {t('chart.library.stat_total', { count: filteredCharts.length })}
          {activeDashboardId && (
            <span className="clp-stat-extra">
              {t('chart.library.current_dashboard', { name: dashboards.find((d) => d.id === activeDashboardId)?.name || '-' })}
            </span>
          )}
        </div>

        <div
          className="clp-list-container"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          {filteredCharts.length === 0 ? (
            <div className="clp-empty">
              <div className="clp-empty-icon">📊</div>
              <div className="clp-empty-text">
                {search || filterType !== 'all' ? t('chart.library.no_match') : t('chart.library.no_saved')}
              </div>
              <div className="clp-empty-hint">
                {t('chart.library.hint')}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', height: totalHeight }}>
              {filteredCharts.slice(visibleRange.start, visibleRange.end).map((chart, idx) => {
                const actualIndex = visibleRange.start + idx;
                const isSelected = selectedChartId === chart.id;
                const available = isChartAvailableTo(chart);
                const itemHeight = isSelected ? CHART_ITEM_EXPANDED_HEIGHT : CHART_ITEM_HEIGHT;
                return (
                  <div
                    key={chart.id}
                    className={`clp-chart-item ${isSelected ? 'clp-chart-item-selected' : ''} ${!available ? 'clp-chart-item-unavailable' : ''}`}
                    style={{
                      position: 'absolute',
                      // P2-8：使用基于可变高度的前缀偏移，正确反映展开项的高度变化
                      top: offsets[actualIndex] ?? 0,
                      height: itemHeight,
                      left: 0,
                      right: 0,
                    }}
                    onClick={() => handleChartClick(chart)}
                  >
                    <div className="clp-chart-item-row">
                      <div className="clp-chart-icon">{getChartIcon(chart.chartType)}</div>
                      <div className="clp-chart-info">
                        <div className="clp-chart-name">{chart.name}</div>
                        <div className="clp-chart-meta">
                          {chart.chartType} · {t('chart.library.last_update')}{' '}
                          {new Date(chart.updatedAt * 1000).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="clp-chart-meta">
                          {available
                            ? t('chart.library.can_add')
                            : `🔒 ${t('dashboard.unauthorized')}`}
                          {chart.visibility === 'restricted' && chart.authorizedDashboardIds?.length > 0 && (
                            <span className="clp-auth-extra">
                              {t('chart.library.authorized_for', { names: chart.authorizedDashboardIds.slice(0, 2).map(getDashboardName).join('、') })}
                              {chart.authorizedDashboardIds.length > 2 ? t('chart.library.and_more') : ''}
                            </span>
                          )}
                        </div>
                        {chart.tags?.length > 0 && (
                          <div className="clp-tag-row">
                            {chart.tags.slice(0, 3).map((t) => (
                              <span key={t} className="clp-tag">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="clp-chart-item-actions">
                        <button
                          className="clp-add-btn"
                          onClick={(e) => handleAddToDashboard(chart, e)}
                          disabled={!available || !activeDashboardId}
                          title={available ? t('chart.library.add_btn_title') : t('chart.library.unauthorized_add_title')}
                        >{t('chart.library.add_btn')}</button>
                        <button
                          className="clp-schedule-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScheduleChart(chart);
                            setShowScheduleModal(true);
                          }}
                          title={t('chart.scheduleRefresh')}
                        >⚡ {t('chart.scheduleRefresh')}</button>
                        <button
                          className="clp-delete-btn"
                          onClick={(e) => handleDeleteChart(chart, e)}
                          title={t('chart.deleteChart')}
                        >🗑️</button>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="clp-preview-wrapper">
                        <ChartPreviewWithConfigFallback chart={chart} height={180} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="clp-footer">
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {t('chart.library.footer_hint')}
          </div>
        </div>
      </div>
      <TaskEditorModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        initialTaskType="refresh_chart"
        initialPayload={{ chartId: scheduleChart?.id || '' }}
        initialName={t('chart.library.schedule_chart_name', { name: scheduleChart?.name || '' })}
      />

      {/* P2-13: 删除图表确认弹窗（替代原生 confirm） */}
      {chartToDelete && (
        <div
          className="clp-confirm-overlay"
          onClick={() => setChartToDelete(null)}
        >
          <div
            className="clp-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clp-confirm-header">
              <h3 className="clp-confirm-title">{t('chart.library.delete_title')}</h3>
              <button className="clp-confirm-close-btn" onClick={() => setChartToDelete(null)}>×</button>
            </div>
            <div className="clp-confirm-body">
              <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {t('chart.library.delete_confirm', { name: chartToDelete.name })}
              </p>
            </div>
            <div className="clp-confirm-footer">
              <button className="clp-confirm-cancel-btn" onClick={() => setChartToDelete(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="clp-confirm-delete-btn"
                onClick={handleConfirmDeleteChart}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};