import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboardStore, useToastStore } from '../../store';
import { calculateNextPosition } from '../../utils/gridLayout';
import { TaskEditorModal } from '../automation/TaskEditorModal';
import { ChartVisualFullEditor } from './ChartVisualFullEditor';
import { useLocale } from '../../context/LocaleContext';
import { pickChartResultStatement } from '../../utils/chartResult';
import type { SavedChart, ChartType } from '../../types/dashboard';
import type { VisualConfig } from '../../types/chart';

interface ChartEditSidebarProps {
  chart: SavedChart;
  onClose: () => void;
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: string }[] = [
  { value: 'bar', label: 'chart.bar', icon: '📊' },
  { value: 'horizontalBar', label: 'chart.horizontalBar', icon: '📊' },
  { value: 'line', label: 'chart.line', icon: '📈' },
  { value: 'area', label: 'chart.area', icon: '📉' },
  { value: 'pie', label: 'chart.pie', icon: '🥧' },
  { value: 'doughnut', label: 'chart.doughnut', icon: '🍩' },
  { value: 'stackedBar', label: 'chart.stackedBar', icon: '📊' },
  { value: 'dualAxis', label: 'chart.dualAxis', icon: '📏' },
  { value: 'scatter', label: 'chart.scatter', icon: '🔵' },
  { value: 'radar', label: 'chart.radar', icon: '🎯' },
  { value: 'funnel', label: '漏斗图', icon: '🔻' }, // i18n:skip
  { value: 'gauge', label: '仪表盘', icon: '⏱️' }, // i18n:skip
  { value: 'table', label: '表格', icon: '📋' }, // i18n:skip
];

export const ChartEditSidebar: React.FC<ChartEditSidebarProps> = ({ chart, onClose }) => {
  const { dashboards, updateSavedChart, addChartToDashboard, activeDashboardId, updateSavedChartLocal, setVisualConfigPreview, clearVisualConfigPreview } = useDashboardStore();
  const { addToast } = useToastStore();
  const { t } = useLocale();

  // 本地编辑状态
  const [name, setName] = useState(chart.name);
  const [chartType, setChartType] = useState(chart.chartType);
  const [xAxis, setXAxis] = useState(chart.xAxis);
  const [yAxis, setYAxis] = useState<string[]>(chart.yAxis || []);
  const [title, setTitle] = useState(chart.title);
  const [description, setDescription] = useState(chart.description);
  const [tagsText, setTagsText] = useState((chart.tags || []).join(', '));
  const [visibility, setVisibility] = useState<'all' | 'restricted'>(
    (chart.visibility || 'all') as 'all' | 'restricted'
  );
  const [authorizedDashboardIds, setAuthorizedDashboardIds] = useState<string[]>(
    chart.authorizedDashboardIds || []
  );
  const [sql, setSql] = useState(chart.sql);
  const [saving, setSaving] = useState(false);
  const [yAxisInput, setYAxisInput] = useState((chart.yAxis || []).join(', '));
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [visualConfig, setVisualConfigState] = useState<VisualConfig>(chart.visualConfig || {});
  // P0 修复（2026-10-23）：视觉配置变更不再直接写入 savedCharts。
  // 原实现 setVisualConfig 同时调用 updateSavedChartLocal，导致两个 Bug：
  //   1) chart.visualConfig 与本地 visualConfig 始终相等 → hasChanges 恒为 false → "有未保存的修改"永不出现
  //   2) 保存后 store 被后端返回值替换，updatedAt 变化触发 chartSyncKey 重置 effect，刚改的样式被立即清空
  // 现改为：本地 state（编辑器显示）+ 预览通道（仪表盘实时预览），由 handleSave 统一持久化。
  const setVisualConfig = useCallback((config: VisualConfig) => {
    setVisualConfigState(config);
    setVisualConfigPreview(chart.id, config as Record<string, unknown>);
  }, [chart.id, setVisualConfigPreview]);

  // 打开编辑器时清掉该图表的历史预览草稿，避免展示上一次的未保存内容
  useEffect(() => {
    clearVisualConfigPreview(chart.id);
    return () => {
      clearVisualConfigPreview(chart.id);
    };
  }, [chart.id, clearVisualConfigPreview]);

  useEffect(() => {
    if (yAxisInput) {
      const parsed = yAxisInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      setYAxis(parsed);
    } else {
      setYAxis([]);
    }
  }, [yAxisInput]);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 异步重建 config 的序列号：连续快速修改时丢弃过期的 SQL 执行结果，防止旧结果覆盖新结果
  const regenSeqRef = useRef(0);

  /**
   * 重建派生 config（2026-10-23 修复「修改图表类型/坐标轴/SQL 后预览与保存均不生效」）
   *
   * 背景：config 是「SQL 结果 × chartType × 坐标轴」的派生缓存，DashboardItem 渲染优先级为
   * config 直渲 > SQL 重新生成。普通图表没有 lastResult（该字段仅由自动化定时任务写入），
   * 因此只要 config 存在就永远走直渲 —— 修改类型/坐标轴只更新 chartType 字段，
   * 直渲的旧 config 不变，导致预览无响应；保存时持久化的也是旧 config，重启后依然是旧图表。
   *
   * 做法：任一生成输入变化后，用最新输入重新执行 SQL 并生成 config 写入 store
   * （预览经 updateSavedChartLocal 即时生效；保存时以返回值持久化新 config）。
   * 返回 null 表示无法重建（无 SQL / 坐标轴不完整 / 查询失败）—— 此时保留原 config。
   */
  const regenerateConfig = useCallback(async (input: {
    chartType: string;
    xAxis: string;
    yAxis: string[];
    sql: string;
  }): Promise<Record<string, unknown> | null> => {
    const { chartType: nextType, xAxis: nextX, yAxis: nextYs, sql: nextSql } = input;
    if (!nextSql || nextSql.trim().length === 0) return null;
    if (!nextX || nextX.trim().length === 0 || nextYs.length === 0) return null;

    const seq = ++regenSeqRef.current;
    try {
      const { tauriService } = await import('../../services');
      const execResponse = await tauriService.executeSql(nextSql);
      if (seq !== regenSeqRef.current) return null; // 已有更新的修改，丢弃过期结果
      // 多语句 SQL：results[0] 未必是图表数据段（可能是前置探索查询），必须挑出
      // 列完整包含 x/y 轴的结果段，否则 generate_chart_config 缺列报错、重建静默
      // 失败，旧 config 继续短路直渲（2026-10-24 用户图表实测复现）
      const firstResult = pickChartResultStatement(execResponse.data?.results, nextX, nextYs);
      if (!execResponse.success || !firstResult || !firstResult.columns?.length || !firstResult.rows?.length) {
        return null; // 查询失败或为空：保留原 config，不破坏现有渲染
      }
      const genResponse = await tauriService.generateChartConfig({
        columns: firstResult.columns,
        rows: firstResult.rows,
        chart_type: nextType,
        x_axis_column: nextX,
        y_axis_columns: nextYs,
      });
      if (seq !== regenSeqRef.current) return null;
      if (genResponse.success && genResponse.data) {
        const cfg = genResponse.data as Record<string, unknown>;
        updateSavedChartLocal(chart.id, { config: cfg });
        return cfg;
      }
      return null;
    } catch (e) {
      console.warn('[ChartEditSidebar] 重新生成图表配置失败（保留原配置）:', e);
      return null;
    }
  }, [chart.id, updateSavedChartLocal]);

  useEffect(() => {
    const yAxisFromInput = yAxisInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const xAxisTrimmed = xAxis.trim();

    const doSync = () => {
      updateSavedChartLocal(chart.id, {
        chartType: chartType as ChartType,
        xAxis: xAxisTrimmed,
        yAxis: yAxisFromInput,
        ...(sql !== chart.sql ? { sql } : {}),
      });
      // 类型/坐标轴/SQL 都是 config 的生成输入，改动后必须重建派生 config（见 regenerateConfig 注释）
      void regenerateConfig({ chartType, xAxis: xAxisTrimmed, yAxis: yAxisFromInput, sql });
    };

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const changedFields: string[] = [];
    if (chartType !== chart.chartType) changedFields.push('chartType');
    if (xAxisTrimmed !== chart.xAxis) changedFields.push('xAxis');
    if (JSON.stringify(yAxisFromInput) !== JSON.stringify(chart.yAxis || [])) changedFields.push('yAxis');
    if (sql !== chart.sql) changedFields.push('sql');

    if (changedFields.length === 0) return;

    if (changedFields.includes('chartType')) {
      doSync();
    } else {
      syncTimerRef.current = setTimeout(doSync, 600);
    }

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [chart.id, chartType, xAxis, yAxisInput, sql, chart.chartType, chart.xAxis, chart.yAxis, chart.sql, updateSavedChartLocal, regenerateConfig]);

  const isItemBasedChart = useMemo(() => {
    return ['pie', 'doughnut', 'funnel', 'gauge'].includes(chartType);
  }, [chartType]);

  const itemNames = useMemo(() => {
    if (!isItemBasedChart) return [];
    const lr = chart.lastResult;
    if (!lr || !lr.columns || !lr.rows) return [];
    const xAxisIdx = lr.columns.indexOf(xAxis);
    if (xAxisIdx < 0) return [];
    return lr.rows.map((row: string[]) => row[xAxisIdx]).filter((v: string) => v && v.length > 0);
  }, [isItemBasedChart, chart.lastResult, xAxis]);
  const [activeTab, setActiveTab] = useState<'basic' | 'config' | 'visual' | 'query' | 'auth'>('basic');

  // 切换图表（chart.id 变化）或图表被外部更新（updatedAt 变化，如保存成功后的回读）时，
  // 用持久化数据重置本地编辑状态。
  // 注意：不再强制 setActiveTab('basic') —— 用户在 visual 标签页编辑并保存后，
  // 应停留在当前标签页直接看到已保存的结果，而不是被踢回 basic 页（曾被反馈像"修改被保存键清除"）。
  const chartSyncKey = `${chart.id}:${chart.updatedAt || 0}`;
  useEffect(() => {
    setName(chart.name);
    setChartType(chart.chartType);
    setXAxis(chart.xAxis);
    setYAxis(chart.yAxis || []);
    setYAxisInput((chart.yAxis || []).join(', '));
    setTitle(chart.title);
    setDescription(chart.description);
    setTagsText((chart.tags || []).join(', '));
    setVisibility((chart.visibility || 'all') as 'all' | 'restricted');
    setAuthorizedDashboardIds(chart.authorizedDashboardIds || []);
    setSql(chart.sql);
    setVisualConfigState(chart.visualConfig || {});
  }, [chartSyncKey]);

  // 计算是否有变更
  const hasChanges = useMemo(() => {
    const tags = tagsText.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const yAxisFromInput = yAxisInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    return (
      name !== chart.name ||
      chartType !== chart.chartType ||
      xAxis !== chart.xAxis ||
      JSON.stringify(yAxisFromInput) !== JSON.stringify(chart.yAxis || []) ||
      title !== chart.title ||
      description !== chart.description ||
      JSON.stringify(tags) !== JSON.stringify(chart.tags || []) ||
      visibility !== (chart.visibility || 'all') ||
      JSON.stringify(authorizedDashboardIds.sort()) !==
        JSON.stringify((chart.authorizedDashboardIds || []).sort()) ||
      sql !== chart.sql ||
      JSON.stringify(visualConfig) !== JSON.stringify(chart.visualConfig || {})
    );
  }, [name, chartType, xAxis, yAxisInput, title, description, tagsText, visibility, authorizedDashboardIds, sql, visualConfig, chart]);

  const handleSave = async () => {
    if (!name.trim()) {
      addToast('图表名称不能为空', 'warning');
      return;
    }
    const tags = tagsText.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const yAxisFromInput = yAxisInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);

    setSaving(true);
    try {
      // 保存前用当前输入重建 config：debounce 可能未触发、异步重建可能存在竞态，
      // 必须确保持久化的 config 与本次保存的 chartType/坐标轴/SQL 一致
      // （2026-10-23 修复：否则旧 config 被持久化，重启后仪表盘依然渲染旧图表）
      const freshConfig = await regenerateConfig({
        chartType,
        xAxis: xAxis.trim(),
        yAxis: yAxisFromInput,
        sql,
      });
      const result = await updateSavedChart({
        id: chart.id,
        updates: {
          name: name.trim(),
          chartType: chartType as ChartType,
          xAxis: xAxis.trim(),
          yAxis: yAxisFromInput,
          title: title.trim(),
          description: description.trim(),
          tags,
          visibility,
          authorizedDashboardIds: visibility === 'restricted' ? authorizedDashboardIds : [],
          sql,
          config: freshConfig ?? chart.config ?? undefined,
          visualConfig,
        },
      });
      if (result) {
        // 保存成功：清除预览草稿，回退到已持久化的 visualConfig
        clearVisualConfigPreview(chart.id);
        addToast(`图表 "${result.name}" 已更新`, 'success');
      } else {
        addToast('更新图表失败，请重试', 'error');
      }
    } catch (e) {
      console.error('[ChartEditSidebar] 更新失败:', e);
      addToast(`更新失败：${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleDashboard = (id: string) => {
    setAuthorizedDashboardIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleAddToDashboard = async () => {
    if (!activeDashboardId) {
      addToast('请先在顶部选择一个仪表盘', 'warning');
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

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={styles.title}>✏️ 编辑图表</h3>
            <div style={styles.subTitle}>{chart.name}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          {/* Tab 导航 */}
          <div style={styles.tabNav}>
            {([
              { key: 'basic', icon: '📋', label: t('chart.sectionBasic') },
              { key: 'config', icon: '📊', label: t('chart.sectionConfig') },
              { key: 'visual', icon: '🎨', label: t('chart.sectionVisual') },
              { key: 'query', icon: '🗃️', label: t('chart.sectionQuery') },
              { key: 'auth', icon: '🔐', label: t('chart.sectionAuthorization') },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === tab.key ? styles.tabBtnActive : {}),
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 内容 */}
          <div style={styles.tabContent}>
            {activeTab === 'basic' && (
              <Section title={`📋 ${t('chart.sectionBasic')}`}>
                <Field label={t('chart.fieldName')}>
                  <input
                    style={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('chart.chartNamePlaceholder')}
                  />
                </Field>
                <Field label={t('chart.title')}>
                  <input
                    style={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('chart.showOnTop')}
                  />
                </Field>
                <Field label={t('chart.description')}>
                  <textarea
                    style={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('chart.descriptionPlaceholder')}
                  />
                </Field>
                <Field label={t('chart.tags')}>
                  <input
                    style={styles.input}
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder={t('chart.tagsPlaceholder')}
                  />
                </Field>
              </Section>
            )}

            {activeTab === 'config' && (
              <Section title={`📊 ${t('chart.sectionConfig')}`}>
                <Field label={t('chart.chartType')}>
                  <div style={styles.chartTypeGrid}>
                    {CHART_TYPE_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        style={{
                          ...styles.chartTypeCard,
                          ...(chartType === opt.value ? styles.chartTypeCardSelected : {}),
                        }}
                        onClick={() => setChartType(opt.value)}
                      >
                        <div style={{ fontSize: 20 }}>{opt.icon}</div>
                        <div style={{ fontSize: 12 }}>{t(opt.label)}</div>
                      </div>
                    ))}
                  </div>
                </Field>

                <Field label={t('chart.xAxisField')}>
                  <input
                    style={styles.input}
                    value={xAxis}
                    onChange={(e) => setXAxis(e.target.value)}
                    placeholder={t('chart.xAxisPlaceholder')}
                  />
                </Field>

                <Field label={t('chart.yAxisFields')}>
                  <input
                    style={styles.input}
                    value={yAxisInput}
                    onChange={(e) => setYAxisInput(e.target.value)}
                    placeholder={t('chart.yAxisPlaceholder')}
                  />
                  {yAxis.length > 0 && (
                    <div style={styles.chipRow}>
                      {yAxis.map((y, idx) => (
                        <span key={`${y}-${idx}`} style={styles.chip}>{y}</span>
                      ))}
                    </div>
                  )}
                </Field>
              </Section>
            )}

            {activeTab === 'visual' && (
              <Section title={`🎨 ${t('chart.sectionVisual')}`}>
                <ChartVisualFullEditor
                  value={visualConfig}
                  onChange={setVisualConfig}
                  seriesNames={yAxis.length > 0 ? yAxis : []}
                  itemNames={itemNames}
                  isItemBased={isItemBasedChart}
                />
              </Section>
            )}

            {activeTab === 'query' && (
              <Section title={`🗃️ ${t('chart.sectionQuery')}`}>
                <textarea
                  style={{ ...styles.textarea, fontFamily: 'monospace', fontSize: 12 }}
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder="SELECT ... FROM ..." // safe_sql: form placeholder 中的 SQL 示例文案
                  rows={8}
                />
                <div style={styles.helper}>
                  ℹ️ 这是图表渲染时执行的 SQL，修改后需保存才能生效
                </div>
              </Section>
            )}

            {activeTab === 'auth' && (
              <Section title={`🔐 ${t('chart.sectionAuthorization')}`}>
                <div style={styles.radioRow}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={visibility === 'all'}
                      onChange={() => setVisibility('all')}
                      style={styles.radio}
                    />
                    <span>🌐 授权给所有仪表盘</span>
                  </label>
                </div>
                <div style={styles.radioRow}>
                  <label style={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={visibility === 'restricted'}
                      onChange={() => setVisibility('restricted')}
                      style={styles.radio}
                    />
                    <span>🔒 仅授权给以下仪表盘：</span>
                  </label>
                </div>

                {visibility === 'restricted' && (
                  <div style={styles.dashboardList}>
                    {dashboards.length === 0 ? (
                      <div style={styles.helper}>还没有仪表盘，可先在顶部创建</div>
                    ) : (
                      dashboards.map((d) => (
                        <label key={d.id} style={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={authorizedDashboardIds.includes(d.id)}
                            onChange={() => toggleDashboard(d.id)}
                            style={styles.checkbox}
                          />
                          <span>{d.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                <div style={styles.helper}>
                  {t('chart.allDashboardsHint')}
                </div>
              </Section>
            )}

            {/* 操作按钮 */}
            <div style={styles.actionRow}>
              <button
                style={styles.secondaryBtn}
                onClick={handleAddToDashboard}
                title={t('chart.addToCurrentHint')}
              >
                ➕ {t('chart.addToDashboard')}
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => setShowScheduleModal(true)}
                title={t('chart.createTaskHint')}
              >
                ⚡ {t('chart.scheduleRefresh')}
              </button>
            </div>
          </div>
        </div>

        {/* 底部保存栏 */}
        <div style={styles.footer}>
          {hasChanges && <span style={styles.dirtyHint}>有未保存的修改</span>}
          <button style={styles.secondaryBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button
            style={{ ...styles.primaryBtn, opacity: saving ? 0.7 : 1 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('chart.saving') : `💾 ${t('common.save')}`}
          </button>
        </div>
      </div>

      <TaskEditorModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        initialTaskType="refresh_chart"
        initialPayload={{ chartId: chart.id }}
        initialName={`定时刷新图表: ${chart.name}`} // i18n:skip
      />
    </>
  );
};

// --- 可复用小组件 ---

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div style={styles.section}>
    <div style={styles.sectionTitle}>{title}</div>
    <div style={styles.sectionBody}>{children}</div>
  </div>
);

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, children }) => (
  <div style={styles.field}>
    <div style={styles.fieldLabel}>{label}</div>
    <div style={styles.fieldControl}>{children}</div>
  </div>
);

// --- 样式 ---

const styles: Record<string, React.CSSProperties> = {
  // 全屏点击层：仅用于「点击空白处关闭编辑器」。
  // 不要加 background 压暗 —— 编辑期间背后的仪表盘图表通过 previewVisualConfigs
  // 草稿通道实时预览视觉样式修改，任何半透明深色遮罩都会把原图表蒙上一层灰色，
  // 严重影响边改边看的体验（2026-10-23 用户反馈）。面板自身有左边框 + 投影，足够分区。
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'transparent',
    zIndex: 90,
  },
  panel: {
    position: 'fixed',
    right: 0,
    top: 56,
    bottom: 0,
    width: 460,
    background: 'var(--bg-primary)',
    borderLeft: '1px solid var(--border-primary)',
    boxShadow: '-2px 0 12px rgba(0,0,0,0.1)',
    zIndex: 95,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: { fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' },
  subTitle: { fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
    color: 'var(--text-secondary)', padding: '0 8px',
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  tabNav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '6px',
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    flexShrink: 0,
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    fontSize: '12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    background: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  },
  tabBtnActive: {
    background: 'var(--primary)',
    color: 'white',
    borderColor: 'var(--primary)',
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  section: {
    border: '1px solid var(--border-primary)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionTitle: {
    padding: '10px 14px',
    background: 'var(--bg-secondary)',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  sectionBody: {
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  fieldControl: { width: '100%' },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    fontSize: 13,
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    fontSize: 13,
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    resize: 'vertical',
    minHeight: 60,
    boxSizing: 'border-box',
  },
  chartTypeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  chartTypeCard: {
    padding: '10px 6px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
  },
  chartTypeCardSelected: {
    borderColor: 'var(--primary)',
    background: 'var(--primary-bg)',
    color: 'var(--text-primary)',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    display: 'inline-flex',
    padding: '3px 10px',
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    fontSize: 11,
    borderRadius: 4,
  },
  radioRow: {
    marginBottom: 6,
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  radio: { cursor: 'pointer' },
  dashboardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 10,
    background: 'var(--bg-secondary)',
    borderRadius: 6,
    maxHeight: 180,
    overflowY: 'auto',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  checkbox: { cursor: 'pointer' },
  helper: {
    fontSize: 11,
    color: 'var(--text-tertiary)',
    marginTop: 6,
    lineHeight: 1.5,
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTop: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
  },
  dirtyHint: {
    fontSize: 12,
    color: 'var(--warning)',
    marginRight: 'auto',
    fontWeight: 500,
  },
  secondaryBtn: {
    padding: '8px 16px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 13,
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 6,
    background: 'var(--primary)',
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};