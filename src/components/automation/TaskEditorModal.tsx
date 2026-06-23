import React, { useState, useEffect } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useTaskStore, useToastStore, useSettingsStore } from '../../store';
import type { Task, TaskType, ScheduleMode, TaskState, CreateTaskPayload, UpdateTaskPayload, SqlTaskPayload, RefreshChartPayload, RefreshDashboardPayload, ExportCsvPayload } from '../../types/automation';

// 从 settings 读取自动化任务默认值（第三轮新增 - 让"默认重试次数/默认超时"真正生效）
const readAutomationDefaults = (): { retryOnFail: number; timeoutSecs: number } => {
  try {
    const getSetting = useSettingsStore.getState().getSetting;
    const retryItem = getSetting('automation', 'defaultRetryOnFail');
    const timeoutItem = getSetting('automation', 'defaultTimeoutSecs');
    const retry = retryItem?.value ? parseInt(retryItem.value, 10) : 0;
    const timeout = timeoutItem?.value ? parseInt(timeoutItem.value, 10) : 300;
    return {
      retryOnFail: Number.isFinite(retry) ? retry : 0,
      timeoutSecs: Number.isFinite(timeout) && timeout > 0 ? timeout : 300,
    };
  } catch {
    return { retryOnFail: 0, timeoutSecs: 300 };
  }
};

interface TaskEditorModalProps {
  open: boolean;
  task?: Task | null;
  onClose: () => void;
  initialTaskType?: TaskType;
  initialPayload?: {
    sql?: string;
    chartId?: string;
    dashboardId?: string;
    csvSql?: string;
    csvOutputPath?: string;
  };
  initialName?: string;
}

interface DraftState {
  name: string;
  description: string;
  taskType: TaskType;
  scheduleMode: ScheduleMode;
  scheduleValue: string;
  retryOnFail: number;
  timeoutSecs: number;
  state: TaskState;
  sql: string;
  chartId: string;
  dashboardId: string;
  csvOutputPath: string;
  csvSql: string;
}

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'sql', label: 'SQL 执行' },
  { value: 'refresh_chart', label: '刷新图表' },
  { value: 'refresh_dashboard', label: '刷新仪表盘' },
  { value: 'export_csv', label: '导出 CSV' },
];

const SCHEDULE_MODE_OPTIONS: { value: ScheduleMode; label: string }[] = [
  { value: 'interval', label: '按间隔（秒）' },
  { value: 'cron', label: 'Cron 表达式' },
  { value: 'manual', label: '仅手动触发' },
];

// 常见的 cron 预设（第三轮新增 - 可视化 cron 编辑器）
const CRON_PRESETS: { label: string; value: string }[] = [
  { label: '每分钟', value: '* * * * *' },
  { label: '每 5 分钟', value: '*/5 * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 0 点', value: '0 0 * * *' },
  { label: '每天 9 点', value: '0 9 * * *' },
  { label: '工作日 9 点', value: '0 9 * * 1-5' },
  { label: '每周一 9 点', value: '0 9 * * 1' },
  { label: '每月 1 号 0 点', value: '0 0 1 * *' },
];

// 解析 cron 成 5 段
const parseCron = (expr: string): string[] => {
  const parts = expr.trim().split(/\s+/);
  const result = ['*', '*', '*', '*', '*'];
  for (let i = 0; i < Math.min(5, parts.length); i++) result[i] = parts[i];
  return result;
};

const parseInnerPayload = (task: Task | null | undefined): Partial<DraftState> => {
  if (!task || !task.payload) return {};
  try {
    const data = JSON.parse(task.payload);
    switch (task.taskType) {
      case 'sql': {
        const inner = data as SqlTaskPayload;
        return { sql: inner.sql || '' };
      }
      case 'refresh_chart': {
        const inner = data as RefreshChartPayload;
        return { chartId: inner.chartId || '' };
      }
      case 'refresh_dashboard': {
        const inner = data as RefreshDashboardPayload;
        return { dashboardId: inner.dashboardId || '' };
      }
      case 'export_csv': {
        const inner = data as ExportCsvPayload;
        return { csvSql: inner.sql || '', csvOutputPath: inner.outputPath || '' };
      }
    }
    return {};
  } catch {
    return {};
  }
};

const buildPayloadString = (taskType: TaskType, draft: DraftState): string => {
  switch (taskType) {
    case 'sql': {
      const inner: SqlTaskPayload = { sql: draft.sql || '' };
      return JSON.stringify(inner);
    }
    case 'refresh_chart': {
      const inner: RefreshChartPayload = { chartId: draft.chartId || '' };
      return JSON.stringify(inner);
    }
    case 'refresh_dashboard': {
      const inner: RefreshDashboardPayload = { dashboardId: draft.dashboardId || '' };
      return JSON.stringify(inner);
    }
    case 'export_csv': {
      const inner: ExportCsvPayload = { sql: draft.csvSql || '', outputPath: draft.csvOutputPath || '' };
      return JSON.stringify(inner);
    }
  }
};

const getInitialDraft = (
  task?: Task | null,
  initialTaskType?: TaskType,
  initialPayload?: TaskEditorModalProps['initialPayload'],
  initialName?: string,
): DraftState => {
  const defaults = readAutomationDefaults();
  const base: DraftState = {
    name: '',
    description: '',
    taskType: 'sql',
    scheduleMode: 'interval',
    scheduleValue: '3600',
    retryOnFail: defaults.retryOnFail,
    timeoutSecs: defaults.timeoutSecs,
    state: 'enabled',
    sql: '',
    chartId: '',
    dashboardId: '',
    csvOutputPath: '',
    csvSql: '',
  };
  const inner = task ? parseInnerPayload(task) : {};
  const fromTask = task
    ? {
        name: task.name,
        description: task.description,
        taskType: task.taskType,
        scheduleMode: task.scheduleMode,
        scheduleValue: task.scheduleValue,
        retryOnFail: task.retryOnFail,
        timeoutSecs: task.timeoutSecs,
        state: task.state,
        ...inner,
      }
    : {};
  const merged: DraftState = {
    ...base,
    ...fromTask,
  };
  if (initialName !== undefined) {
    merged.name = initialName;
  }
  if (initialTaskType !== undefined) {
    merged.taskType = initialTaskType;
  }
  if (initialPayload) {
    if (initialPayload.sql !== undefined) merged.sql = initialPayload.sql;
    if (initialPayload.chartId !== undefined) merged.chartId = initialPayload.chartId;
    if (initialPayload.dashboardId !== undefined) merged.dashboardId = initialPayload.dashboardId;
    if (initialPayload.csvSql !== undefined) merged.csvSql = initialPayload.csvSql;
    if (initialPayload.csvOutputPath !== undefined) merged.csvOutputPath = initialPayload.csvOutputPath;
  }
  return merged;
};

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({
  open,
  task,
  onClose,
  initialTaskType,
  initialPayload,
  initialName,
}) => {
  const { createTask, updateTask, loadTasks } = useTaskStore();
  const { addToast } = useToastStore();
  const [draft, setDraft] = useState<DraftState>(
    getInitialDraft(task, initialTaskType, initialPayload, initialName),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(getInitialDraft(task, initialTaskType, initialPayload, initialName));
      setError(null);
      setSaving(false);
    }
  }, [open, task, initialTaskType, initialPayload, initialName]);

  if (!open) return null;

  const isEdit = Boolean(task);

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (!draft.name.trim()) return '请输入任务名称';
    if (!['sql', 'refresh_chart', 'refresh_dashboard', 'export_csv'].includes(draft.taskType)) {
      return '请选择任务类型';
    }
    if (!['interval', 'cron', 'manual'].includes(draft.scheduleMode)) {
      return '请选择调度模式';
    }
    if (draft.scheduleMode === 'interval') {
      const secs = parseInt(draft.scheduleValue, 10);
      if (Number.isNaN(secs) || secs < 1) return '请输入大于 0 的秒数';
    }
    if (draft.taskType === 'sql' && !draft.sql.trim()) return '请输入 SQL';
    if (draft.taskType === 'refresh_chart' && !draft.chartId.trim()) return '请输入 chartId';
    if (draft.taskType === 'refresh_dashboard' && !draft.dashboardId.trim()) return '请输入 dashboardId';
    if (draft.taskType === 'export_csv' && (!draft.csvSql.trim() || !draft.csvOutputPath.trim())) {
      return '请输入 SQL 和输出路径';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payloadString = buildPayloadString(draft.taskType, draft);
      if (isEdit && task) {
        const patch: UpdateTaskPayload = {
          name: draft.name.trim(),
          description: draft.description.trim(),
          payload: payloadString,
          scheduleMode: draft.scheduleMode,
          scheduleValue: draft.scheduleMode === 'manual' ? '' : draft.scheduleValue,
          state: draft.state,
        };
        await updateTask(task.id, patch);
        addToast('任务已更新', 'success');
      } else {
        const create: CreateTaskPayload = {
          name: draft.name.trim(),
          description: draft.description.trim(),
          taskType: draft.taskType,
          payload: payloadString,
          scheduleMode: draft.scheduleMode,
          scheduleValue: draft.scheduleMode === 'manual' ? '' : draft.scheduleValue,
          state: draft.state,
          retryOnFail: draft.retryOnFail,
          timeoutSecs: draft.timeoutSecs,
        };
        await createTask(create);
      }
      await loadTasks();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`保存失败：${msg}`);
      addToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>{isEdit ? '编辑任务' : '新建任务'}</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <div style={styles.field}>
            <label style={styles.label}>任务名称 *</label>
            <input
              style={styles.input}
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例如：每小时数据统计"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>描述</label>
            <textarea
              style={{ ...styles.textarea, minHeight: '56px' }}
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="可选描述..."
            />
          </div>

          <div style={styles.twoCol}>
            <div style={styles.field}>
              <label style={styles.label}>任务类型 *</label>
              <select
                style={styles.select}
                value={draft.taskType}
                onChange={(e) => set('taskType', e.target.value as TaskType)}
              >
                {TASK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>任务状态</label>
              <select
                style={styles.select}
                value={draft.state}
                onChange={(e) => set('state', e.target.value as TaskState)}
              >
                <option value="enabled">启用</option>
                <option value="disabled">禁用</option>
                <option value="paused">暂停</option>
              </select>
            </div>
          </div>

          <div style={styles.twoCol}>
            <div style={styles.field}>
              <label style={styles.label}>调度模式</label>
              <select
                style={styles.select}
                value={draft.scheduleMode}
                onChange={(e) => set('scheduleMode', e.target.value as ScheduleMode)}
              >
                {SCHEDULE_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...styles.field, flex: 2 }}>
              {draft.scheduleMode === 'cron' ? (
                <>
                  <label style={styles.label}>Cron 表达式（分 时 日 月 周）</label>
                  {/* 5 段可视化输入 */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {['分', '时', '日', '月', '周'].map((label, idx) => (
                      <div key={idx} style={{ flex: 1, minWidth: 0 }}>
                        <label style={{ fontSize: FontSizes.caption, color: Colors.textSecondary, display: 'block', marginBottom: '4px' }}>{label}</label>
                        <input
                          style={{ ...styles.input, padding: '6px 8px', fontSize: FontSizes.small }}
                          value={parseCron(draft.scheduleValue)[idx]}
                          onChange={(e) => {
                            const parts = parseCron(draft.scheduleValue);
                            parts[idx] = e.target.value.trim() || '*';
                            set('scheduleValue', parts.join(' '));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  {/* 预设选择 */}
                  <select
                    style={{ ...styles.select, fontSize: FontSizes.small, padding: '4px 8px' }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) set('scheduleValue', e.target.value);
                    }}
                  >
                    <option value="">选择预设...</option>
                    {CRON_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}（{p.value}）</option>
                    ))}
                  </select>
                  {/* 实时预览 */}
                  <div style={{ fontSize: FontSizes.small, color: Colors.textSecondary, marginTop: '6px' }}>
                    当前表达式：<span style={{ fontFamily: 'Consolas, monospace', color: Colors.textPrimary }}>{parseCron(draft.scheduleValue).join(' ')}</span>
                  </div>
                </>
              ) : (
                <>
                  <label style={styles.label}>
                    {draft.scheduleMode === 'interval' ? '间隔（秒）' : '调度值'}
                  </label>
                  <input
                    style={styles.input}
                    disabled={draft.scheduleMode === 'manual'}
                    value={draft.scheduleMode === 'manual' ? '-' : draft.scheduleValue}
                    onChange={(e) => set('scheduleValue', e.target.value)}
                    placeholder={draft.scheduleMode === 'interval' ? '例如 3600' : ''}
                  />
                </>
              )}
            </div>
          </div>

          {draft.taskType === 'sql' && (
            <div style={styles.field}>
              <label style={styles.label}>SQL *</label>
              <textarea
                style={{ ...styles.textarea, minHeight: '120px', fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                value={draft.sql}
                onChange={(e) => set('sql', e.target.value)}
                placeholder="SELECT * FROM my_table WHERE ..."
              />
            </div>
          )}

          {draft.taskType === 'refresh_chart' && (
            <div style={styles.field}>
              <label style={styles.label}>chartId *</label>
              <input
                style={styles.input}
                value={draft.chartId}
                onChange={(e) => set('chartId', e.target.value)}
                placeholder="图表 ID"
              />
            </div>
          )}

          {draft.taskType === 'refresh_dashboard' && (
            <div style={styles.field}>
              <label style={styles.label}>dashboardId *</label>
              <input
                style={styles.input}
                value={draft.dashboardId}
                onChange={(e) => set('dashboardId', e.target.value)}
                placeholder="仪表盘 ID"
              />
            </div>
          )}

          {draft.taskType === 'export_csv' && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>SQL *</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: '90px', fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                  value={draft.csvSql}
                  onChange={(e) => set('csvSql', e.target.value)}
                  placeholder="SELECT * FROM ..."
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>输出路径 *</label>
                <input
                  style={styles.input}
                  value={draft.csvOutputPath}
                  onChange={(e) => set('csvOutputPath', e.target.value)}
                  placeholder="/path/to/export.csv"
                />
              </div>
            </>
          )}

          <div style={styles.twoCol}>
            <div style={styles.field}>
              <label style={styles.label}>失败重试次数</label>
              <input
                style={styles.input}
                type="number"
                min={0}
                value={draft.retryOnFail}
                onChange={(e) => set('retryOnFail', parseInt(e.target.value || '0', 10))}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>超时（秒）</label>
              <input
                style={styles.input}
                type="number"
                min={1}
                value={draft.timeoutSecs}
                onChange={(e) => set('timeoutSecs', parseInt(e.target.value || '300', 10))}
              />
            </div>
          </div>

          {error && (
            <div style={styles.errorBox}>⚠️ {error}</div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={saving}>取消</button>
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving || !draft.name.trim()}>
            {saving ? '保存中...' : '保存'}
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
    background: Colors.background,
    borderRadius: BorderRadius.lg,
    width: '640px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    border: `1px solid ${Colors.border}`,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${Spacing.md} ${Spacing.lg}`,
    borderBottom: `1px solid ${Colors.border}`,
  },
  title: {
    margin: 0,
    fontSize: FontSizes.h1,
    fontWeight: 600,
    color: Colors.textPrimary,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: Colors.textSecondary,
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: Spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: Spacing.md,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: Spacing.xs,
    flex: 1,
  },
  twoCol: {
    display: 'flex',
    gap: Spacing.md,
  },
  label: {
    fontSize: FontSizes.small,
    fontWeight: 500,
    color: Colors.textPrimary,
  },
  input: {
    padding: `${Spacing.xs} ${Spacing.sm}`,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    fontSize: FontSizes.small,
    background: Colors.backgroundLight,
    color: Colors.textPrimary,
  },
  textarea: {
    padding: `${Spacing.xs} ${Spacing.sm}`,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    fontSize: FontSizes.small,
    background: Colors.backgroundLight,
    color: Colors.textPrimary,
    resize: 'vertical',
  },
  select: {
    padding: `${Spacing.xs} ${Spacing.sm}`,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    fontSize: FontSizes.small,
    background: Colors.backgroundLight,
    color: Colors.textPrimary,
  },
  errorBox: {
    padding: `${Spacing.sm} ${Spacing.md}`,
    backgroundColor: 'rgba(220,53,69,0.1)',
    border: `1px solid rgba(220,53,69,0.3)`,
    borderRadius: BorderRadius.md,
    color: Colors.danger,
    fontSize: FontSizes.small,
    fontWeight: 500,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    padding: `${Spacing.md} ${Spacing.lg}`,
    borderTop: `1px solid ${Colors.border}`,
  },
  cancelBtn: {
    padding: `${Spacing.xs} ${Spacing.lg}`,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    background: Colors.backgroundLight,
    cursor: 'pointer',
    fontSize: FontSizes.small,
    color: Colors.textPrimary,
  },
  saveBtn: {
    padding: `${Spacing.xs} ${Spacing.lg}`,
    border: 'none',
    borderRadius: BorderRadius.md,
    background: Colors.primary,
    color: '#fff',
    cursor: 'pointer',
    fontSize: FontSizes.small,
  },
};
