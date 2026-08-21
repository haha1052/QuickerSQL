/**
 * DashboardEmptyState — 仪表盘空状态/加载状态子组件
 *
 * 职责：
 * - 渲染加载中状态（loading=true 且 dashboardsCount=0）
 * - 渲染空状态（无仪表盘）+ 创建仪表盘按钮 + 创建仪表盘模态框
 * - 纯展示型组件：所有业务动作（创建仪表盘、关闭模态框等）由父组件通过回调处理
 *
 * 拆分自 DashboardPage.tsx（P2 技术债 Task 3）
 */
import React from 'react';
import { useLocale } from '../../context/LocaleContext';

export interface DashboardEmptyStateProps {
  /** 是否处于加载中 */
  loading: boolean;
  /** 当前仪表盘数量（仅当为 0 时本组件才会渲染） */
  dashboardsCount: number;
  /** 是否显示创建仪表盘模态框 */
  showCreateModal: boolean;
  /** 新仪表盘名称 */
  newDashboardName: string;
  /** 创建中（禁用按钮/输入） */
  creatingDashboard: boolean;
  /** 名称变化回调 */
  onNewDashboardNameChange: (value: string) => void;
  /** 关闭创建模态框 */
  onCreateModalClose: () => void;
  /** 确认创建仪表盘 */
  onCreateDashboard: () => void;
  /** 点击「创建仪表盘」按钮（打开模态框） */
  onShowCreateModal: () => void;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  loading,
  dashboardsCount,
  showCreateModal,
  newDashboardName,
  creatingDashboard,
  onNewDashboardNameChange,
  onCreateModalClose,
  onCreateDashboard,
  onShowCreateModal,
}) => {
  const { t } = useLocale();

  // 加载中状态：仅当 loading=true 且 dashboardsCount=0 时显示
  if (loading && dashboardsCount === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>⏳</div>
        <div style={styles.emptyTitle}>{t('error.dashboard.loading_data')}</div>
        <div style={styles.emptyDesc}>{t('error.dashboard.loading_data_desc')}</div>
      </div>
    );
  }

  // 空状态：仅当 dashboardsCount=0 时显示
  if (dashboardsCount === 0) {
    return (
      <>
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>📊</div>
          <div style={styles.emptyTitle}>{t('dashboard.noDashboards')}</div>
          <div style={styles.emptyDesc}>{t('dashboard.createFirstDashboardHint')}</div>
          <button style={styles.createButton} onClick={onShowCreateModal}>
            {t('dashboard.createDashboard')}
          </button>
        </div>

        {showCreateModal && (
          <div
            style={styles.modalOverlay}
            onClick={() => {
              if (!creatingDashboard) onCreateModalClose();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !creatingDashboard) {
                onCreateModalClose();
              }
            }}
          >
            <div
              style={styles.modal}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !creatingDashboard) {
                  onCreateModalClose();
                }
              }}
              tabIndex={-1}
            >
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{t('dashboard.createDashboard')}</h3>
                <button
                  style={styles.modalCloseBtn}
                  onClick={() => !creatingDashboard && onCreateModalClose()}
                  disabled={creatingDashboard}
                >
                  ×
                </button>
              </div>
              <div style={styles.modalBody}>
                <label style={styles.modalLabel}>{t('dashboard.dashboardName')} *</label>
                <input
                  style={styles.modalInput}
                  value={newDashboardName}
                  onChange={(e) => onNewDashboardNameChange(e.target.value)}
                  placeholder={t('dashboard.namePlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onCreateDashboard();
                    } else if (e.key === 'Escape') {
                      if (!creatingDashboard) onCreateModalClose();
                    }
                  }}
                  autoFocus
                  disabled={creatingDashboard}
                />
              </div>
              <div style={styles.modalFooter}>
                <button
                  style={styles.modalCancelBtn}
                  onClick={onCreateModalClose}
                  disabled={creatingDashboard}
                >
                  {t('common.cancel')}
                </button>
                <button
                  style={{
                    ...styles.modalConfirmBtn,
                    opacity: creatingDashboard || !newDashboardName.trim() ? 0.6 : 1,
                    cursor: creatingDashboard || !newDashboardName.trim() ? 'not-allowed' : 'pointer',
                  }}
                  onClick={onCreateDashboard}
                  disabled={creatingDashboard || !newDashboardName.trim()}
                >
                  {creatingDashboard ? t('common.creating') : t('common.create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
  emptyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: 'var(--text-secondary)',
    padding: '48px 24px',
  },
  emptyIcon: { fontSize: '48px' },
  emptyTitle: { fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' },
  emptyDesc: { fontSize: '14px', maxWidth: '400px', textAlign: 'center', lineHeight: 1.6 },
  createButton: {
    padding: '10px 24px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: '12px',
    width: '440px',
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-primary)',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    lineHeight: 1,
    borderRadius: '4px',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  modalLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  modalInput: {
    padding: '10px 14px',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 24px',
    borderTop: '1px solid var(--border-primary)',
  },
  modalCancelBtn: {
    padding: '8px 20px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '14px',
  },
  modalConfirmBtn: {
    padding: '8px 20px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
  },
};
