import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from '../../context/LocaleContext';
import { useAppStore } from '../../store';
import { computeVisibleRange, indexToOffset } from '../../utils/virtual';
import './TrashPanel.css';

interface TrashItem {
  id: string;
  original_table_name: string;
  trash_table_name?: string;
  trash_file_path?: string;
  row_count: number;
  strategy: string;
  deleted_at: string;
  deleted_by?: string;
}

const TRASH_ITEM_HEIGHT = 50;



interface TrashPanelProps {
  onBack?: () => void;
  onRefresh?: () => void;
}

const TrashPanel: React.FC<TrashPanelProps> = ({ onBack, onRefresh }) => {
  const { t } = useLocale();
  const { setMessage } = useAppStore();
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(500);

  const visibleRange = computeVisibleRange(
    scrollTop,
    viewportHeight,
    TRASH_ITEM_HEIGHT,
    trashItems.length,
    4,
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (e.currentTarget.clientHeight !== viewportHeight) {
      setViewportHeight(e.currentTarget.clientHeight);
    }
  }, [viewportHeight]);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN');
    } catch {
      return dateStr;
    }
  };

  const loadTrashList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { tauriService } = await import('../../services');
      const response = await tauriService.getTrashList();
      
      if (response.success && response.data) {
        setTrashItems(response.data.items || []);
      } else {
        setError(response.error || t('trash.loadFailed'));
      }
    } catch (err) {
      console.error('Failed to load trash list:', err);
      setError(`${t('trash.loadFailed')}: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRestore = async (item: TrashItem) => {
    if (!confirm(`${t('trash.confirmRestore').replace('{tableName}', item.original_table_name)}`)) {
      return;
    }

    try {
      setLoading(true);
      const { tauriService } = await import('../../services');
      const response = await tauriService.restoreFromTrash(item.id);
      
      if (response.success) {
        setMessage(response.data || t('trash.restoreSuccess'), 'success');
        await loadTrashList();
        if (onRefresh) onRefresh();
      } else {
        console.error('[TrashPanel] Restore failed:', response.error);
        setMessage('trash.restoreFailed', 'error');
      }
    } catch (err) {
      console.error('Failed to restore:', err);
      setMessage('trash.restoreFailed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    if (!confirm(`${t('trash.confirmPermanentDelete').replace('{tableName}', item.original_table_name)}`)) {
      return;
    }

    try {
      setLoading(true);
      const { tauriService } = await import('../../services');
      const response = await tauriService.permanentDelete(item.id);
      
      if (response.success) {
        setMessage(response.data || t('trash.permanentDeleted'), 'success');
        await loadTrashList();
      } else {
        setMessage(`${t('trash.deleteFail')}: ${response.error}`, 'error');
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      setMessage(`${t('trash.deleteFail')}: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrashList();
  }, [loadTrashList]);

  return (
    <div className="trash-panel">
      <div className="trash-header">
        <div className="trash-header-left">
          {onBack && (
            <button className="btn-back" onClick={onBack}>
              ← {t('common.back')}
            </button>
          )}
          <h2 className="trash-title">
            🗑️ {t('settings.category.trash')}
          </h2>
        </div>
        <button
          className="btn-refresh"
          onClick={loadTrashList}
          disabled={loading}
        >
          🔄 {t('common.refresh')}
        </button>
      </div>

      {error && (
        <div className="trash-error">{error}</div>
      )}

      <div className="trash-content">
        {loading && trashItems.length === 0 && (
          <div className="trash-loading">{t('common.loading')}</div>
        )}

        {!loading && trashItems.length === 0 && (
          <div className="trash-empty">
            <div className="empty-icon">🗑️</div>
            <p>{t('trash.empty')}</p>
          </div>
        )}

        {trashItems.length > 0 && (
          <div
            className="trash-list"
            ref={listContainerRef}
            onScroll={handleScroll}
            style={{ overflowY: 'auto', position: 'relative' }}
          >
            <div style={{ height: visibleRange.totalHeight, position: 'relative' }}>
              {trashItems.slice(visibleRange.start, visibleRange.end).map((item, idx) => {
                const actualIndex = visibleRange.start + idx;
                return (
                  <div
                    key={item.id}
                    className="trash-item"
                    style={{
                      position: 'absolute',
                      top: indexToOffset(actualIndex, TRASH_ITEM_HEIGHT),
                      height: TRASH_ITEM_HEIGHT,
                      left: 0,
                      right: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div className="trash-item-info">
                      <span className="trash-item-name">
                        📊 {item.original_table_name}
                      </span>
                      <span className="meta-item">
                        {t('trash.rowCount')} {item.row_count.toLocaleString()}
                      </span>
                      <span className="meta-item">
                        {t('trash.deletedAt')} {formatDate(item.deleted_at)}
                      </span>
                    </div>

                    <div className="trash-item-actions">
                      <button
                        className="btn-action btn-restore"
                        onClick={() => handleRestore(item)}
                        disabled={loading}
                      >
                        {t('trash.restore')}
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handlePermanentDelete(item)}
                        disabled={loading}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrashPanel;
