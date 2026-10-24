import React, { useState, useEffect, useMemo } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useTaskStore, useToastStore } from '../../store';
import { useStartupContext } from '../../AppWrapper';
import { useLocale } from '../../context/LocaleContext';
import { TaskEditorModal } from './TaskEditorModal';
import { TaskRunLogsPanel } from './TaskRunLogsPanel';
import type { Task, TaskType, TaskState, TaskRunStatus } from '../../types/automation';

/**
 * 将 Unix 时间戳（秒）格式化为 yyyy-MM-dd HH:mm 字符串
 * @param ts - Unix 时间戳（秒），为 null 时返回 '-'
 * @returns 格式化后的日期字符串
 */
const formatDateTime = (ts: number | null): string => {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * 渲染任务类型徽章（SQL / 刷新图表 / 刷新仪表盘 / 导出 CSV）
 * @param t - i18n 翻译函数
 * @param taskType - 任务类型
 * @returns 带颜色背景的徽章 ReactNode
 */
const getTaskTypeBadge = (t: (key: string) => string, taskType: TaskType): React.ReactNode => {
  const map: Record<TaskType, React.CSSProperties> = {
    sql: { background: 'rgba(0,123,255,0.12)', color: Colors.primary },
    refresh_chart: { background: 'rgba(23,162,184,0.12)', color: Colors.info },
    refresh_dashboard: { background: 'rgba(255,193,7,0.15)', color: '#b7860b' },
    export_csv: { background: 'rgba(40,167,69,0.12)', color: Colors.success },
  };
  const label: Record<TaskType, string> = {
    sql: t('task.typeSQL'),
    refresh_chart: t('task.actionRefreshChart'),
    refresh_dashboard: t('task.actionRefreshDashboard'),
    export_csv: t('task.typeExportCSV'),
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: `${Spacing.xs} ${Spacing.sm}`,
      borderRadius: BorderRadius.sm,
      fontSize: FontSizes.caption,
      fontWeight: 500,
      ...map[taskType],
    }}>{label[taskType] || taskType}</span>
  );
};

/**
 * 渲染任务状态徽章（enabled / disabled / paused）
 * @param t - i18n 翻译函数
 * @param state - 任务状态
 * @returns 带颜色背景的徽章 ReactNode
 */
const getStateBadge = (t: (key: string) => string, state: TaskState): React.ReactNode => {
  const map: Record<TaskState, React.CSSProperties> = {
    enabled: { background: 'rgba(40,167,69,0.15)', color: Colors.success },
    disabled: { background: 'rgba(102,102,102,0.15)', color: Colors.textSecondary },
    paused: { background: 'rgba(253,126,20,0.15)', color: Colors.warning },
  };
  const label: Record<TaskState, string> = {
    enabled: t('task.statusEnabled'),
    disabled: t('task.statusDisabled'),
    paused: t('task.statusPaused'),
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: `${Spacing.xs} ${Spacing.sm}`,
      borderRadius: BorderRadius.sm,
      fontSize: FontSizes.caption,
      fontWeight: 500,
      ...map[state],
    }}>{label[state] || state}</span>
  );
};

/**
 * 渲染任务最近一次运行状态徽章（success / failed / running / skipped）
 * @param t - i18n 翻译函数
 * @param status - 运行状态；为 null/undefined 时返回 '-'
 * @returns 带颜色背景的徽章 ReactNode
 */
const getRunStatusBadge = (t: (key: string) => string, status: TaskRunStatus | undefined | null): React.ReactNode => {
  if (!status) return <span style={{ color: Colors.textSecondary, fontSize: FontSizes.caption }}>-</span>;
  const map: Record<TaskRunStatus, React.CSSProperties> = {
    success: { background: 'rgba(40,167,69,0.15)', color: Colors.success },
    failed: { background: 'rgba(220,53,69,0.15)', color: Colors.danger },
    running: { background: 'rgba(253,126,20,0.15)', color: Colors.warning },
    skipped: { background: 'rgba(102,102,102,0.15)', color: Colors.textSecondary },
  };
  const label: Record<TaskRunStatus, string> = {
    success: t('task.runSuccess'),
    failed: t('task.runFailed'),
    running: t('task.runRunning'),
    skipped: t('task.runSkipped'),
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: `${Spacing.xs} ${Spacing.sm}`,
      borderRadius: BorderRadius.sm,
      fontSize: FontSizes.caption,
      fontWeight: 500,
      ...map[status],
    }}>{label[status]}</span>
  );
};

/**
 * 根据任务的调度模式生成可读摘要
 * - interval：按秒数转换为天/小时/分钟/秒描述
 * - cron：直接展示 cron 表达式
 * - 其他：返回"仅手动执行"
 *
 * @param t - i18n 翻译函数，支持 vars 参数
 * @param task - 任务对象
 * @returns 调度摘要字符串
 */
const getScheduleSummary = (t: (key: string, vars?: Record<string, string | number>) => string, task: Task): string => {
  if (task.scheduleMode === 'interval') {
    const v = parseInt(task.scheduleValue, 10);
    if (v >= 86400) return t('task.scheduleIntervalDays', { value: (v / 86400).toFixed(1) });
    if (v >= 3600) return t('task.scheduleIntervalHours', { value: (v / 3600).toFixed(1) });
    if (v >= 60) return t('task.scheduleIntervalMinutes', { value: (v / 60).toFixed(1) });
    return t('task.scheduleIntervalSeconds', { value: v });
  }
  if (task.scheduleMode === 'cron') return t('task.scheduleCron', { value: task.scheduleValue });
  return t('task.scheduleManualOnly');
};

/**
 * 任务中心页面组件
 *
 * 职责：
 * - 左右分栏布局：左侧为任务列表（统计卡片 + 筛选 + 表格 + 分页），右侧为 TaskRunLogsPanel
 * - 支持按状态、类型、调度模式筛选；按名称/描述搜索；按更新时间/名称排序
 * - 分页展示（默认每页 20 条，可切换 10/20/50/100），支持上一页/下一页
 * - 行操作：启用/禁用切换、立即运行、编辑、删除（带 confirm）
 * - 顶部「新建任务」按钮打开 TaskEditorModal
 * - 中间分隔条可拖拽调整左右栏宽度（限制 30%-70%）
 *
 * 副作用：
 * - 启动时优先消费 StartupContext 中的 tasks 缓存
 * - 启动后每 30 秒后台调用 loadTasks 刷新
 * - 拖拽时为 document 注册 mousemove/mouseup 监听
 */
export const TaskCenterPage: React.FC = () => {
  const {
    tasks,
    selectedTaskId,
    stats,
    loading,
    filterState,
    filterType,
    selectTask,
    enableTask,
    disableTask,
    runTaskNow,
    deleteTask,
    setFilterState,
    setFilterType,
    setKeyword,
    loadTasks,
  } = useTaskStore();

  const { addToast } = useToastStore();
  const { t } = useLocale();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(55); // 百分比
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const container = document.querySelector('[data-task-center-container]');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setLeftPanelWidth(Math.min(Math.max(newWidth, 30), 70)); // 限制在 30%-70%
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // v3 启动优化：优先消费 StartupContext 中的缓存数据，避免独立 IPC
  // 仅在首屏渲染后按需刷新时才执行 IPC
  const { startupData, isStartupLoaded } = useStartupContext();
  useEffect(() => {
    if (!isStartupLoaded || !startupData) return;
    const store = useTaskStore.getState();
    if (startupData.tasks.length > 0) {
      store.setTasksFromStartup(startupData.tasks);
    } else {
      // 空数据库场景：直接设空，不发 IPC
      store.setTasksFromStartup([]);
    }
    // 30 秒后仍在本页面则后台刷新（非启动关键路径）
    const timer = setInterval(() => { store.loadTasks(); }, 30000);
    return () => clearInterval(timer);
  }, [isStartupLoaded, startupData?.tasks?.length]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedTasks = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  }, [tasks, safeCurrentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tasks.length, pageSize]);

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditorOpen(true);
  };

  const handleToggleState = async (task: Task) => {
    try {
      if (task.state === 'enabled') {
        await disableTask(task.id);
        addToast(t('task.toastDisabled', { name: task.name }), 'success');
      } else {
        await enableTask(task.id);
        addToast(t('task.toastEnabled', { name: task.name }), 'success');
      }
    } catch (e) {
      addToast(t('task.toastOperationFailed', { error: String(e) }), 'error');
    }
  };

  const handleRunNow = async (task: Task) => {
    try {
      await runTaskNow(task.id);
      addToast(t('task.toastRunStarted', { name: task.name }), 'success');
    } catch (e) {
      addToast(t('task.toastRunFailed', { error: String(e) }), 'error');
    }
  };

  const handleDelete = (task: Task) => {
    if (!confirm(t('task.confirmDelete', { name: task.name }))) return;
    deleteTask(task.id).then((ok) => {
      if (ok) addToast(t('task.toastDeleted'), 'success');
    });
  };

  const applySearch = () => {
    setKeyword(searchInput.trim());
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setEditorOpen(true);
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      background: Colors.background,
      overflow: 'hidden',
      minHeight: 0,
    },
    leftPanel: {
      width: `${leftPanelWidth}%`,
      minWidth: '30%',
      maxWidth: '70%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: Spacing.lg,
      gap: Spacing.md,
      boxSizing: 'border-box',
    },
    resizeHandle: {
      width: '6px',
      cursor: 'col-resize',
      background: Colors.border,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
      '&:hover': {
        background: Colors.borderLight,
      },
    } as React.CSSProperties,
    resizeHandleActive: {
      background: Colors.primary,
    },
    topBar: {
      display: 'flex',
      flexDirection: 'column',
      gap: Spacing.md,
    },
    pageTitle: {
      fontSize: FontSizes.h1,
      fontWeight: 600,
      color: Colors.textPrimary,
      margin: 0,
    },
    statsRow: {
      display: 'flex',
      gap: Spacing.md,
      flexWrap: 'wrap',
    },
    statCard: {
      flex: 1,
      minWidth: '140px',
      background: Colors.background,
      border: `1px solid ${Colors.border}`,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
    },
    statLabel: {
      fontSize: FontSizes.small,
      color: Colors.textSecondary,
      marginBottom: Spacing.xs,
    },
    statValue: {
      fontSize: '28px',
      fontWeight: 600,
      color: Colors.textPrimary,
      lineHeight: 1.2,
    },
    actionRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      flexWrap: 'wrap',
    },
    searchBox: {
      display: 'flex',
      gap: Spacing.sm,
      alignItems: 'center',
      flex: 1,
      minWidth: '200px',
    },
    searchInput: {
      flex: 1,
      padding: `${Spacing.sm} ${Spacing.md}`,
      fontSize: FontSizes.small,
      border: `1px solid ${Colors.border}`,
      borderRadius: BorderRadius.sm,
      background: Colors.background,
      color: Colors.textPrimary,
      outline: 'none',
    },
    select: {
      padding: `${Spacing.sm} ${Spacing.md}`,
      fontSize: FontSizes.small,
      border: `1px solid ${Colors.border}`,
      borderRadius: BorderRadius.sm,
      background: Colors.background,
      color: Colors.textPrimary,
      cursor: 'pointer',
    },
    primaryBtn: {
      padding: `${Spacing.sm} ${Spacing.md}`,
      background: Colors.primary,
      color: '#fff',
      border: 'none',
      borderRadius: BorderRadius.sm,
      fontSize: FontSizes.small,
      cursor: 'pointer',
      fontWeight: 500,
    },
    secondaryBtn: {
      padding: `${Spacing.sm} ${Spacing.md}`,
      background: Colors.background,
      color: Colors.textPrimary,
      border: `1px solid ${Colors.border}`,
      borderRadius: BorderRadius.sm,
      fontSize: FontSizes.small,
      cursor: 'pointer',
    },
    tableContainer: {
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      background: Colors.backgroundLight,
      border: `1px solid ${Colors.border}`,
      borderRadius: BorderRadius.md,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    tableHeader: {
      background: 'rgba(0,123,255,0.04)',
      position: 'sticky',
      top: 0,
      zIndex: 1,
    },
    th: {
      padding: `${Spacing.sm} ${Spacing.md}`,
      textAlign: 'left',
      fontSize: FontSizes.small,
      fontWeight: 500,
      color: Colors.textSecondary,
      borderBottom: `1px solid ${Colors.border}`,
      whiteSpace: 'nowrap',
    },
    tableRow: {
      borderBottom: `1px solid ${Colors.border}`,
      cursor: 'pointer',
      transition: 'background 0.15s',
    },
    td: {
      padding: `${Spacing.sm} ${Spacing.md}`,
      fontSize: FontSizes.small,
      color: Colors.textPrimary,
      verticalAlign: 'middle',
    },
    taskName: {
      fontWeight: 500,
      fontSize: FontSizes.body,
      color: Colors.textPrimary,
      marginBottom: Spacing.xs,
    },
    taskDesc: {
      fontSize: FontSizes.small,
      color: Colors.textSecondary,
      marginTop: '2px',
    },
    actionBtns: {
      display: 'flex',
      gap: Spacing.sm,
      justifyContent: 'center',
    },
    iconBtn: {
      padding: `${Spacing.xs} ${Spacing.sm}`,
      fontSize: FontSizes.small,
      border: `1px solid ${Colors.border}`,
      background: Colors.background,
      borderRadius: BorderRadius.sm,
      color: Colors.textPrimary,
      cursor: 'pointer',
    },
    empty: {
      padding: Spacing.xl,
      textAlign: 'center',
      color: Colors.textSecondary,
      fontSize: FontSizes.small,
    },
  };

  return (
    <div style={styles.container} data-task-center-container>
      <div style={styles.leftPanel}>
        <div style={styles.topBar}>
          <h1 style={styles.pageTitle}>{t('task.pageTitle')}</h1>
          <div style={styles.statsRow}>
            <div style={{ ...styles.statCard, borderLeft: `3px solid ${Colors.primary}` }}>
              <div style={styles.statLabel}>{t('task.statTotal')}</div>
              <div style={styles.statValue}>{stats.total}</div>
            </div>
            <div style={{ ...styles.statCard, borderLeft: `3px solid ${Colors.success}` }}>
              <div style={styles.statLabel}>{t('task.statEnabled')}</div>
              <div style={styles.statValue}>{stats.enabledCount}</div>
            </div>
            <div style={{ ...styles.statCard, borderLeft: `3px solid ${Colors.danger}` }}>
              <div style={styles.statLabel}>{t('task.statFailed')}</div>
              <div style={styles.statValue}>{stats.failedTasksCount}</div>
            </div>
          </div>
          <div style={styles.actionRow}>
            <div style={styles.searchBox}>
              <input
                style={styles.searchInput}
                placeholder={t('task.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
              />
              <select
                style={styles.select}
                value={filterState}
                onChange={(e) => setFilterState(e.target.value as TaskState | 'all')}
              >
                <option value="all">{t('task.filterAllStates')}</option>
                <option value="enabled">{t('task.filterStateRunning')}</option>
                <option value="disabled">{t('task.filterStateDisabled')}</option>
                <option value="paused">{t('task.filterStatePaused')}</option>
              </select>
              <select
                style={styles.select}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">{t('task.filterAllTypes')}</option>
                <option value="sql">{t('task.typeSQL')}</option>
                <option value="refresh_chart">{t('task.actionRefreshChart')}</option>
                <option value="refresh_dashboard">{t('task.actionRefreshDashboard')}</option>
                <option value="export_csv">{t('task.typeExportCSV')}</option>
              </select>
              <select
                style={styles.select}
                value="all"
                onChange={() => {}}
                title={t('task.scheduleModeFilter')}
              >
                <option value="all">{t('task.filterAllSchedules')}</option>
                <option value="manual">{t('task.filterScheduleManual')}</option>
                <option value="interval">{t('task.filterScheduleInterval')}</option>
                <option value="cron">{t('task.filterScheduleCron')}</option>
              </select>
              <button
                style={styles.secondaryBtn}
                onClick={() => loadTasks()}
                title={t('automation.refreshTaskList')}
                disabled={loading}
              >
                🔄 刷新
              </button>
              <button
                style={styles.primaryBtn}
                onClick={handleCreateTask}
                title={t('automation.newTask')}
              >
                + 新建任务
              </button>
            </div>
          </div>
        </div>

        <div style={styles.tableContainer}>
          {loading && tasks.length === 0 ? (
            <div style={styles.empty}>{t('common.loading')}</div>
          ) : tasks.length === 0 ? (
            <div style={styles.empty}>{t('task.emptyHint')}</div>
          ) : (
            <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>{t('task.thName')}</th>
                  <th style={styles.th}>{t('task.thType')}</th>
                  <th style={styles.th}>{t('task.thState')}</th>
                  <th style={styles.th}>{t('task.thSchedule')}</th>
                  <th style={styles.th}>{t('task.thLastRun')}</th>
                  <th style={styles.th}>{t('task.thNextRun')}</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>{t('task.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedTasks.map((task) => (
                  <tr
                    key={task.id}
                    style={{
                      ...styles.tableRow,
                      ...(selectedTaskId === task.id ? { background: 'rgba(0,123,255,0.06)' } : {}),
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = Colors.backgroundLight; }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        selectedTaskId === task.id ? 'rgba(0,123,255,0.06)' : '';
                    }}
                    onClick={() => selectTask(task.id)}
                  >
                    <td style={{ ...styles.td, cursor: 'pointer' }}>
                      <div style={styles.taskName}>{task.name}</div>
                      {task.description && (
                        <div style={styles.taskDesc}>{task.description}</div>
                      )}
                    </td>
                    <td style={styles.td}>{getTaskTypeBadge(t, task.taskType)}</td>
                    <td style={styles.td}>{getStateBadge(t, task.state)}</td>
                    <td style={{ ...styles.td, fontSize: FontSizes.small, color: Colors.textSecondary }}>
                      {getScheduleSummary(t, task)}
                    </td>
                    <td style={{ ...styles.td, fontSize: FontSizes.small }}>
                      <div>{formatDateTime(task.lastRunAt)}</div>
                      <div style={{ marginTop: '2px' }}>{getRunStatusBadge(t, task.lastRunStatus)}</div>
                    </td>
                    <td style={{ ...styles.td, fontSize: FontSizes.small, color: Colors.textSecondary }}>
                      {formatDateTime(task.nextRunAt)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={styles.actionBtns}>
                        <button
                          style={styles.iconBtn}
                          title={task.state === 'enabled' ? t('task.btnDisable') : t('task.btnEnable')}
                          onClick={() => handleToggleState(task)}
                        >
                          {task.state === 'enabled' ? '⏸' : '▶'}
                        </button>
                        <button
                          style={styles.iconBtn}
                          title={t('common.runNow')}
                          onClick={() => handleRunNow(task)}
                        >
                          ⚡
                        </button>
                        <button
                          style={styles.iconBtn}
                          title={t('common.edit')}
                          onClick={() => openEdit(task)}
                        >
                          ✏️
                        </button>
                        <button
                          style={{ ...styles.iconBtn, color: Colors.danger }}
                          title={t('common.delete')}
                          onClick={() => handleDelete(task)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {tasks.length > pageSize && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: `${Spacing.md} ${Spacing.lg}`,
                borderTop: `1px solid ${Colors.border}`,
                fontSize: FontSizes.small,
                color: Colors.textSecondary,
              }}>
                <div>
                  {t('task.paginationInfoPrefix')}
                  <b style={{ color: Colors.textPrimary }}>{tasks.length}</b>
                  {t('task.paginationInfoMiddle')}
                  <b style={{ color: Colors.textPrimary }}>{safeCurrentPage}</b>
                  /<b style={{ color: Colors.textPrimary }}>{totalPages}</b>
                  {t('task.paginationInfoSuffix')}
                </div>
                <div style={{ display: 'flex', gap: Spacing.sm, alignItems: 'center' }}>
                  <button
                    style={{
                      padding: `${Spacing.xs} ${Spacing.md}`,
                      border: `1px solid ${Colors.border}`,
                      background: Colors.background,
                      borderRadius: BorderRadius.sm,
                      cursor: safeCurrentPage > 1 ? 'pointer' : 'not-allowed',
                      color: safeCurrentPage > 1 ? Colors.textPrimary : Colors.textSecondary,
                      opacity: safeCurrentPage > 1 ? 1 : 0.5,
                    }}
                    onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                    disabled={safeCurrentPage <= 1}
                  >{t('task.prevPage')}</button>
                  <select
                    style={{
                      padding: `${Spacing.xs} ${Spacing.sm}`,
                      border: `1px solid ${Colors.border}`,
                      background: Colors.background,
                      borderRadius: BorderRadius.sm,
                      color: Colors.textPrimary,
                    }}
                    value={pageSize}
                    onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (<option key={n} value={n}>{t('task.pageSizeOption', { size: n })}</option>))}
                  </select>
                  <button
                    style={{
                      padding: `${Spacing.xs} ${Spacing.md}`,
                      border: `1px solid ${Colors.border}`,
                      background: Colors.background,
                      borderRadius: BorderRadius.sm,
                      cursor: safeCurrentPage < totalPages ? 'pointer' : 'not-allowed',
                      color: safeCurrentPage < totalPages ? Colors.textPrimary : Colors.textSecondary,
                      opacity: safeCurrentPage < totalPages ? 1 : 0.5,
                    }}
                    onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                    disabled={safeCurrentPage >= totalPages}
                  >{t('task.nextPage')}</button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      <div
        style={{
          width: '6px',
          cursor: 'col-resize',
          background: Colors.border,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        onMouseDown={() => setIsDragging(true)}
      >
        <div style={{ width: '4px', height: '20px', background: Colors.textSecondary, borderRadius: '2px', opacity: isDragging ? 1 : 0.5 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '300px', minHeight: 0, overflow: 'hidden' }}>
        <TaskRunLogsPanel task={selectedTask} />
      </div>

      <TaskEditorModal
        open={editorOpen}
        task={editingTask}
        onClose={() => {
          setEditorOpen(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
};
