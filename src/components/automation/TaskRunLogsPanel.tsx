import React, { useState, useRef } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useTaskStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { computeVisibleRange } from '../../utils/virtual';
import type { Task, TaskRun, TaskRunStatus } from '../../types/automation';

const ITEM_HEIGHT = 44;
const OVERSCAN = 5;

interface TaskRunLogsPanelProps {
  task?: Task | null;
}

const formatDateTime = (ts: number): string => {
  const d = new Date(ts * 1000);
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatDuration = (ms: number | null): string => {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
};

/** 将任务执行记录数组导出为 CSV 文件并触发浏览器下载。
 *  字段：run_id, task_id, status, started_at, finished_at, duration_ms, error_message
 *  含逗号/引号/换行的字段按 RFC 4180 用双引号包裹，内部双引号转义为两个双引号。
 *  error_message 取自 run.output（失败时通常包含错误信息）。
 */
const exportRunsToCsv = (runs: TaskRun[]): void => {
  const headers = ['run_id', 'task_id', 'status', 'started_at', 'finished_at', 'duration_ms', 'error_message'];
  const rows = runs.map((run) => [
    run.id,
    run.taskId,
    run.status,
    run.startedAt ? formatDateTime(run.startedAt) : '',
    run.finishedAt ? formatDateTime(run.finishedAt) : '',
    run.durationMs !== null && run.durationMs !== undefined ? String(run.durationMs) : '',
    run.output ?? '',
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `task-runs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getStatusStyles = (status: TaskRunStatus): React.CSSProperties => {
  switch (status) {
    case 'success':
      return { background: Colors.primaryLight, color: Colors.primary };
    case 'failed':
      return { background: 'rgba(220,53,69,0.1)', color: Colors.danger };
    case 'running':
      return { background: 'rgba(247,181,81,0.15)', color: '#f7b251' };
    case 'skipped':
      return { background: 'rgba(102,102,102,0.1)', color: Colors.textSecondary };
    default:
      return { background: Colors.backgroundDark, color: Colors.textSecondary };
  }
};

const getStatusText = (t: (key: string) => string, status: TaskRunStatus): string => {
  switch (status) {
    case 'success': return t('task.runSuccess');
    case 'failed': return t('task.runFailed');
    case 'running': return t('task.runRunning');
    case 'skipped': return t('task.runSkipped');
    default: return status;
  }
};

const getTriggerText = (t: (key: string) => string, trigger: 'manual' | 'schedule'): string => (
  trigger === 'manual' ? t('task.triggerManual') : t('task.triggerSchedule')
);

/** 任务开关状态 → badge 样式/文案映射
 *  enabled  → success / 已启用
 *  disabled → skipped / 已禁用
 *  paused   → skipped / 已暂停（不再错误地显示为橙色 running）
 *  其他未知值 → skipped / [原始值]（保守处理，避免误报为"执行中"）
 */
const getTaskStateStyle = (state: string): React.CSSProperties => {
  switch (state) {
    case 'enabled':
      return { background: Colors.primaryLight, color: Colors.primary };
    case 'disabled':
    case 'paused':
      return { background: 'rgba(102,102,102,0.1)', color: Colors.textSecondary };
    default:
      return { background: 'rgba(102,102,102,0.1)', color: Colors.textSecondary };
  }
};
const getTaskStateText = (t: (key: string) => string, state: string): string => {
  switch (state) {
    case 'enabled': return t('task.statusEnabled');
    case 'disabled': return t('task.statusDisabled');
    case 'paused': return t('task.statusPaused');
    default: return state;
  }
};

export const TaskRunLogsPanel: React.FC<TaskRunLogsPanelProps> = ({ task }) => {
  const { t } = useLocale();
  const { taskRuns, selectedTaskId, loadTaskRuns } = useTaskStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  React.useEffect(() => {
    if (logContainerRef.current) {
      setViewportHeight(logContainerRef.current.clientHeight || 400);
    }
  }, [task?.id]);

  const range = computeVisibleRange(scrollTop, viewportHeight, ITEM_HEIGHT, taskRuns.length, OVERSCAN);
  const visibleRuns = taskRuns.slice(range.start, range.end);

  const handleRefresh = () => {
    if (selectedTaskId) {
      loadTaskRuns(selectedTaskId, 50);
    }
  };

  if (!task) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>{t('taskLogs.panelTitle')}</div>
        </div>
        <div style={styles.empty}>{t('taskLogs.selectTaskHint')}</div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>{t('taskLogs.detailTitle')}</div>
        <div style={{ display: 'flex', gap: Spacing.sm }}>
          <button
            style={{ ...styles.refreshBtn, opacity: taskRuns.length === 0 ? 0.5 : 1, cursor: taskRuns.length === 0 ? 'not-allowed' : 'pointer' }}
            onClick={() => exportRunsToCsv(taskRuns)}
            disabled={taskRuns.length === 0}
            title={taskRuns.length === 0 ? t('taskLogs.exportCsvDisabledHint') : t('task.exportCsv')}
          >
            📥 {t('task.exportCsv')}
          </button>
          <button style={styles.refreshBtn} onClick={handleRefresh}>🔄 {t('common.refresh')}</button>
        </div>
      </div>

      <div style={styles.detailSection}>
        <div style={styles.detailName}>{task.name}</div>
        {task.description && <div style={styles.detailDesc}>{task.description}</div>}
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.fieldType')}</div>
            <div style={styles.detailItemValue}>{task.taskType}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.fieldState')}</div>
            <div>
              <span style={{ ...styles.badge, ...getTaskStateStyle(task.state) }}>
                {getTaskStateText(t, task.state)}
              </span>
            </div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.fieldScheduleMode')}</div>
            <div style={styles.detailItemValue}>{task.scheduleMode}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.fieldScheduleValue')}</div>
            <div style={styles.detailItemValue}>{task.scheduleValue || '-'}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.totalRuns')}</div>
            <div style={styles.detailItemValue}>{task.totalRuns}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.success')}</div>
            <div style={{ ...styles.detailItemValue, color: Colors.success }}>{task.successRuns}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.failed')}</div>
            <div style={{ ...styles.detailItemValue, color: Colors.danger }}>{task.failedRuns}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>{t('taskLogs.fieldNextRun')}</div>
            <div style={styles.detailItemValue}>{task.nextRunAt ? formatDateTime(task.nextRunAt) : '-'}</div>
          </div>
        </div>
        <div style={styles.subTitle}>{t('taskLogs.executionRecords', { count: taskRuns.length })}</div>

        {taskRuns.length === 0 ? (
          <div style={styles.empty}>{t('taskLogs.noLogs')}</div>
        ) : (
          <div style={styles.logTable}>
            <div style={styles.logHeaderRow}>
              <div style={{ ...styles.logCell, flex: 1.4 }}>{t('taskLogs.fieldStartedAt')}</div>
              <div style={{ ...styles.logCell, flex: 0.8 }}>{t('taskLogs.fieldStatus')}</div>
              <div style={{ ...styles.logCell, flex: 0.8 }}>{t('taskLogs.fieldDuration')}</div>
              <div style={{ ...styles.logCell, flex: 1 }}>{t('taskLogs.fieldTrigger')}</div>
            </div>
            <div
              ref={(el) => {
                scrollContainerRef.current = el;
                logContainerRef.current = el;
              }}
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}
              onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            >
              <div style={{ height: range.totalHeight, position: 'relative' }}>
                {visibleRuns.map((run, idx) => (
                  <div
                    key={run.id}
                    style={{
                      position: 'absolute',
                      top: (range.start + idx) * ITEM_HEIGHT,
                      left: 0,
                      right: 0,
                      height: ITEM_HEIGHT,
                    }}
                  >
                    <div style={styles.logRowWrapper}>
                      <div
                        style={{
                          ...styles.logRow,
                          ...(expandedId === run.id ? styles.logRowExpanded : {}),
                        }}
                        onClick={() => setExpandedId((prev) => (prev === run.id ? null : run.id))}
                      >
                        <div style={{ ...styles.logCell, flex: 1.4 }}>{formatDateTime(run.startedAt)}</div>
                        <div style={{ ...styles.logCell, flex: 0.8 }}>
                          <span style={{ ...styles.badge, ...getStatusStyles(run.status) }}>
                            {getStatusText(t, run.status)}
                          </span>
                        </div>
                        <div style={{ ...styles.logCell, flex: 0.8 }}>{formatDuration(run.durationMs)}</div>
                        <div style={{ ...styles.logCell, flex: 1 }}>
                          <span style={{ fontSize: FontSizes.caption, color: Colors.textSecondary }}>
                            {getTriggerText(t, run.triggerType)}
                          </span>
                        </div>
                      </div>
                      {expandedId === run.id && run.output && (
                        <div style={styles.outputPreview}>
                          <div style={styles.outputLabel}>{t('taskLogs.fieldOutput')}</div>
                          <pre style={styles.outputContent}>{run.output}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '100%',
    height: '100%',
    borderLeft: `1px solid ${Colors.border}`,
    background: Colors.background,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: '300px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${Spacing.md} ${Spacing.lg}`,
    borderBottom: `1px solid ${Colors.border}`,
  },
  headerTitle: {
    fontSize: FontSizes.h2,
    fontWeight: 600,
    color: Colors.textPrimary,
  },
  refreshBtn: {
    padding: `${Spacing.xs} ${Spacing.md}`,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    background: Colors.backgroundLight,
    color: Colors.textPrimary,
    cursor: 'pointer',
    fontSize: FontSizes.small,
  },
  detailSection: {
    flex: 1,
    padding: Spacing.lg,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: Spacing.md,
    minHeight: 0,
  },
  detailName: {
    fontSize: FontSizes.h1,
    fontWeight: 600,
    color: Colors.textPrimary,
  },
  detailDesc: {
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
    lineHeight: 1.5,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: Spacing.md,
    background: Colors.backgroundLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  detailItemLabel: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
  },
  detailItemValue: {
    fontSize: FontSizes.small,
    color: Colors.textPrimary,
    fontWeight: 500,
    wordBreak: 'break-word',
  },
  subTitle: {
    fontSize: FontSizes.small,
    fontWeight: 600,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  logTable: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  logHeaderRow: {
    display: 'flex',
    background: Colors.backgroundDark,
    borderBottom: `1px solid ${Colors.border}`,
  },
  logRowWrapper: {
    borderBottom: `1px solid ${Colors.borderLight}`,
  },
  logRow: {
    display: 'flex',
    alignItems: 'center',
    padding: `${Spacing.sm} ${Spacing.md}`,
    cursor: 'pointer',
    background: Colors.background,
    transition: 'background 0.15s',
  },
  logRowExpanded: {
    background: Colors.backgroundLight,
  },
  logCell: {
    fontSize: FontSizes.caption,
    color: Colors.textPrimary,
  },
  badge: {
    display: 'inline-block',
    padding: `${Spacing.xs} ${Spacing.sm}`,
    borderRadius: BorderRadius.sm,
    fontSize: FontSizes.caption,
    fontWeight: 500,
  },
  outputPreview: {
    background: Colors.backgroundDark,
    padding: Spacing.md,
    borderTop: `1px solid ${Colors.borderLight}`,
  },
  outputLabel: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: 500,
  },
  outputContent: {
    margin: 0,
    padding: Spacing.sm,
    background: Colors.background,
    border: `1px solid ${Colors.border}`,
    borderRadius: BorderRadius.sm,
    fontSize: FontSizes.caption,
    color: Colors.textPrimary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '240px',
    overflow: 'auto',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  },
  empty: {
    padding: Spacing.xl,
    textAlign: 'center',
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
    background: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
  },
};
