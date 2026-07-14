import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { SqlSnippet } from '../../types';
import { useAppStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';

interface SnippetsPanelProps {
  onInsertSql?: (sql: string) => void;
}

interface SnippetFormData {
  name: string;
  sql: string;
  description: string;
  category: string;
  tags: string;
}

const initialFormData: SnippetFormData = {
  name: '',
  sql: '',
  description: '',
  category: '',
  tags: '',
};

export const SnippetsPanel: React.FC<SnippetsPanelProps> = ({ onInsertSql }) => {
  const { setMessage } = useAppStore();
  const { t } = useLocale();
  const [snippets, setSnippets] = useState<SqlSnippet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [editingSnippet, setEditingSnippet] = useState<SqlSnippet | null>(null);
  const [formData, setFormData] = useState<SnippetFormData>(initialFormData);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    snippets.forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return Array.from(cats).sort();
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    let result = snippets;

    if (categoryFilter === 'favorites') {
      result = result.filter(s => s.isFavorite);
    } else if (categoryFilter !== 'all') {
      result = result.filter(s => s.category === categoryFilter);
    }

    if (search.trim()) {
      const keyword = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(keyword) ||
        (s.description?.toLowerCase() || '').includes(keyword)
      );
    }

    return result;
  }, [snippets, categoryFilter, search]);

  const loadSnippets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { tauriService } = await import('../../services');
      const response = await tauriService.listSqlSnippets();

      if (response.success && response.data) {
        setSnippets(response.data);
      } else {
        setError(response.error || '加载片段失败');
      }
    } catch (err) {
      console.error('Failed to load snippets:', err);
      setError(`加载片段失败: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleFavorite = async (snippet: SqlSnippet, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.toggleSnippetFavorite(snippet.id);

      if (response.success) {
        setSnippets(prev => prev.map(s =>
          s.id === snippet.id ? { ...s, isFavorite: !s.isFavorite } : s
        ));
      } else {
        setMessage(response.error || '操作失败', 'error');
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      setMessage('操作失败', 'error');
    }
  };

  const handleInsert = (snippet: SqlSnippet) => {
    if (onInsertSql) {
      onInsertSql(snippet.sql);
      setMessage('已插入到编辑器', 'success');
    }
  };

  const handleEdit = (snippet: SqlSnippet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSnippet(snippet);
    setFormData({
      name: snippet.name,
      sql: snippet.sql,
      description: snippet.description || '',
      category: snippet.category || '',
      tags: snippet.tags || '',
    });
    setShowDialog(true);
  };

  const handleDelete = async (snippet: SqlSnippet, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除片段「${snippet.name}」吗？`)) {
      return;
    }

    try {
      const { tauriService } = await import('../../services');
      const response = await tauriService.deleteSqlSnippet(snippet.id);

      if (response.success) {
        setMessage('删除成功', 'success');
        await loadSnippets();
      } else {
        setMessage(`错误: ${response.error}`, 'error');
      }
    } catch (err) {
      console.error('Failed to delete snippet:', err);
      setMessage(`错误: ${err}`, 'error');
    }
  };

  const handleNewSnippet = () => {
    setEditingSnippet(null);
    setFormData(initialFormData);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setMessage('请输入片段名称', 'error');
      return;
    }
    if (!formData.sql.trim()) {
      setMessage('请输入 SQL 内容', 'error');
      return;
    }

    try {
      const { tauriService } = await import('../../services');

      if (editingSnippet) {
        const response = await tauriService.updateSqlSnippet({
          id: editingSnippet.id,
          name: formData.name.trim(),
          sql: formData.sql,
          description: formData.description.trim() || undefined,
          category: formData.category.trim() || undefined,
          tags: formData.tags.trim() || undefined,
        });

        if (response.success) {
          setMessage('更新成功', 'success');
          setShowDialog(false);
          await loadSnippets();
        } else {
          setMessage(`错误: ${response.error}`, 'error');
        }
      } else {
        const response = await tauriService.createSqlSnippet({
          name: formData.name.trim(),
          sql: formData.sql,
          description: formData.description.trim() || undefined,
          category: formData.category.trim() || undefined,
          tags: formData.tags.trim() || undefined,
        });

        if (response.success) {
          setMessage('创建成功', 'success');
          setShowDialog(false);
          await loadSnippets();
        } else {
          setMessage(`错误: ${response.error}`, 'error');
        }
      }
    } catch (err) {
      console.error('Failed to save snippet:', err);
      setMessage(`错误: ${err}`, 'error');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const truncateSql = (sql: string, maxLen: number = 50): string => {
    const singleLine = sql.replace(/\s+/g, ' ').trim();
    return singleLine.length > maxLen ? singleLine.slice(0, maxLen) + '...' : singleLine;
  };

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  return (
    <div style={styles.panel}>
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="搜索片段..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <button style={styles.newBtn} onClick={handleNewSnippet}>
          + 新建
        </button>
      </div>

      <div style={styles.filterBar}>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">全部</option>
          <option value="favorites">收藏</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.content}>
        {loading && filteredSnippets.length === 0 && (
          <div style={styles.emptyState}>加载中...</div>
        )}

        {!loading && filteredSnippets.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            <p>{t('snippets.empty')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('snippets.createFirstHint')}</p>
          </div>
        )}

        {filteredSnippets.length > 0 && (
          <div style={styles.snippetList}>
            {filteredSnippets.map(snippet => (
              <div
                key={snippet.id}
                style={{
                  ...styles.snippetItem,
                  borderColor: expandedId === snippet.id ? 'var(--primary)' : 'var(--border-primary)',
                }}
              >
                <div
                  style={styles.snippetHeader}
                  onClick={() => toggleExpand(snippet.id)}
                >
                  <div style={styles.snippetTitle}>
                    <span style={styles.favoriteIcon} onClick={(e) => handleToggleFavorite(snippet, e)}>
                      {snippet.isFavorite ? '⭐' : '☆'}
                    </span>
                    <span style={styles.snippetName} title={snippet.name}>{snippet.name}</span>
                  </div>
                  <div style={styles.snippetActions}>
                    <button
                      style={styles.actionBtn}
                      onClick={(e) => { e.stopPropagation(); handleInsert(snippet); }}
                      title={t('snippets.insertToEditor')}
                    >
                      📝
                    </button>
                    <button
                      style={styles.actionBtn}
                      onClick={(e) => handleEdit(snippet, e)}
                      title={t('common.edit')}
                    >
                      ✏️
                    </button>
                    <button
                      style={{ ...styles.actionBtn, color: 'var(--error)' }}
                      onClick={(e) => handleDelete(snippet, e)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div
                  style={styles.snippetSummary}
                  onClick={() => toggleExpand(snippet.id)}
                  onDoubleClick={() => handleInsert(snippet)}
                >
                  <code style={styles.sqlPreview}>{truncateSql(snippet.sql)}</code>
                </div>

                {expandedId === snippet.id && (
                  <div style={styles.snippetDetails}>
                    {snippet.description && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>描述:</span>
                        <span style={styles.detailValue}>{snippet.description}</span>
                      </div>
                    )}
                    {snippet.category && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>分类:</span>
                        <span style={styles.detailTag}>{snippet.category}</span>
                      </div>
                    )}
                    {snippet.tags && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>标签:</span>
                        <div style={styles.tagsContainer}>
                          {snippet.tags.split(',').map((tag, i) => (
                            <span key={i} style={styles.tag}>{tag.trim()}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>SQL:</span>
                    </div>
                    <pre style={styles.sqlFull}>{snippet.sql}</pre>
                    <div style={styles.detailRow}>
                      <span style={styles.detailMeta}>
                        创建于 {new Date(snippet.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showDialog && (
        <div style={styles.dialogOverlay} onClick={() => setShowDialog(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogHeader}>
              <h3 style={styles.dialogTitle}>
                {editingSnippet ? '编辑 SQL 片段' : '新建 SQL 片段'}
              </h3>
              <button style={styles.dialogClose} onClick={() => setShowDialog(false)}>✕</button>
            </div>

            <div style={styles.dialogBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={styles.formInput}
                  placeholder="输入片段名称"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>SQL *</label>
                <textarea
                  value={formData.sql}
                  onChange={(e) => setFormData(prev => ({ ...prev, sql: e.target.value }))}
                  style={styles.formTextarea}
                  placeholder={t('snippets.sqlPlaceholder')}
                  rows={8}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  style={styles.formInput}
                  placeholder={t('snippets.descPlaceholder')}
                />
              </div>

              <div style={styles.formRow}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.formLabel}>分类</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    style={styles.formInput}
                    placeholder={t('snippets.categoryName')}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>标签（逗号分隔）</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  style={styles.formInput}
                  placeholder={t('snippets.tagsPlaceholder')}
                />
              </div>
            </div>

            <div style={styles.dialogFooter}>
              <button style={styles.cancelBtn} onClick={() => setShowDialog(false)}>
                取消
              </button>
              <button style={styles.saveBtn} onClick={handleSave}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    height: '100%',
    background: 'var(--bg-primary)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
  },
  searchBox: {
    flex: 1,
  },
  searchInput: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '12px',
    outline: 'none',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  newBtn: {
    padding: '6px 12px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-tertiary)',
  },
  filterSelect: {
    padding: '4px 8px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '12px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  error: {
    padding: '8px 16px',
    background: 'var(--error-bg)',
    color: 'var(--error)',
    borderBottom: '1px solid var(--error)',
    fontSize: '12px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '12px',
    minHeight: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    fontSize: '13px',
  },
  snippetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  snippetItem: {
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    background: 'var(--bg-secondary)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  snippetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    gap: '8px',
  },
  snippetTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
    minWidth: 0,
  },
  favoriteIcon: {
    fontSize: '14px',
    cursor: 'pointer',
    flexShrink: 0,
    userSelect: 'none',
  },
  snippetName: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  snippetActions: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  actionBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '2px 4px',
    borderRadius: '3px',
    transition: 'background 0.2s',
  },
  snippetSummary: {
    padding: '0 10px 8px 10px',
  },
  sqlPreview: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: 'Consolas, Monaco, monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
  },
  snippetDetails: {
    padding: '10px',
    borderTop: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
  },
  detailRow: {
    marginBottom: '8px',
    fontSize: '12px',
  },
  detailLabel: {
    color: 'var(--text-tertiary)',
    marginRight: '6px',
    fontWeight: '500',
  },
  detailValue: {
    color: 'var(--text-primary)',
  },
  detailTag: {
    display: 'inline-block',
    padding: '2px 8px',
    background: 'var(--primary-bg)',
    color: 'var(--primary)',
    borderRadius: '10px',
    fontSize: '11px',
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '4px',
  },
  tag: {
    display: 'inline-block',
    padding: '2px 6px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderRadius: '8px',
    fontSize: '10px',
  },
  sqlFull: {
    margin: '8px 0',
    padding: '10px',
    background: 'var(--bg-tertiary)',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'Consolas, Monaco, monospace',
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  detailMeta: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: 'var(--bg-primary)',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '560px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  },
  dialogHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  dialogTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  dialogClose: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  dialogBody: {
    padding: '16px 20px',
    overflowY: 'auto',
    flex: 1,
  },
  dialogFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '14px 20px',
    borderTop: '1px solid var(--border-primary)',
  },
  formGroup: {
    marginBottom: '14px',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  formLabel: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  formInput: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
  },
  formTextarea: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'Consolas, Monaco, monospace',
    outline: 'none',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  saveBtn: {
    padding: '8px 20px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
};

export default SnippetsPanel;
