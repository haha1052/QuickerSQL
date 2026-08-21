import React from 'react';
import { SearchIcon, RefreshCwIcon } from './Icons';
import { useLocale } from '../../context/LocaleContext';

// ============ 常量 ============
const ICON_SIZE = 14;
const WRAPPER_SIZE = 16;

/** 表排序方式：名称升/降序、行数降序、列数降序 */
export type SortKey = 'name_asc' | 'name_desc' | 'row_count_desc' | 'column_count_desc';
/** 分组模式：系统/用户分组、首字母分组、不分组 */
export type GroupMode = 'system_user' | 'first_letter' | 'none';

/**
 * DatabaseExplorer 顶部工具栏子组件
 *
 * 职责：
 * - 搜索框（按表名过滤）
 * - 排序选择（名称升/降序、行数降序、列数降序）
 * - 分组选择（系统/用户分组、首字母分组、不分组）
 * - 刷新按钮
 *
 * 设计：纯展示组件，所有状态由父组件通过 props 传入。
 */
export interface DatabaseExplorerSearchBarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  groupMode: GroupMode;
  onGroupModeChange: (value: GroupMode) => void;
  onRefresh: () => void;
}

export const DatabaseExplorerSearchBar: React.FC<DatabaseExplorerSearchBarProps> = ({
  searchTerm,
  onSearchTermChange,
  sortKey,
  onSortKeyChange,
  groupMode,
  onGroupModeChange,
  onRefresh,
}) => {
  const { t } = useLocale();

  return (
    <div style={searchBarStyles.header}>
      <div style={searchBarStyles.searchBox}>
        <span style={searchBarStyles.iconCell}>
          <SearchIcon size={ICON_SIZE} color="var(--text-tertiary)" />
        </span>
        <input
          type="text"
          placeholder={t('databaseExplorer.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          style={searchBarStyles.searchInput}
        />
      </div>

      <select
        value={sortKey}
        onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
        style={searchBarStyles.selectBox}
        title={t('database.sortBy')}
      >
        <option value="name_asc">{t('database.sortNameAsc')}</option>
        <option value="name_desc">{t('database.sortNameDesc')}</option>
        <option value="row_count_desc">{t('database.sortRowCountDesc')}</option>
        <option value="column_count_desc">{t('database.sortColumnCountDesc')}</option>
      </select>

      <select
        value={groupMode}
        onChange={(e) => onGroupModeChange(e.target.value as GroupMode)}
        style={searchBarStyles.selectBox}
        title={t('database.groupMode')}
      >
        <option value="system_user">{t('database.groupBySystemUser')}</option>
        <option value="first_letter">{t('database.groupByFirstLetter')}</option>
        <option value="none">{t('database.groupNone')}</option>
      </select>

      <button style={searchBarStyles.refreshBtn} onClick={onRefresh} title={t('database.refresh')}>
        <span style={searchBarStyles.iconCell}>
          <RefreshCwIcon size={ICON_SIZE} color="var(--text-secondary)" />
        </span>
      </button>
    </div>
  );
};

// ============ 样式 ============
const searchBarStyles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: '120px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '13px',
    outline: 'none',
    padding: '4px 0',
    color: 'var(--text-primary)',
  },
  selectBox: {
    fontSize: '12px',
    padding: '4px 8px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    outline: 'none',
  },
  refreshBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  iconCell: {
    width: WRAPPER_SIZE,
    height: WRAPPER_SIZE,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 0,
  },
};
