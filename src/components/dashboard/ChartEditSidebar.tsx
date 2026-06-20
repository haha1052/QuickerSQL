import React, { useState, useEffect, useMemo } from 'react';
import { useDashboardStore } from '../../store/dashboardStore';
import { useToastStore } from '../../store/toastStore';
import { calculateNextPosition } from '../../utils/gridLayout';
import { TaskEditorModal } from '../automation/TaskEditorModal';
import type { SavedChart, ChartType } from '../../types/dashboard';

interface ChartEditSidebarProps {
  chart: SavedChart;
  onClose: () => void;
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: string }[] = [
  { value: 'bar', label: '柱状图', icon: '📊' },
  { value: 'line', label: '折线图', icon: '📈' },
  { value: 'pie', label: '饼图', icon: '🥧' },
  { value: 'scatter', label: '散点图', icon: '🔵' },
  { value: 'area', label: '面积图', icon: '📉' },
  { value: 'stackedBar', label: '堆叠柱', icon: '📊' },
  { value: 'table', label: '表格', icon: '📋' },
];

export const ChartEditSidebar: React.FC<ChartEditSidebarProps> = ({ chart, onClose }) => {
  const { dashboards, updateSavedChart, addChartToDashboard, activeDashboardId } = useDashboardStore();
  const { addToast } = useToastStore();

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

  // 当切换图表时更新状态
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
  }, [chart.id]);

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
      sql !== chart.sql
    );
  }, [name, chartType, xAxis, yAxisInput, title, description, tagsText, visibility, authorizedDashboardIds, sql, chart]);

  const handleSave = async () => {
    if (!name.trim()) {
      addToast('图表名称不能为空', 'warning');
      return;
    }
    const tags = tagsText.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    const yAxisFromInput = yAxisInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);

    setSaving(true);
    try {
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
        },
      });
      if (result) {
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
          {/* 基本信息 */}
          <Section title="📋 基本信息">
            <Field label="名称">
              <input
                style={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="图表名称"
              />
            </Field>
            <Field label="标题">
              <input
                style={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="显示在图表顶部"
              />
            </Field>
            <Field label="描述">
              <textarea
                style={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选描述（不展示在图表上）"
              />
            </Field>
            <Field label="标签（用逗号分隔）">
              <input
                style={styles.input}
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="如：销售, 2024, 季度"
              />
            </Field>
          </Section>

          {/* 图表配置 */}
          <Section title="📊 图表配置">
            <Field label="图表类型">
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
                    <div style={{ fontSize: 12 }}>{opt.label}</div>
                  </div>
                ))}
              </div>
            </Field>

            <Field label="X 轴字段">
              <input
                style={styles.input}
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value)}
                placeholder="例如：月份、日期、地区"
              />
            </Field>

            <Field label="Y 轴字段（用逗号分隔多个）">
              <input
                style={styles.input}
                value={yAxisInput}
                onChange={(e) => setYAxisInput(e.target.value)}
                placeholder="例如：销售额, 利润, 成本"
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

          {/* SQL 查询 */}
          <Section title="🗃️ 数据查询 (SQL)">
            <textarea
              style={{ ...styles.textarea, fontFamily: 'monospace', fontSize: 12 }}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT ... FROM ..."
              rows={6}
            />
            <div style={styles.helper}>
              ℹ️ 这是图表渲染时执行的 SQL，修改后需保存才能生效
            </div>
          </Section>

          {/* 授权范围 */}
          <Section title="🔐 授权范围">
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
              选择"所有仪表盘"后，此图表可被任何仪表盘引用。选择"仅授权"后，只能在勾选的仪表盘中使用。
            </div>
          </Section>

          {/* 操作按钮 */}
          <div style={styles.actionRow}>
            <button
              style={styles.secondaryBtn}
              onClick={handleAddToDashboard}
              title="将此图表的一个副本添加到当前仪表盘"
            >
              ➕ 添加到当前仪表盘
            </button>
            <button
              style={styles.secondaryBtn}
              onClick={() => setShowScheduleModal(true)}
              title="为当前图表创建一个定时刷新的自动化任务"
            >
              ⚡ 配置定时刷新
            </button>
          </div>
        </div>

        {/* 底部保存栏 */}
        <div style={styles.footer}>
          {hasChanges && <span style={styles.dirtyHint}>有未保存的修改</span>}
          <button style={styles.secondaryBtn} onClick={onClose}>关闭</button>
          <button
            style={{ ...styles.primaryBtn, opacity: saving ? 0.7 : 1 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '💾 保存修改'}
          </button>
        </div>
      </div>

      <TaskEditorModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        initialTaskType="refresh_chart"
        initialPayload={{ chartId: chart.id }}
        initialName={`定时刷新图表: ${chart.name}`}
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
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    zIndex: 800,
  },
  panel: {
    position: 'fixed',
    right: 0,
    top: 0, bottom: 0,
    width: 460,
    background: 'var(--bg-primary)',
    borderLeft: '1px solid var(--border-primary)',
    boxShadow: '-2px 0 12px rgba(0,0,0,0.1)',
    zIndex: 900,
    display: 'flex',
    flexDirection: 'column',
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
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
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
