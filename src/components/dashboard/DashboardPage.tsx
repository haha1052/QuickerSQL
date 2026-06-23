import React, { useState, useEffect } from 'react';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardCanvas } from './DashboardCanvas';
import { DashboardFilterBar } from './filters/DashboardFilterBar';
import { ChartLibraryPanel } from './ChartLibraryPanel';
import { ChartEditSidebar } from './ChartEditSidebar';
import { useDashboardStore } from '../../store';
import { useStartupContext } from '../../AppWrapper';
import { exportDashboardToPng } from '../../utils/dashboardExport';

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
  } = useDashboardStore();
  const [isEditing, setIsEditing] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showEditSidebar, setShowEditSidebar] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState({
    gap: 16,
    rowHeight: 80,
    snapToGrid: true,
  });

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
      const hasChanges = Object.keys(tempLayout).length > 0;
      if (hasChanges) {
        const confirmed = confirm(
          `检测到 ${hasChanges} 个图表的布局已修改。\n\n点击"确定"保存更改并退出编辑模式，\n点击"取消"继续编辑。`
        );
        if (!confirmed) return; // 用户选择继续编辑
      }

      setSavingLayout(true);
      try {
        const { updateDashboardItem } = useDashboardStore.getState();
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
          alert(`⚠️ 部分布局保存失败（${failedCount}/${results.length} 项），请重试或检查网络连接。`);
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

  // v3 启动优化：优先消费 StartupContext 中的缓存数据，避免独立 IPC
  // 如果 startupData 为空（首次启动），则直接设为空数组；不触发任何 IPC
  const { startupData, isStartupLoaded } = useStartupContext();
  useEffect(() => {
    if (!isStartupLoaded || !startupData) return;
    if (startupData.dashboards.length > 0) {
      useDashboardStore.getState().setDashboardsFromStartup(startupData.dashboards);
    } else {
      useDashboardStore.getState().setDashboardsFromStartup([]);
    }
    if (startupData.savedCharts.length > 0) {
      useDashboardStore.getState().setSavedChartsFromStartup(startupData.savedCharts);
    } else {
      useDashboardStore.getState().setSavedChartsFromStartup([]);
    }
  }, [isStartupLoaded, startupData?.dashboards?.length, startupData?.savedCharts?.length]);

  // 若存在仪表盘列表但没选，则默认选择第一个仪表盘
  useEffect(() => {
    if (!activeDashboardId && dashboards.length > 0) {
      setActiveDashboard(dashboards[0].id);
    }
  }, [activeDashboardId, dashboards]);

  useEffect(() => {
    const { resetFilters } = useDashboardStore.getState();
    resetFilters();
  }, [activeDashboardId]);

  useEffect(() => {
    if (selectedChartId) {
      setShowEditSidebar(true);
    } else {
      setShowEditSidebar(false);
    }
  }, [selectedChartId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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
          if (confirm('确定从仪表盘移除该图表吗？')) {
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

  if (dashboards.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>📊</div>
        <div style={styles.emptyTitle}>暂无仪表盘</div>
        <div style={styles.emptyDesc}>创建您的第一个仪表盘来展示数据可视化</div>
        <button
          style={styles.createButton}
          onClick={async () => {
            const { createDashboard } = useDashboardStore.getState();
            const name = prompt('仪表盘名称：', '新仪表盘');
            if (name?.trim()) {
              await createDashboard(name.trim());
            }
          }}
        >
          + 新建仪表盘
        </button>
      </div>
    );
  }

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards[0];

  // P3-1：导出仪表盘为 PNG
  const handleExportPng = async () => {
    if (!activeDashboard) return;
    const canvasEl = document.querySelector('[data-dashboard-canvas="true"]') as HTMLElement | null;
    await exportDashboardToPng(activeDashboard, canvasEl, activeDashboard.name);
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
        layoutSettings={layoutSettings}
        onLayoutSettingsChange={setLayoutSettings}
      />
      {/* P1 UX：编辑模式提示条 */}
      {isEditing && (
        <div style={styles.editModeBanner}>
          <span style={styles.editModeIcon}>✏️</span>
          <span style={styles.editModeText}>
            编辑模式 — 拖拽移动 / 右下角圆点缩放 / 方向键微调(Shift大步) / Delete删除 / Esc退出
          </span>
          {Object.keys(tempLayout).length > 0 && (
            <span style={styles.editModeChanged}>
              · 已修改 {Object.keys(tempLayout).length} 项
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
  emptyIcon: { fontSize: '64px' },
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
};
