import React from 'react';
import { ChevronRightIcon, TableIcon, RefreshCwIcon, TrashIcon } from './Icons';
import { useLocale } from '../../context/LocaleContext';
import type { ColumnInfo, TableInfo } from '../../types';
import type { GroupMode } from './DatabaseExplorerSearchBar';

// ============ 常量 ============
const ICON_SIZE = 14;
const WRAPPER_SIZE = 16;

// ============ 工具函数 ============
/** 将数字按 zh-CN 区域格式化为千位分隔字符串 */
export const formatCount = (n: number) => n.toLocaleString('zh-CN');

/**
 * 将字节数格式化为带单位的可读字符串（B/KB/MB/GB/TB）
 * @param bytes - 字节数
 * @returns 形如 "1.5 MB" 的字符串；<=0 时返回 "0 B"
 */
export const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
};

/**
 * 搜索词高亮：在 text 中找到 keyword 并将其用 <mark> 包裹
 * @param text - 原始文本
 * @param keyword - 搜索关键词（大小写不敏感）
 * @returns 包含高亮 span 的 ReactNode；未匹配时返回原文本
 */
export const highlightText = (text: string, keyword: string): React.ReactNode => {
  if (!keyword) return text;
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  const idx = lower.indexOf(kw);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={tableListStyles.highlightMark}>{text.slice(idx, idx + kw.length)}</span>
      {text.slice(idx + kw.length)}
    </>
  );
};

/** 分组数据结构（由父组件计算后传入） */
export interface TableGroup {
  title: string;
  items: TableInfo[];
  accent: boolean;
  groupKey: string;
}

/**
 * DatabaseExplorer 表列表子组件
 *
 * 职责：
 * - 渲染分组列表（系统/用户分组、首字母分组、不分组）
 * - 渲染单个表行（表名、行数、列数、索引数、大小、删除按钮）
 * - 渲染展开的列信息（懒加载，含 PK、类型、NOT NULL、DEFAULT 标签）
 * - 分组折叠/展开
 * - 搜索无结果提示
 *
 * 设计：纯展示组件，所有状态由父组件通过 props 传入。
 */
export interface DatabaseExplorerTableListProps {
  /** 已分组的表数据 */
  groups: TableGroup[];
  /** 当前分组模式（控制是否可折叠分组） */
  groupMode: GroupMode;
  /** 是否正在加载 */
  loading: boolean;
  /** 搜索关键词（用于高亮） */
  searchTerm: string;
  /** 已展开的表名集合 */
  expandedTables: Set<string>;
  /** 列信息缓存 */
  columnsCache: Record<string, ColumnInfo[]>;
  /** 列加载状态 */
  columnsLoading: Record<string, boolean>;
  /** 表元数据缓存 */
  metaCache: Record<string, { index_count: number; size_bytes: number }>;
  /** 过滤+排序后的表列表（用于搜索无结果提示） */
  sortedTables: TableInfo[];

  // 事件回调
  onToggleTableExpand: (table: TableInfo) => void;
  onDoubleClickTable: (table: TableInfo) => void;
  onContextMenu: (e: React.MouseEvent, table: TableInfo) => void;
  onDeleteTable: (table: TableInfo) => void;
  onToggleGroupExpand: (group: TableGroup) => void;
  /** 获取分组展开状态 */
  getGroupExpanded: (group: TableGroup) => boolean;
}

export const DatabaseExplorerTableList: React.FC<DatabaseExplorerTableListProps> = ({
  groups,
  groupMode,
  loading,
  searchTerm,
  expandedTables,
  columnsCache,
  columnsLoading,
  metaCache,
  sortedTables,
  onToggleTableExpand,
  onDoubleClickTable,
  onContextMenu,
  onDeleteTable,
  onToggleGroupExpand,
  getGroupExpanded,
}) => {
  const { t } = useLocale();

  /** 渲染单个表行 */
  const renderTableRow = (table: TableInfo) => {
    const isExpanded = expandedTables.has(table.name);
    const cols = columnsCache[table.name];
    const colsLoading = columnsLoading[table.name];

    return (
      <div key={table.name} style={tableListStyles.tableItem}>
        <div
          style={{
            ...tableListStyles.tableHeader,
            ...(table.is_system_table ? tableListStyles.systemTableHeader : {}),
          }}
          onClick={() => onToggleTableExpand(table)}
          onDoubleClick={() => onDoubleClickTable(table)}
          onContextMenu={(e) => onContextMenu(e, table)}
        >
          <span style={{ ...tableListStyles.iconCell, ...(isExpanded ? tableListStyles.chevronRotatedCell : {}) }}>
            <ChevronRightIcon size={ICON_SIZE} color="var(--text-tertiary)" />
          </span>

          <span style={tableListStyles.iconCell}>
            <TableIcon size={ICON_SIZE} color={table.is_system_table ? 'var(--accent-color)' : 'var(--primary)'} />
          </span>

          <span style={{ ...tableListStyles.tableName, ...(table.is_system_table ? tableListStyles.systemTableName : {}) }}>
            {highlightText(table.name, searchTerm.trim())}
          </span>

          {table.is_system_table && <span style={tableListStyles.systemTableBadge}>{t('database.systemTableBadge')}</span>}

          <span style={tableListStyles.tableMeta}>
            {table.row_count > 0 ? `${formatCount(table.row_count)} ${t('database.rowCountSuffix')}` : null}
          </span>
          <span style={tableListStyles.tableMeta}>
            {table.column_count > 0 ? `${table.column_count} ${t('database.columnCountSuffix')}` : null}
          </span>
          {metaCache[table.name] && metaCache[table.name].index_count > 0 && (
            <span style={tableListStyles.tableMeta}>
              {metaCache[table.name].index_count} {t('database.indexCountSuffix')}
            </span>
          )}
          {metaCache[table.name] && metaCache[table.name].size_bytes > 0 && (
            <span style={tableListStyles.tableMeta}>
              ≈ {formatSize(metaCache[table.name].size_bytes)}
            </span>
          )}

          {!table.is_system_table && (
            <button
              style={tableListStyles.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTable(table);
              }}
              title={t('database.dropTable')}
            >
              <TrashIcon size={ICON_SIZE} color="var(--text-tertiary)" />
            </button>
          )}
        </div>

        {isExpanded && (
          <div style={tableListStyles.columnsList}>
            {colsLoading && !cols && (
              <div style={tableListStyles.columnLoading}>
                <span style={tableListStyles.iconCell}>
                  <RefreshCwIcon size={ICON_SIZE} color="var(--text-tertiary)" />
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('database.loadingColumns')}</span>
              </div>
            )}
            {cols && cols.length === 0 && <div style={tableListStyles.columnEmpty}>{t('database.noColumns')}</div>}
            {cols && cols.length > 0 && cols.map((col: ColumnInfo) => (
              <div key={col.name} style={tableListStyles.columnItem}>
                <span style={tableListStyles.columnName}>
                  {col.is_primary_key && <span style={tableListStyles.pkMarker}>🔑</span>}
                  {col.name}
                </span>
                <span style={tableListStyles.columnType}>
                  {col.data_type}
                  {!col.nullable && <span style={tableListStyles.notNullTag}>NOT NULL</span>}
                  {col.default_value && <span style={tableListStyles.defaultTag}>DEFAULT {col.default_value}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={tableListStyles.tablesList}>
      {loading ? (
        <div style={tableListStyles.loading}>
          <span style={tableListStyles.iconCell}>
            <RefreshCwIcon size={ICON_SIZE} color="var(--text-secondary)" />
          </span>
          <span>{t('common.loading')}</span>
        </div>
      ) : (
        groups.map((g, idx) => {
          const isExpanded = getGroupExpanded(g);
          const isToggleable = groupMode !== 'none';
          return (
            <div key={g.title + idx} style={tableListStyles.groupItem}>
              <div
                style={tableListStyles.groupHeader}
                onClick={isToggleable ? () => onToggleGroupExpand(g) : undefined}
              >
                <span style={{
                  ...tableListStyles.iconCell,
                  ...(isExpanded ? tableListStyles.chevronRotatedCell : {}),
                  ...(groupMode === 'none' ? { visibility: 'hidden' } : {}),
                }}>
                  <ChevronRightIcon size={ICON_SIZE} color="var(--text-tertiary)" />
                </span>
                <span style={{ ...tableListStyles.groupTitle, ...(g.accent ? tableListStyles.groupTitleAccent : {}) }}>
                  {g.title}
                </span>
                <span style={tableListStyles.groupCount}>{g.items.length}</span>
              </div>
              {isExpanded && g.items.length > 0 && (
                <div style={tableListStyles.groupChildren}>{g.items.map(renderTableRow)}</div>
              )}
              {isExpanded && g.items.length === 0 && (
                <div style={tableListStyles.groupEmptyHint}>
                  {g.groupKey === 'user' && (
                    <>{t('database.noUserTablesHint1')} <b>SQL</b> {t('database.noUserTablesHint2')} <code style={tableListStyles.codeTip}>CREATE TABLE "{t('database.tableNamePlaceholder')}" (...)</code> {t('database.noUserTablesHint3')} <b>{t('database.importCSVExcel')}</b> {t('database.noUserTablesHint4')}</>
                  )}
                  {g.groupKey === 'system' && t('database.noSystemTables')}
                  {g.groupKey !== 'user' && g.groupKey !== 'system' && t('database.noTablesWithPrefix', { prefix: g.title })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* 搜索无结果提示 */}
      {!loading && searchTerm.trim() && sortedTables.length === 0 && (
        <div style={tableListStyles.empty}>
          {t('database.noMatchWithTerm', { term: searchTerm })}
        </div>
      )}
    </div>
  );
};

// ============ 样式 ============
const tableListStyles: Record<string, React.CSSProperties> = {
  iconCell: {
    width: WRAPPER_SIZE,
    height: WRAPPER_SIZE,
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

  tablesList: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    padding: '4px',
    minHeight: 0,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '20px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  empty: {
    padding: '20px',
    color: 'var(--text-tertiary)',
    fontSize: '13px',
    textAlign: 'center',
  },

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

  tableItem: {
    marginBottom: '2px',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background 0.2s',
    minWidth: 'max-content',
  },
  tableName: {
    flex: '1 0 auto',
    fontSize: '13px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  },
  tableMeta: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    background: 'var(--bg-tertiary)',
    padding: '1px 5px',
    borderRadius: '3px',
  },
  columnsList: {
    paddingLeft: `${WRAPPER_SIZE + 8 + WRAPPER_SIZE}px`,
    borderLeft: '2px solid var(--border-primary)',
    marginLeft: '12px',
  },
  columnLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  columnEmpty: {
    padding: '6px 8px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
  },
  columnItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    fontSize: '12px',
    gap: '8px',
  },
  columnName: {
    color: 'var(--text-secondary)',
  },
  columnType: {
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  pkMarker: {
    marginRight: '2px',
  },
  notNullTag: {
    fontStyle: 'normal',
    fontSize: '10px',
    color: 'var(--accent-color)',
    background: 'var(--bg-tertiary)',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  defaultTag: {
    fontStyle: 'normal',
    fontSize: '10px',
    color: 'var(--text-tertiary)',
    background: 'var(--bg-tertiary)',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s',
  },

  highlightMark: {
    background: 'rgba(255, 220, 100, 0.35)',
    color: 'var(--text-primary)',
    borderRadius: '2px',
    padding: '0 1px',
    fontWeight: 600,
  },

  systemTableHeader: {
    background: 'var(--bg-tertiary)',
  },
  systemTableName: {
    fontWeight: 600,
    color: 'var(--accent-color)',
  },
  systemTableBadge: {
    fontSize: '11px',
    padding: '1px 5px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-tertiary)',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
