import React, { useState } from 'react';
import { useDashboardStore } from '../../store/dashboardStore';
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
}) => {
  const { dashboards, createDashboard, deleteDashboard, toggleFullscreen, isFullscreen, refreshCharts } = useDashboardStore();
  const [showScheduleModal, setShowScheduleModal] = useState(false);

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
};
