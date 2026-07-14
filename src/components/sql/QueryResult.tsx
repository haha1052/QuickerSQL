import React from 'react';
import { useQueryStore } from '../../store';
import { QueryResultItem } from './QueryResultItem';
import { useLocale } from '../../context/LocaleContext';

export const QueryResult: React.FC = () => {
  const sqlQueries = useQueryStore(s => s.sqlQueries);
  const activeQueryId = useQueryStore(s => s.activeQueryId);
  const queryLoading = useQueryStore(s => s.queryLoading);
  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
  const { t } = useLocale();

  if (!activeQuery) {
    return null;
  }

  const batchResults = activeQuery.batchResults;
  const isLoading = queryLoading === activeQueryId;

  return (
    <div style={styles.container}>
      {isLoading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>{t('query.running')}</div>
        </div>
      ) : batchResults !== null && batchResults !== undefined ? (
        <div style={styles.resultsContainer}>
          {batchResults.map((result, index) => (
            <QueryResultItem key={index} result={result} index={index} />
          ))}
        </div>
      ) : (
        <div style={styles.emptyContainer}>
          <span style={styles.emptyText}>{t('query.clickToRun')}</span>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    background: 'var(--bg-primary)',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    minHeight: 200,
    background: 'var(--bg-primary)',
  },
  loadingText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  resultsContainer: {
    overflowX: 'hidden',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    minHeight: 200,
    background: 'var(--bg-primary)',
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
};
