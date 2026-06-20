import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TableIcon, ChevronRightIcon, RefreshCwIcon, SearchIcon, TrashIcon } from './Icons';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { useWorkspaceStore } from '../../store';
import { useToastStore } from '../../store/toastStore';
import { useLocale } from '../../context/LocaleContext';
import type { ColumnInfo, TableInfo } from '../../types';

// ============ 常量 ============
const ICON_SIZE = 14;
const WRAPPER_SIZE = 16;
const LARGE_TABLE_THRESHOLD = 10000;

// ============ 类型定义 ============
type SortKey = 'name_asc' | 'name_desc' | 'row_count_desc' | 'column_count_desc';
type GroupMode = 'system_user' | 'first_letter' | 'none';

// ============ 工具函数 ============
const formatCount = (n: number) => n.toLocaleString('zh-CN');
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

// 搜索词高亮：在 text 中找到 keyword 并将其用 <mark> 包裹
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

export const DatabaseExplorer: React.FC = () => {
  const { t } = useLocale();

  // ============ 状态 ============
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [columnsCache, setColumnsCache] = useState<Record<string, ColumnInfo[]>>({});
  const [columnsLoading, setColumnsLoading] = useState<Record<string, boolean>>({});
  const [metaCache, setMetaCache] = useState<Record<string, { index_count: number; size_bytes: number }>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  // ============ 分组展开状态（独立控制每个分组是否展开，不影响分组是否存在）
  const [expandUserTables, setExpandUserTables] = useState(true);
  const [expandSystemTables, setExpandSystemTables] = useState(true);
  const [expandedFirstLetter, setExpandedFirstLetter] = useState<Set<string>>(new Set(['全部']));

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

  // ============ 数据加载 ============
  const loadTables = async () => {
    setLoading(true);
    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.listTables();
      if (response.success && response.data) {
        setTables(response.data);
      }
    } catch (e) {
      console.error('Failed to load tables:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  // ============ 列信息懒加载 ============
  const loadColumnsIfNeeded = useCallback(async (tableName: string) => {
    if (columnsCache[tableName] || columnsLoading[tableName]) return;
    setColumnsLoading((prev) => ({ ...prev, [tableName]: true }));
    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.getTableColumns(tableName);
      if (response.success && response.data) {
        setColumnsCache((prev) => ({ ...prev, [tableName]: response.data! }));
      }
    } catch (e) {
      console.error('Failed to load columns:', e);
    } finally {
      setColumnsLoading((prev) => {
        const next = { ...prev };
        delete next[tableName];
        return next;
      });
    }
  }, [columnsCache, columnsLoading]);

  // ============ 交互：展开 / 折叠 ============
  const toggleTableExpand = async (table: TableInfo) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(table.name)) {
      newExpanded.delete(table.name);
    } else {
      newExpanded.add(table.name);
      void loadColumnsIfNeeded(table.name);
      if (!metaCache[table.name]) {
        try {
          const { tauriService: svc } = await import('../../services');
          const metaRes = await svc.getTableMeta(table.name);
          if (metaRes.success && metaRes.data) {
            setMetaCache((prev) => ({ ...prev, [table.name]: metaRes.data as { index_count: number; size_bytes: number } }));
          }
        } catch {
          // 忽略错误
        }
      }
    }
    setExpandedTables(newExpanded);
  };

  // ============ 操作：生成 SQL 并新建 Tab ============
  const generateAndOpenSql = useCallback((tableName: string, sql: string, tabTitle?: string) => {
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
      { initialSql: sql }
    );
  }, [addTab]);

  const handleDoubleClickTable = async (table: TableInfo) => {
    const needsQuotes = !/^[a-zA-Z0-9_]+$/.test(table.name);
    const sql = needsQuotes
      ? `SELECT * FROM "${table.name}" LIMIT 100;`
      : `SELECT * FROM ${table.name} LIMIT 100;`;
    generateAndOpenSql(table.name, sql);
  };

  // ============ 操作：删除表 ============
  const handleDeleteTable = async (table: TableInfo) => {
    if (table.is_system_table) {
      addToast(`系统表 '${table.name}' 不允许删除或修改`, 'error');
      return;
    }
    if (table.row_count >= LARGE_TABLE_THRESHOLD) {
      const ok = confirm(
        `将删除表 '${table.name}'（共 ${formatCount(table.row_count)} 行数据），\n` +
        `删除后可从"回收站"恢复。确认继续？`,
      );
      if (!ok) return;
    } else if (!confirm(`确定删除表 '${table.name}'？`)) {
      return;
    }
    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.moveToTrash(table.name);
      if (response.success) {
        addToast(`表 '${table.name}' 已移到回收站`, 'success');
        await loadTables();
      } else {
        addToast(`删除失败: ${response.error}`, 'error');
      }
    } catch (e) {
      console.error('Delete failed:', e);
      addToast('删除失败', 'error');
    }
  };

  // ============ 操作：重命名表 ============
  const handleRenameTable = async (table: TableInfo) => {
    const newName = prompt(`将表 "${table.name}" 重命名为：`, table.name);
    if (!newName) return; // 用户取消

    const trimmed = newName.trim();
    if (!trimmed) {
      addToast('表名不能为空', 'warning');
      return;
    }
    if (trimmed === table.name) {
      return; // 未修改，无需操作
    }

    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.renameTable(table.name, trimmed);
      if (response.success) {
        // 刷新列缓存（旧表名已不存在）
        setColumnsCache((prev) => {
          const next = { ...prev };
          delete next[table.name];
          return next;
        });
        addToast(`表已重命名为 '${trimmed}'`, 'success');
        await loadTables();
      } else {
        addToast(`重命名失败: ${response.error}`, 'error');
      }
    } catch (e) {
      console.error('Rename failed:', e);
      addToast('重命名失败', 'error');
    }
  };

  // ============ 操作：复制表名 ============
  const copyTableName = useCallback((tableName: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tableName).catch(() => {});
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = tableName;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
  }, []);

  // ============ 搜索 & 排序 & 分组 ============
  // 先根据搜索词过滤
  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) return tables;
    const kw = searchTerm.toLowerCase();
    return tables.filter((t) => t.name.toLowerCase().includes(kw));
  }, [tables, searchTerm]);

  // 再按 sortKey 排序
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

  // 分组
  // 注意：这里只构建 groups 列表，不依赖展开状态（展开由渲染层控制）
  //   - 确保「用户表」和「系统表」分组一定存在（即使为空）
  //   - 用户表为空时，分组头仍显示，展开时提示「暂无用户表」
  const groups = useMemo(() => {
    if (groupMode === 'first_letter') {
      const map = new Map<string, TableInfo[]>();
      for (const t of sortedTables) {
        const key = t.is_system_table
          ? '系统表'
          : (() => {
              const first = t.name.charAt(0).toUpperCase();
              return /[A-Z0-9]/.test(first) ? first : '其他';
            })();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
      // 确保「系统表」分组始终存在（即使空也显示）
      if (!map.has('系统表')) map.set('系统表', []);
      return Array.from(map.entries())
        .sort(([a], [b]) => {
          // 「系统表」在最前面（如果存在）
          if (a === '系统表') return -1;
          if (b === '系统表') return 1;
          return a.localeCompare(b);
        })
        .map(([title, items]) => ({
          title,
          items,
          accent: title === '系统表',
          groupKey: title,
        }));
    }
    if (groupMode === 'system_user') {
      const user = sortedTables.filter((t) => !t.is_system_table);
      const sys = sortedTables.filter((t) => t.is_system_table);
      // 两个分组始终存在（即使为空）
      return [
        { title: '用户表', items: user, accent: false, groupKey: 'user' },
        { title: '系统表', items: sys, accent: true, groupKey: 'system' },
      ];
    }
    // none — 平铺模式（不分组）
    return [{ title: '全部', items: sortedTables, accent: false, groupKey: 'all' }];
  }, [sortedTables, groupMode]);

  // 计算任意分组是否展开
  const getGroupExpanded = useCallback((g: { title: string; groupKey: string; items: TableInfo[] }) => {
    if (groupMode === 'system_user') {
      return g.groupKey === 'user' ? expandUserTables : expandSystemTables;
    }
    if (groupMode === 'first_letter') {
      return expandedFirstLetter.has(g.groupKey);
    }
    // none 模式（平铺），只有一个分组，默认展开
    return true;
  }, [groupMode, expandUserTables, expandSystemTables, expandedFirstLetter]);

  // 切换任意分组的展开状态
  const toggleGroupExpanded = useCallback((g: { title: string; groupKey: string; items: TableInfo[] }) => {
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
    // none 模式：不支持折叠（单分组无意义）
  }, [groupMode]);

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

          {table.is_system_table && <span style={styles.systemTableBadge}>系统表</span>}

          <span style={styles.tableMeta}>
            {table.row_count > 0 ? `${formatCount(table.row_count)} 行` : null}
          </span>
          <span style={styles.tableMeta}>
            {table.column_count > 0 ? `${table.column_count} 列` : null}
          </span>
          {metaCache[table.name] && metaCache[table.name].index_count > 0 && (
            <span style={styles.tableMeta}>
              {metaCache[table.name].index_count} 索引
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
              title="删除表"
            >
              <TrashIcon size={ICON_SIZE} color="var(--text-tertiary)" />
            </button>
          )}
        </div>

        {/* 展开后的列列表 */}
        {isExpanded && (
          <div style={styles.columnsList}>
            {colsLoading && !cols && (
              <div style={styles.columnLoading}>
                <span style={styles.iconCell}>
                  <RefreshCwIcon size={ICON_SIZE} color="var(--text-tertiary)" />
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>加载列信息...</span>
              </div>
            )}
            {cols && cols.length === 0 && <div style={styles.columnEmpty}>无列信息</div>}
            {cols && cols.length > 0 && cols.map((col) => (
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
        label: '查看前 100 行',
        shortcut: '双击',
        onClick: () => {
          generateAndOpenSql(table.name, `SELECT * FROM ${quotedName} LIMIT 100;`, `${table.name} (浏览)`);
        },
      },
      {
        label: '复制表名',
        shortcut: 'Ctrl+C',
        onClick: () => copyTableName(table.name),
      },
      {
        label: `生成 SELECT *`,
        onClick: () => generateAndOpenSql(table.name, `SELECT * FROM ${quotedName};`, `${table.name} (SELECT)`),
      },
      {
        label: `生成 COUNT`,
        onClick: () => generateAndOpenSql(table.name, `SELECT COUNT(*) AS total FROM ${quotedName};`, `${table.name} (COUNT)`),
      },
      {
        label: `生成 INSERT 模板`,
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
        label: '重命名表',
        shortcut: 'F2',
        onClick: () => handleRenameTable(table),
      });
      items.push({
        label: '删除表',
        shortcut: 'Del',
        danger: true,
        onClick: () => handleDeleteTable(table),
      });
    }

    return items;
  }, [contextMenu, generateAndOpenSql, copyTableName, columnsCache, handleRenameTable]);

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

        {/* 排序下拉 */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={styles.selectBox}
          title="排序方式"
        >
          <option value="name_asc">名称 A-Z</option>
          <option value="name_desc">名称 Z-A</option>
          <option value="row_count_desc">行数最多</option>
          <option value="column_count_desc">列数最多</option>
        </select>

        {/* 分组模式下拉 */}
        <select
          value={groupMode}
          onChange={(e) => setGroupMode(e.target.value as GroupMode)}
          style={styles.selectBox}
          title="分组模式"
        >
          <option value="system_user">按系统/用户</option>
          <option value="first_letter">按首字母</option>
          <option value="none">平铺</option>
        </select>

        <button style={styles.refreshBtn} onClick={loadTables} title="刷新列表">
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
                    {g.title === '用户表' && (
                      <>暂无用户表，可通过 <b>SQL</b> 执行 <code style={styles.codeTip}>CREATE TABLE "你的表名" (...)</code> 或 <b>导入 CSV/Excel</b> 创建</>
                    )}
                    {g.title === '系统表' && '暂无系统表'}
                    {g.title !== '用户表' && g.title !== '系统表' && `暂无${g.title}开头的表`}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 搜索无结果提示 */}
        {!loading && searchTerm.trim() && sortedTables.length === 0 && (
          <div style={styles.empty}>
            未找到匹配「{searchTerm}」的表</div>
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

  // ===== 统一的图标单元格 =====
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

  // ===== 顶部工具栏 =====
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

  // ===== 列表区域 =====
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

  // ===== 分组 =====
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
  groupEmpty: {
    padding: '6px 8px 6px 32px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
  },
  // 分组为空时的友好提示（比 groupEmpty 更显眼、带操作引导）
  groupEmptyHint: {
    marginLeft: '8px',
    padding: '12px 16px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    background: 'var(--bg-tertiary)',
    borderLeft: '3px solid var(--text-tertiary)',
    lineHeight: '1.6',
  },
  // 代码提示片段（如 CREATE TABLE 语句）
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

  // ===== 表行 =====
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

  // ===== 搜索高亮 =====
  highlightMark: {
    background: 'rgba(255, 220, 100, 0.35)',
    color: 'var(--text-primary)',
    borderRadius: '2px',
    padding: '0 1px',
    fontWeight: 600,
  },

  // ===== 系统表样式 =====
  systemTableHeader: {
    background: 'var(--bg-tertiary)',
  },
  systemTableName: {
    fontWeight: 600,
    color: 'var(--accent-color)',
  },
  systemTableBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    background: 'var(--accent-color)',
    color: '#fff',
    borderRadius: '3px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
