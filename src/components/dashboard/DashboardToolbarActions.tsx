/**
 * DashboardToolbarActions — 仪表盘工具栏操作按钮组子组件
 *
 * 职责：渲染工具栏左侧（仪表盘选择器 + 新建 + 图表库开关）与右侧
 * （刷新 / 定时刷新 / 导出 / 画布设置 / 保存 / 编辑 / 全屏 / 删除）操作按钮。
 * 纯展示型组件，所有业务回调通过 props 由父组件 DashboardToolbar 传入，不直接访问 store。
 */
import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import type { Dashboard } from '../../types/dashboard';

export interface DashboardToolbarActionsProps {
  dashboard: Dashboard | null;
  dashboards: Dashboard[];
  isEditing: boolean;
  isSaving: boolean;
  savingLayout: boolean;
  isFullscreen: boolean;
  libraryOpen?: boolean;
  onDashboardChange: (id: string) => void;
  onNewDashboard: () => void;
  onToggleLibrary?: () => void;
  onRefresh: () => void;
  onScheduleRefresh: () => void;
  onExportPng?: () => void;
  onOpenCanvasSettings: () => void;
  onSave?: () => void;
  onToggleEdit: () => void;
  onToggleFullscreen: () => void;
  onDelete: () => void;
}

export const DashboardToolbarActions: React.FC<DashboardToolbarActionsProps> = ({
  dashboard, dashboards, isEditing, isSaving, savingLayout, isFullscreen, libraryOpen,
  onDashboardChange, onNewDashboard, onToggleLibrary, onRefresh, onScheduleRefresh,
  onExportPng, onOpenCanvasSettings, onSave, onToggleEdit, onToggleFullscreen, onDelete,
}) => {
  const { t } = useLocale();
  const busy = isSaving || savingLayout;

  return (
    <div style={styles.toolbar}>
      <div style={styles.toolbarLeft}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={styles.select} value={dashboard?.id || ''} onChange={(e) => onDashboardChange(e.target.value)}>
            {dashboards.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
          <button style={styles.btn} onClick={onNewDashboard} title="新建仪表盘">➕ 新建</button>
        </div>
        {onToggleLibrary && (
          <button style={{ ...styles.btn, ...(libraryOpen ? styles.btnActive : {}) }} onClick={onToggleLibrary} title={t('dashboard.openChartLibrary')}>
            📚 {t('chart.chartLibrary')}
          </button>
        )}
      </div>

      <div style={styles.toolbarRight}>
        {dashboard && (
          <>
            <button style={styles.btn} onClick={onRefresh} title={t('dashboard.refreshAllCharts')}>🔄 {t('common.refresh')}</button>
            <button style={styles.btn} onClick={onScheduleRefresh} title={t('dashboard.scheduleRefresh')}>⚡ 定时刷新</button>
            {onExportPng && (
              <button style={{ ...styles.btn, ...(busy ? styles.btnDisabled : {}) }} onClick={onExportPng} title={t('dashboard.exportPng')}>📷 导出</button>
            )}
            <button style={styles.btn} onClick={onOpenCanvasSettings} title={t('dashboard.canvasSettings')}>⚙️ 画布</button>
            {onSave && (
              <button style={{ ...styles.btn, ...(busy ? styles.btnDisabled : {}) }} onClick={onSave} disabled={busy} title="保存仪表盘 (Ctrl+S)">
                {isSaving ? '⏳ 保存中...' : '💾 保存'}
              </button>
            )}
            <button style={{ ...styles.btn, ...(isEditing ? styles.btnActive : {}) }} onClick={onToggleEdit} disabled={savingLayout}>
              {savingLayout ? '⏳ 保存中...' : (isEditing ? '✅ 保存布局' : '📝 编辑')}
            </button>
            <button style={styles.btn} onClick={onToggleFullscreen}>{isFullscreen ? '🗗 退出全屏' : '🗖 全屏'}</button>
            <button style={styles.btnDanger} onClick={onDelete} title={t('dashboard.deleteDashboard')}>🗑</button>
          </>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', gap: '16px' },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  select: { padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer', minWidth: '150px' },
  btn: { padding: '6px 12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  btnDanger: { padding: '6px 10px', background: 'transparent', color: 'var(--error)', border: '1px solid var(--border-primary)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  btnActive: { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};
