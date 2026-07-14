import React, { useState, useRef } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useTaskStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { computeVisibleRange } from '../../utils/virtual';
import type { Task, TaskRunStatus } from '../../types/automation';

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
    case 'success': return '成功';
    case 'failed': return '失败';
    case 'running': return t('task.running');
    case 'skipped': return '跳过';
    default: return status;
  }
};

const getTriggerText = (t: 'manual' | 'schedule'): string => (t === 'manual' ? '手动触发' : '定时触发');

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
const getTaskStateText = (state: string): string => {
  switch (state) {
    case 'enabled': return '已启用';
    case 'disabled': return '已禁用';
    case 'paused': return '已暂停';
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
          <div style={styles.headerTitle}>运行日志</div>
        </div>
        <div style={styles.empty}>{t('taskLogs.selectTaskHint')}</div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>任务详情 · 运行日志</div>
        <button style={styles.refreshBtn} onClick={handleRefresh}>🔄 刷新</button>
      </div>

      <div style={styles.detailSection}>
        <div style={styles.detailName}>{task.name}</div>
        {task.description && <div style={styles.detailDesc}>{task.description}</div>}
        <div style={styles.detailGrid}>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>类型</div>
            <div style={styles.detailItemValue}>{task.taskType}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>状态</div>
            <div>
              <span style={{ ...styles.badge, ...getTaskStateStyle(task.state) }}>
                {getTaskStateText(task.state)}
              </span>
            </div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>调度模式</div>
            <div style={styles.detailItemValue}>{task.scheduleMode}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>调度值</div>
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
            <div style={styles.detailItemLabel}>下次运行</div>
            <div style={styles.detailItemValue}>{task.nextRunAt ? formatDateTime(task.nextRunAt) : '-'}</div>
          </div>
        </div>
        <div style={styles.subTitle}>执行记录（{taskRuns.length}）</div>

        {taskRuns.length === 0 ? (
          <div style={styles.empty}>{t('taskLogs.noLogs')}</div>
        ) : (
          <div style={styles.logTable}>
            <div style={styles.logHeaderRow}>
              <div style={{ ...styles.logCell, flex: 1.4 }}>开始时间</div>
              <div style={{ ...styles.logCell, flex: 0.8 }}>状态</div>
              <div style={{ ...styles.logCell, flex: 0.8 }}>耗时</div>
              <div style={{ ...styles.logCell, flex: 1 }}>触发</div>
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
                            {getTriggerText(run.triggerType)}
                          </span>
                        </div>
                      </div>
                      {expandedId === run.id && run.output && (
                        <div style={styles.outputPreview}>
                          <div style={styles.outputLabel}>输出</div>
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
