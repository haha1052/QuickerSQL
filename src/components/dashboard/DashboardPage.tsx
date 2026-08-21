import React, { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DashboardEmptyState } from './DashboardEmptyState';
import { DashboardContent } from './DashboardContent';
import type {
  DashboardLayoutEntry,
  DashboardLayoutSettings,
  DashboardTempLayout,
} from './DashboardContent';
import { useDashboardStore } from '../../store';
import { useToastStore } from '../../store/toastStore';
import { exportDashboardToPng } from '../../utils/dashboardExport';
import { useLocale } from '../../context/LocaleContext';

export const DashboardPage: React.FC = () => {
  // P1-13：useShallow 仅订阅必要字段
  const {
    dashboards,
    activeDashboardId,
    savedCharts,
    selectedChartId,
    setSelectedChartId,
    setActiveDashboard,
    isFullscreen,
    setFullscreen,
    loading,
  } = useDashboardStore(
    useShallow((s) => ({
      dashboards: s.dashboards,
      activeDashboardId: s.activeDashboardId,
      savedCharts: s.savedCharts,
      selectedChartId: s.selectedChartId,
      setSelectedChartId: s.setSelectedChartId,
      setActiveDashboard: s.setActiveDashboard,
      isFullscreen: s.isFullscreen,
      setFullscreen: s.setFullscreen,
      loading: s.loading,
    }))
  );
  const { t } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showEditSidebar, setShowEditSidebar] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const [layoutSettings] = useState<DashboardLayoutSettings>({
    gap: 16,
    rowHeight: 80,
    snapToGrid: true,
  });

  // T3+T4: 编辑模式下的临时布局（按 itemId 存储覆盖后的位置/尺寸）
  const [tempLayout, setTempLayout] = useState<DashboardTempLayout>({});
  // P2-13: 替换原生 confirm/alert
  // pendingExitEdit: 退出编辑模式时有未保存布局变更，等待用户确认
  const [pendingExitEdit, setPendingExitEdit] = useState(false);
  // pendingRemoveChart: 用户按 Delete 删除选中图表，等待用户确认
  const [pendingRemoveChart, setPendingRemoveChart] = useState<{ itemId: string } | null>(null);

  // 处理画布设置变化
  const handleCanvasSettingsChange = async (settings: {
    backgroundColor?: string;
    backgroundImage?: string;
    canvasWidth?: number;
    canvasHeight?: number;
    padding?: number;
    gridGap?: number;
    rowHeight?: number;
    snapToGrid?: boolean;
  }) => {
    if (!activeDashboard) return;
    const { updateDashboard } = useDashboardStore.getState();
    await updateDashboard(activeDashboard.id, {
      backgroundColor: settings.backgroundColor,
      backgroundImage: settings.backgroundImage,
      canvasWidth: settings.canvasWidth,
      canvasHeight: settings.canvasHeight,
      padding: settings.padding,
      gridGap: settings.gridGap,
      rowHeight: settings.rowHeight,
      snapToGrid: settings.snapToGrid,
    });
  };

  // 进入编辑模式时清空临时布局
  useEffect(() => {
    if (isEditing) {
      setTempLayout({});
    }
  }, [isEditing]);

  // T3: 图表项位置/尺寸变更回调（在拖拽/缩放时持续调用）
  const handleItemLayoutChange = (
    itemId: string,
    layout: DashboardLayoutEntry
  ) => {
    setTempLayout((prev) => ({ ...prev, [itemId]: layout }));
  };

  // T2: 退出编辑模式时：先把临时布局应用到 store，再调用 saveLayout 保存
  // P1 改进：退出前确认是否保存；保存改为并行调用 + 错误收集
  // P2-13: 改为非阻塞弹窗（替代原生 confirm），实际退出动作延后到 executeExitEdit
  const handleToggleEdit = () => {
    if (isEditing && activeDashboard) {
      // 有布局变更时，询问用户是否保存
      const changedCount = Object.keys(tempLayout).length;
      if (changedCount > 0) {
        // P2-13: 改为弹窗确认，用户点击确认后调用 executeExitEdit
        setPendingExitEdit(true);
        return;
      }
      // 无布局变更直接退出
      void executeExitEdit();
    } else {
      setIsEditing(true);
    }
  };

  // P2-13: 实际执行退出编辑模式 + 保存布局（由确认弹窗触发，或无变更时直接调用）
  const executeExitEdit = async () => {
    setSavingLayout(true);
    try {
      const { updateDashboardItem, loadDashboards } = useDashboardStore.getState();
      // P1 改进：改为并行保存 + 错误收集
      const savePromises = Object.entries(tempLayout).map(async ([itemId, layout]) => {
        try {
          await updateDashboardItem(itemId, {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height,
          });
          return { itemId, success: true };
        } catch (e) {
          console.error(`[DashboardPage] 保存 item ${itemId} 失败:`, e);
          return { itemId, success: false, error: e };
        }
      });

      const results = await Promise.all(savePromises);
      const failedCount = results.filter(r => !r.success).length;
      if (failedCount > 0) {
        // P2-13: 替换原生 alert 为项目 toast
        useToastStore.getState().addToast(
          t('dashboard.layoutSavePartialFailed', {
            failedCount,
            totalCount: results.length,
          }),
          'error'
        );
      } else {
        // 保存成功后重新加载完整数据，确保 store 中的 layout 与后端一致
        await loadDashboards();
      }
    } finally {
      setSavingLayout(false);
      setIsEditing(false);
      setTempLayout({});
    }
  };

  // 保存仪表盘（保存按钮和 Ctrl+S 快捷键触发）
  const handleSave = async () => {
    if (!activeDashboard || isSaving) return;

    // 非编辑模式下点击保存，提示用户
    if (!isEditing) {
      useToastStore.getState().addToast(t('error.dashboard.enter_edit_first'), 'warning');
      return;
    }

    // 编辑模式但无布局变更
    if (Object.keys(tempLayout).length === 0) {
      useToastStore.getState().addToast(t('error.dashboard.no_unsaved_changes'), 'info');
      return;
    }

    // 编辑模式且有布局变更，执行保存
    setIsSaving(true);
    try {
      const { saveDashboardLayout } = useDashboardStore.getState();
      const layoutUpdates = Object.entries(tempLayout).map(([id, layout]) => ({
        id,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
      }));
      const result = await saveDashboardLayout(activeDashboard.id, layoutUpdates);
      if (result) {
        setTempLayout({});
        useToastStore.getState().addToast(t('error.dashboard.save_success'), 'success');
      } else {
        useToastStore.getState().addToast(t('error.dashboard.save_failed_unknown'), 'error');
      }
    } catch (e) {
      console.error('[DashboardPage] 保存失败:', e);
      useToastStore.getState().addToast(t('error.dashboard.save_failed_with_msg', { message: (e as Error).message }), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // P1-9 + P2-15：移除 needsFullLoad 判断，无条件加载完整数据
  // 启动时仅注入 Lite 数据（sql 为空），进入 Dashboard 页时必须刷新为完整数据
  useEffect(() => {
    const store = useDashboardStore.getState();
    store.loadDashboards();
    store.loadSavedCharts();
  }, []);

  // 若存在仪表盘列表但没选，则默认选择第一个仪表盘
  useEffect(() => {
    if (!activeDashboardId && dashboards.length > 0) {
      setActiveDashboard(dashboards[0].id);
    }
  }, [activeDashboardId, dashboards, setActiveDashboard]);

  useEffect(() => {
    const { resetFilters } = useDashboardStore.getState();
    resetFilters();
  }, [activeDashboardId]);

  useEffect(() => {
    if (!selectedChartId) {
      setShowEditSidebar(false);
    }
  }, [selectedChartId]);

  const handleChartDoubleClick = (chartId: string) => {
    setSelectedChartId(chartId);
    setShowEditSidebar(true);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S：保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Esc：退出全屏 或 退出编辑模式 或 取消选中
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setFullscreen(false);
        } else if (isEditing) {
          handleToggleEdit();
        } else if (selectedChartId) {
          setSelectedChartId(null);
        }
        return;
      }

      // 以下快捷键仅在编辑模式下生效
      if (!isEditing) return;

      // 避免在输入框中触发快捷键
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // 方向键微调选中图表位置
      if (selectedChartId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const activeDash = useDashboardStore.getState().dashboards.find((d) => d.id === activeDashboardId);
        if (!activeDash) return;
        const targetItem = activeDash.layout.find((it) => it.chartId === selectedChartId);
        if (!targetItem) return;

        // 大步移动（Shift）= 3格，小步 = 1格
        const step = e.shiftKey ? 3 : 1;
        let newX = targetItem.x;
        let newY = targetItem.y;

        if (e.key === 'ArrowLeft') newX = Math.max(0, targetItem.x - step);
        if (e.key === 'ArrowRight') newX = Math.min(12 - targetItem.width, targetItem.x + step);
        if (e.key === 'ArrowUp') newY = Math.max(0, targetItem.y - step);
        if (e.key === 'ArrowDown') newY = targetItem.y + step;

        if (newX !== targetItem.x || newY !== targetItem.y) {
          setTempLayout((prev) => ({
            ...prev,
            [targetItem.id]: { x: newX, y: newY, width: targetItem.width, height: targetItem.height },
          }));
        }
        return;
      }

      // Delete/Backspace：删除选中图表
      if (selectedChartId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        const activeDash = useDashboardStore.getState().dashboards.find((d) => d.id === activeDashboardId);
        if (!activeDash) return;
        const targetItem = activeDash.layout.find((it) => it.chartId === selectedChartId);
        if (targetItem) {
          // P2-13: 改为弹窗确认，实际删除延后到 handleConfirmRemoveChart
          setPendingRemoveChart({ itemId: targetItem.id });
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, isEditing, selectedChartId, activeDashboardId, setFullscreen, setSelectedChartId]);

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;
    setCreatingDashboard(true);
    try {
      const { createDashboard } = useDashboardStore.getState();
      await createDashboard(newDashboardName.trim());
      setShowCreateModal(false);
      setNewDashboardName('');
    } catch (e) {
      console.error('[DashboardPage] 创建仪表盘失败:', e);
      // P2-13: 替换原生 alert 为项目 toast
      useToastStore.getState().addToast(t('dashboard.createFailed'), 'error');
    } finally {
      setCreatingDashboard(false);
    }
  };

  // P2-13: 用户确认退出编辑模式并保存布局
  const handleConfirmExitEdit = () => {
    setPendingExitEdit(false);
    void executeExitEdit();
  };

  // P2-13: 用户取消退出编辑模式
  const handleCancelExitEdit = () => setPendingExitEdit(false);

  // P2-13: 用户确认删除选中图表
  const handleConfirmRemoveChart = () => {
    if (!pendingRemoveChart) return;
    const itemId = pendingRemoveChart.itemId;
    setPendingRemoveChart(null);
    useDashboardStore.getState().removeChartFromDashboard(itemId);
    setSelectedChartId(null);
  };

  // P2-13: 用户取消删除图表
  const handleCancelRemoveChart = () => setPendingRemoveChart(null);

  // 加载/空状态：交由 DashboardEmptyState 子组件渲染
  if (dashboards.length === 0) {
    return (
      <DashboardEmptyState
        loading={loading}
        dashboardsCount={dashboards.length}
        showCreateModal={showCreateModal}
        newDashboardName={newDashboardName}
        creatingDashboard={creatingDashboard}
        onNewDashboardNameChange={setNewDashboardName}
        onCreateModalClose={() => setShowCreateModal(false)}
        onCreateDashboard={handleCreateDashboard}
        onShowCreateModal={() => {
          setNewDashboardName(t('dashboard.newDashboardName'));
          setShowCreateModal(true);
        }}
      />
    );
  }

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards[0];

  // P3-1：导出仪表盘为 PNG
  const handleExportPng = async () => {
    if (isEditing) {
      useToastStore.getState().addToast(t('error.dashboard.exit_edit_first'), 'warning');
      return;
    }
    if (!activeDashboard) {
      useToastStore.getState().addToast(t('error.dashboard.no_active_dashboard'), 'error');
      return;
    }
    const canvasEl = document.querySelector('[data-dashboard-canvas="true"]') as HTMLElement | null;
    const result = await exportDashboardToPng(activeDashboard, canvasEl, activeDashboard.name);
    if (result.success) {
      useToastStore.getState().addToast(t('error.dashboard.export_success'), 'success');
    } else {
      useToastStore.getState().addToast(result.message, 'error');
    }
  };

  return (
    <DashboardContent
      activeDashboard={activeDashboard}
      isEditing={isEditing}
      isFullscreen={isFullscreen}
      savingLayout={savingLayout}
      isSaving={isSaving}
      tempLayout={tempLayout}
      showLibrary={showLibrary}
      showEditSidebar={showEditSidebar}
      selectedChartId={selectedChartId}
      savedCharts={savedCharts}
      pendingExitEdit={pendingExitEdit}
      pendingRemoveChart={pendingRemoveChart}
      layoutSettings={layoutSettings}
      onToggleEdit={handleToggleEdit}
      onDashboardChange={setActiveDashboard}
      onSave={handleSave}
      onExportPng={handleExportPng}
      onCanvasSettingsChange={handleCanvasSettingsChange}
      onToggleLibrary={() => setShowLibrary(v => !v)}
      onCloseLibrary={() => setShowLibrary(false)}
      onItemLayoutChange={handleItemLayoutChange}
      onItemDoubleClick={handleChartDoubleClick}
      onConfirmExitEdit={handleConfirmExitEdit}
      onCancelExitEdit={handleCancelExitEdit}
      onConfirmRemoveChart={handleConfirmRemoveChart}
      onCancelRemoveChart={handleCancelRemoveChart}
      onCloseEditSidebar={() => {
        setShowEditSidebar(false);
        setSelectedChartId(null);
      }}
    />
  );
};
