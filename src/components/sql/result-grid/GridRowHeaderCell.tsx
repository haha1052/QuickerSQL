/**
 * GridRowHeaderCell.tsx — 行号列表头组件（#）
 *
 * 单击：dispatch CustomEvent 'grid:rowHeaderClicked' → 外层 selection.handleRowHeaderClicked 选全表
 * 右键：dispatch CustomEvent 'grid:rowHeaderContextMenu' → 外层右键菜单 + 全选
 */
import React, { useCallback } from 'react';
import { useLocale } from '../../../context/LocaleContext';

export const GridRowHeaderCell: React.FC<{ displayName?: string; localeText?: Record<string, string> }> = () => {
  const { t } = useLocale();
  const tip = t('grid.header.selectAll');

  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    document.dispatchEvent(
      new CustomEvent('grid:rowHeaderClicked', {
        detail: {
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
        },
      }),
    );
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(
      new CustomEvent('grid:rowHeaderContextMenu', {
        detail: {
          x: e.clientX,
          y: e.clientY,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
        },
      }),
    );
  }, []);

  return (
    <div
      className="rg-header-cell rg-header-rowheader"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={tip}
    >
      <span className="rg-header-label">#</span>
    </div>
  );
};

export default GridRowHeaderCell;
