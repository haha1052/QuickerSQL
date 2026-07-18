import React, { useEffect, useMemo, useState } from 'react';
import { useStartupContext } from '../../AppWrapper';
import { TableIcon, ChevronRightIcon, RefreshCwIcon, SearchIcon, TrashIcon } from './Icons';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { useWorkspaceStore } from '../../store';
import { useToastStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { useSetting } from '../../context/SettingsContext';
import type { ColumnInfo, TableInfo } from '../../types';
import { useTableStore } from '../../store';

// ============ 常量 ============
const ICON_SIZE = 14;
const WRAPPER_SIZE = 16;
const LARGE_TABLE_THRESHOLD = 10000;

// ============ 类型定义 ============
/** 表排序方式：名称升/降序、行数降序、列数降序 */
type SortKey = 'name_asc' | 'name_desc' | 'row_count_desc' | 'column_count_desc';
/** 分组模式：系统/用户分组、首字母分组、不分组 */
type GroupMode = 'system_user' | 'first_letter' | 'none';

// ============ 工具函数 ============
/** 将数字按 zh-CN 区域格式化为千位分隔字符串 */
const formatCount = (n: number) => n.toLocaleString('zh-CN');

/**
 * 将字节数格式化为带单位的可读字符串（B/KB/MB/GB/TB）
 * @param bytes - 字节数
 * @returns 形如 "1.5 MB" 的字符串；<=0 时返回 "0 B"
 */
const formatSize = (bytes: number) => {
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
const highlightText = (text: string, keyword: string): React.ReactNode => {
  if (!keyword) return text;
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  const idx = lower.indexOf(kw);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={styles.highlightMark}>{text.slice(idx, idx + kw.length)}</span>
      {text.slice(idx + kw.length)}
    </>
  );
};

/**
 * 数据库浏览器组件
 *
 * 职责：
 * - 列出所有表（用户表 + 系统表），支持搜索、排序、分组
 * - 表行可展开查看列信息（懒加载 columnsCache 与 metaCache）
 * - 双击表名生成 `SELECT * FROM <table> LIMIT 100` 并打开新 SQL Tab
 * - 右键菜单提供：查看前 100 行、复制表名、生成 SELECT/COUNT/INSERT 模板、重命名、删除
 * - 删除表时按 row_count 与 confirmBeforeDelete 设置走回收站流程
 * - 排序：名称升/降序、行数降序、列数降序
 * - 分组：系统/用户分组、首字母分组、不分组
 *
 * 副作用：
 * - 启动时优先消费 StartupContext 的 tablesList
 * - 启动后 500ms 若本地仍为空则触发 listTables
 * - storeTables 变化时同步到本地 tables
 *
 * 设置依赖：
 * - trash.confirmBeforeDelete：是否删除前确认
 * - database.showSystemTables：是否显示系统表
 */
export const DatabaseExplorer: React.FC = () => {
  const { t } = useLocale();

  const [confirmBeforeDeleteRaw] = useSetting('trash', 'confirmBeforeDelete');
  const confirmBeforeDelete = confirmBeforeDeleteRaw === undefined ? true : confirmBeforeDeleteRaw === 'true';

  const [showSystemTablesRaw] = useSetting('database', 'showSystemTables');
  const showSystemTables = showSystemTablesRaw === undefined ? false : showSystemTablesRaw === 'true';

  // ============ 从 store 读取状态 ============
  const {
    tables: storeTables,
    loading: storeLoading,
    columnsCache,
    columnsLoading,
    metaCache,
    listTables,
    getTableColumns,
    getTableMeta,
    moveToTrash,
    renameTable,
  } = useTableStore();

  // 本地 UI 状态
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandUserTables, setExpandUserTables] = useState(true);
  const [expandSystemTables, setExpandSystemTables] = useState(true);
  const [expandedFirstLetter, setExpandedFirstLetter] = useState<Set<string>>(new Set(['all']));

  // ============ P1 状态 ============
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');     // 排序方式
  const [groupMode, setGroupMode] = useState<GroupMode>('system_user'); // 分组模式
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    table: TableInfo;
  } | null>(null);

  const { addTab } = useWorkspaceStore();
  const { addToast } = useToastStore();

  // v2 启动优化：优先使用 StartupContext 已返回的 tablesList
  const startupCtx = useStartupContext();

  // 启动阶段优先消费 StartupContext 的 tablesList，有数据时直接使用，否则设空数组
  useEffect(() => {
    if (!startupCtx.isStartupLoaded) return;

    if (startupCtx.startupData?.tablesList && startupCtx.startupData.tablesList.length > 0) {
      const initialTables = startupCtx.startupData.tablesList.map((name) => ({
        name,
        row_count: -1,
        column_count: -1,
        is_system_table: name.startsWith('__') || name.startsWith('sqlite_'),
      }));
      setTables(initialTables);
      return;
    }
    // 空数据库场景：直接设空数组
    setTables([]);
  }, [startupCtx.isStartupLoaded, startupCtx.startupData?.tablesList]);

  // 当 store 中的 tables 更新时同步到本地（listTables 调用后）
  useEffect(() => {
    if (storeTables.length > 0) {
      setTables(storeTables);
    }
  }, [storeTables]);

  // 初始化时主动刷新表列表（解决启动时不显示表的问题）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tables.length === 0) {
        void listTables();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // ============ 列信息懒加载 ============
  const loadColumnsIfNeeded = async (tableName: string) => {
    if (columnsCache[tableName] || columnsLoading[tableName]) return;
    await getTableColumns(tableName);
  };

  // ============ 交互：展开 / 折叠 ============
  const toggleTableExpand = async (table: TableInfo) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(table.name)) {
      newExpanded.delete(table.name);
    } else {
      newExpanded.add(table.name);
      void loadColumnsIfNeeded(table.name);
      if (!metaCache[table.name]) {
        await getTableMeta(table.name);
      }
    }
    setExpandedTables(newExpanded);
  };

  // ============ 操作：生成 SQL 并新建 Tab ============
  const generateAndOpenSql = (tableName: string, sql: string, tabTitle?: string) => {
    addTab(
      {
        title: tabTitle || tableName,
        type: 'sql',
        panels: [
          { id: 'editor', type: 'sql_editor', title: 'SQL Editor', size: 50, active: true, content: null },
          { id: 'results', type: 'results_grid', title: 'Results', size: 50, active: true, content: null },
        ],
        active: true,
      },
      { initialSql: sql },
    );
  };

  const handleDoubleClickTable = (table: TableInfo) => {
    const needsQuotes = !/^[a-zA-Z0-9_]+$/.test(table.name);
    const sql = needsQuotes
      ? `SELECT * FROM "${table.name}" LIMIT 100;`
      : `SELECT * FROM ${table.name} LIMIT 100;`;
    generateAndOpenSql(table.name, sql);
  };

  // ============ 操作：删除表 ============
  const handleDeleteTable = async (table: TableInfo) => {
    if (table.is_system_table) {
      addToast(t('database.systemTableNotDeletable', { name: table.name }), 'error');
      return;
    }
    if (confirmBeforeDelete) {
      if (table.row_count >= LARGE_TABLE_THRESHOLD) {
        const ok = confirm(
          t('database.confirmDeleteLargeTable', {
            name: table.name,
            count: formatCount(table.row_count),
            trash: t('database.trash'),
          }),
        );
        if (!ok) return;
      } else if (!confirm(t('database.confirmDeleteTable', { name: table.name }))) {
        return;
      }
    }
    await moveToTrash(table.name);
  };

  // ============ 操作：重命名表 ============
  const handleRenameTable = async (table: TableInfo) => {
    const newName = prompt(t('database.renameTablePrompt', { name: table.name }), table.name);
    if (!newName) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      addToast(t('database.tableNameCannotBeEmpty'), 'warning');
      return;
    }
    if (trimmed === table.name) {
      return;
    }

    await renameTable(table.name, trimmed);
  };

  // ============ 操作：复制表名 ============
  const copyTableName = (tableName: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tableName).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = tableName;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
  };

  // ============ 搜索 & 排序 & 分组 ============
  const filteredTables = useMemo(() => {
    let result = tables;
    if (!showSystemTables) {
      result = result.filter((tbl) => !tbl.is_system_table);
    }
    if (!searchTerm.trim()) return result;
    const kw = searchTerm.toLowerCase();
    return result.filter((tbl) => tbl.name.toLowerCase().includes(kw));
  }, [tables, searchTerm, showSystemTables]);

  const sortedTables = useMemo(() => {
    const copy = [...filteredTables];
    switch (sortKey) {
      case 'name_asc':
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        copy.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'row_count_desc':
        copy.sort((a, b) => b.row_count - a.row_count);
        break;
      case 'column_count_desc':
        copy.sort((a, b) => b.column_count - a.column_count);
        break;
    }
    return copy;
  }, [filteredTables, sortKey]);

  const groups = useMemo(() => {
    if (groupMode === 'first_letter') {
      const map = new Map<string, TableInfo[]>();
      for (const tbl of sortedTables) {
        const key = tbl.is_system_table
          ? 'system'
          : (() => {
            const first = tbl.name.charAt(0).toUpperCase();
            return /[A-Z0-9]/.test(first) ? first : 'other';
          })();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(tbl);
      }
      if (showSystemTables && !map.has('system')) map.set('system', []);
      return Array.from(map.entries())
        .sort(([a], [b]) => {
          if (a === 'system') return -1;
          if (b === 'system') return 1;
          return a.localeCompare(b);
        })
        .map(([key, items]) => ({
          title: key === 'system' ? t('database.systemTables') : key === 'other' ? t('database.other') : key,
          items,
          accent: key === 'system',
          groupKey: key,
        }));
    }
    if (groupMode === 'system_user') {
      const user = sortedTables.filter((tbl) => !tbl.is_system_table);
      const sys = sortedTables.filter((tbl) => tbl.is_system_table);
      const result = [
        { title: t('database.userTables'), items: user, accent: false, groupKey: 'user' },
      ];
      if (showSystemTables) {
        result.push({ title: t('database.systemTables'), items: sys, accent: true, groupKey: 'system' });
      }
      return result;
    }
    return [{ title: t('database.allTables'), items: sortedTables, accent: false, groupKey: 'all' }];
  }, [sortedTables, groupMode, showSystemTables, t]);

  const getGroupExpanded = (g: { title: string; groupKey: string; items: TableInfo[] }) => {
    if (groupMode === 'system_user') {
      return g.groupKey === 'user' ? expandUserTables : expandSystemTables;
    }
    if (groupMode === 'first_letter') {
      return expandedFirstLetter.has(g.groupKey);
    }
    return true;
  };

  const toggleGroupExpanded = (g: { title: string; groupKey: string; items: TableInfo[] }) => {
    if (groupMode === 'system_user') {
      if (g.groupKey === 'user') setExpandUserTables((v) => !v);
      else setExpandSystemTables((v) => !v);
      return;
    }
    if (groupMode === 'first_letter') {
      setExpandedFirstLetter((prev) => {
        const next = new Set(prev);
        if (next.has(g.groupKey)) next.delete(g.groupKey);
        else next.add(g.groupKey);
        return next;
      });
    }
  };

  // ============ 渲染单个表行 ============
  const renderTableRow = (table: TableInfo) => {
    const isExpanded = expandedTables.has(table.name);
    const cols = columnsCache[table.name];
    const colsLoading = columnsLoading[table.name];

    return (
      <div key={table.name} style={styles.tableItem}>
        <div
          style={{
            ...styles.tableHeader,
            ...(table.is_system_table ? styles.systemTableHeader : {}),
          }}
          onClick={() => toggleTableExpand(table)}
          onDoubleClick={() => handleDoubleClickTable(table)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, table });
          }}
        >
          <span style={{ ...styles.iconCell, ...(isExpanded ? styles.chevronRotatedCell : {}) }}>
            <ChevronRightIcon size={ICON_SIZE} color="var(--text-tertiary)" />
          </span>

          <span style={styles.iconCell}>
            <TableIcon size={ICON_SIZE} color={table.is_system_table ? 'var(--accent-color)' : 'var(--primary)'} />
          </span>

          <span style={{ ...styles.tableName, ...(table.is_system_table ? styles.systemTableName : {}) }}>
            {highlightText(table.name, searchTerm.trim())}
          </span>

          {table.is_system_table && <span style={styles.systemTableBadge}>{t('database.systemTableBadge')}</span>}

          <span style={styles.tableMeta}>
            {table.row_count > 0 ? `${formatCount(table.row_count)} ${t('database.rowCountSuffix')}` : null}
          </span>
          <span style={styles.tableMeta}>
            {table.column_count > 0 ? `${table.column_count} ${t('database.columnCountSuffix')}` : null}
          </span>
          {metaCache[table.name] && metaCache[table.name].index_count > 0 && (
            <span style={styles.tableMeta}>
              {metaCache[table.name].index_count} {t('database.indexCountSuffix')}
            </span>
          )}
          {metaCache[table.name] && metaCache[table.name].size_bytes > 0 && (
            <span style={styles.tableMeta}>
              ≈ {formatSize(metaCache[table.name].size_bytes)}
            </span>
          )}

          {!table.is_system_table && (
            <button
              style={styles.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTable(table);
              }}
              title={t('database.dropTable')}
            >
              <TrashIcon size={ICON_SIZE} color="var(--text-tertiary)" />
            </button>
          )}
        </div>

        {isExpanded && (
          <div style={styles.columnsList}>
            {colsLoading && !cols && (
              <div style={styles.columnLoading}>
                <span style={styles.iconCell}>
                  <RefreshCwIcon size={ICON_SIZE} color="var(--text-tertiary)" />
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('database.loadingColumns')}</span>
              </div>
            )}
            {cols && cols.length === 0 && <div style={styles.columnEmpty}>{t('database.noColumns')}</div>}
            {cols && cols.length > 0 && cols.map((col: ColumnInfo) => (
              <div key={col.name} style={styles.columnItem}>
                <span style={styles.columnName}>
                  {col.is_primary_key && <span style={styles.pkMarker}>🔑</span>}
                  {col.name}
                </span>
                <span style={styles.columnType}>
                  {col.data_type}
                  {!col.nullable && <span style={styles.notNullTag}>NOT NULL</span>}
                  {col.default_value && <span style={styles.defaultTag}>DEFAULT {col.default_value}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============ 右键菜单动态生成 ============
  const contextMenuItems: ContextMenuItem[] | null = useMemo(() => {
    if (!contextMenu) return null;
    const table = contextMenu.table;
    const needsQuotes = !/^[a-zA-Z0-9_]+$/.test(table.name);
    const quotedName = needsQuotes ? `"${table.name}"` : table.name;
    const items: ContextMenuItem[] = [
      {
        label: t('database.viewTop100Rows'),
        shortcut: t('database.doubleClick'),
        onClick: () => {
          generateAndOpenSql(table.name, `SELECT * FROM ${quotedName} LIMIT 100;`, `${table.name} (${t('database.browse')})`);
        },
      },
      {
        label: t('database.copyTableName'),
        shortcut: 'Ctrl+C',
        onClick: () => copyTableName(table.name),
      },
      {
        label: t('database.generateSelect'),
        onClick: () => generateAndOpenSql(table.name, `SELECT * FROM ${quotedName};`, `${table.name} (SELECT)`),
      },
      {
        label: t('database.generateCount'),
        onClick: () => generateAndOpenSql(table.name, `SELECT COUNT(*) AS total FROM ${quotedName};`, `${table.name} (COUNT)`),
      },
      {
        label: t('database.generateInsertTemplate'),
        onClick: () => {
          const cols = columnsCache[table.name];
          const colNames = cols && cols.length > 0
            ? cols.map((c) => (needsQuotes ? `"${c.name}"` : c.name)).join(', ')
            : 'column1, column2, ...';
          const placeholders = cols && cols.length > 0
            ? cols.map(() => '?').join(', ')
            : '?, ?, ...';
          generateAndOpenSql(
            table.name,
            `INSERT INTO ${quotedName} (${colNames}) VALUES (${placeholders});`,
            `${table.name} (INSERT)`,
          );
        },
      },
      { label: '---', separator: true, onClick: () => {} },
    ];

    if (!table.is_system_table) {
      items.push({
        label: t('database.renameTable'),
        shortcut: 'F2',
        onClick: () => handleRenameTable(table),
      });
      items.push({
        label: t('database.deleteTable'),
        shortcut: 'Del',
        danger: true,
        onClick: () => handleDeleteTable(table),
      });
    }

    return items;
  }, [contextMenu, columnsCache, t]);

  const loading = storeLoading;

  return (
    <div style={styles.container}>
      {/* 顶部工具栏 */}
      <div style={styles.header}>
        <div style={styles.searchBox}>
          <span style={styles.iconCell}>
            <SearchIcon size={ICON_SIZE} color="var(--text-tertiary)" />
          </span>
          <input
            type="text"
            placeholder={t('databaseExplorer.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={styles.selectBox}
          title={t('database.sortBy')}
        >
          <option value="name_asc">{t('database.sortNameAsc')}</option>
          <option value="name_desc">{t('database.sortNameDesc')}</option>
          <option value="row_count_desc">{t('database.sortRowCountDesc')}</option>
          <option value="column_count_desc">{t('database.sortColumnCountDesc')}</option>
        </select>

        <select
          value={groupMode}
          onChange={(e) => setGroupMode(e.target.value as GroupMode)}
          style={styles.selectBox}
          title={t('database.groupMode')}
        >
          <option value="system_user">{t('database.groupBySystemUser')}</option>
          <option value="first_letter">{t('database.groupByFirstLetter')}</option>
          <option value="none">{t('database.groupNone')}</option>
        </select>

        <button style={styles.refreshBtn} onClick={() => listTables()} title={t('database.refresh')}>
          <span style={styles.iconCell}>
            <RefreshCwIcon size={ICON_SIZE} color="var(--text-secondary)" />
          </span>
        </button>
      </div>

      {/* 表列表 */}
      <div style={styles.tablesList}>
        {loading ? (
          <div style={styles.loading}>
            <span style={styles.iconCell}>
              <RefreshCwIcon size={ICON_SIZE} color="var(--text-secondary)" />
            </span>
            <span>{t('common.loading')}</span>
          </div>
        ) : (
          groups.map((g, idx) => {
            const isExpanded = getGroupExpanded(g);
            const isToggleable = groupMode !== 'none';
            return (
              <div key={g.title + idx} style={styles.groupItem}>
                <div
                  style={styles.groupHeader}
                  onClick={isToggleable ? () => toggleGroupExpanded(g) : undefined}
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
                  <div style={styles.groupChildren}>{g.items.map(renderTableRow)}</div>
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
          })
        )}

        {/* 搜索无结果提示 */}
        {!loading && searchTerm.trim() && sortedTables.length === 0 && (
          <div style={styles.empty}>
            {t('database.noMatchWithTerm', { term: searchTerm })}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && contextMenuItems && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

// ============ 样式 ============
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    userSelect: 'none',
  },

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
