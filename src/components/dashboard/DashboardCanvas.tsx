import React, { useState } from 'react';
import { DashboardItem } from './DashboardItem';
import { AddChartModal } from './AddChartModal';
import { useDashboardStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import type { Dashboard } from '../../types/dashboard';

interface DashboardCanvasProps {
  dashboard: Dashboard | null;
  isEditing: boolean;
  tempLayout?: Record<string, { x: number; y: number; width: number; height: number }>;
  onItemLayoutChange?: (itemId: string, layout: { x: number; y: number; width: number; height: number }) => void;
  onItemDoubleClick?: (chartId: string) => void;
  layoutSettings?: { gap: number; rowHeight: number; snapToGrid: boolean };
}

export const DashboardCanvas: React.FC<DashboardCanvasProps> = ({
  dashboard,
  isEditing,
  tempLayout = {},
  onItemLayoutChange,
  onItemDoubleClick,
  layoutSettings = { gap: 16, rowHeight: 80, snapToGrid: true },
}) => {
  const { t } = useLocale();
  const [showAddModal, setShowAddModal] = useState(false);
  const { removeChartFromDashboard } = useDashboardStore();

  const effectiveGap = dashboard?.gridGap ?? layoutSettings.gap;
  const effectiveRowHeight = dashboard?.rowHeight ?? layoutSettings.rowHeight;
  const effectiveSnapToGrid = dashboard?.snapToGrid ?? layoutSettings.snapToGrid;
  const effectiveLayoutSettings = {
    gap: effectiveGap,
    rowHeight: effectiveRowHeight,
    snapToGrid: effectiveSnapToGrid,
  };

  if (!dashboard) {
    return (
      <div style={styles.emptyCanvas}>
        请选择或创建一个仪表盘
      </div>
    );
  }

  const canvasPadding = dashboard?.padding ?? 16;

  // 当画布宽度固定时，使用固定列宽（像素），否则使用 1fr 自适应
  const hasFixedWidth = dashboard?.canvasWidth && dashboard.canvasWidth > 0;
  const totalPaddingGap = canvasPadding * 2 + effectiveGap * 11;
  const colWidth = hasFixedWidth
    ? Math.floor(((dashboard!.canvasWidth as number) - totalPaddingGap) / 12)
    : null;

  const isEmpty = dashboard.layout.length === 0;

  return (
    <div
      style={{
        ...styles.canvas,
        gap: `${effectiveGap}px`,
        gridAutoRows: `${effectiveRowHeight}px`,
        padding: `${canvasPadding}px`,
        backgroundColor: dashboard?.backgroundColor || undefined,
        backgroundImage: dashboard?.backgroundImage ? `url(${dashboard.backgroundImage})` : undefined,
        backgroundSize: dashboard?.backgroundImage ? 'cover' : undefined,
        backgroundPosition: dashboard?.backgroundImage ? 'center' : undefined,
        height: dashboard?.canvasHeight && dashboard.canvasHeight > 0 ? `${dashboard.canvasHeight}px` : undefined,
        width: dashboard?.canvasWidth && dashboard.canvasWidth > 0 ? `${dashboard.canvasWidth}px` : undefined,
        // 固定宽度时使用固定像素列宽，否则使用 1fr 自适应
        gridTemplateColumns: colWidth ? `repeat(12, ${colWidth}px)` : undefined,
        alignItems: isEmpty ? 'center' : undefined,
        justifyContent: isEmpty ? 'center' : undefined,
      }}
      data-dashboard-canvas="true"
    >
      {isEmpty && (
        <div style={styles.emptyCanvas}>
          <div style={styles.emptyIcon}>📊</div>
          <div style={styles.emptyText}>{t('dashboard.empty')}</div>
          <div style={styles.emptyHint}>
            点击下方按钮添加已保存的图表，或先到 SQL 查询页保存图表
          </div>
          <button style={styles.addChartBtn} onClick={() => setShowAddModal(true)}>
            + 添加图表
          </button>

          {/* 添加图表弹窗 */}
          {showAddModal && (
            <AddChartModal
              dashboardId={dashboard.id}
              onClose={() => setShowAddModal(false)}
              onAdded={() => setShowAddModal(false)}
            />
          )}
        </div>
      )}

      {!isEmpty && dashboard.layout.map((item) => {
        // 合并 tempLayout：优先使用 tempLayout 中的覆盖值
        const override = tempLayout[item.id];
        const effectiveX = override ? override.x : item.x;
        const effectiveY = override ? override.y : item.y;
        const effectiveWidth = override ? override.width : item.width;
        const effectiveHeight = override ? override.height : item.height;

        return (
          <DashboardItem
            key={item.id}
            item={{ ...item, x: effectiveX, y: effectiveY, width: effectiveWidth, height: effectiveHeight }}
            isEditing={isEditing}
            onRemove={isEditing ? () => removeChartFromDashboard(item.id) : undefined}
            onLayoutChange={isEditing && onItemLayoutChange ? (layout) => onItemLayoutChange(item.id, layout) : undefined}
            onDoubleClick={onItemDoubleClick ? () => onItemDoubleClick(item.chartId) : undefined}
            layoutSettings={effectiveLayoutSettings}
          />
        );
      })}

      {/* 编辑模式下显示添加按钮 */}
      {isEditing && (
        <div style={styles.addChartPlaceholder}>
          <button style={styles.addChartBtn} onClick={() => setShowAddModal(true)}>
            + 添加图表
          </button>
        </div>
      )}

      {/* 添加图表弹窗 */}
      {showAddModal && dashboard && (
        <AddChartModal
          dashboardId={dashboard.id}
          onClose={() => setShowAddModal(false)}
          onAdded={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gridAutoRows: '80px',
    gap: '16px',
    padding: '16px',
    overflow: 'auto',
    // 添加 alignItems: 'stretch' 确保子元素高度一致
    alignItems: 'stretch',
  },
  emptyCanvas: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    gridColumn: '1 / -1',
    gridRow: '1 / -1',
    marginTop: '100px',
  },
  emptyIcon: { fontSize: '48px' },
  emptyText: { fontSize: '16px', fontWeight: 600 },
  emptyHint: { fontSize: '13px', color: 'var(--text-tertiary)' },
  addChartBtn: {
    padding: '8px 20px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  addChartPlaceholder: {
    gridColumn: '1 / -1',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: '2px dashed var(--border-primary)',
    borderRadius: '8px',
    minHeight: '80px',
  },
};
