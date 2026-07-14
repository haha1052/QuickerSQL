import React, { useState, useEffect, useRef } from 'react';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardFilterBar } from './filters/DashboardFilterBar';
import { ChartLibraryPanel } from './ChartLibraryPanel';
import { ChartEditSidebar } from './ChartEditSidebar';
import { useDashboardStore } from '../../store';
import { useStartupContext } from '../../AppWrapper';
import { exportDashboardToPng } from '../../utils/dashboardExport';
import { useLocale } from '../../context/LocaleContext';
import { useToastStore } from '../../store/toastStore';

export const DashboardPage: React.FC = () => {
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
  } = useDashboardStore();
  const { t } = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showEditSidebar, setShowEditSidebar] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [creatingDashboard, setCreatingDashboard] = useState(false);
  const [layoutSettings] = useState({
    gap: 16,
    rowHeight: 80,
    snapToGrid: true,
  });

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

  // T3+T4: 编辑模式下的临时布局（按 itemId 存储覆盖后的位置/尺寸）
  const [tempLayout, setTempLayout] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});

  // 进入编辑模式时清空临时布局
  useEffect(() => {
    if (isEditing) {
      setTempLayout({});
    }
  }, [isEditing]);

  // T3: 图表项位置/尺寸变更回调（在拖拽/缩放时持续调用）
  const handleItemLayoutChange = (
    itemId: string,
    layout: { x: number; y: number; width: number; height: number }
  ) => {
    setTempLayout((prev) => ({ ...prev, [itemId]: layout }));
  };

  // T2: 退出编辑模式时：先把临时布局应用到 store，再调用 saveLayout 保存
  // P1 改进：退出前确认是否保存；保存改为并行调用 + 错误收集
  const handleToggleEdit = async () => {
    if (isEditing && activeDashboard) {
      // 有布局变更时，询问用户是否保存
      const changedCount = Object.keys(tempLayout).length;
      if (changedCount > 0) {
        const confirmed = confirm(
          t('dashboard.confirmSaveLayout', {
            count: changedCount,
            confirm: t('common.confirm'),
            cancel: t('common.cancel'),
          })
        );
        if (!confirmed) return; // 用户选择继续编辑
      }

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
          alert(t('dashboard.layoutSavePartialFailed', {
            failedCount,
            totalCount: results.length,
          }));
        } else {
          // 保存成功后重新加载完整数据，确保 store 中的 layout 与后端一致
          await loadDashboards();
        }
      } finally {
        setSavingLayout(false);
        setIsEditing(false);
        setTempLayout({});
      }
    } else {
      setIsEditing(true);
    }
  };

  // 保存仪表盘（保存按钮和 Ctrl+S 快捷键触发）
  const handleSave = async () => {
    if (!activeDashboard || isSaving) return;

    // 非编辑模式下点击保存，提示用户
    if (!isEditing) {
      useToastStore.getState().addToast('请先进入编辑模式再保存', 'warning');
      return;
    }

    // 编辑模式但无布局变更
    if (Object.keys(tempLayout).length === 0) {
      useToastStore.getState().addToast('没有未保存的变更', 'info');
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
        useToastStore.getState().addToast('保存成功', 'success');
      } else {
        useToastStore.getState().addToast('保存失败：未知错误', 'error');
      }
    } catch (e) {
      console.error('[DashboardPage] 保存失败:', e);
      useToastStore.getState().addToast(`保存失败：${(e as Error).message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // v3 启动优化：优先消费 StartupContext 中的缓存数据，避免独立 IPC
  // 注意：DashboardLite 是精简数据（不含 layout），设置缓存后需加载完整数据
  const { startupData, isStartupLoaded } = useStartupContext();
  const hasLoadedRef = useRef(false);

  // 统一加载逻辑：
  // 1. 启动数据就绪时：先设置缓存（精简数据），再触发完整加载
  // 2. 组件挂载但无启动缓存（项目切换后进入）：直接加载
  // 使用 hasLoadedRef 确保只触发一次完整加载，避免竞态
  useEffect(() => {
    if (hasLoadedRef.current) return;

    if (isStartupLoaded && startupData) {
      hasLoadedRef.current = true;

      if (startupData.dashboards.length > 0) {
        useDashboardStore.getState().setDashboardsFromStartup(startupData.dashboards);
      }
      if (startupData.savedCharts.length > 0) {
        useDashboardStore.getState().setSavedChartsFromStartup(startupData.savedCharts);
      }

      const currentDashboards = useDashboardStore.getState().dashboards;
      const needsFullLoad = currentDashboards.length > 0 && currentDashboards.every(d => d.layout.length === 0);

      if (needsFullLoad || currentDashboards.length === 0) {
        useDashboardStore.getState().loadDashboards();
      }
    } else if (dashboards.length === 0 && !loading) {
      hasLoadedRef.current = true;
      useDashboardStore.getState().loadDashboards();
    }
  }, [isStartupLoaded, startupData, dashboards.length, loading]);

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
          if (confirm(t('dashboard.confirmRemoveChart'))) {
            useDashboardStore.getState().removeChartFromDashboard(targetItem.id);
            setSelectedChartId(null);
          }
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
      alert(t('dashboard.createFailed'));
    } finally {
      setCreatingDashboard(false);
    }
  };

  if (loading && dashboards.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>⏳</div>
        <div style={styles.emptyTitle}>加载中...</div>
        <div style={styles.emptyDesc}>正在读取仪表盘数据</div>
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <>
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>📊</div>
          <div style={styles.emptyTitle}>{t('dashboard.noDashboards')}</div>
          <div style={styles.emptyDesc}>{t('dashboard.createFirstDashboardHint')}</div>
          <button
            style={styles.createButton}
            onClick={() => {
              setNewDashboardName(t('dashboard.newDashboardName'));
              setShowCreateModal(true);
            }}
          >
            {t('dashboard.createDashboard')}
          </button>
        </div>

        {showCreateModal && (
          <div
            style={styles.modalOverlay}
            onClick={() => {
              if (!creatingDashboard) setShowCreateModal(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !creatingDashboard) {
                setShowCreateModal(false);
              }
            }}
          >
            <div
              style={styles.modal}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !creatingDashboard) {
                  setShowCreateModal(false);
                }
              }}
              tabIndex={-1}
            >
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>{t('dashboard.createDashboard')}</h3>
                <button
                  style={styles.modalCloseBtn}
                  onClick={() => !creatingDashboard && setShowCreateModal(false)}
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
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  placeholder={t('dashboard.namePlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateDashboard();
                    } else if (e.key === 'Escape') {
                      if (!creatingDashboard) setShowCreateModal(false);
                    }
                  }}
                  autoFocus
                  disabled={creatingDashboard}
                />
              </div>
              <div style={styles.modalFooter}>
                <button
                  style={styles.modalCancelBtn}
                  onClick={() => setShowCreateModal(false)}
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
                  onClick={handleCreateDashboard}
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

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards[0];

  // P3-1：导出仪表盘为 PNG
  const handleExportPng = async () => {
    if (isEditing) {
      useToastStore.getState().addToast('请先退出编辑模式', 'warning');
      return;
    }
    if (!activeDashboard) {
      useToastStore.getState().addToast('没有活动的仪表盘', 'error');
      return;
    }
    const canvasEl = document.querySelector('[data-dashboard-canvas="true"]') as HTMLElement | null;
    const result = await exportDashboardToPng(activeDashboard, canvasEl, activeDashboard.name);
    if (result.success) {
      useToastStore.getState().addToast('导出成功', 'success');
    } else {
      useToastStore.getState().addToast(result.message, 'error');
    }
  };

  const mainContent = (
    <>
      <DashboardToolbar
        dashboard={activeDashboard}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
        savingLayout={savingLayout}
        onDashboardChange={setActiveDashboard}
        onToggleLibrary={() => setShowLibrary(v => !v)}
        libraryOpen={showLibrary}
        onExportPng={handleExportPng}
        onCanvasSettingsChange={handleCanvasSettingsChange}
        onSave={handleSave}
        isSaving={isSaving}
      />
      {/* P1 UX：编辑模式提示条 */}
      {isEditing && (
        <div style={styles.editModeBanner}>
          <span style={styles.editModeIcon}>✏️</span>
          <span style={styles.editModeText}>
            {t('dashboard.editModeHint')}
          </span>
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
        onItemLayoutChange={handleItemLayoutChange}
        onItemDoubleClick={handleChartDoubleClick}
        layoutSettings={layoutSettings}
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
        <ChartLibraryPanel open={true} onClose={() => setShowLibrary(false)} />
      )}

      {(() => {
        const chart = savedCharts.find((c) => c.id === selectedChartId);
        if (showEditSidebar && chart) {
          return (
            <ChartEditSidebar
              chart={chart}
              onClose={() => {
                setShowEditSidebar(false);
                setSelectedChartId(null);
              }}
            />
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
  leftPanel: {
    width: '320px',
    minWidth: '280px',
    maxWidth: '420px',
    borderRight: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  rightPanel: {
    width: '360px',
    minWidth: '300px',
    maxWidth: '480px',
    borderLeft: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  fullscreen: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
  },
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
