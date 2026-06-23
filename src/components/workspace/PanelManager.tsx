import React, { useState, useCallback } from 'react';
import type { Panel } from '../../types';
import { useWorkspaceStore, useQueryStore } from '../../store';
import { SQLEditor } from '../sql/SQLEditor';
import { QueryResult } from '../sql/QueryResult';
import { ChartPanel } from '../chart/ChartPanel';

interface PanelManagerProps {
  tabId: string;
  panels: Panel[];
}

export const PanelManager: React.FC<PanelManagerProps> = ({ tabId, panels }) => {
  const { updatePanel, tabs } = useWorkspaceStore();
  const { sqlQueries, activeQueryId, updateSqlQuery, setActiveQueryId } = useQueryStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartSizes, setDragStartSizes] = useState<number[]>([]);

  // 当前 Tab 绑定的 queryId（从 tab 数据里拿，而不是全局 activeQueryId）
  const tabData = tabs.find(t => t.id === tabId);
  const tabQueryId = tabData?.queryId || activeQueryId;
  
  // 确保全局 activeQueryId 与当前 tab.queryId 同步
  React.useEffect(() => {
    if (tabQueryId && activeQueryId !== tabQueryId) {
      setActiveQueryId(tabQueryId);
    }
  }, [tabQueryId, activeQueryId, setActiveQueryId]);

  const activeQuery = sqlQueries.find(q => q.id === tabQueryId);

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    setIsDragging(true);
    setDragIndex(index);
    setDragStartY(e.clientY);
    setDragStartSizes(panels.map(p => p.size));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || dragIndex === null) return;
    
    const container = document.getElementById('panel-container');
    if (!container) return;

    const containerHeight = container.clientHeight;
    const delta = e.clientY - dragStartY;
    const deltaPercent = (delta / containerHeight) * 100;
    
    const newSizes = [...dragStartSizes];
    newSizes[dragIndex] += deltaPercent;
    newSizes[dragIndex + 1] -= deltaPercent;
    
    // 确保面板大小在合理范围内
    newSizes.forEach((size, i) => {
      if (size < 20) {
        const diff = 20 - size;
        newSizes[i] = 20;
        if (i < newSizes.length - 1) newSizes[i + 1] -= diff;
      }
    });
    
    panels.forEach((panel, idx) => {
      updatePanel(tabId, panel.id, { size: newSizes[idx] });
    });
  }, [isDragging, dragIndex, dragStartY, dragStartSizes, panels, tabId, updatePanel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragIndex(null);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderPanelContent = (panel: Panel) => {
    switch (panel.type) {
      case 'sql_editor':
        // 使用当前 Tab 绑定的 queryId，确保每个 Tab 显示自己的查询
        const displayedQuery = activeQuery || sqlQueries[0];
        const displayedQueryId = displayedQuery?.id || tabQueryId;
        
        return (
          <SQLEditor
            query={displayedQuery}
            onChange={(sql) => updateSqlQuery(displayedQueryId, { sql })}
          />
        );
      case 'results_grid':
        return <QueryResult />;
      case 'chart':
        return (
          <ChartPanel
            queryResult={activeQuery?.result ? {
              columns: activeQuery.result.columns || [],
              rows: activeQuery.result.rows || []
            } : null}
          />
        );
      case 'query_plan':
        return (
          <div style={styles.placeholderPanel}>
            查询计划（即将推出）
          </div>
        );
      default:
        return (
          <div style={styles.placeholderPanel}>
            {panel.title}
          </div>
        );
    }
  };

  return (
    <div id="panel-container" style={styles.panelContainer}>
      {panels.map((panel, index) => {
        // size === 0 时跳过渲染（only-editor / only-results 模式）
        if (panel.size === 0) return null;

        return (
          <React.Fragment key={panel.id}>
            <div style={{
              ...styles.panel,
              height: `${panel.size}%`,
              minHeight: panel.type === 'results_grid' ? 200 : undefined,
            }}>
              <div style={styles.panelContent}>
                {renderPanelContent(panel)}
              </div>
            </div>

            {index < panels.length - 1 && panels[index + 1]?.size !== 0 && (
              <div
                style={{
                  ...styles.resizer,
                  cursor: isDragging && dragIndex === index ? 'row-resize' : 'ns-resize',
                  background: isDragging && dragIndex === index ? 'var(--primary)' : 'var(--border-primary)',
                }}
                onMouseDown={(e) => handleMouseDown(index, e)}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panelContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  resizer: {
    height: '4px',
    width: '100%',
    transition: 'background 0.2s',
  },
  placeholderPanel: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
};
