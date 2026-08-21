import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Monaco from 'monaco-editor';
import type { SqlQuery } from '../../types';
import { useSetting } from '../../context/SettingsContext';
import { useLocale } from '../../context/LocaleContext';
import { useTheme } from '../../context/ThemeContext';
import { useQueryStore } from '../../store';
import { getStatementAtCursor } from '../../utils/sqlStatementParser';
import { registerSqlCompletionProvider, unregisterSqlCompletionProvider, setCompletionData } from '../../utils/sqlCompletionProvider';
import { parseSqlError, calculateErrorLineOffset } from '../../utils/sqlErrorParser';
import { formatSql } from '../../utils/sqlFormatter';
import { tauriService } from '../../services/tauri';
import { ParameterPanel } from './ParameterPanel';
import shortcutManager, { parseShortcut } from '../../utils/shortcutManager';
import { editorSelectionGetter } from './hooks/useQueryExecution';

interface SQLEditorProps {
  query: SqlQuery;
  onChange: (sql: string) => void;
  onExecute?: () => void;
  onExecuteStatement?: (sql: string) => void;
  onExplain?: () => void;
  onExplainStatement?: (sql: string) => void;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({
  query,
  onChange,
  onExecute,
  onExecuteStatement,
  onExplain,
  onExplainStatement,
}) => {
  const { t } = useLocale();
  const { actualTheme } = useTheme();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const completionRegisteredRef = useRef<boolean>(false);
  const autoExecutePendingRef = useRef<boolean>(false);
  // P2-13: 自动恢复确认弹窗状态（替代原生 window.confirm）
  const [recoverConfirm, setRecoverConfirm] = useState<{ sql: string; timestamp: number; saveKey: string } | null>(null);
  const jumpToLine = useQueryStore((state) => state.jumpToLine);
  const setJumpToLine = useQueryStore((state) => state.setJumpToLine);

  const [fontSize] = useSetting('appearance', 'fontSize');
  const [fontFamily] = useSetting('appearance', 'fontFamily');
  const [wordWrap] = useSetting('appearance', 'wordWrap');
  const [tabSize] = useSetting('editor', 'tabSize');
  const [lineHeight] = useSetting('appearance', 'lineHeight');
  const [appearanceMinimap] = useSetting('appearance', 'minimap');
  const [smoothScrolling] = useSetting('appearance', 'smoothScrolling');

  const [showLineNumbers] = useSetting('editor', 'showLineNumbers');
  const [highlightLine] = useSetting('editor', 'highlightLine');
  const [bracketMatching] = useSetting('editor', 'bracketMatching');
  const [showMinimap] = useSetting('editor', 'showMinimap');
  const [enableCodeFolding] = useSetting('editor', 'enableCodeFolding');
  const [insertSpaces] = useSetting('editor', 'insertSpaces');
  const [autoIndent] = useSetting('editor', 'autoIndent');
  const [formatOnPaste] = useSetting('editor', 'formatOnPaste');
  const [bracketPairColorization] = useSetting('editor', 'bracketPairColorization');
  const [cursorBlinking] = useSetting('editor', 'cursorBlinking');
  const [cursorStyle] = useSetting('editor', 'cursorStyle');
  const [renderWhitespace] = useSetting('editor', 'renderWhitespace');

  const [autoComplete] = useSetting('sql', 'autoComplete');
  const [uppercaseKeywords] = useSetting('sql', 'uppercaseKeywords');
  const [enableHighlighting] = useSetting('sql', 'enableHighlighting');
  const [autoExecute] = useSetting('sql', 'autoExecute');
  const [enableAutoRecover] = useSetting('sql', 'enableAutoRecover');
  const [_defaultSelectLimit] = useSetting('sql', 'defaultSelectLimit');

  // 编辑器设置
  const [autoSave] = useSetting('editor', 'autoSave');
  const [saveInterval] = useSetting('editor', 'saveInterval');

  const [executeQueryShortcut] = useSetting('shortcuts', 'executeQuery');
  const [executeAllShortcut] = useSetting('shortcuts', 'executeAll');
  const [explainQueryShortcut] = useSetting('shortcuts', 'explainQuery');
  const [explainAllShortcut] = useSetting('shortcuts', 'explainAll');
  const [formatSqlShortcut] = useSetting('shortcuts', 'formatSql');
  const [findShortcut] = useSetting('shortcuts', 'find');
  const [replaceShortcut] = useSetting('shortcuts', 'replace');
  const [goToLineShortcut] = useSetting('shortcuts', 'goToLine');
  const [toggleCommentShortcut] = useSetting('shortcuts', 'toggleComment');

  const autoCompleteEnabled = autoComplete !== 'false';
  const uppercaseKeywordsEnabled = uppercaseKeywords !== 'false';
  const highlightingEnabled = enableHighlighting !== 'false';

  const fontSizeNum = parseInt(fontSize || '14', 10);
  const tabSizeNum = parseInt(tabSize || '2', 10);
  const lineHeightNum = parseFloat(lineHeight || '1.6');

  const monacoTheme = actualTheme === 'dark' ? 'vs-dark' : 'vs';
  const wordWrapSetting = wordWrap === 'true' ? 'on' : 'off';

  const lineNumbersSetting = showLineNumbers === 'true' ? 'on' : 'off';
  const renderLineHighlightSetting = highlightLine === 'true' ? 'all' : 'none';
  const matchBracketsSetting = bracketMatching === 'true' ? 'always' : 'never';
  const minimapEnabled = appearanceMinimap !== 'false' && showMinimap === 'true';
  const foldingEnabled = enableCodeFolding === 'true';
  const insertSpacesEnabled = insertSpaces === 'true';
  const autoIndentSetting = autoIndent === 'true' ? 'full' : 'none';
  const formatOnPasteEnabled = formatOnPaste === 'true';
  const bracketPairColorizationEnabled = bracketPairColorization === 'true';
  const smoothScrollingEnabled = smoothScrolling !== 'false';
  
  // cursorBlinking: blink | smooth | phase | expand
  const cursorBlinkingSetting = cursorBlinking === 'smooth' ? 'smooth' 
    : cursorBlinking === 'phase' ? 'phase' 
    : cursorBlinking === 'expand' ? 'expand' 
    : 'blink';
  
  // cursorStyle: line | block | underline
  const cursorStyleSetting = cursorStyle === 'block' ? 'block' 
    : cursorStyle === 'underline' ? 'underline' 
    : 'line';
  
  // renderWhitespace: none | boundary | all
  const renderWhitespaceSetting = renderWhitespace === 'boundary' ? 'boundary' 
    : renderWhitespace === 'all' ? 'all' 
    : 'none';

  const getErrorLineNumbers = (): number[] => {
    const batchResults = query.batchResults;
    if (!batchResults || batchResults.length === 0) return [];

    const errorLines: number[] = [];

    for (const result of batchResults) {
      if (result.success || !result.error) continue;

      const parsed = parseSqlError(result.error);
      if (parsed.lineNumber === null) continue;

      const offset = calculateErrorLineOffset(query.sql, result.statement);
      const actualLine = offset + parsed.lineNumber;
      errorLines.push(actualLine);
    }

    return errorLines;
  };

  const updateErrorDecorations = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    const errorLines = getErrorLineNumbers();

    const newDecorations = errorLines.map((lineNumber) => ({
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'sql-error-line',
        overviewRuler: {
          color: '#ff5555',
          position: Monaco.editor.OverviewRulerLane.Right,
        },
        linesDecorationsClassName: 'sql-error-line-decoration',
      },
    }));

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  };

  const clearErrorDecorations = (editor: Monaco.editor.IStandaloneCodeEditor) => {
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
  };

  const handleEditorMount = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (autoCompleteEnabled && !completionRegisteredRef.current) {
      registerSqlCompletionProvider(monaco);
      completionRegisteredRef.current = true;
    }

    updateErrorDecorations(editor, monaco);

    // 注册选中文本获取器，供外部执行按钮使用
    editorSelectionGetter.current = () => {
      const editor = editorRef.current;
      if (!editor) return undefined;
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model) return undefined;
      const selectedText = model.getValueInRange(selection);
      if (selectedText && selectedText.trim().length > 0) {
        return selectedText.trim();
      }
      return undefined;
    };
  };

  // 组件卸载时清除选中文本获取器，避免持有已卸载的 editor 引用
  useEffect(() => {
    return () => {
      editorSelectionGetter.current = null;
    };
  }, []);

  // autoExecute: 监听分号键和回车键
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const disposable = editor.onKeyDown((e) => {
      if (autoExecute === 'true') {
        const key = e.browserEvent.key;
        if (key === ';') {
          // 检测到分号，设置待执行标志
          autoExecutePendingRef.current = true;
        } else if (key === 'Enter' && autoExecutePendingRef.current) {
          // 检测到回车，且之前输入了分号，执行 SQL
          autoExecutePendingRef.current = false;
          const model = editor.getModel();
          if (model) {
            const sql = model.getValue();
            if (sql && sql.trim().length > 0) {
              onExecute?.();
            }
          }
          // 阻止默认行为
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    // 当用户移动光标时，清除待执行标志
    const cursorDisposable = editor.onDidChangeCursorSelection(() => {
      autoExecutePendingRef.current = false;
    });

    return () => {
      disposable.dispose();
      cursorDisposable.dispose();
    };
  }, [autoExecute, onExecute]);

  // enableAutoRecover + autoSave: 定期保存到 localStorage 以便恢复
  useEffect(() => {
    // autoRecover 和 autoSave 任一启用即可
    if (enableAutoRecover !== 'true' && autoSave !== 'true') return;

    const editor = editorRef.current;
    if (!editor) return;

    const AUTO_SAVE_KEY = `__autosave_${query.id}`;
    // 使用 saveInterval 设置，如果未设置则默认 30 秒
    const saveIntervalMs = (parseInt(saveInterval || '30', 10)) * 1000;

    // 检查是否有恢复点
    const checkAndRecover = () => {
      const saved = localStorage.getItem(AUTO_SAVE_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.sql && data.sql !== query.sql) {
            // P2-13: 替换原生 window.confirm 为项目内确认弹窗
            // 将恢复决策延后到用户点击确认/取消时执行
            setRecoverConfirm({
              sql: data.sql,
              timestamp: data.timestamp,
              saveKey: AUTO_SAVE_KEY,
            });
          }
        } catch (e) {
          console.warn('[SQLEditor] 恢复自动保存内容失败:', e);
          localStorage.removeItem(AUTO_SAVE_KEY);
        }
      }
    };

    // P2-13: 用户确认恢复后执行的回调（由 ConfirmModal 触发）
    // 注：此处闭包内不直接调用，改用 setRecoverConfirm 触发弹窗，
    // 实际恢复操作在 handleConfirmRecover / handleCancelRecover 中完成

    // 立即检查一次
    checkAndRecover();

    // 定期保存
    const intervalId = setInterval(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;
      const sql = model.getValue();
      if (sql && sql.trim().length > 0) {
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify({
          sql,
          timestamp: Date.now(),
        }));
      }
    }, saveIntervalMs);

    // 编辑器内容变化时也保存（仅 autoSave 启用时）
    let contentDisposable: Monaco.IDisposable | undefined;
    if (autoSave === 'true') {
      contentDisposable = editor.onDidChangeModelContent(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;
        const sql = model.getValue();
        if (sql && sql.trim().length > 0) {
          localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify({
            sql,
            timestamp: Date.now(),
          }));
        }
      });
    }

    return () => {
      clearInterval(intervalId);
      contentDisposable?.dispose();
    };
  }, [enableAutoRecover, autoSave, saveInterval, query.id, query.sql, onChange]);

  useEffect(() => {
    const handleExecuteQuery = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.executeQuery');
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!model) return;

      // 有选中且非空白：执行选中的 SQL
      if (selection) {
        const selectedText = model.getValueInRange(selection);
        if (selectedText && selectedText.trim().length > 0) {
          onExecuteStatement?.(selectedText.trim());
          return;
        }
      }

      // 无选中：执行全部 SQL（与"执行"按钮行为一致）
      onExecute?.();
    };

    const handleExecuteAll = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.executeAll');
      onExecute?.();
    };

    const handleExplainQuery = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.explainQuery');
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!model) return;

      if (selection) {
        const selectedText = model.getValueInRange(selection);
        if (selectedText && selectedText.trim().length > 0) {
          onExplainStatement?.(selectedText.trim());
          return;
        }
      }

      const position = editor.getPosition();
      if (!position) return;
      const sql = model.getValue();
      const { statement } = getStatementAtCursor(sql, position.lineNumber - 1, position.column - 1);
      if (statement && statement.trim().length > 0) {
        onExplainStatement?.(statement.trim());
      }
    };

    const handleExplainAll = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.explainAll');
      onExplain?.();
    };

    const handleFormatSql = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.formatSql');
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      const position = editor.getPosition();
      const originalValue = model.getValue();

      try {
        const formatted = formatSql(originalValue, tabSizeNum, uppercaseKeywordsEnabled);
        if (formatted !== originalValue) {
          editor.executeEdits('format-sql', [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ]);

          if (position) {
            const lineCount = model.getLineCount();
            const newLineNumber = Math.min(position.lineNumber, lineCount);
            const maxColumn = model.getLineMaxColumn(newLineNumber);
            const newColumn = Math.min(position.column, maxColumn);
            editor.setPosition({ lineNumber: newLineNumber, column: newColumn });
          }
        }
      } catch (e) {
        console.warn('[SQLEditor] SQL 格式化失败:', e);
      }
    };

    const handleFind = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.find');
      const editor = editorRef.current;
      if (!editor) return;
      const action = editor.getAction('actions.find');
      if (action) {
        action.run();
      }
    };

    const handleReplace = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.replace');
      const editor = editorRef.current;
      if (!editor) return;
      const action = editor.getAction('editor.action.startFindReplaceAction');
      if (action) {
        action.run();
      }
    };

    const handleGoToLine = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.goToLine');
      const editor = editorRef.current;
      if (!editor) return;
      const action = editor.getAction('editor.action.gotoLine');
      if (action) {
        action.run();
      }
    };

    const handleToggleComment = () => {
      console.debug('[Shortcut] 触发编辑器命令:', 'editor.toggleComment');
      const editor = editorRef.current;
      if (!editor) return;
      const action = editor.getAction('editor.action.commentLine');
      if (action) {
        action.run();
      }
    };

    const commandIds = ['editor.executeQuery', 'editor.executeAll', 'editor.explainQuery', 'editor.explainAll', 'editor.formatSql', 'editor.find', 'editor.replace', 'editor.goToLine', 'editor.toggleComment'];
    const unregisterFns: Array<() => void> = [];

    const commands = [
      { id: 'editor.executeQuery', handler: handleExecuteQuery },
      { id: 'editor.executeAll', handler: handleExecuteAll },
      { id: 'editor.explainQuery', handler: handleExplainQuery },
      { id: 'editor.explainAll', handler: handleExplainAll },
      { id: 'editor.formatSql', handler: handleFormatSql },
      { id: 'editor.find', handler: handleFind },
      { id: 'editor.replace', handler: handleReplace },
      { id: 'editor.goToLine', handler: handleGoToLine },
      { id: 'editor.toggleComment', handler: handleToggleComment },
    ];

    for (const cmd of commands) {
      try {
        const unregister = shortcutManager.registerCommand({
          id: cmd.id,
          scope: 'editor',
          handler: cmd.handler,
        });
        unregisterFns.push(unregister);
        console.debug('[Shortcut] 注册编辑器命令:', cmd.id);
      } catch (e) {
        console.warn('[SQLEditor] 快捷键操作失败:', e);
      }
    }

    const shortcutMap: Record<string, string | undefined> = {
      'editor.executeQuery': executeQueryShortcut,
      'editor.executeAll': executeAllShortcut,
      'editor.explainQuery': explainQueryShortcut,
      'editor.explainAll': explainAllShortcut,
      'editor.formatSql': formatSqlShortcut,
      'editor.find': findShortcut,
      'editor.replace': replaceShortcut,
      'editor.goToLine': goToLineShortcut,
      'editor.toggleComment': toggleCommentShortcut,
    };

    for (const [commandId, keyString] of Object.entries(shortcutMap)) {
      if (keyString) {
        const keyCode = parseShortcut(keyString);
        if (keyCode !== 0) {
          try {
            shortcutManager.bindShortcut(commandId, keyString);
            console.debug('[Shortcut] 绑定编辑器快捷键:', commandId, '=', keyString);
          } catch (e) {
            console.warn('[SQLEditor] 快捷键操作失败:', e);
          }
        }
      } else {
        shortcutManager.unbindShortcut(commandId);
      }
    }

    return () => {
      for (const unregister of unregisterFns) {
        unregister();
      }
      for (const id of commandIds) {
        shortcutManager.unbindShortcut(id);
      }
    };
  }, [onExecute, onExecuteStatement, onExplain, onExplainStatement, tabSizeNum, uppercaseKeywordsEnabled, executeQueryShortcut, executeAllShortcut, explainQueryShortcut, explainAllShortcut, formatSqlShortcut, findShortcut, replaceShortcut, goToLineShortcut, toggleCommentShortcut]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    updateErrorDecorations(editor, monaco);
  }, [query.batchResults, query.sql]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || jumpToLine === null) return;

    editor.revealLineInCenter(jumpToLine);
    editor.setPosition({ lineNumber: jumpToLine, column: 1 });
    editor.focus();

    setJumpToLine(null);
  }, [jumpToLine, setJumpToLine]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;

    if (autoCompleteEnabled && !completionRegisteredRef.current) {
      registerSqlCompletionProvider(monaco);
      completionRegisteredRef.current = true;
    } else if (!autoCompleteEnabled && completionRegisteredRef.current) {
      unregisterSqlCompletionProvider();
      completionRegisteredRef.current = false;
    }
  }, [autoCompleteEnabled]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const newLanguage = highlightingEnabled ? 'sql' : 'plaintext';
    if (model.getLanguageId() !== newLanguage) {
      monacoRef.current?.editor.setModelLanguage(model, newLanguage);
    }
  }, [highlightingEnabled]);

  useEffect(() => {
    const loadTablesAndColumns = async () => {
      try {
        const tablesResp = await tauriService.listTables();
        if (!tablesResp.success || !tablesResp.data) return;

        const tables = tablesResp.data;
        const tableNames = tables.map((t) => t.name);

        const seenColumns = new Set<string>();
        const allColumnNames: string[] = [];

        const colResults = await Promise.all(
          tables.map(async (table) => {
            try {
              const colsResp = await tauriService.getTableColumns(table.name);
              return colsResp.success && colsResp.data ? colsResp.data : [];
            } catch (e) {
              console.warn(`[SQLEditor] 加载表 ${table.name} 的列失败:`, e);
              return [];
            }
          })
        );

        for (const cols of colResults) {
          for (const col of cols) {
            if (!seenColumns.has(col.name)) {
              seenColumns.add(col.name);
              allColumnNames.push(col.name);
            }
          }
        }

        setCompletionData(tableNames, allColumnNames);
      } catch (err) {
        console.error('[SQLEditor] 加载表名和列名失败:', err);
      }
    };

    loadTablesAndColumns();
  }, []);

  const handleChange = (value: string | undefined) => {
    const editor = editorRef.current;
    if (editor) {
      clearErrorDecorations(editor);
    }
    onChange(value || '');
  };

  // P2-13: 用户确认恢复未保存内容
  const handleConfirmRecover = () => {
    if (!recoverConfirm) return;
    onChange(recoverConfirm.sql);
    localStorage.removeItem(recoverConfirm.saveKey);
    setRecoverConfirm(null);
  };

  // P2-13: 用户取消恢复，清除恢复点
  const handleCancelRecover = () => {
    if (!recoverConfirm) return;
    localStorage.removeItem(recoverConfirm.saveKey);
    setRecoverConfirm(null);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)' }}>
      <style>{`
        .sql-error-line {
          background: rgba(255, 85, 85, 0.1);
        }
        .sql-error-line-decoration {
          text-decoration: underline wavy #ff5555;
          text-decoration-skip-ink: none;
        }
      `}</style>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language="sql"
          theme={monacoTheme}
          value={query.sql}
          onChange={handleChange}
          onMount={handleEditorMount}
          aria-label={t('sqlEditor.inputSql')}
          options={{
            fontSize: fontSizeNum,
            fontFamily: fontFamily || 'Monaco, Menlo, "Ubuntu Mono", monospace',
            lineHeight: Math.round(fontSizeNum * lineHeightNum),
            lineNumbers: lineNumbersSetting,
            renderLineHighlight: renderLineHighlightSetting,
            matchBrackets: matchBracketsSetting,
            minimap: { enabled: minimapEnabled },
            folding: foldingEnabled,
            insertSpaces: insertSpacesEnabled,
            autoIndent: autoIndentSetting,
            bracketPairColorization: { enabled: bracketPairColorizationEnabled },
            automaticLayout: true,
            wordWrap: wordWrapSetting,
            tabSize: tabSizeNum,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: formatOnPasteEnabled,
            renderWhitespace: renderWhitespaceSetting,
            scrollBeyondLastLine: false,
            glyphMargin: false,
            lineNumbersMinChars: 2,
            padding: { top: 0, bottom: 0 },
            smoothScrolling: smoothScrollingEnabled,
            cursorBlinking: cursorBlinkingSetting,
            cursorStyle: cursorStyleSetting,
          }}
        />
      </div>
      <ParameterPanel sql={query.sql} />

      {/* P2-13: 自动恢复确认弹窗（替代原生 window.confirm） */}
      {recoverConfirm && (
        <div
          style={recoverModalStyles.overlay}
          onClick={handleCancelRecover}
        >
          <div
            style={recoverModalStyles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={recoverModalStyles.header}>
              <h3 style={recoverModalStyles.title}>{t('sqlEditor.recoverTitle')}</h3>
              <button style={recoverModalStyles.closeBtn} onClick={handleCancelRecover}>×</button>
            </div>
            <div style={recoverModalStyles.body}>
              <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {t('sqlEditor.recoverPrompt', { time: new Date(recoverConfirm.timestamp).toLocaleString() })}
              </p>
            </div>
            <div style={recoverModalStyles.footer}>
              <button style={recoverModalStyles.cancelBtn} onClick={handleCancelRecover}>
                {t('common.cancel')}
              </button>
              <button
                style={recoverModalStyles.confirmBtn}
                onClick={handleConfirmRecover}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// P2-13: 自动恢复确认弹窗样式（与项目其他模态风格一致）
const recoverModalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-primary)',
    borderRadius: 8,
    width: '420px',
    maxWidth: '90vw',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: { fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text-primary)' },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '0 4px',
    lineHeight: 1,
  },
  body: { padding: '20px' },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid var(--border-primary)',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 13,
  },
  confirmBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid var(--primary)',
    background: 'var(--primary)',
    color: 'white',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
};
