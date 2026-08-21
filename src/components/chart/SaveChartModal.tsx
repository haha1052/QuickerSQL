import React, { useState, useEffect } from 'react';
import { useDashboardStore, useToastStore } from '../../store';
import { calculateNextPosition } from '../../utils/gridLayout';
import { useLocale } from '../../context/LocaleContext';
import type { SavedChart } from '../../types/dashboard';

interface SaveChartModalProps {
  queryId: string;
  querySql?: string;
  chartType: string;
  xAxis: string;
  yAxis: string[];
  chartConfig: Record<string, unknown>;
  onSave: (savedChart: SavedChart) => void;
  onClose: () => void;
}

export const SaveChartModal: React.FC<SaveChartModalProps> = ({
  queryId,
  querySql,
  chartType,
  xAxis,
  yAxis,
  chartConfig,
  onSave,
  onClose,
}) => {
  const { t } = useLocale();
  const { dashboards, loadDashboards, createSavedChart, addChartToDashboard, createDashboard, activeDashboardId, error: dashboardError, errorKey: dashboardErrorKey } = useDashboardStore();
  const { addToast } = useToastStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [targetDashboardId, setTargetDashboardId] = useState<string>(activeDashboardId || '');
  const [addToDashboard, setAddToDashboard] = useState(!!activeDashboardId);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showNewDashboardModal, setShowNewDashboardModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'restricted'>('all');
  const [authorizedDashboardIds, setAuthorizedDashboardIds] = useState<string[]>([]);

  useEffect(() => {
    loadDashboards();
  }, []);

  // 清理 chartConfig 中的不可序列化值（NaN、undefined、Infinity 等）
  const sanitizeChartConfig = (config: Record<string, unknown>): Record<string, unknown> => {
    try {
      return JSON.parse(JSON.stringify(config, (_key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) return null;
        if (typeof value === 'function') return undefined;
        if (typeof value === 'symbol') return undefined;
        return value;
      }));
    } catch (e) {
      console.warn('Sanitize chart config failed:', e);
      return {};
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg(t('chart.error.nameRequired'));
      return;
    }
    if (addToDashboard && !targetDashboardId) {
      setErrorMsg(t('chart.error.dashboardRequired'));
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      const sanitizedConfig = sanitizeChartConfig(chartConfig);

      // 若选择"添加到仪表盘"且授权范围为 restricted，确保当前仪表盘在授权列表中
      let effectiveAuthIds = visibility === 'restricted' && authorizedDashboardIds.length > 0
        ? [...authorizedDashboardIds]
        : [];
      if (addToDashboard && targetDashboardId && visibility === 'restricted') {
        if (!effectiveAuthIds.includes(targetDashboardId)) {
          effectiveAuthIds.push(targetDashboardId);
        }
      }

      const chart = await createSavedChart({
        name: name.trim(),
        queryId,
        querySql: querySql || '',
        chartType,
        xAxis,
        yAxis,
        title: name.trim(),
        description: description.trim(),
        tags,
        config: sanitizedConfig,
        visibility,
        authorizedDashboardIds: effectiveAuthIds,
      });

      if (!chart) {
        // SubTask 4.12：消费 store error 时优先使用 errorKey + t() 翻译
        // - dashboardErrorKey 存在表示使用前端兜底文案，应通过 t() 翻译
        // - dashboardErrorKey 为 null 表示 error 来自后端原始字符串，直接显示
        const err = dashboardErrorKey ? t(dashboardErrorKey) : (dashboardError || t('error.saved_chart.create_failed'));
        console.error('[SaveChartModal] 图表保存失败:', err);
        setErrorMsg(err);
        if (dashboardErrorKey) {
          addToast({ key: dashboardErrorKey }, 'error');
        } else {
          addToast(err, 'error');
        }
        return;
      }

      const authText = visibility === 'all'
        ? t('chart.allDashboardsPublic')
        : t('chart.authorizedToCount', { count: effectiveAuthIds.length });
      addToast(t('chart.savedChartToast', { name: chart.name, auth: authText }), 'success');

      if (addToDashboard && targetDashboardId) {
        // 计算新图表在目标仪表盘中的位置（避免重叠）
        const target = dashboards.find((d) => d.id === targetDashboardId);
        const position = calculateNextPosition(target?.layout || []);
        const addOk = await addChartToDashboard(targetDashboardId, chart.id, position);
        if (addOk) {
          addToast(t('chart.addedToDashboardToast', { name: target?.name || targetDashboardId }), 'success');
        } else {
          addToast(t('chart.savedButAddFailed'), 'warning');
        }
      }
      onSave(chart);
    } catch (e) {
      console.error('[SaveChartModal] 保存异常:', e);
      setErrorMsg(t('chart.error.saveException', { msg: String(e) }));
      addToast(t('chart.error.saveException', { msg: String(e) }), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewDashboard = async () => {
    if (!newDashboardName.trim()) return;
    try {
      const dashboard = await createDashboard(newDashboardName.trim());
      if (dashboard) {
        setTargetDashboardId(dashboard.id);
        setShowNewDashboardModal(false);
        setNewDashboardName('');
      } else {
        console.error('创建仪表盘失败');
      }
    } catch (e) {
      console.error('Create dashboard failed:', e);
    }
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.header}>
            <h3 style={styles.title}>💾 {t('chart.saveTitle')}</h3>
            <button style={styles.closeBtn} onClick={onClose}>×</button>
          </div>
          <div style={styles.body}>
            <label style={styles.label}>{t('chart.fieldName')} *</label>
            <input
              style={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('chart.namePlaceholder')}
              autoFocus
            />

            <label style={styles.label}>{t('chart.description')}</label>
            <textarea
              style={styles.textarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('chart.descriptionPlaceholder')}
            />

            <label style={styles.label}>{t('chart.fieldTags')}</label>
            <div style={styles.tagContainer}>
              {tags.map(t => (
                <span key={t} style={styles.tag}>
                  {t}
                  <button style={styles.tagRemove} onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                </span>
              ))}
              <input
                style={styles.tagInput}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    setTags(prev => [...prev, tagInput.trim()]);
                    setTagInput('');
                  }
                }}
                placeholder={t('chart.tagInputHint')}
              />
            </div>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={addToDashboard}
                onChange={e => setAddToDashboard(e.target.checked)}
              />
              {t('chart.addToDashboard')}
            </label>

            {addToDashboard && (
              <select
                style={styles.select}
                value={targetDashboardId}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '__new_dashboard__') {
                    setShowNewDashboardModal(true);
                  } else {
                    setTargetDashboardId(val);
                  }
                }}
              >
                <option value="">{t('chart.selectDashboard')}</option>
                {dashboards.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                <option value="__new_dashboard__">{t('chart.newDashboardOption')}</option>
              </select>
            )}

            <div style={styles.sectionTitle}>授权范围</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={visibility === 'all'}
                  onChange={() => setVisibility('all')}
                />
                <span>{t('chart.allDashboardsPublic')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={visibility === 'restricted'}
                  onChange={() => setVisibility('restricted')}
                />
                <span>{t('chart.authSpecifiedDashboards')}</span>
              </label>
            </div>

            {visibility === 'restricted' && (
              <div style={{ marginLeft: '20px', marginBottom: '12px', padding: '8px', background: '#f8f9fa', borderRadius: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{t('chart.selectAuthDashboards')}</div>
                {dashboards.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#999' }}>{t('chart.noDashboards')}</div>
                ) : (
                  dashboards.map((d) => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={authorizedDashboardIds.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAuthorizedDashboardIds([...authorizedDashboardIds, d.id]);
                          } else {
                            setAuthorizedDashboardIds(authorizedDashboardIds.filter((id) => id !== d.id));
                          }
                        }}
                      />
                      <span>{d.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            {errorMsg && (
              <div style={styles.errorBox} onClick={e => e.stopPropagation()}>
                ⚠️ {errorMsg}
              </div>
            )}
          </div>
          <div style={styles.footer}>
            <button style={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
            <button
              style={styles.saveBtn}
              onClick={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving ? t('chart.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>

      {/* 创建新仪表盘弹窗 */}
      {showNewDashboardModal && (
        <div style={styles.overlay} onClick={() => setShowNewDashboardModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.header}>
              <h3 style={styles.title}>📊 {t('chart.newDashboardTitle')}</h3>
              <button style={styles.closeBtn} onClick={() => setShowNewDashboardModal(false)}>×</button>
            </div>
            <div style={styles.body}>
              <label style={styles.label}>仪表盘名称 *</label>
              <input
                style={styles.input}
                value={newDashboardName}
                onChange={e => setNewDashboardName(e.target.value)}
                placeholder={t('dashboard.namePlaceholder')}
                autoFocus
              />
            </div>
            <div style={styles.footer}>
              <button style={styles.cancelBtn} onClick={() => setShowNewDashboardModal(false)}>{t('common.cancel')}</button>
              <button
                style={styles.saveBtn}
                onClick={handleCreateNewDashboard}
                disabled={!newDashboardName.trim()}
              >
                {t('chart.createBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
    background: 'var(--bg-primary)',
    borderRadius: '12px',
    width: '480px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: { margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' },
  sectionTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px', marginBottom: '4px' },
  closeBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' },
  body: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  label: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  input: {
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  textarea: {
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    minHeight: '60px',
    resize: 'vertical',
  },
  tagContainer: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    borderRadius: '4px',
    fontSize: '12px',
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--primary)',
    padding: 0,
  },
  tagInput: {
    padding: '4px 8px',
    border: '1px dashed var(--border-primary)',
    borderRadius: '4px',
    fontSize: '12px',
    background: 'transparent',
    color: 'var(--text-primary)',
    width: '100px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  errorBox: {
    padding: '10px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: 'rgb(239, 68, 68)',
    fontSize: '13px',
    fontWeight: 500,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '16px 20px',
    borderTop: '1px solid var(--border-primary)',
  },
  cancelBtn: {
    padding: '8px 20px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  saveBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '6px',
    background: 'var(--primary)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
  },
};
