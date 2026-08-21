import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../AppWrapper';
import { ChevronLeftIcon } from '../components/common/Icons';
import { useLocale } from '../context/LocaleContext';
import { tauriService } from '../services';
import type { AuditLogItem, AuditLogModule, AuditLogStatus } from '../types';
import './Settings.css';

/** 审计日志模块 → i18n 标签映射（用于 CSV 导出与表格渲染）。
 *  SQL 是技术术语，保留原文不翻译。
 */
const getModuleLabel = (t: (key: string) => string, module: AuditLogModule): string => {
  switch (module) {
    case 'sql': return 'SQL';
    case 'import': return t('activityLog.moduleImport');
    case 'project': return t('activityLog.moduleProject');
    case 'settings': return t('activityLog.moduleSettings');
    case 'trash': return t('activityLog.moduleTrash');
    case 'chart': return t('activityLog.moduleChart');
    default: return module;
  }
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
  const { t } = useLocale();

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

  const moduleOptions: { value: AuditLogModule | 'all'; label: string }[] = [
    { value: 'all', label: t('filter.all') },
    { value: 'sql', label: 'SQL' },
    { value: 'import', label: t('activityLog.moduleImport') },
    { value: 'project', label: t('activityLog.moduleProject') },
    { value: 'settings', label: t('activityLog.moduleSettings') },
    { value: 'trash', label: t('activityLog.moduleTrash') },
    { value: 'chart', label: t('activityLog.moduleChart') },
  ];

  const statusOptions: { value: AuditLogStatus | 'all'; label: string }[] = [
    { value: 'all', label: t('filter.all') },
    { value: 'success', label: t('common.success') },
    { value: 'failed', label: t('activityLog.statusFailed') },
  ];

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
      showToast(t('activityLog.noExportRecords'), 'error');
      return;
    }
    const headers = [
      t('activityLog.csvHeaderTime'),
      t('activityLog.csvHeaderModule'),
      t('activityLog.csvHeaderAction'),
      t('activityLog.csvHeaderDescription'),
      t('activityLog.csvHeaderStatus'),
      t('activityLog.csvHeaderDuration'),
      t('activityLog.csvHeaderDetails'),
    ];
    const rows = items.map((it) => [
      it.timestamp,
      getModuleLabel(t, it.module),
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
    showToast(t('activityLog.exportSuccess'));
  };

  const handleCleanup = async () => {
    setConfirmCleanup(false);
    const resp = await tauriService.cleanupExpiredAuditLogs(retentionDays);
    if (resp.success) {
      showToast(t('activityLog.cleanupResult', { count: resp.data ?? 0 }));
      fetchLogs();
    } else {
      showToast(resp.error || t('activityLog.cleanupFailed'), 'error');
    }
  };

  const handleClearAll = async () => {
    setConfirmClear(false);
    const resp = await tauriService.clearAllAuditLogs();
    if (resp.success) {
      showToast(t('activityLog.clearAllSuccess'));
      fetchLogs();
    } else {
      showToast(resp.error || t('activityLog.clearAllFailed'), 'error');
    }
  };

  const visibleItems = useMemo(() => items, [items]);

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <div className="settings-header">
          <button className="back-button" onClick={goToWorkspace} title="Back">
            <ChevronLeftIcon size={16} />
            <span>← {t('common.back')}</span>
          </button>
          <h2>{t('activityLog.pageTitle')}</h2>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            {t('activityLog.totalCount', { count: total })}
          </div>
        </div>
      </div>

      <div className="settings-content">
        {error && (
          <div className="settings-error">
            <p>{error}</p>
            <button onClick={() => setError(null)}>{t('activityLog.close')}</button>
          </div>
        )}

        {toast && (
          <div className={`settings-toast ${toast.type}`}>{toast.msg}</div>
        )}

        <div className="settings-category-title">{t('activityLog.categoryTitle')}</div>

        <div className="settings-category-content" style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <label style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('activityLog.moduleLabel')}
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value as AuditLogModule | 'all')}
                className="setting-select"
                style={{ marginLeft: 6, width: 130 }}
              >
                {moduleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('activityLog.statusLabel')}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AuditLogStatus | 'all')}
                className="setting-select"
                style={{ marginLeft: 6, width: 120 }}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <div style={{ flex: 1 }} />

            <button className="export-button" onClick={fetchLogs} disabled={loading}>
              🔄 {t('common.refresh')}
            </button>
            <button className="export-button" onClick={handleExportCSV}>
              📥 {t('activityLog.exportCsv')}
            </button>

            {confirmCleanup ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('activityLog.retentionDays')}</span>
                <input
                  type="number"
                  min={1}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Math.max(1, Number(e.target.value) || 1))}
                  className="setting-input"
                  style={{ width: 70 }}
                />
                <button className="reset-all-button" onClick={handleCleanup} style={{ padding: '8px 12px' }}>
                  {t('activityLog.confirmCleanup')}
                </button>
                <button className="reset-button" onClick={() => setConfirmCleanup(false)} style={{ padding: '8px 12px' }}>
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button className="reset-button" onClick={() => setConfirmCleanup(true)}>
                🧹 {t('activityLog.cleanupExpired')}
              </button>
            )}

            {confirmClear ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="reset-all-button" onClick={handleClearAll} style={{ padding: '8px 12px' }}>
                  {t('activityLog.confirmClearAll')}
                </button>
                <button className="reset-button" onClick={() => setConfirmClear(false)} style={{ padding: '8px 12px' }}>
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button className="reset-all-button" onClick={() => setConfirmClear(true)}>
                🗑 {t('activityLog.clearAll')}
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'var(--bg-tertiary)' }}>
                <tr>
                  <th style={thStyle}>{t('activityLog.thTime')}</th>
                  <th style={thStyle}>{t('activityLog.thModule')}</th>
                  <th style={thStyle}>{t('activityLog.thAction')}</th>
                  <th style={thStyle}>{t('activityLog.thDescription')}</th>
                  <th style={thStyle}>{t('activityLog.thStatus')}</th>
                  <th style={thStyle}>{t('activityLog.thDuration')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td style={tdStyleCenter} colSpan={6}>{t('common.loading')}</td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td style={tdStyleCenter} colSpan={6}>{t('activityLog.noRecords')}</td>
                  </tr>
                ) : (
                  visibleItems.map((item) => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border-primary)' }}>
                      <td style={tdStyle}>{formatTimestamp(item.timestamp)}</td>
                      <td style={tdStyle}>{getModuleLabel(t, item.module)}</td>
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
                          {item.status === 'success' ? t('common.success') : t('activityLog.statusFailed')}
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
