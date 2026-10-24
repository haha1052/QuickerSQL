import type React from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../../styles/design-system';
import { useSettingsStore } from '../../../store';
import type {
  Task,
  TaskType,
  ScheduleMode,
  TaskState,
  SqlTaskPayload,
  RefreshChartPayload,
  RefreshDashboardPayload,
  ExportCsvPayload,
  DependencyType,
  TimeIntervalConfig,
  CronConfig,
  TaskSuccessConfig,
  TaskCompletedConfig,
} from '../../../types/automation';
import { parseDependencyConfig, serializeDependencyConfig } from '../../../types/automation';

/** 父组件持有的表单状态（拆分后由父组件管理，子表单通过 props 读写） */
export interface DraftState {
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

/** 触发条件草稿（编辑态，可能尚未持久化） */
export interface DraftDependency {
  id?: string;
  dependencyType: DependencyType;
  dependencyConfig: string;
}

/** 从外部传入的初始 payload（新建任务时预填） */
export interface InitialPayload {
  sql?: string;
  chartId?: string;
  dashboardId?: string;
  csvSql?: string;
  csvOutputPath?: string;
}

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'sql', label: 'automation.taskType.sql' },
  { value: 'refresh_chart', label: 'automation.taskType.refreshChart' },
  { value: 'refresh_dashboard', label: 'automation.taskType.refreshDashboard' },
  { value: 'export_csv', label: 'automation.taskType.exportCsv' },
];

export const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'automation.cron.everyMinute', value: '* * * * *' },
  { label: 'automation.cron.every5Minutes', value: '*/5 * * * *' },
  { label: 'automation.cron.hourly', value: '0 * * * *' },
  { label: 'automation.cron.dailyMidnight', value: '0 0 * * *' },
  { label: 'automation.cron.daily9am', value: '0 9 * * *' },
  { label: 'automation.cron.weekday9am', value: '0 9 * * 1-5' },
  { label: 'automation.cron.monday9am', value: '0 9 * * 1' },
  { label: 'automation.cron.monthly1stMidnight', value: '0 0 1 * *' },
];

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  time_interval: 'automation.dependency.timeInterval',
  cron: 'automation.dependency.cron',
  task_success: 'automation.dependency.taskSuccess',
  task_completed: 'automation.dependency.taskCompleted',
};

/** 读取自动化默认设置（失败重试次数、超时秒数） */
export const readAutomationDefaults = (): { retryOnFail: number; timeoutSecs: number } => {
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

/** 将 cron 表达式拆分为 5 段（不足补 *） */
export const parseCron = (expr: string): string[] => {
  const parts = expr.trim().split(/\s+/);
  const result = ['*', '*', '*', '*', '*'];
  for (let i = 0; i < Math.min(5, parts.length); i++) result[i] = parts[i];
  return result;
};

/** 从已有任务的 payload 字符串中解析出表单字段 */
export const parseInnerPayload = (task: Task | null | undefined): Partial<DraftState> => {
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

/** 将表单状态序列化为 payload JSON 字符串 */
export const buildPayloadString = (taskType: TaskType, draft: DraftState): string => {
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

/** 根据任务/初始参数构造初始表单草稿 */
export const getInitialDraft = (
  task?: Task | null,
  initialTaskType?: TaskType,
  initialPayload?: InitialPayload,
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

/** 将旧的 scheduleMode/scheduleValue 迁移为触发条件草稿列表 */
export const migrateScheduleToDeps = (scheduleMode: ScheduleMode, scheduleValue: string): DraftDependency[] => {
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

/** 生成触发条件的人类可读描述 */
export const getDependencyDescription = (dep: DraftDependency, allTasks: Task[]): string => {
  const config = parseDependencyConfig(dep.dependencyConfig);
  if (!config) return '无效配置'; // i18n:skip 动态描述文案，LocaleContext 无对应 key
  switch (dep.dependencyType) {
    case 'time_interval': {
      const c = config as TimeIntervalConfig;
      return `每 ${c.intervalSeconds} 秒`; // i18n:skip 动态描述文案，LocaleContext 无对应 key
    }
    case 'cron': {
      const c = config as CronConfig;
      return c.expression;
    }
    case 'task_success': {
      const c = config as TaskSuccessConfig;
      const task = allTasks.find((t) => t.id === c.upstreamTaskId);
      const taskName = task ? task.name : c.upstreamTaskId;
      const delay = c.delaySeconds && c.delaySeconds > 0 ? `（延迟 ${c.delaySeconds} 秒）` : ''; // i18n:skip 动态描述文案，LocaleContext 无对应 key
      return `${taskName} 成功后${delay}`; // i18n:skip 动态描述文案，LocaleContext 无对应 key
    }
    case 'task_completed': {
      const c = config as TaskCompletedConfig;
      const task = allTasks.find((t) => t.id === c.upstreamTaskId);
      const taskName = task ? task.name : c.upstreamTaskId;
      const delay = c.delaySeconds && c.delaySeconds > 0 ? `（延迟 ${c.delaySeconds} 秒）` : ''; // i18n:skip 动态描述文案，LocaleContext 无对应 key
      return `${taskName} 完成后${delay}`; // i18n:skip 动态描述文案，LocaleContext 无对应 key
    }
  }
};

/** 从触发条件列表反推出 scheduleMode/scheduleValue */
export const getScheduleFromDeps = (
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

/** 表单与模态框共享样式（原样从 TaskEditorModal 迁移，保持视觉一致） */
export const formStyles: Record<string, React.CSSProperties> = {
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
