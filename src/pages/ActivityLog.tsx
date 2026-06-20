import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../AppWrapper';
import { ChevronLeftIcon } from '../components/common/Icons';
import { tauriService } from '../services';
import type { AuditLogItem, AuditLogModule, AuditLogStatus } from '../types';
import './Settings.css';

const MODULE_OPTIONS: { value: AuditLogModule | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'sql', label: 'SQL' },
  { value: 'import', label: '导入' },
  { value: 'project', label: '项目' },
  { value: 'settings', label: '设置' },
  { value: 'trash', label: '回收站' },
  { value: 'chart', label: '图表' },
];

const STATUS_OPTIONS: { value: AuditLogStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
];

const MODULE_LABELS: Record<AuditLogModule, string> = {
  sql: 'SQL',
  import: '导入',
  project: '项目',
  settings: '设置',
  trash: '回收站',
  chart: '图表',
};

const formatTimestamp = (ts: string): string => {
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return ts;
  }
};

const ActivityLog: React.FC = () => {
  const { goToWorkspace } = useAppContext();

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [moduleFilter, setModuleFilter] = useState<AuditLogModule | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AuditLogStatus | 'all'>('all');
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tauriService.getAuditLogs({
        module: moduleFilter === 'all' ? null : moduleFilter,
        status: statusFilter === 'all' ? null : statusFilter,
        limit: 500,
      });
      if (response.success && response.data) {
        setItems(response.data.items || []);
        setTotal(response.data.total ?? (response.data.items?.length || 0));
      } else {
        setItems([]);
        setTotal(0);
      }

      const countResp = await tauriService.countAuditLogs();
      if (countResp.success && countResp.data !== undefined) {
        setTotal(countResp.data);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      showToast('没有可导出的记录', 'error');
      return;
    }
    const headers = ['时间', '模块', '操作', '描述', '状态', '耗时(ms)', '详情'];
    const rows = items.map((it) => [
      it.timestamp,
      MODULE_LABELS[it.module] || it.module,
      it.action,
      it.description,
      it.status,
      String(it.duration_ms ?? ''),
      it.details ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('导出成功');
  };

  const handleCleanup = async () => {
    setConfirmCleanup(false);
    const resp = await tauriService.cleanupExpiredAuditLogs(retentionDays);
    if (resp.success) {
      showToast(`已清理 ${resp.data} 条过期日志`);
      fetchLogs();
    } else {
      showToast(resp.error || '清理失败', 'error');
    }
  };

  const handleClearAll = async () => {
    setConfirmClear(false);
    const resp = await tauriService.clearAllAuditLogs();
    if (resp.success) {
      showToast('已清空所有日志');
      fetchLogs();
    } else {
      showToast(resp.error || '清空失败', 'error');
    }
  };

  const visibleItems = useMemo(() => items, [items]);

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <div className="settings-header">
          <button className="back-button" onClick={goToWorkspace} title="Back">
            <ChevronLeftIcon size={16} />
            <span>← 返回</span>
          </button>
          <h2>🕓 活动记录</h2>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            共 {total} 条日志
          </div>
        </div>
      </div>

      <div className="settings-content">
        {error && (
          <div className="settings-error">
            <p>{error}</p>
            <button onClick={() => setError(null)}>关闭</button>
          </div>
        )}

        {toast && (
          <div className={`settings-toast ${toast.type}`}>{toast.msg}</div>
        )}

        <div className="settings-category-title">活动记录</div>

        <div className="settings-category-content" style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <label style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              模块：
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value as AuditLogModule | 'all')}
                className="setting-select"
                style={{ marginLeft: 6, width: 130 }}
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              状态：
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AuditLogStatus | 'all')}
                className="setting-select"
                style={{ marginLeft: 6, width: 120 }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <div style={{ flex: 1 }} />

            <button className="export-button" onClick={fetchLogs} disabled={loading}>
              🔄 刷新
            </button>
            <button className="export-button" onClick={handleExportCSV}>
              📥 导出CSV
            </button>

            {confirmCleanup ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>保留天数：</span>
                <input
                  type="number"
                  min={1}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Math.max(1, Number(e.target.value) || 1))}
                  className="setting-input"
                  style={{ width: 70 }}
                />
                <button className="reset-all-button" onClick={handleCleanup} style={{ padding: '8px 12px' }}>
                  确认清理
                </button>
                <button className="reset-button" onClick={() => setConfirmCleanup(false)} style={{ padding: '8px 12px' }}>
                  取消
                </button>
              </div>
            ) : (
              <button className="reset-button" onClick={() => setConfirmCleanup(true)}>
                🧹 清理过期日志
              </button>
            )}

            {confirmClear ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="reset-all-button" onClick={handleClearAll} style={{ padding: '8px 12px' }}>
                  确认清空
                </button>
                <button className="reset-button" onClick={() => setConfirmClear(false)} style={{ padding: '8px 12px' }}>
                  取消
                </button>
              </div>
            ) : (
              <button className="reset-all-button" onClick={() => setConfirmClear(true)}>
                🗑 清空全部
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'var(--bg-tertiary)' }}>
                <tr>
                  <th style={thStyle}>时间</th>
                  <th style={thStyle}>模块</th>
                  <th style={thStyle}>操作</th>
                  <th style={thStyle}>描述</th>
                  <th style={thStyle}>状态</th>
                  <th style={thStyle}>耗时</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td style={tdStyleCenter} colSpan={6}>加载中...</td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td style={tdStyleCenter} colSpan={6}>暂无记录</td>
                  </tr>
                ) : (
                  visibleItems.map((item) => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border-primary)' }}>
                      <td style={tdStyle}>{formatTimestamp(item.timestamp)}</td>
                      <td style={tdStyle}>{MODULE_LABELS[item.module] || item.module}</td>
                      <td style={tdStyle}>{item.action}</td>
                      <td style={tdStyle} title={item.details || undefined}>
                        {item.description}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 12,
                            background: item.status === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                            color: item.status === 'success' ? 'var(--success)' : 'var(--error)',
                          }}
                        >
                          {item.status === 'success' ? '成功' : '失败'}
                        </span>
                      </td>
                      <td style={tdStyle}>{item.duration_ms ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  color: 'var(--text-primary)',
  fontWeight: 500,
  fontSize: 13,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: 'var(--text-primary)',
  verticalAlign: 'top',
};

const tdStyleCenter: React.CSSProperties = {
  padding: '30px 12px',
  textAlign: 'center',
  color: 'var(--text-tertiary)',
};

export default ActivityLog;
