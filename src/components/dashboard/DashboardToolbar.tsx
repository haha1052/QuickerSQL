import React, { useState } from 'react';
import { useDashboardStore } from '../../store';
import type { Dashboard } from '../../types/dashboard';
import { TaskEditorModal } from '../automation/TaskEditorModal';

interface DashboardToolbarProps {
  dashboard: Dashboard | null;
  isEditing: boolean;
  onToggleEdit: () => void;
  savingLayout?: boolean;
  onDashboardChange: (id: string) => void;
  onToggleLibrary?: () => void;
  libraryOpen?: boolean;
  onExportPng?: () => void;
  onLayoutSettingsChange?: (settings: { gap: number; rowHeight: number; snapToGrid: boolean }) => void;
  layoutSettings?: { gap: number; rowHeight: number; snapToGrid: boolean };
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  dashboard,
  isEditing,
  onToggleEdit,
  savingLayout = false,
  onDashboardChange,
  onToggleLibrary,
  libraryOpen,
  onExportPng,
  onLayoutSettingsChange,
  layoutSettings,
}) => {
  const { dashboards, createDashboard, deleteDashboard, toggleFullscreen, isFullscreen, refreshCharts } = useDashboardStore();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [localGap, setLocalGap] = useState(layoutSettings?.gap ?? 16);
  const [localRowHeight, setLocalRowHeight] = useState(layoutSettings?.rowHeight ?? 80);
  const [localSnapToGrid, setLocalSnapToGrid] = useState(layoutSettings?.snapToGrid ?? true);

  const handleNewDashboard = async () => {
    const name = prompt('仪表盘名称：', '新仪表盘');
    if (!name?.trim()) return;
    const result = await createDashboard(name.trim());
    if (result) {
      onDashboardChange(result.id);
    }
  };

  const handleDelete = async () => {
    if (!dashboard) return;
    if (confirm(`确定删除仪表盘 "${dashboard.name}" 吗？`)) {
      await deleteDashboard(dashboard.id);
    }
  };

  const handleApplyLayoutSettings = () => {
    onLayoutSettingsChange?.({ gap: localGap, rowHeight: localRowHeight, snapToGrid: localSnapToGrid });
    setShowLayoutSettings(false);
  };

  return (
    <>
      <div style={styles.toolbar}>
      <div style={styles.toolbarLeft}>
        <select
          style={styles.select}
          value={dashboard?.id || ''}
          onChange={(e) => onDashboardChange(e.target.value)}
        >
          {dashboards.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <button style={styles.btn} onClick={handleNewDashboard}>
          + 新建
        </button>

        {onToggleLibrary && (
          <button
            style={{
              ...styles.btn,
              ...(libraryOpen ? styles.btnActive : {}),
            }}
            onClick={onToggleLibrary}
            title="打开图表库，查看所有历史图表"
          >
            📚 图表库
          </button>
        )}
      </div>

      <div style={styles.toolbarRight}>
        {dashboard && (
          <>
            <button style={styles.btn} onClick={refreshCharts} title="刷新所有图表数据">
              🔄 刷新
            </button>
            <button
              style={styles.btn}
              onClick={() => setShowScheduleModal(true)}
              title="定时刷新仪表盘数据"
            >
              ⚡ 定时刷新
            </button>
            {onExportPng && (
              <button
                style={styles.btn}
                onClick={onExportPng}
                title="导出仪表盘为 PNG 图片"
                disabled={isEditing}
              >
                📷 导出
              </button>
            )}
            <button
              style={{
                ...styles.btn,
                ...(isEditing ? styles.btnActive : {}),
              }}
              onClick={onToggleEdit}
              disabled={savingLayout}
            >
              {savingLayout ? '⏳ 保存中...' : (isEditing ? '✅ 保存布局' : '📝 编辑')}
            </button>
            <button
              style={styles.btn}
              onClick={() => setShowLayoutSettings(true)}
              title="布局设置"
            >
              📐 布局
            </button>
            <button style={styles.btn} onClick={toggleFullscreen}>
              {isFullscreen ? '🗗 退出全屏' : '🗖 全屏'}
            </button>
            <button
              style={styles.btnDanger}
              onClick={handleDelete}
              title="删除仪表盘"
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
    <TaskEditorModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        initialTaskType="refresh_dashboard"
        initialPayload={{ dashboardId: (dashboard?.id || '').toString() }}
        initialName={'定时刷新仪表盘: ' + (dashboard?.name || '')}
      />

      {/* 布局设置弹窗 */}
      {showLayoutSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowLayoutSettings(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>布局设置</h3>
              <button style={styles.closeBtn} onClick={() => setShowLayoutSettings(false)}>×</button>
            </div>
            <div style={styles.modalContent}>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>图表间距 (px)</label>
                <input
                  type="range"
                  min="0"
                  max="32"
                  value={localGap}
                  onChange={(e) => setLocalGap(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.settingValue}>{localGap}px</span>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>行高 (px)</label>
                <input
                  type="range"
                  min="40"
                  max="160"
                  value={localRowHeight}
                  onChange={(e) => setLocalRowHeight(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.settingValue}>{localRowHeight}px</span>
              </div>
              <div style={styles.settingRow}>
                <label style={styles.settingLabel}>
                  <input
                    type="checkbox"
                    checked={localSnapToGrid}
                    onChange={(e) => setLocalSnapToGrid(e.target.checked)}
                    style={styles.checkbox}
                  />
                  磁吸对齐网格
                </label>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={() => setShowLayoutSettings(false)}>取消</button>
              <button style={styles.applyBtn} onClick={handleApplyLayoutSettings}>应用</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
    gap: '16px',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    cursor: 'pointer',
    minWidth: '150px',
  },
  btn: {
    padding: '6px 12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  btnDanger: {
    padding: '6px 10px',
    background: 'transparent',
    color: 'var(--error)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnActive: {
    background: 'var(--primary)',
    color: 'white',
    borderColor: 'var(--primary)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: '12px',
    width: '360px',
    maxWidth: '90vw',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
  },
  modalContent: {
    padding: '20px',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  settingLabel: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    minWidth: '100px',
  },
  slider: {
    flex: 1,
    cursor: 'pointer',
  },
  settingValue: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    minWidth: '40px',
    textAlign: 'right',
  },
  checkbox: {
    cursor: 'pointer',
    marginRight: '8px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 20px',
    borderTop: '1px solid var(--border-primary)',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  applyBtn: {
    padding: '8px 16px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};
