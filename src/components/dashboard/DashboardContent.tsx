/**
 * DashboardContent — 仪表盘主内容区子组件
 *
 * 职责：
 * - 组合工具栏、过滤条、画布、确认弹窗、库面板、编辑侧栏等子组件
 * - 处理全屏 vs 普通布局切换
 * - 渲染编辑模式提示条
 * - 纯展示型组件：状态与事件处理由 DashboardPage 通过 props 传入
 *
 * 拆分自 DashboardPage.tsx（P2 技术债 Task 3）
 */
import React from 'react';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardFilterBar } from './filters/DashboardFilterBar';
import { ChartLibraryPanel } from './ChartLibraryPanel';
import { ChartEditSidebar } from './ChartEditSidebar';
import { DashboardConfirmModal } from './DashboardConfirmModal';
import type { DashboardCanvasSettings } from './DashboardToolbarCanvasSettings';
import { useLocale } from '../../context/LocaleContext';
import type { Dashboard, SavedChart } from '../../types/dashboard';

/** 单个图表项的位置/尺寸 */
export interface DashboardLayoutEntry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 编辑模式临时布局：按 itemId 索引 */
export type DashboardTempLayout = Record<string, DashboardLayoutEntry>;

/** 画布栅格设置 */
export interface DashboardLayoutSettings {
  gap: number;
  rowHeight: number;
  snapToGrid: boolean;
}

export interface DashboardContentProps {
  activeDashboard: Dashboard;
  isEditing: boolean;
  isFullscreen: boolean;
  savingLayout: boolean;
  isSaving: boolean;
  tempLayout: DashboardTempLayout;
  showLibrary: boolean;
  showEditSidebar: boolean;
  selectedChartId: string | null;
  savedCharts: SavedChart[];
  pendingExitEdit: boolean;
  pendingRemoveChart: { itemId: string } | null;
  layoutSettings: DashboardLayoutSettings;
  // Handlers
  onToggleEdit: () => void;
  onDashboardChange: (id: string) => void;
  onSave: () => void;
  onExportPng: () => void;
  onCanvasSettingsChange: (settings: DashboardCanvasSettings) => void;
  onToggleLibrary: () => void;
  onCloseLibrary: () => void;
  onItemLayoutChange: (itemId: string, layout: DashboardLayoutEntry) => void;
  onItemDoubleClick: (chartId: string) => void;
  onConfirmExitEdit: () => void;
  onCancelExitEdit: () => void;
  onConfirmRemoveChart: () => void;
  onCancelRemoveChart: () => void;
  onCloseEditSidebar: () => void;
}

export const DashboardContent: React.FC<DashboardContentProps> = ({
  activeDashboard,
  isEditing,
  isFullscreen,
  savingLayout,
  isSaving,
  tempLayout,
  showLibrary,
  showEditSidebar,
  selectedChartId,
  savedCharts,
  pendingExitEdit,
  pendingRemoveChart,
  layoutSettings,
  onToggleEdit,
  onDashboardChange,
  onSave,
  onExportPng,
  onCanvasSettingsChange,
  onToggleLibrary,
  onCloseLibrary,
  onItemLayoutChange,
  onItemDoubleClick,
  onConfirmExitEdit,
  onCancelExitEdit,
  onConfirmRemoveChart,
  onCancelRemoveChart,
  onCloseEditSidebar,
}) => {
  const { t } = useLocale();

  const mainContent = (
    <>
      <DashboardToolbar
        dashboard={activeDashboard}
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        savingLayout={savingLayout}
        onDashboardChange={onDashboardChange}
        onToggleLibrary={onToggleLibrary}
        libraryOpen={showLibrary}
        onExportPng={onExportPng}
        onCanvasSettingsChange={onCanvasSettingsChange}
        onSave={onSave}
        isSaving={isSaving}
      />
      {/* P1 UX：编辑模式提示条 */}
      {isEditing && (
        <div style={styles.editModeBanner}>
          <span style={styles.editModeIcon}>✏️</span>
          <span style={styles.editModeText}>{t('dashboard.editModeHint')}</span>
          {Object.keys(tempLayout).length > 0 && (
            <span style={styles.editModeChanged}>
              {t('dashboard.itemsModified', { count: Object.keys(tempLayout).length })}
            </span>
          )}
        </div>
      )}
      <DashboardFilterBar filters={activeDashboard?.filters || []} />
      <DashboardCanvas
        dashboard={activeDashboard}
        isEditing={isEditing}
        tempLayout={tempLayout}
        onItemLayoutChange={onItemLayoutChange}
        onItemDoubleClick={onItemDoubleClick}
        layoutSettings={layoutSettings}
      />

      {/* P2-13: 退出编辑模式确认弹窗（替代原生 confirm） */}
      <DashboardConfirmModal
        open={pendingExitEdit}
        title={t('dashboard.confirmSaveLayoutTitle')}
        message={t('dashboard.confirmSaveLayout', {
          count: Object.keys(tempLayout).length,
          confirm: t('common.confirm'),
          cancel: t('common.cancel'),
        })}
        onConfirm={onConfirmExitEdit}
        onCancel={onCancelExitEdit}
      />

      {/* P2-13: 删除图表确认弹窗（替代原生 confirm） */}
      <DashboardConfirmModal
        open={!!pendingRemoveChart}
        title={t('dashboard.confirmRemoveChartTitle')}
        message={t('dashboard.confirmRemoveChart')}
        variant="danger"
        onConfirm={onConfirmRemoveChart}
        onCancel={onCancelRemoveChart}
      />
    </>
  );

  if (isFullscreen) {
    return <div style={styles.fullscreen}>{mainContent}</div>;
  }

  return (
    <div style={styles.container}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {mainContent}
      </div>

      {showLibrary && (
        <ChartLibraryPanel open={true} onClose={onCloseLibrary} />
      )}

      {(() => {
        const chart = savedCharts.find((c) => c.id === selectedChartId);
        if (showEditSidebar && chart) {
          return (
            <ChartEditSidebar chart={chart} onClose={onCloseEditSidebar} />
          );
        }
        return null;
      })()}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    height: '100%',
    background: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  fullscreen: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
  },
  // P1 UX：编辑模式提示条
  editModeBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'var(--primary-bg)',
    borderBottom: '1px solid var(--primary)',
    fontSize: '13px',
    color: 'var(--primary)',
  },
  editModeIcon: { fontSize: '14px' },
  editModeText: { fontWeight: 500 },
  editModeChanged: { color: 'var(--warning)', fontWeight: 600 },
};
