import React, { useState } from 'react';
import { DashboardItem } from './DashboardItem';
import { AddChartModal } from './AddChartModal';
import { useDashboardStore } from '../../store/dashboardStore';
import type { Dashboard } from '../../types/dashboard';

interface DashboardCanvasProps {
  dashboard: Dashboard | null;
  isEditing: boolean;
  tempLayout?: Record<string, { x: number; y: number; width: number; height: number }>;
  onItemLayoutChange?: (itemId: string, layout: { x: number; y: number; width: number; height: number }) => void;
}

export const DashboardCanvas: React.FC<DashboardCanvasProps> = ({
  dashboard,
  isEditing,
  tempLayout = {},
  onItemLayoutChange,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const { removeChartFromDashboard } = useDashboardStore();

  if (!dashboard) {
    return (
      <div style={styles.emptyCanvas}>
        请选择或创建一个仪表盘
      </div>
    );
  }

  if (dashboard.layout.length === 0) {
    return (
      <div style={styles.emptyCanvas}>
        <div style={styles.emptyIcon}>📊</div>
        <div style={styles.emptyText}>暂无图表</div>
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
    );
  }

  return (
    <div style={styles.canvas} data-dashboard-canvas="true">
      {dashboard.layout.map((item) => {
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
  },
  emptyCanvas: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    color: 'var(--text-secondary)',
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
