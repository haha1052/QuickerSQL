/**
 * CellDetailModal.tsx — 单元格详情弹窗
 *
 * 展示长文本/JSON 美化内容，支持复制。
 * 从右键菜单"查看单元格内容…"打开。
 */
import React, { useMemo } from 'react';
import { useLocale } from '../../../context/LocaleContext';
import { writeClipboard } from '../../../utils/resultCopy';
import { useAppStore } from '../../../store';
import './ResultGrid.css';

interface CellDetailModalProps {
  /** 单元格值 */
  value: string | null;
  /** 列名 */
  header: string | null;
  /** 关闭回调 */
  onClose: () => void;
}

export const CellDetailModal: React.FC<CellDetailModalProps> = ({
  value,
  header,
  onClose,
}) => {
  const { t } = useLocale();
  const { setMessage } = useAppStore();

  // 尝试 JSON 美化
  const displayValue = useMemo(() => {
    if (value === null) return 'NULL';
    // 尝试解析为 JSON 并美化
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }, [value]);

  const isLong = (value ?? '').length > 100;

  const handleCopy = async () => {
    const text = value ?? '';
    const ok = await writeClipboard(text);
    if (ok) {
      setMessage(t('grid.selection.copied'), 'success');
    } else {
      setMessage(t('hooks.copyFail'), 'error');
    }
    onClose();
  };

  // 点击遮罩关闭
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Escape 关闭
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="rg-cell-detail-overlay" onClick={handleOverlayClick} onKeyDown={handleKeyDown}>
      <div className="rg-cell-detail-modal">
        <div className="rg-cell-detail-header">
          <span className="rg-cell-detail-title">
            {header ? `${t('grid.view.cellDetail')} — ${header}` : t('grid.view.cellDetail')}
          </span>
          <button className="rg-cell-detail-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="rg-cell-detail-body">
          <pre className={`rg-cell-detail-pre${isLong ? ' rg-cell-detail-long' : ''}`}>
            {displayValue}
          </pre>
        </div>
        <div className="rg-cell-detail-footer">
          <span className="rg-cell-detail-meta">
            {(value ?? '').length.toLocaleString()} chars
          </span>
          <button className="rg-cell-detail-copy-btn" onClick={handleCopy}>
            {t('grid.copy.cell')}
          </button>
        </div>
      </div>
    </div>
  );
};
