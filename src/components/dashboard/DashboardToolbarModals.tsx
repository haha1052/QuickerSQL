/**
 * DashboardToolbarModals — 仪表盘工具栏辅助弹窗子组件
 *
 * 职责：渲染「定时刷新」任务编辑弹窗（TaskEditorModal）、「新建仪表盘」弹窗、
 * 「删除仪表盘」确认弹窗。纯展示型组件，所有业务动作（创建/删除、toast 提示等）
 * 由父组件 DashboardToolbar 通过回调处理，不直接访问 store。
 */
import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import type { Dashboard } from '../../types/dashboard';
import { TaskEditorModal } from '../automation/TaskEditorModal';

export interface DashboardToolbarModalsProps {
  dashboard: Dashboard | null;
  showScheduleModal: boolean;
  onScheduleClose: () => void;
  showCreateModal: boolean;
  creating: boolean;
  newDashboardName: string;
  onNewDashboardNameChange: (value: string) => void;
  onCreateClose: () => void;
  onCreateConfirm: () => void;
  showDeleteConfirm: boolean;
  onDeleteClose: () => void;
  onDeleteConfirm: () => void;
}

export const DashboardToolbarModals: React.FC<DashboardToolbarModalsProps> = ({
  dashboard, showScheduleModal, onScheduleClose, showCreateModal, creating,
  newDashboardName, onNewDashboardNameChange, onCreateClose, onCreateConfirm,
  showDeleteConfirm, onDeleteClose, onDeleteConfirm,
}) => {
  const { t } = useLocale();
  const canCreate = !creating && !!newDashboardName.trim();

  return (
    <>
      <TaskEditorModal
        open={showScheduleModal}
        onClose={onScheduleClose}
        initialTaskType="refresh_dashboard"
        initialPayload={{ dashboardId: (dashboard?.id || '').toString() }}
        initialName={t('automation.scheduledRefreshPrefix', { name: dashboard?.name || '' })}
      />

      {/* 新建仪表盘弹窗 */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={onCreateClose}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{t('dashboard.createDashboard')}</h3>
              <button style={styles.modalCloseBtn} onClick={onCreateClose} disabled={creating}>×</button>
            </div>
            <div style={styles.modalBody}>
              <label style={styles.modalLabel}>{t('dashboard.dashboardName')} *</label>
              <input
                style={styles.modalInput}
                value={newDashboardName}
                onChange={(e) => onNewDashboardNameChange(e.target.value)}
                placeholder={t('dashboard.namePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCreateConfirm();
                  else if (e.key === 'Escape' && !creating) onCreateClose();
                }}
                autoFocus
                disabled={creating}
              />
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={onCreateClose} disabled={creating}>{t('common.cancel')}</button>
              <button
                style={{ ...styles.modalConfirmBtn, opacity: canCreate ? 1 : 0.6, cursor: canCreate ? 'pointer' : 'not-allowed' }}
                onClick={onCreateConfirm}
                disabled={!canCreate}
              >
                {creating ? t('common.creating') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P2-13: 删除仪表盘确认弹窗（替代原生 confirm） */}
      {showDeleteConfirm && dashboard && (
        <div style={styles.modalOverlay} onClick={onDeleteClose}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{t('dashboard.confirmDeleteTitle')}</h3>
              <button style={styles.modalCloseBtn} onClick={onDeleteClose}>×</button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {t('dashboard.confirmDeleteDashboard', { name: dashboard.name })}
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.modalCancelBtn} onClick={onDeleteClose}>{t('common.cancel')}</button>
              <button
                style={{ ...styles.modalConfirmBtn, background: 'var(--error)', borderColor: 'var(--error)' }}
                onClick={onDeleteConfirm}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--bg-primary)', borderRadius: '12px', width: '440px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border-primary)' },
  modalTitle: { margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' },
  modalCloseBtn: { background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 8px', lineHeight: 1, borderRadius: '4px' },
  modalBody: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' },
  modalLabel: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  modalInput: { padding: '10px 14px', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border-primary)' },
  modalCancelBtn: { padding: '8px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px' },
  modalConfirmBtn: { padding: '8px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px' },
};
