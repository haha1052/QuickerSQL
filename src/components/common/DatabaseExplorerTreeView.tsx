import React from 'react';
import { ChevronRightIcon } from './Icons';
import { useLocale } from '../../context/LocaleContext';
import type { TableInfo } from '../../types';

// ============ 常量 ============
const ICON_SIZE = 14;

// ============ 类型定义 ============
/** 单个分组的结构（由父组件根据 groupMode + sortedTables 计算后传入） */
export interface GroupInfo {
  /** 分组显示标题（已本地化） */
  title: string;
  /** 分组下的表列表 */
  items: TableInfo[];
  /** 是否高亮（系统表分组用） */
  accent: boolean;
  /** 分组标识（user/system/首字母/other/all） */
  groupKey: string;
}

/**
 * DatabaseExplorer 树形分组渲染组件
 *
 * 职责：
 * - 渲染分组标题（含展开/收起箭头、分组名、计数徽章）
 * - 渲染分组下的表行（通过 renderTable 回调由父组件提供实际渲染逻辑）
 * - 渲染分组为空时的提示文案（用户表/系统表/首字母前缀三种）
 *
 * 该组件不持有任何状态，所有展开/收起状态由父组件管理。
 */
export interface DatabaseExplorerTreeViewProps {
  /** 已计算好的分组列表 */
  groups: GroupInfo[];
  /** 当前分组模式（影响展开箭头是否可见、空提示文案选择） */
  groupMode: 'system_user' | 'first_letter' | 'none';
  /** 判断某个分组是否展开 */
  getGroupExpanded: (g: GroupInfo) => boolean;
  /** 切换某个分组的展开/收起 */
  onToggleGroup: (g: GroupInfo) => void;
  /** 渲染单个表行的回调（由父组件用 DatabaseExplorerTableList 实现） */
  renderTable: (table: TableInfo) => React.ReactNode;
}

const DatabaseExplorerTreeViewComponent: React.FC<DatabaseExplorerTreeViewProps> = ({
  groups,
  groupMode,
  getGroupExpanded,
  onToggleGroup,
  renderTable,
}) => {
  const { t } = useLocale();

  return (
    <>
      {groups.map((g, idx) => {
        const isExpanded = getGroupExpanded(g);
        const isToggleable = groupMode !== 'none';
        return (
          <div key={g.title + idx} style={styles.groupItem}>
            <div
              style={styles.groupHeader}
              onClick={isToggleable ? () => onToggleGroup(g) : undefined}
            >
              <span style={{
                ...styles.iconCell,
                ...(isExpanded ? styles.chevronRotatedCell : {}),
                ...(groupMode === 'none' ? { visibility: 'hidden' } : {}),
              }}>
                <ChevronRightIcon size={ICON_SIZE} color="var(--text-tertiary)" />
              </span>
              <span style={{ ...styles.groupTitle, ...(g.accent ? styles.groupTitleAccent : {}) }}>
                {g.title}
              </span>
              <span style={styles.groupCount}>{g.items.length}</span>
            </div>
            {isExpanded && g.items.length > 0 && (
              <div style={styles.groupChildren}>{g.items.map(renderTable)}</div>
            )}
            {isExpanded && g.items.length === 0 && (
              <div style={styles.groupEmptyHint}>
                {g.groupKey === 'user' && (
                  <>{t('database.noUserTablesHint1')} <b>SQL</b> {t('database.noUserTablesHint2')} <code style={styles.codeTip}>CREATE TABLE "{t('database.tableNamePlaceholder')}" (...)</code> {t('database.noUserTablesHint3')} <b>{t('database.importCSVExcel')}</b> {t('database.noUserTablesHint4')}</>
                )}
                {g.groupKey === 'system' && t('database.noSystemTables')}
                {g.groupKey !== 'user' && g.groupKey !== 'system' && t('database.noTablesWithPrefix', { prefix: g.title })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

/** 用 React.memo 包装避免父组件重渲染时的无谓更新 */
export const DatabaseExplorerTreeView = React.memo(DatabaseExplorerTreeViewComponent);
DatabaseExplorerTreeView.displayName = 'DatabaseExplorerTreeView';

// ============ 样式 ============
const styles: Record<string, React.CSSProperties> = {
  groupItem: {
    marginBottom: '2px',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 8px',
    cursor: 'pointer',
    borderRadius: '4px',
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    transition: 'background 0.2s',
  },
  groupTitle: {
    flex: 1,
  },
  groupTitleAccent: {
    color: 'var(--accent-color)',
  },
  groupCount: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    background: 'var(--bg-tertiary)',
    padding: '1px 6px',
    borderRadius: '10px',
  },
  groupChildren: {
    marginLeft: '8px',
    borderLeft: '1px solid var(--border-primary)',
    paddingLeft: '4px',
    overflowY: 'auto',
    overflowX: 'auto',
    maxHeight: 'calc(50vh - 80px)',
    minHeight: 0,
  },
  groupEmptyHint: {
    marginLeft: '8px',
    padding: '12px 16px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
    borderLeft: '3px solid var(--text-tertiary)',
    lineHeight: '1.6',
  },
  codeTip: {
    display: 'inline-block',
    padding: '2px 6px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    fontSize: '11px',
    borderRadius: '3px',
    margin: '0 2px',
  },
  iconCell: {
    width: 16,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 0,
    transition: 'transform 0.15s ease',
    transformOrigin: 'center',
  },
  chevronRotatedCell: {
    transform: 'rotate(90deg)',
  },
};
