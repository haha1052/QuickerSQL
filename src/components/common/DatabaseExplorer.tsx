import React, { useEffect, useMemo, useState } from 'react';
import { useStartupContext } from '../../AppWrapper';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { DatabaseExplorerSearchBar, type SortKey, type GroupMode } from './DatabaseExplorerSearchBar';
import {
  DatabaseExplorerTableList,
  type TableGroup,
  formatCount,
} from './DatabaseExplorerTableList';
import { useWorkspaceStore } from '../../store';
import { useToastStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';
import { useSetting } from '../../context/SettingsContext';
import type { TableInfo } from '../../types';
import { useTableStore } from '../../store';

// ============ 常量 ============
/** 触发"大表确认"对话框的行数阈值 */
const LARGE_TABLE_THRESHOLD = 10000;

/**
 * 数据库浏览器组件（主容器）
 *
 * 子组件拆分（v26.2 P2-1）：
 * - `DatabaseExplorerSearchBar`：搜索/排序/分组/刷新 UI
 * - `DatabaseExplorerTableList`：分组渲染、表行、列展开 UI
 *
 * 设置依赖：trash.confirmBeforeDelete、database.showSystemTables
 */
const DatabaseExplorerComponent: React.FC = () => {
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

  // ============ 本地 UI 状态 ============
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandUserTables, setExpandUserTables] = useState(true);
  const [expandSystemTables, setExpandSystemTables] = useState(true);
  const [expandedFirstLetter, setExpandedFirstLetter] = useState<Set<string>>(new Set(['all']));
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [groupMode, setGroupMode] = useState<GroupMode>('system_user');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    table: TableInfo;
  } | null>(null);

  const { addTab } = useWorkspaceStore();
  const { addToast } = useToastStore();
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
      ? `SELECT * FROM "${table.name}" LIMIT 100;` // safe_sql: SQL 客户端工具生成的 SQL 模板（表名来自数据库自身，后端 SqlIdentifier 校验）
      : `SELECT * FROM ${table.name} LIMIT 100;`; // safe_sql: SQL 客户端工具生成的 SQL 模板（表名来自数据库自身，后端 SqlIdentifier 校验）
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

  // ============ 搜索 & 排序 & 分组（useMemo） ============
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

  const groups: TableGroup[] = useMemo(() => {
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
      const result: TableGroup[] = [
        { title: t('database.userTables'), items: user, accent: false, groupKey: 'user' },
      ];
      if (showSystemTables) {
        result.push({ title: t('database.systemTables'), items: sys, accent: true, groupKey: 'system' });
      }
      return result;
    }
    return [{ title: t('database.allTables'), items: sortedTables, accent: false, groupKey: 'all' }];
  }, [sortedTables, groupMode, showSystemTables, t]);

  const getGroupExpanded = (g: TableGroup) => {
    if (groupMode === 'system_user') {
      return g.groupKey === 'user' ? expandUserTables : expandSystemTables;
    }
    if (groupMode === 'first_letter') {
      return expandedFirstLetter.has(g.groupKey);
    }
    return true;
  };

  const toggleGroupExpanded = (g: TableGroup) => {
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
          generateAndOpenSql(table.name, `SELECT * FROM ${quotedName} LIMIT 100;`, `${table.name} (${t('database.browse')})`); // safe_sql: SQL 客户端工具生成的 SQL 模板
        },
      },
      {
        label: t('database.copyTableName'),
        shortcut: 'Ctrl+C',
        onClick: () => copyTableName(table.name),
      },
      {
        label: t('database.generateSelect'),
        onClick: () => generateAndOpenSql(table.name, `SELECT * FROM ${quotedName};`, `${table.name} (SELECT)`), // safe_sql: SQL 客户端工具生成的 SQL 模板
      },
      {
        label: t('database.generateCount'),
        onClick: () => generateAndOpenSql(table.name, `SELECT COUNT(*) AS total FROM ${quotedName};`, `${table.name} (COUNT)`), // safe_sql: SQL 客户端工具生成的 SQL 模板
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
            `INSERT INTO ${quotedName} (${colNames}) VALUES (${placeholders});`, // safe_sql: SQL 客户端工具生成的 SQL 模板（用户填充占位符）
            `${table.name} (INSERT)`, // safe_sql: 标签中的 SQL 关键字
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
      <DatabaseExplorerSearchBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        groupMode={groupMode}
        onGroupModeChange={setGroupMode}
        onRefresh={() => listTables()}
      />

      {/* 表列表 */}
      <DatabaseExplorerTableList
        groups={groups}
        groupMode={groupMode}
        loading={loading}
        searchTerm={searchTerm}
        expandedTables={expandedTables}
        columnsCache={columnsCache}
        columnsLoading={columnsLoading}
        metaCache={metaCache}
        sortedTables={sortedTables}
        onToggleTableExpand={toggleTableExpand}
        onDoubleClickTable={handleDoubleClickTable}
        onContextMenu={(e, table) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, table });
        }}
        onDeleteTable={handleDeleteTable}
        onToggleGroupExpand={toggleGroupExpanded}
        getGroupExpanded={getGroupExpanded}
      />

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

/** P2-2: 用 React.memo 包装以避免父组件重渲染时的无谓更新 */
export const DatabaseExplorer = React.memo(DatabaseExplorerComponent);
DatabaseExplorer.displayName = 'DatabaseExplorer';

// ============ 样式（仅保留主容器相关，子组件样式各自维护） ============
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none' },
};
