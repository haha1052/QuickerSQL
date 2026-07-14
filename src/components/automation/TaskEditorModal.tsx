import React, { useState, useEffect, useMemo } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useTaskStore, useToastStore, useSettingsStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import type {
  Task,
  TaskType,
  ScheduleMode,
  TaskState,
  CreateTaskPayload,
  UpdateTaskPayload,
  SqlTaskPayload,
  RefreshChartPayload,
  RefreshDashboardPayload,
  ExportCsvPayload,
  DependencyType,
  TimeIntervalConfig,
  CronConfig,
  TaskSuccessConfig,
  TaskCompletedConfig,
  DependencyConfig,
} from '../../types/automation';
import { parseDependencyConfig, serializeDependencyConfig } from '../../types/automation';

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

interface DraftDependency {
  id?: string;
  dependencyType: DependencyType;
  dependencyConfig: string;
}

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'sql', label: 'SQL 执行' },
  { value: 'refresh_chart', label: '刷新图表' },
  { value: 'refresh_dashboard', label: '刷新仪表盘' },
  { value: 'export_csv', label: '导出 CSV' },
];

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

const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  time_interval: '时间间隔',
  cron: 'Cron 表达式',
  task_success: '前置任务成功',
  task_completed: '前置任务完成',
};

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

const migrateScheduleToDeps = (scheduleMode: ScheduleMode, scheduleValue: string): DraftDependency[] => {
  if (scheduleMode === 'manual' || !scheduleValue) {
    return [];
  }
  if (scheduleMode === 'interval') {
    const config: TimeIntervalConfig = { intervalSeconds: parseInt(scheduleValue, 10) || 3600 };
    return [{ dependencyType: 'time_interval', dependencyConfig: serializeDependencyConfig(config) }];
  }
  if (scheduleMode === 'cron') {
    const config: CronConfig = { expression: scheduleValue || '0 * * * *', timezone: 'local' };
    return [{ dependencyType: 'cron', dependencyConfig: serializeDependencyConfig(config) }];
  }
  return [];
};

const getDependencyDescription = (dep: DraftDependency, allTasks: Task[]): string => {
  const config = parseDependencyConfig(dep.dependencyConfig);
  if (!config) return '无效配置';
  switch (dep.dependencyType) {
    case 'time_interval': {
      const c = config as TimeIntervalConfig;
      return `每 ${c.intervalSeconds} 秒`;
    }
    case 'cron': {
      const c = config as CronConfig;
      return c.expression;
    }
    case 'task_success': {
      const c = config as TaskSuccessConfig;
      const task = allTasks.find((t) => t.id === c.upstreamTaskId);
      const taskName = task ? task.name : c.upstreamTaskId;
      const delay = c.delaySeconds && c.delaySeconds > 0 ? `（延迟 ${c.delaySeconds} 秒）` : '';
      return `${taskName} 成功后${delay}`;
    }
    case 'task_completed': {
      const c = config as TaskCompletedConfig;
      const task = allTasks.find((t) => t.id === c.upstreamTaskId);
      const taskName = task ? task.name : c.upstreamTaskId;
      const delay = c.delaySeconds && c.delaySeconds > 0 ? `（延迟 ${c.delaySeconds} 秒）` : '';
      return `${taskName} 完成后${delay}`;
    }
  }
};

const getScheduleFromDeps = (
  deps: DraftDependency[],
): { scheduleMode: ScheduleMode; scheduleValue: string } => {
  const timeDep = deps.find((d) => d.dependencyType === 'time_interval');
  if (timeDep) {
    const config = parseDependencyConfig(timeDep.dependencyConfig) as TimeIntervalConfig | null;
    if (config) {
      return { scheduleMode: 'interval', scheduleValue: String(config.intervalSeconds) };
    }
  }
  const cronDep = deps.find((d) => d.dependencyType === 'cron');
  if (cronDep) {
    const config = parseDependencyConfig(cronDep.dependencyConfig) as CronConfig | null;
    if (config) {
      return { scheduleMode: 'cron', scheduleValue: config.expression };
    }
  }
  return { scheduleMode: 'manual', scheduleValue: '' };
};

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({
  open,
  task,
  onClose,
  initialTaskType,
  initialPayload,
  initialName,
}) => {
  const { createTask, updateTask, loadTasks, dependencies, loadDependencies, replaceDependencies } =
    useTaskStore();
  const { addToast } = useToastStore();
  const { t } = useLocale();
  const [draft, setDraft] = useState<DraftState>(
    getInitialDraft(task, initialTaskType, initialPayload, initialName),
  );
  const [deps, setDeps] = useState<DraftDependency[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDepForm, setShowDepForm] = useState(false);
  const [editingDepIndex, setEditingDepIndex] = useState<number | null>(null);
  const [depFormType, setDepFormType] = useState<DependencyType>('time_interval');
  const [depFormConfig, setDepFormConfig] = useState<DependencyConfig | null>(null);

  const allTasks = useTaskStore((s) => s.tasks);
  const isEdit = Boolean(task);

  const availableTasks = useMemo(() => {
    if (!task) return allTasks;
    return allTasks.filter((t) => t.id !== task.id);
  }, [allTasks, task]);

  useEffect(() => {
    if (open) {
      setDraft(getInitialDraft(task, initialTaskType, initialPayload, initialName));
      setError(null);
      setSaving(false);
      setShowDepForm(false);
      setEditingDepIndex(null);
      if (task) {
        const cachedDeps = dependencies[task.id];
        if (cachedDeps && cachedDeps.length > 0) {
          setDeps(
            cachedDeps.map((d) => ({
              id: d.id,
              dependencyType: d.dependencyType,
              dependencyConfig: d.dependencyConfig,
            })),
          );
        } else {
          loadDependencies(task.id).then(() => {
            const currentDeps = useTaskStore.getState().dependencies[task.id];
            if (currentDeps && currentDeps.length > 0) {
              setDeps(
                currentDeps.map((d) => ({
                  id: d.id,
                  dependencyType: d.dependencyType,
                  dependencyConfig: d.dependencyConfig,
                })),
              );
            } else {
              setDeps(migrateScheduleToDeps(task.scheduleMode, task.scheduleValue));
            }
          });
        }
      } else {
        setDeps([]);
      }
    }
  }, [open, task, initialTaskType, initialPayload, initialName]);

  if (!open) return null;

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const openAddDepForm = (type: DependencyType) => {
    setDepFormType(type);
    setEditingDepIndex(null);
    let initialConfig: DependencyConfig;
    switch (type) {
      case 'time_interval':
        initialConfig = { intervalSeconds: 3600 };
        break;
      case 'cron':
        initialConfig = { expression: '0 * * * *', timezone: 'local' };
        break;
      case 'task_success':
        initialConfig = { upstreamTaskId: availableTasks[0]?.id || '', delaySeconds: 0 };
        break;
      case 'task_completed':
        initialConfig = { upstreamTaskId: availableTasks[0]?.id || '', delaySeconds: 0 };
        break;
    }
    setDepFormConfig(initialConfig);
    setShowDepForm(true);
  };

  const openEditDepForm = (index: number) => {
    const dep = deps[index];
    const config = parseDependencyConfig(dep.dependencyConfig);
    if (!config) return;
    setDepFormType(dep.dependencyType);
    setEditingDepIndex(index);
    setDepFormConfig(config);
    setShowDepForm(true);
  };

  const closeDepForm = () => {
    setShowDepForm(false);
    setEditingDepIndex(null);
    setDepFormConfig(null);
  };

  const saveDepForm = () => {
    if (!depFormConfig) return;
    const newDep: DraftDependency = {
      dependencyType: depFormType,
      dependencyConfig: serializeDependencyConfig(depFormConfig),
    };
    if (editingDepIndex !== null) {
      const newDeps = [...deps];
      newDeps[editingDepIndex] = { ...newDep, id: deps[editingDepIndex].id };
      setDeps(newDeps);
    } else {
      setDeps([...deps, newDep]);
    }
    closeDepForm();
  };

  const deleteDep = (index: number) => {
    setDeps(deps.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    if (!draft.name.trim()) return '请输入任务名称';
    if (!['sql', 'refresh_chart', 'refresh_dashboard', 'export_csv'].includes(draft.taskType)) {
      return '请选择任务类型';
    }
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      const config = parseDependencyConfig(dep.dependencyConfig);
      if (!config) return `第 ${i + 1} 个触发条件配置无效`;
      if (dep.dependencyType === 'time_interval') {
        const c = config as TimeIntervalConfig;
        if (!c.intervalSeconds || c.intervalSeconds <= 0) {
          return `第 ${i + 1} 个触发条件：间隔秒数必须大于 0`;
        }
      }
      if (dep.dependencyType === 'cron') {
        const c = config as CronConfig;
        if (!c.expression || !c.expression.trim()) {
          return `第 ${i + 1} 个触发条件：Cron 表达式不能为空`;
        }
      }
      if (dep.dependencyType === 'task_success' || dep.dependencyType === 'task_completed') {
        const c = config as TaskSuccessConfig;
        if (!c.upstreamTaskId) {
          return `第 ${i + 1} 个触发条件：请选择前置任务`;
        }
      }
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
      const { scheduleMode, scheduleValue } = getScheduleFromDeps(deps);
      const payloadString = buildPayloadString(draft.taskType, draft);
      if (isEdit && task) {
        const patch: UpdateTaskPayload = {
          name: draft.name.trim(),
          description: draft.description.trim(),
          payload: payloadString,
          scheduleMode,
          scheduleValue: scheduleMode === 'manual' ? '' : scheduleValue,
          state: draft.state,
        };
        await updateTask(task.id, patch);
        await replaceDependencies(
          task.id,
          deps.map((d) => ({
            dependencyType: d.dependencyType,
            dependencyConfig: d.dependencyConfig,
          })),
        );
        addToast('任务已更新', 'success');
      } else {
        const create: CreateTaskPayload = {
          name: draft.name.trim(),
          description: draft.description.trim(),
          taskType: draft.taskType,
          payload: payloadString,
          scheduleMode,
          scheduleValue: scheduleMode === 'manual' ? '' : scheduleValue,
          state: draft.state,
          retryOnFail: draft.retryOnFail,
          timeoutSecs: draft.timeoutSecs,
        };
        const created = await createTask(create);
        if (created && deps.length > 0) {
          await replaceDependencies(
            created.id,
            deps.map((d) => ({
              dependencyType: d.dependencyType,
              dependencyConfig: d.dependencyConfig,
            })),
          );
        }
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
          <button style={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.field}>
            <label style={styles.label}>任务名称 *</label>
            <input
              style={styles.input}
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('task.namePlaceholder')}
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
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
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

          <div style={styles.dependencySection}>
            <div style={styles.dependencyHeader}>
              <label style={styles.label}>触发条件</label>
            </div>
            <div style={styles.dependencyList}>
              {deps.length === 0 ? (
                <div style={styles.emptyDeps}>暂无触发条件（任务仅手动触发）</div>
              ) : (
                deps.map((dep, index) => (
                  <div key={index} style={styles.depItem}>
                    <div style={styles.depItemLeft}>
                      <span style={styles.depTypeTag}>
                        {DEPENDENCY_TYPE_LABELS[dep.dependencyType]}
                      </span>
                      <span style={styles.depDesc}>
                        {getDependencyDescription(dep, allTasks)}
                      </span>
                    </div>
                    <div style={styles.depItemActions}>
                      <button
                        style={styles.iconBtn}
                        onClick={() => openEditDepForm(index)}
                        title="编辑"
                      >
                        ✎
                      </button>
                      <button
                        style={styles.iconBtn}
                        onClick={() => deleteDep(index)}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={styles.addDepBtnRow}>
              <div style={styles.addDepBtnGroup}>
                <button style={styles.addDepBtn} onClick={() => openAddDepForm('time_interval')}>
                  + 时间间隔
                </button>
                <button style={styles.addDepBtn} onClick={() => openAddDepForm('cron')}>
                  + Cron 表达式
                </button>
                <button style={styles.addDepBtn} onClick={() => openAddDepForm('task_success')}>
                  + 前置任务成功
                </button>
                <button style={styles.addDepBtn} onClick={() => openAddDepForm('task_completed')}>
                  + 前置任务完成
                </button>
              </div>
            </div>
          </div>

          {draft.taskType === 'sql' && (
            <div style={styles.field}>
              <label style={styles.label}>SQL *</label>
              <textarea
                style={{
                  ...styles.textarea,
                  minHeight: '120px',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                }}
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
                placeholder={t('task.chartId')}
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
                  style={{
                    ...styles.textarea,
                    minHeight: '90px',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  }}
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

          {error && <div style={styles.errorBox}>⚠️ {error}</div>}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button
            style={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {showDepForm && (
          <div style={styles.overlay} onClick={closeDepForm}>
            <div style={styles.depFormModal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.header}>
                <h3 style={styles.title}>
                  {editingDepIndex !== null ? '编辑触发条件' : '添加触发条件'}
                </h3>
                <button style={styles.closeBtn} onClick={closeDepForm}>
                  ×
                </button>
              </div>
              <div style={styles.body}>
                <div style={styles.field}>
                  <label style={styles.label}>类型</label>
                  <select
                    style={styles.select}
                    value={depFormType}
                    onChange={(e) => {
                      const type = e.target.value as DependencyType;
                      openAddDepForm(type);
                    }}
                    disabled={editingDepIndex !== null}
                  >
                    {(Object.keys(DEPENDENCY_TYPE_LABELS) as DependencyType[]).map((key) => (
                      <option key={key} value={key}>
                        {DEPENDENCY_TYPE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>

                {depFormType === 'time_interval' && depFormConfig && (
                  <div style={styles.field}>
                    <label style={styles.label}>间隔时间</label>
                    <div style={{ display: 'flex', gap: Spacing.sm }}>
                      <input
                        style={{ ...styles.input, flex: 1 }}
                        type="number"
                        min={1}
                        value={
                          (depFormConfig as TimeIntervalConfig).intervalSeconds
                        }
                        onChange={(e) => {
                          const val = parseInt(e.target.value || '0', 10);
                          setDepFormConfig({
                            intervalSeconds: Math.max(1, val || 1),
                          } as TimeIntervalConfig);
                        }}
                      />
                      <select
                        style={styles.select}
                        value="秒"
                        disabled
                      >
                        <option value="秒">秒</option>
                      </select>
                    </div>
                    <div style={styles.quickIntervalRow}>
                      {[
                        { label: '1 分钟', secs: 60 },
                        { label: '5 分钟', secs: 300 },
                        { label: '1 小时', secs: 3600 },
                        { label: '1 天', secs: 86400 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          style={styles.quickBtn}
                          onClick={() => {
                            setDepFormConfig({
                              intervalSeconds: p.secs,
                            } as TimeIntervalConfig);
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {depFormType === 'cron' && depFormConfig && (
                  <>
                    <div style={styles.field}>
                      <label style={styles.label}>Cron 表达式（分 时 日 月 周）</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        {['分', '时', '日', '月', '周'].map((label, idx) => (
                          <div key={idx} style={{ flex: 1, minWidth: 0 }}>
                            <label
                              style={{
                                fontSize: FontSizes.caption,
                                color: Colors.textSecondary,
                                display: 'block',
                                marginBottom: '4px',
                              }}
                            >
                              {label}
                            </label>
                            <input
                              style={{
                                ...styles.input,
                                padding: '6px 8px',
                                fontSize: FontSizes.small,
                              }}
                              value={
                                parseCron((depFormConfig as CronConfig).expression)[
                                  idx
                                ]
                              }
                              onChange={(e) => {
                                const parts = parseCron(
                                  (depFormConfig as CronConfig).expression,
                                );
                                parts[idx] = e.target.value.trim() || '*';
                                setDepFormConfig({
                                  ...(depFormConfig as CronConfig),
                                  expression: parts.join(' '),
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <select
                        style={{
                          ...styles.select,
                          fontSize: FontSizes.small,
                          padding: '4px 8px',
                        }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setDepFormConfig({
                              ...(depFormConfig as CronConfig),
                              expression: e.target.value,
                            });
                          }
                        }}
                      >
                        <option value="">选择预设...</option>
                        {CRON_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}（{p.value}）
                          </option>
                        ))}
                      </select>
                      <div
                        style={{
                          fontSize: FontSizes.small,
                          color: Colors.textSecondary,
                          marginTop: '6px',
                        }}
                      >
                        当前表达式：
                        <span
                          style={{
                            fontFamily: 'Consolas, monospace',
                            color: Colors.textPrimary,
                          }}
                        >
                          {parseCron((depFormConfig as CronConfig).expression).join(' ')}
                        </span>
                      </div>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>时区</label>
                      <select
                        style={styles.select}
                        value={(depFormConfig as CronConfig).timezone || 'local'}
                        onChange={(e) => {
                          setDepFormConfig({
                            ...(depFormConfig as CronConfig),
                            timezone: e.target.value,
                          });
                        }}
                      >
                        <option value="local">本地时区</option>
                        <option value="UTC">UTC</option>
                        <option value="Asia/Shanghai">Asia/Shanghai</option>
                        <option value="America/New_York">America/New_York</option>
                        <option value="Europe/London">Europe/London</option>
                      </select>
                    </div>
                  </>
                )}

                {(depFormType === 'task_success' || depFormType === 'task_completed') &&
                  depFormConfig && (
                    <>
                      <div style={styles.field}>
                        <label style={styles.label}>前置任务</label>
                        <select
                          style={styles.select}
                          value={
                            (depFormConfig as TaskSuccessConfig | TaskCompletedConfig)
                              .upstreamTaskId
                          }
                          onChange={(e) => {
                            setDepFormConfig({
                              ...(depFormConfig as
                                | TaskSuccessConfig
                                | TaskCompletedConfig),
                              upstreamTaskId: e.target.value,
                            });
                          }}
                        >
                          {availableTasks.length === 0 && (
                            <option value="">暂无可用任务</option>
                          )}
                          {availableTasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>延迟秒数（可选）</label>
                        <input
                          style={styles.input}
                          type="number"
                          min={0}
                          value={
                            (depFormConfig as TaskSuccessConfig | TaskCompletedConfig)
                              .delaySeconds || 0
                          }
                          onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10);
                            setDepFormConfig({
                              ...(depFormConfig as
                                | TaskSuccessConfig
                                | TaskCompletedConfig),
                              delaySeconds: Math.max(0, val || 0),
                            });
                          }}
                        />
                      </div>
                    </>
                  )}
              </div>
              <div style={styles.footer}>
                <button style={styles.cancelBtn} onClick={closeDepForm}>
                  取消
                </button>
                <button style={styles.saveBtn} onClick={saveDepForm}>
                  确定
                </button>
              </div>
            </div>
          </div>
        )}
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
  depFormModal: {
    background: Colors.background,
    borderRadius: BorderRadius.lg,
    width: '480px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    border: `1px solid ${Colors.border}`,
    zIndex: 1100,
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
  dependencySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: Spacing.sm,
    padding: Spacing.md,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    background: Colors.backgroundLight,
  },
  dependencyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dependencyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  emptyDeps: {
    padding: Spacing.md,
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSizes.small,
    border: `1px dashed ${Colors.border}`,
    borderRadius: BorderRadius.md,
  },
  depItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${Spacing.sm} ${Spacing.md}`,
    background: Colors.background,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
  },
  depItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  depTypeTag: {
    padding: '2px 8px',
    background: Colors.primaryLight,
    color: Colors.primary,
    borderRadius: BorderRadius.sm,
    fontSize: FontSizes.caption,
    fontWeight: 500,
    flexShrink: 0,
  },
  depDesc: {
    fontSize: FontSizes.small,
    color: Colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  depItemActions: {
    display: 'flex',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  iconBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.sm,
    background: Colors.backgroundLight,
    cursor: 'pointer',
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
  },
  addDepBtnRow: {
    marginTop: Spacing.xs,
  },
  addDepBtnGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  addDepBtn: {
    padding: `${Spacing.xs} ${Spacing.sm}`,
    border: `1px dashed ${Colors.border}`,
    borderRadius: BorderRadius.md,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
  },
  quickIntervalRow: {
    display: 'flex',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  quickBtn: {
    padding: '2px 8px',
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.sm,
    background: Colors.background,
    cursor: 'pointer',
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
  },
};
