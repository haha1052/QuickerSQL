import React, { createContext, useContext, useEffect, useRef } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import shortcutManager, { parseShortcut } from '../utils/shortcutManager';
import { useSetting } from './SettingsContext';
import { useLocale } from './LocaleContext';
import { useSettingsStore, useAppStore, useWorkspaceStore, useQueryStore, useProjectStore, useImportStore } from '../store';
import type { WorkspaceTabType } from '../types';
import { tauriService } from '../services';
import { formatSql } from '../utils/sqlFormatter';

const MODIFIER_CTRL = 2048;
const MODIFIER_SHIFT = 1024;
const MODIFIER_ALT = 512;

const KEY_CODE_MAP: Record<string, number> = {
  A: 31, B: 32, C: 33, D: 34, E: 35, F: 36, G: 37, H: 38, I: 39,
  J: 40, K: 41, L: 42, M: 43, N: 44, O: 45, P: 46, Q: 47, R: 48,
  S: 49, T: 50, U: 51, V: 52, W: 53, X: 54, Y: 55, Z: 56,
  '0': 11, '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67, F10: 68, F11: 69, F12: 70,
  Enter: 3, Escape: 9, Tab: 2, Space: 10, Backspace: 1, Delete: 20,
  ArrowUp: 16, ArrowDown: 18, ArrowLeft: 15, ArrowRight: 17,
  Home: 14, End: 13, PageUp: 11, PageDown: 12,
  ',': 84, '/': 89,
};

interface ShortcutContextValue {
  manager: typeof shortcutManager;
}

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

function keyboardEventToKeyCode(event: KeyboardEvent): number {
  let result = 0;

  if (event.ctrlKey || event.metaKey) {
    result |= MODIFIER_CTRL;
  }
  if (event.shiftKey) {
    result |= MODIFIER_SHIFT;
  }
  if (event.altKey) {
    result |= MODIFIER_ALT;
  }

  const key = event.key;
  let keyCode: number | undefined;

  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    keyCode = KEY_CODE_MAP[key.toUpperCase()];
  } else if (key.length === 1 && /[0-9]/.test(key)) {
    keyCode = KEY_CODE_MAP[key];
  } else {
    keyCode = KEY_CODE_MAP[key];
  }

  if (keyCode !== undefined) {
    result |= keyCode;
  } else {
    return 0;
  }

  return result;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') { // safe_sql: HTML <select> 元素名（非 SQL 关键字）
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

function isMonacoEditor(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  let el: HTMLElement | null = target;
  while (el) {
    if (el.classList && el.classList.contains('monaco-editor')) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

const GLOBAL_SHORTCUT_KEYS = [
  'newFile',
  'openFile',
  'saveFile',
  'saveAs',
  'closeTab',
  'nextTab',
  'prevTab',
  'undo',
  'redo',
  'copy',
  'paste',
  'cut',
  'selectAll',
  'newProject',
  'importData',
  'exportData',
  'openSettings',
  'explainPlan',
] as const;

type GlobalShortcutKey = typeof GLOBAL_SHORTCUT_KEYS[number];

const PASS_THROUGH_COMMANDS = new Set([
  'undo', 'redo', 'copy', 'paste', 'cut', 'selectAll'
]);

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { openSettingsModal } = useSettingsStore();
  const { setMessage } = useAppStore();
  const { t } = useLocale();
  const [formatOnSave] = useSetting('sql', 'formatOnSave');
  const [trimTrailingWhitespace] = useSetting('editor', 'trimTrailingWhitespace');
  const [enableExplainPlan] = useSetting('database', 'enableExplainPlan');

  const shortcutValues: Record<string, string | undefined> = {};
  for (const key of GLOBAL_SHORTCUT_KEYS) {
    shortcutValues[key] = useSetting('shortcuts', key)[0];
  }

  const registeredCommandsRef = useRef<Set<string>>(new Set());
  const boundShortcutsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const handleNewFile = () => {
      const { addTab, tabs } = useWorkspaceStore.getState();
      addTab({
        title: `QUERY ${tabs.filter(t => t.type === 'sql').length + 1}`,
        type: 'sql' as WorkspaceTabType,
        panels: [
          {
            id: 'editor',
            type: 'sql_editor',
            title: 'SQL Editor',
            size: 100,
            active: true,
            content: null,
          },
          {
            id: 'results',
            type: 'results_grid',
            title: 'Results',
            size: 0,
            active: true,
            content: null,
          },
        ],
        active: true,
      });
    };

    const handleOpenFile = async () => {
      try {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: 'SQL',
              extensions: ['sql'],
            },
          ],
        });

        if (selected) {
          const { invoke } = await import('@tauri-apps/api/core');
          const content = await invoke<string>('read_text_file', { path: selected });
          
          const { addSqlQuery, updateSqlQuery, setActiveQueryId } = useQueryStore.getState();
          addSqlQuery();
          
          const { sqlQueries } = useQueryStore.getState();
          const newQuery = sqlQueries[sqlQueries.length - 1];
          
          updateSqlQuery(newQuery.id, { sql: content });
          setActiveQueryId(newQuery.id);
          
          const fileName = selected.split(/[\\/]/).pop() || 'query.sql';
          updateSqlQuery(newQuery.id, { name: fileName.replace('.sql', '') });
          
          const { addTab } = useWorkspaceStore.getState();
          addTab({
            title: fileName.replace('.sql', ''),
            type: 'sql' as WorkspaceTabType,
            panels: [
              {
                id: 'editor',
                type: 'sql_editor',
                title: 'SQL Editor',
                size: 100,
                active: true,
                content: null,
              },
              {
                id: 'results',
                type: 'results_grid',
                title: 'Results',
                size: 0,
                active: true,
                content: null,
              },
            ],
            active: true,
          }, { queryId: newQuery.id });
          
          setMessage(`Success: ${fileName}`, 'success');
        }
      } catch (e) {
        setMessage(`Error: ${String(e)}`, 'error');
      }
    };

    const handleSaveFile = async () => {
      const { sqlQueries, activeQueryId } = useQueryStore.getState();
      const activeQuery = sqlQueries.find(q => q.id === activeQueryId);
      
      if (!activeQuery) {
        setMessage('No active query', 'warning');
        return;
      }

      try {
        let contentToSave = activeQuery.sql;
        
        // 如果启用了保存时格式化，则格式化 SQL
        if (formatOnSave === 'true') {
          contentToSave = formatSql(contentToSave);
        }
        
        // 如果启用了去除尾部空格，则处理
        if (trimTrailingWhitespace === 'true') {
          contentToSave = contentToSave.replace(/[ \t]+\n/g, '\n');
        }
        
        const path = await save({
          defaultPath: `${activeQuery.name || 'query'}.sql`,
          filters: [
            {
              name: 'SQL',
              extensions: ['sql'],
            },
          ],
        });

        if (path) {
          await tauriService.writeTextFile(path, contentToSave);
          setMessage(`Saved: ${path}`, 'success');
        }
      } catch (e) {
        setMessage(`Error: ${String(e)}`, 'error');
      }
    };

    const handleSaveAs = handleSaveFile;

    const handleNewProject = () => {
      // 打开项目弹窗
      useProjectStore.getState().setShowProjectModal(true);
    };

    const handleImportData = async () => {
      try {
        // 打开文件选择对话框
        const filePath = await open({
          multiple: true,
          filters: [
            { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls'] },
          ],
        });

        if (filePath) {
          const paths = Array.isArray(filePath) ? filePath : [filePath];
          // 将文件添加到导入队列
          const { addImportItems } = useImportStore.getState();
          const newItems = paths.map((path) => {
            const fileName = path.split(/[\\/]/).pop() || path;
            return {
              id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              fileType: fileName.endsWith('.csv') ? 'csv' as const : 'excel' as const,
              filePath: path,
              fileName,
              preview: { headers: [], rows: [] },
              hasHeader: true,
              tableName: fileName.replace(/\.(csv|xlsx?|xls)$/i, ''),
              fields: [],
              selected: true,
              status: 'idle' as const,
              isParent: false,
            };
          });
          addImportItems(newItems);
          setMessage({ key: 'toast.addedFilesHint', vars: { count: paths.length } }, 'info');
        }
      } catch (e) {
        setMessage(`Error: ${String(e)}`, 'error');
      }
    };

    const handleExportData = async () => {
      try {
        // 获取当前活动的查询
        const { activeQueryId, sqlQueries } = useQueryStore.getState();
        const activeQuery = sqlQueries.find((q) => q.id === activeQueryId);

        if (!activeQuery || !activeQuery.sql) {
          setMessage('toast.noExportableSQL', 'warning');
          return;
        }

        // 打开保存对话框
        const filePath = await save({
          defaultPath: 'query.sql',
          filters: [
            { name: 'SQL Files', extensions: ['sql'] },
          ],
        });

        if (filePath) {
          await tauriService.writeTextFile(filePath, activeQuery.sql);
          setMessage({ key: 'toast.exportedTo', vars: { path: filePath } }, 'success');
        }
      } catch (e) {
        setMessage(`Error: ${String(e)}`, 'error');
      }
    };

    const handleExplainPlan = async () => {
      try {
        // 检查 enableExplainPlan 设置
        if (enableExplainPlan === 'false') {
          setMessage('toast.explainDisabled', 'warning');
          return;
        }

        // 获取当前活动的查询
        const { activeQueryId, sqlQueries } = useQueryStore.getState();
        const activeQuery = sqlQueries.find((q) => q.id === activeQueryId);

        if (!activeQuery || !activeQuery.sql) {
          setMessage('toast.noExplainSQL', 'warning');
          return;
        }

        // 获取 SQL 内容并添加 EXPLAIN
        const sql = activeQuery.sql.trim();
        if (!sql) {
          setMessage('toast.noExplainSQL', 'warning');
          return;
        }

        // 构建 EXPLAIN QUERY PLAN 查询
        const explainSql = sql.startsWith('EXPLAIN')
          ? sql
          : sql.startsWith('SELECT') || sql.startsWith('WITH') // safe_sql: SQL 关键字检测逻辑（用于判断 SQL 类型以决定是否加 EXPLAIN 前缀）
            ? `EXPLAIN QUERY PLAN ${sql}`
            : sql;

        // 执行 EXPLAIN 查询
        const response = await tauriService.executeSql(explainSql);

        if (response.success && response.data) {
          const results = response.data.results;
          if (results.length > 0 && results[0].rows) {
            // 将结果格式化显示
            const formatted = results[0].rows.map(row => row.join(' | ')).join('\n');
            setMessage({ key: 'toast.explainResult', vars: { result: formatted } }, 'info');
          } else if (results.length > 0 && results[0].error) {
            setMessage({ key: 'toast.explainFailed', vars: { error: results[0].error } }, 'error');
          } else {
            setMessage('common.queryResultEmpty', 'warning');
          }
        } else {
          setMessage({ key: 'toast.explainFailed', vars: { error: response.error || t('common.unknownError') } }, 'error');
        }
      } catch (e) {
        setMessage(`Error: ${String(e)}`, 'error');
      }
    };

    const handleCloseTab = () => {
      const { activeTabId, removeTab } = useWorkspaceStore.getState();
      if (activeTabId) {
        removeTab(activeTabId);
      }
    };

    const handleNextTab = () => {
      const { tabs, activeTabId, setActiveTab } = useWorkspaceStore.getState();
      if (tabs.length <= 1) return;
      const currentIndex = tabs.findIndex(t => t.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex].id);
    };

    const handlePrevTab = () => {
      const { tabs, activeTabId, setActiveTab } = useWorkspaceStore.getState();
      if (tabs.length <= 1) return;
      const currentIndex = tabs.findIndex(t => t.id === activeTabId);
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex].id);
    };

    const handlePassThrough = () => {
    };

    const commands: Array<{ id: GlobalShortcutKey; handler: () => void }> = [
      { id: 'newFile', handler: handleNewFile },
      { id: 'openFile', handler: handleOpenFile },
      { id: 'saveFile', handler: handleSaveFile },
      { id: 'saveAs', handler: handleSaveAs },
      { id: 'closeTab', handler: handleCloseTab },
      { id: 'nextTab', handler: handleNextTab },
      { id: 'prevTab', handler: handlePrevTab },
      { id: 'undo', handler: handlePassThrough },
      { id: 'redo', handler: handlePassThrough },
      { id: 'copy', handler: handlePassThrough },
      { id: 'paste', handler: handlePassThrough },
      { id: 'cut', handler: handlePassThrough },
      { id: 'selectAll', handler: handlePassThrough },
      { id: 'newProject', handler: handleNewProject },
      { id: 'importData', handler: handleImportData },
      { id: 'exportData', handler: handleExportData },
      { id: 'openSettings', handler: () => openSettingsModal() },
      { id: 'explainPlan', handler: handleExplainPlan },
    ];

    const unregisterFns: Array<() => void> = [];
    for (const cmd of commands) {
      if (!registeredCommandsRef.current.has(cmd.id)) {
        const unregister = shortcutManager.registerCommand({
          id: cmd.id,
          scope: 'global',
          handler: cmd.handler,
        });
        unregisterFns.push(unregister);
        registeredCommandsRef.current.add(cmd.id);
        console.debug('[Shortcut] 注册全局命令:', cmd.id);
      }
    }

    return () => {
      for (const unregister of unregisterFns) {
        unregister();
      }
      registeredCommandsRef.current.clear();
    };
  }, [openSettingsModal, setMessage, enableExplainPlan, t]);

  useEffect(() => {
    for (const key of GLOBAL_SHORTCUT_KEYS) {
      const keyString = shortcutValues[key];
      const previous = boundShortcutsRef.current.get(key);

      if (keyString && keyString !== previous) {
        const keyCode = parseShortcut(keyString);
        if (keyCode !== 0) {
          try {
            shortcutManager.bindShortcut(key, keyString);
            boundShortcutsRef.current.set(key, keyString);
            console.debug('[Shortcut] 绑定全局快捷键:', key, '=', keyString);
          } catch (e) {
            console.warn('[ShortcutProvider] 绑定快捷键失败:', key, e);
          }
        }
      } else if (!keyString && previous) {
        shortcutManager.unbindShortcut(key);
        boundShortcutsRef.current.delete(key);
      }
    }
  }, [shortcutValues]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const eventKeyCode = keyboardEventToKeyCode(event);
      if (eventKeyCode === 0) {
        return;
      }

      const hasModifier = (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey);
      const isEditable = isEditableElement(event.target);
      const isInMonaco = isMonacoEditor(event.target);

      const bindings = shortcutManager.getAllBindings();

      if (isInMonaco) {
        const editorCommands = shortcutManager.getCommandsByScope('editor');
        const editorCommandIds = new Set(editorCommands.map(c => c.id));

        for (const binding of bindings) {
          if (binding.keyCode === eventKeyCode && editorCommandIds.has(binding.commandId)) {
            const command = editorCommands.find(c => c.id === binding.commandId);
            if (command) {
              console.debug('[Shortcut] 触发编辑器命令:', command.id);
              event.preventDefault();
              event.stopPropagation();
              command.handler();
              return;
            }
          }
        }
        return;
      }

      if (isEditable && !hasModifier) {
        return;
      }

      const globalCommands = shortcutManager.getCommandsByScope('global');
      const globalCommandIds = new Set(globalCommands.map(c => c.id));

      for (const binding of bindings) {
        if (binding.keyCode === eventKeyCode && globalCommandIds.has(binding.commandId)) {
          const command = globalCommands.find(c => c.id === binding.commandId);
          if (command) {
            console.debug('[Shortcut] 触发全局命令:', command.id);
            if (!PASS_THROUGH_COMMANDS.has(binding.commandId)) {
              event.preventDefault();
              event.stopPropagation();
            }
            command.handler();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  const contextValue: ShortcutContextValue = {
    manager: shortcutManager,
  };

  return (
    <ShortcutContext.Provider value={contextValue}>
      {children}
    </ShortcutContext.Provider>
  );
};

export function useShortcuts(): typeof shortcutManager {
  const context = useContext(ShortcutContext);
  if (context) {
    return context.manager;
  }
  return shortcutManager;
}

export default ShortcutProvider;
