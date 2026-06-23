import React, { useState, useEffect, useMemo } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useTaskStore, useToastStore } from '../../store';
import { useStartupContext } from '../../AppWrapper';
import { TaskEditorModal } from './TaskEditorModal';
import { TaskRunLogsPanel } from './TaskRunLogsPanel';
import type { Task, TaskType, TaskState, TaskRunStatus } from '../../types/automation';

const formatDateTime = (ts: number | null): string => {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getTaskTypeBadge = (t: TaskType): React.ReactNode => {
  const map: Record<TaskType, React.CSSProperties> = {
    sql: { background: 'rgba(0,123,255,0.12)', color: Colors.primary },
    refresh_chart: { background: 'rgba(23,162,184,0.12)', color: Colors.info },
    refresh_dashboard: { background: 'rgba(255,193,7,0.15)', color: '#b7860b' },
    export_csv: { background: 'rgba(40,167,69,0.12)', color: Colors.success },
  };
  const label: Record<TaskType, string> = {
    sql: 'SQL 执行',
    refresh_chart: '刷新图表',
    refresh_dashboard: '刷新仪表盘',
    export_csv: '导出 CSV',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: `${Spacing.xs} ${Spacing.sm}`,
      borderRadius: BorderRadius.sm,
      fontSize: FontSizes.caption,
      fontWeight: 500,
      ...map[t],
    }}>{label[t] || t}</span>
  );
};

const getStateBadge = (state: TaskState): React.ReactNode => {
  const map: Record<TaskState, React.CSSProperties> = {
    enabled: { background: 'rgba(40,167,69,0.15)', color: Colors.success },
    disabled: { background: 'rgba(102,102,102,0.15)', color: Colors.textSecondary },
    paused: { background: 'rgba(253,126,20,0.15)', color: Colors.warning },
  };
  const label: Record<TaskState, string> = {
    enabled: '运行中',
    disabled: '已禁用',
    paused: '已暂停',
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

const getRunStatusBadge = (status: TaskRunStatus | undefined | null): React.ReactNode => {
  if (!status) return <span style={{ color: Colors.textSecondary, fontSize: FontSizes.caption }}>-</span>;
  const map: Record<TaskRunStatus, React.CSSProperties> = {
    success: { background: 'rgba(40,167,69,0.15)', color: Colors.success },
    failed: { background: 'rgba(220,53,69,0.15)', color: Colors.danger },
    running: { background: 'rgba(253,126,20,0.15)', color: Colors.warning },
    skipped: { background: 'rgba(102,102,102,0.15)', color: Colors.textSecondary },
  };
  const label: Record<TaskRunStatus, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    skipped: '跳过',
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

const getScheduleSummary = (task: Task): string => {
  if (task.scheduleMode === 'interval') {
    const v = parseInt(task.scheduleValue, 10);
    if (v >= 86400) return `间隔 ${(v / 86400).toFixed(1)} 天`;
    if (v >= 3600) return `间隔 ${(v / 3600).toFixed(1)} 小时`;
    if (v >= 60) return `间隔 ${(v / 60).toFixed(1)} 分钟`;
    return `间隔 ${v} 秒`;
  }
  if (task.scheduleMode === 'cron') return `Cron: ${task.scheduleValue}`;
  return '仅手动触发';
};

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
  } = useTaskStore();

  const { addToast } = useToastStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  const openCreate = () => {
    setEditingTask(null);
    setEditorOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditorOpen(true);
  };

  const handleToggleState = async (task: Task) => {
    try {
      if (task.state === 'enabled') {
        await disableTask(task.id);
        addToast(`任务已禁用：${task.name}`, 'success');
      } else {
        await enableTask(task.id);
        addToast(`任务已启用：${task.name}`, 'success');
      }
    } catch (e) {
      addToast(`操作失败：${String(e)}`, 'error');
    }
  };

  const handleRunNow = async (task: Task) => {
    try {
      await runTaskNow(task.id);
      addToast(`任务已运行：${task.name}`, 'success');
    } catch (e) {
      addToast(`任务执行失败：${String(e)}`, 'error');
    }
  };

  const handleDelete = (task: Task) => {
    if (!confirm(`确认删除任务 "${task.name}" 吗？此操作不可恢复。`)) return;
    deleteTask(task.id).then((ok) => {
      if (ok) addToast('任务已删除', 'success');
    });
  };

  const applySearch = () => {
    setKeyword(searchInput.trim());
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      background: Colors.background,
      overflow: 'hidden',
    },
    leftPanel: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: Spacing.lg,
      gap: Spacing.md,
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
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <div style={styles.topBar}>
          <h1 style={styles.pageTitle}>自动化任务</h1>
          <div style={styles.statsRow}>
            <div style={{ ...styles.statCard, borderLeft: `3px solid ${Colors.primary}` }}>
              <div style={styles.statLabel}>任务总数</div>
              <div style={styles.statValue}>{stats.total}</div>
            </div>
            <div style={{ ...styles.statCard, borderLeft: `3px solid ${Colors.success}` }}>
              <div style={styles.statLabel}>已启用</div>
              <div style={styles.statValue}>{stats.enabledCount}</div>
            </div>
            <div style={{ ...styles.statCard, borderLeft: `3px solid ${Colors.danger}` }}>
              <div style={styles.statLabel}>异常任务</div>
              <div style={styles.statValue}>{stats.failedTasksCount}</div>
            </div>
          </div>
          <div style={styles.actionRow}>
            <div style={styles.searchBox}>
              <input
                style={styles.searchInput}
                placeholder="搜索任务名称..."
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
                <option value="all">所有状态</option>
                <option value="enabled">运行中</option>
                <option value="disabled">已禁用</option>
                <option value="paused">已暂停</option>
              </select>
              <select
                style={styles.select}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">所有类型</option>
                <option value="sql">SQL 执行</option>
                <option value="refresh_chart">刷新图表</option>
                <option value="refresh_dashboard">刷新仪表盘</option>
                <option value="export_csv">导出 CSV</option>
              </select>
              <select
                style={styles.select}
                value="all"
                onChange={() => {}}
                title="调度模式筛选"
              >
                <option value="all">所有调度</option>
                <option value="manual">手动触发</option>
                <option value="interval">间隔调度</option>
                <option value="cron">Cron 调度</option>
              </select>
            </div>
            <button style={styles.primaryBtn} onClick={openCreate}>+ 新建任务</button>
          </div>
        </div>

        <div style={styles.tableContainer}>
          {loading && tasks.length === 0 ? (
            <div style={styles.empty}>加载中...</div>
          ) : tasks.length === 0 ? (
            <div style={styles.empty}>暂无任务。点击"新建任务"开始。</div>
          ) : (
            <>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>名称</th>
                  <th style={styles.th}>类型</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>调度</th>
                  <th style={styles.th}>上次运行</th>
                  <th style={styles.th}>下次运行</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>操作</th>
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
                    <td style={styles.td}>{getTaskTypeBadge(task.taskType)}</td>
                    <td style={styles.td}>{getStateBadge(task.state)}</td>
                    <td style={{ ...styles.td, fontSize: FontSizes.small, color: Colors.textSecondary }}>
                      {getScheduleSummary(task)}
                    </td>
                    <td style={{ ...styles.td, fontSize: FontSizes.small }}>
                      <div>{formatDateTime(task.lastRunAt)}</div>
                      <div style={{ marginTop: '2px' }}>{getRunStatusBadge(task.lastRunStatus)}</div>
                    </td>
                    <td style={{ ...styles.td, fontSize: FontSizes.small, color: Colors.textSecondary }}>
                      {formatDateTime(task.nextRunAt)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={styles.actionBtns}>
                        <button
                          style={styles.iconBtn}
                          title={task.state === 'enabled' ? '禁用' : '启用'}
                          onClick={() => handleToggleState(task)}
                        >
                          {task.state === 'enabled' ? '⏸' : '▶'}
                        </button>
                        <button
                          style={styles.iconBtn}
                          title="立即运行"
                          onClick={() => handleRunNow(task)}
                        >
                          ⚡
                        </button>
                        <button
                          style={styles.iconBtn}
                          title="编辑"
                          onClick={() => openEdit(task)}
                        >
                          ✏️
                        </button>
                        <button
                          style={{ ...styles.iconBtn, color: Colors.danger }}
                          title="删除"
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
                  共 <b style={{ color: Colors.textPrimary }}>{tasks.length}</b> 个任务
                  ，第 <b style={{ color: Colors.textPrimary }}>{safeCurrentPage}</b>/{totalPages} 页
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
                  >上一页</button>
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
                    {PAGE_SIZE_OPTIONS.map((n) => (<option key={n} value={n}>{n} 条/页</option>))}
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
                  >下一页</button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      <TaskRunLogsPanel task={selectedTask} />

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
