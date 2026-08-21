import React, { useState } from 'react';
import { useDashboardStore, useToastStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import type { Dashboard } from '../../types/dashboard';
import { DashboardToolbarActions } from './DashboardToolbarActions';
import { DashboardToolbarCanvasSettings } from './DashboardToolbarCanvasSettings';
import type { DashboardCanvasSettings } from './DashboardToolbarCanvasSettings';
import { DashboardToolbarModals } from './DashboardToolbarModals';

interface DashboardToolbarProps {
  dashboard: Dashboard | null;
  isEditing: boolean;
  onToggleEdit: () => void;
  savingLayout?: boolean;
  onDashboardChange: (id: string) => void;
  onToggleLibrary?: () => void;
  libraryOpen?: boolean;
  onExportPng?: () => void;
  onCanvasSettingsChange?: (settings: DashboardCanvasSettings) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

/**
 * DashboardToolbar — 仪表盘工具栏父组件
 *
 * 职责：
 * - 管理共享状态（弹窗显隐、新建仪表盘名称/创建中状态、删除确认）
 * - 访问 store（dashboards / createDashboard / deleteDashboard / refreshCharts / 全屏）与 toast
 * - 编排业务动作（创建仪表盘、确认删除、应用画布设置）并通过 props 传递给子组件
 * - 组合三个子组件：DashboardToolbarActions / DashboardToolbarCanvasSettings / DashboardToolbarModals
 */
export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  dashboard,
  isEditing,
  onToggleEdit,
  savingLayout = false,
  onDashboardChange,
  onToggleLibrary,
  libraryOpen,
  onExportPng,
  onCanvasSettingsChange,
  onSave,
  isSaving = false,
}) => {
  const { t } = useLocale();
  const { dashboards, deleteDashboard, toggleFullscreen, isFullscreen, refreshCharts, createDashboard } = useDashboardStore();
  // P2-13: 使用项目 toast 替代原生 alert（用于删除失败等提示）
  const { addToast } = useToastStore();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [creating, setCreating] = useState(false);
  // P2-13: 删除仪表盘确认弹窗状态（替代原生 confirm）
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // P2-13: 删除仪表盘改为弹窗确认（替代原生 confirm）
  const handleDelete = () => {
    if (!dashboard) return;
    setShowDeleteConfirm(true);
  };

  // P2-13: 用户确认删除后实际执行
  const handleConfirmDelete = async () => {
    if (!dashboard) return;
    setShowDeleteConfirm(false);
    try {
      await deleteDashboard(dashboard.id);
      addToast({ key: 'dashboard.deleteSuccess', vars: { name: dashboard.name } }, 'success');
    } catch (e) {
      console.error('[DashboardToolbar] 删除仪表盘失败:', e);
      addToast(`${t('dashboard.deleteFailed')}: ${(e as Error).message}`, 'error');
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;
    setCreating(true);
    try {
      const newDash = await createDashboard(newDashboardName.trim());
      if (newDash) {
        onDashboardChange(newDash.id);
        setShowCreateModal(false);
        setNewDashboardName('');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleApplyCanvasSettings = (settings: DashboardCanvasSettings) => {
    onCanvasSettingsChange?.(settings);
    setShowCanvasSettings(false);
  };

  return (
    <>
      <DashboardToolbarActions
        dashboard={dashboard}
        dashboards={dashboards}
        isEditing={isEditing}
        isSaving={isSaving}
        savingLayout={savingLayout}
        isFullscreen={isFullscreen}
        libraryOpen={libraryOpen}
        onDashboardChange={onDashboardChange}
        onNewDashboard={() => setShowCreateModal(true)}
        onToggleLibrary={onToggleLibrary}
        onRefresh={refreshCharts}
        onScheduleRefresh={() => setShowScheduleModal(true)}
        onExportPng={onExportPng}
        onOpenCanvasSettings={() => setShowCanvasSettings(true)}
        onSave={onSave}
        onToggleEdit={onToggleEdit}
        onToggleFullscreen={toggleFullscreen}
        onDelete={handleDelete}
      />

      <DashboardToolbarModals
        dashboard={dashboard}
        showScheduleModal={showScheduleModal}
        onScheduleClose={() => setShowScheduleModal(false)}
        showCreateModal={showCreateModal}
        creating={creating}
        newDashboardName={newDashboardName}
        onNewDashboardNameChange={setNewDashboardName}
        onCreateClose={() => !creating && setShowCreateModal(false)}
        onCreateConfirm={handleCreateDashboard}
        showDeleteConfirm={showDeleteConfirm}
        onDeleteClose={() => setShowDeleteConfirm(false)}
        onDeleteConfirm={handleConfirmDelete}
      />

      {/* 画布设置弹窗：条件挂载，保证每次打开都从最新 dashboard 重新初始化表单 */}
      {showCanvasSettings && dashboard && (
        <DashboardToolbarCanvasSettings
          dashboard={dashboard}
          onClose={() => setShowCanvasSettings(false)}
          onApply={handleApplyCanvasSettings}
        />
      )}
    </>
  );
};
