import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { QueryHistoryItem } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import { useAppStore } from '../../store';
import { computeVisibleRange } from '../../utils/virtual';
import './QueryHistory.css';

interface QueryHistoryProps {
  onBack?: () => void;
  onExecuteSql?: (sql: string) => void;
}

const ITEM_HEIGHT = 50;
const VIEWPORT_HEIGHT = 520;
const OVERSCAN = 5;

const QueryHistory: React.FC<QueryHistoryProps> = ({ onBack, onExecuteSql }) => {
  const { t } = useLocale();
  const { setMessage } = useAppStore();
  const [historyItems, setHistoryItems] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const range = computeVisibleRange(scrollTop, VIEWPORT_HEIGHT, ITEM_HEIGHT, historyItems.length, OVERSCAN);
  const visibleItems = historyItems.slice(range.start, range.end);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { tauriService } = await import('../../services');
      const response = await tauriService.getQueryHistory({
        search: search || null,
        only_favorites: onlyFavorites || null,
      });

      if (response.success && response.data) {
        setHistoryItems(response.data.items || []);
      } else {
        setError(response.error || t('queryHistory.loadFailed'));
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      setError(`${t('queryHistory.loadFailed')}: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [search, onlyFavorites]);

  const handleToggleFavorite = async (item: QueryHistoryItem) => {
    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.updateQueryFavorite({
        id: item.id,
        is_favorite: !item.is_favorite,
      });

      if (response.success) {
        await loadHistory();
      }
    } catch (err) {
      console.error('Failed to update favorite:', err);
    }
  };

  const handleDelete = async (item: QueryHistoryItem) => {
    if (!confirm(t('queryHistory.confirmDelete'))) {
      return;
    }

    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.deleteQueryHistory(item.id);

      if (response.success) {
        setMessage('toast.deletedSuccess', 'success');
        await loadHistory();
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      console.error('Failed to delete history:', err);
      setMessage(`${t('common.error')}: ${err}`, 'error');
    }
  };

  const handleExecute = (item: QueryHistoryItem) => {
    if (onExecuteSql) {
      onExecuteSql(item.sql);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="query-history">
      <div className="history-header">
        <div className="history-header-left">
          {onBack && (
            <button className="btn-back" onClick={onBack}>
              ← {t('common.back')}
            </button>
          )}
          <h2 className="history-title">📜 {t('queryHistory.title')}</h2>
        </div>
        <button className="btn-refresh" onClick={loadHistory} disabled={loading}>
          🔄 {t('common.refresh')}
        </button>
      </div>

      <div className="history-filter-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder={t('queryHistory.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <label className="favorite-filter">
          <input
            type="checkbox"
            checked={onlyFavorites}
            onChange={(e) => setOnlyFavorites(e.target.checked)}
          />
          <span>{t('queryHistory.favoritesOnly')}</span>
        </label>
      </div>

      {error && <div className="history-error">{error}</div>}

      <div className="history-content">
        {loading && historyItems.length === 0 && (
          <div className="history-loading">{t('common.loading')}</div>
        )}

        {!loading && historyItems.length === 0 && (
          <div className="history-empty">
            <div className="empty-icon">📜</div>
            <p>{t('queryHistory.empty')}</p>
          </div>
        )}

        {historyItems.length > 0 && (
          <div
            ref={scrollContainerRef}
            style={{ height: VIEWPORT_HEIGHT, overflowY: 'auto', position: 'relative' }}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          >
            <div style={{ height: range.totalHeight, position: 'relative' }}>
              {visibleItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: (range.start + idx) * ITEM_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ITEM_HEIGHT,
                  }}
                >
                  <div className={`history-item ${!item.success ? 'failed' : ''}`}>
                    <div className="status-badge">
                      {item.success ? '✅' : '❌'}
                    </div>
                    <div
                      className="history-item-sql"
                      title={item.sql}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        const target = e.currentTarget;
                        const selection = window.getSelection();
                        const range = document.createRange();
                        range.selectNodeContents(target);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const menu = document.createElement('div');
                        menu.className = 'sql-context-menu';
                        menu.innerHTML = `<button>${t('queryHistory.copy')}</button>`;
                        menu.style.position = 'fixed';
                        menu.style.left = `${e.clientX}px`;
                        menu.style.top = `${e.clientY}px`;
                        document.body.appendChild(menu);

                        const copyBtn = menu.querySelector('button');
                        copyBtn?.addEventListener('click', async () => {
                          await navigator.clipboard.writeText(item.sql);
                          setMessage('toast.copied', 'success');
                          menu.remove();
                        });

                        const handleClickOutside = (event: MouseEvent) => {
                          if (!menu.contains(event.target as Node)) {
                            menu.remove();
                            document.removeEventListener('click', handleClickOutside);
                          }
                        };
                        document.addEventListener('click', handleClickOutside);
                      }}
                    >
                      {item.sql}
                    </div>
                    <button
                      className={`btn-favorite ${item.is_favorite ? 'active' : ''}`}
                      onClick={() => handleToggleFavorite(item)}
                      title={item.is_favorite ? t('queryHistory.unfavorite') : t('queryHistory.favorite')}
                    >
                      {item.is_favorite ? '⭐' : '☆'}
                    </button>
                    <button
                      className="btn-action btn-execute"
                      onClick={() => handleExecute(item)}
                      disabled={loading}
                      title={t('queryHistory.execute')}
                    >
                      ▶
                    </button>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(item)}
                      disabled={loading}
                      title={t('common.delete')}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryHistory;
