import React, { useState, useEffect, useCallback } from 'react';
import { useLocale } from '../../context/LocaleContext';
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



interface TrashPanelProps {
  onBack?: () => void;
  onRefresh?: () => void;
}

const TrashPanel: React.FC<TrashPanelProps> = ({ onBack, onRefresh }) => {
  const { t } = useLocale();
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<TrashItem | null>(null);

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
        alert(response.data || t('trash.restoreSuccess'));
        await loadTrashList();
        if (onRefresh) onRefresh();
      } else {
        alert(`${t('trash.restoreFail')}: ${response.error}`);
      }
    } catch (err) {
      console.error('Failed to restore:', err);
      alert(`${t('trash.restoreFail')}: ${err}`);
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
        alert(response.data || t('trash.permanentDeleted'));
        await loadTrashList();
      } else {
        alert(`${t('trash.deleteFail')}: ${response.error}`);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert(`${t('trash.deleteFail')}: ${err}`);
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
          <div className="trash-list">
            {trashItems.map((item) => (
              <div
                key={item.id}
                className={`trash-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="trash-item-info">
                  <div className="trash-item-name">
                    📊 {item.original_table_name}
                  </div>
                  <div className="trash-item-meta">
                    <span className="meta-item">
                      {t('trash.rowCount')} {item.row_count.toLocaleString()}
                    </span>
                    <span className="meta-item">
                      {t('trash.deletedAt')} {formatDate(item.deleted_at)}
                    </span>
                    <span className={`meta-tag ${item.strategy.toLowerCase()}`}>
                      {item.strategy === 'Rename' ? t('trash.rename') : t('trash.parquet')}
                    </span>
                  </div>
                </div>

                <div className="trash-item-actions">
                  <button
                    className="btn-action btn-restore"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(item);
                    }}
                    disabled={loading}
                  >
                    {t('trash.restore')}
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePermanentDelete(item);
                    }}
                    disabled={loading}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrashPanel;
