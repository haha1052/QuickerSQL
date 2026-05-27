import React from 'react';
import { useQueryStore } from '../../store';
import { QueryResultItem } from './QueryResultItem';
import { Colors, FontSizes } from '../../styles/design-system';

export const QueryResult: React.FC = () => {
  const { sqlQueries, activeQueryId, queryLoading } = useQueryStore();
  const activeQuery = sqlQueries.find(q => q.id === activeQueryId);

  if (!activeQuery) {
    return null;
  }

  const batchResults = activeQuery.batchResults;
  const isLoading = queryLoading === activeQueryId;

  return (
    <div style={styles.container}>
      {isLoading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>正在执行查询...</div>
        </div>
      ) : batchResults && batchResults.length > 0 ? (
        <div style={styles.resultsContainer}>
          {batchResults.map((result, index) => (
            <QueryResultItem key={index} result={result} index={index} />
          ))}
        </div>
      ) : (
        <div style={styles.emptyContainer}>
          <span style={styles.emptyText}>点击执行按钮运行查询</span>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    height: '100%',
  },
  loadingText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
  },
  resultsContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    height: '100%',
  },
  emptyText: {
    fontSize: FontSizes.body,
    color: Colors.textSecondary,
  },
};
