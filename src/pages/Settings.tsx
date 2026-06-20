import React, { useEffect, useState } from 'react';
import { useAppContext } from '../AppWrapper';
import { ChevronLeftIcon, CheckIcon } from '../components/common/Icons';
import { useSettingsStore } from '../store';
import { tauriService } from '../services';
import type { SettingItem } from '../types';
import { useLocale } from '../context/LocaleContext';
import './Settings.css';

// 定义每个设置项的专用配置
const SETTING_CONFIGS: Record<string, {
  type: 'boolean' | 'number' | 'select' | 'string';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  displayAs?: 'slider' | 'select';
  displayOptions?: { label: string; value: string }[];
}> = {
  // ========== 外观设置 (8项) ==========
  'appearance-theme': {
    type: 'select',
    options: ['light', 'dark', 'system'],
    displayOptions: [
      { label: '浅色', value: 'light' },
      { label: '深色', value: 'dark' },
      { label: '跟随系统', value: 'system' },
    ],
  },
  'appearance-fontSize': {
    type: 'number',
    min: 8,
    max: 32,
    step: 1,
    displayAs: 'select',
    options: ['8', '10', '12', '14', '16', '18', '20', '24', '28', '32'],
  },
  'appearance-fontFamily': {
    type: 'select',
    options: ['Consolas', 'Monaco', 'Courier New', 'Source Code Pro', 'Fira Code'],
    displayOptions: [
      { label: 'Consolas', value: 'Consolas' },
      { label: 'Monaco', value: 'Monaco' },
      { label: 'Courier New', value: 'Courier New' },
      { label: 'Source Code Pro', value: 'Source Code Pro' },
      { label: 'Fira Code', value: 'Fira Code' },
    ],
  },
  'appearance-lineHeight': {
    type: 'number',
    min: 1.0,
    max: 3.0,
    step: 0.1,
    displayAs: 'select',
    options: ['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '2.2', '2.5', '3.0'],
  },
  'appearance-tabSize': {
    type: 'number',
    min: 1,
    max: 8,
    step: 1,
    displayAs: 'select',
    options: ['1', '2', '3', '4', '6', '8'],
  },
  'appearance-wordWrap': { type: 'boolean' },
  'appearance-minimap': { type: 'boolean' },
  'appearance-smoothScrolling': { type: 'boolean' },

  // ========== 编辑器设置 (12项) ==========
  'editor-autoIndent': { type: 'boolean' },
  'editor-highlightLine': { type: 'boolean' },
  'editor-bracketMatching': { type: 'boolean' },
  'editor-autoSave': { type: 'boolean' },
  'editor-saveInterval': {
    type: 'number',
    min: 5,
    max: 300,
    step: 5,
    displayAs: 'select',
    options: ['5', '10', '15', '30', '60', '120', '300'],
  },
  'editor-tabSize': {
    type: 'number',
    min: 1,
    max: 8,
    step: 1,
    displayAs: 'select',
    options: ['1', '2', '3', '4', '6', '8'],
  },
  'editor-insertSpaces': { type: 'boolean' },
  'editor-trimTrailingWhitespace': { type: 'boolean' },
  'editor-formatOnPaste': { type: 'boolean' },
  'editor-bracketPairColorization': { type: 'boolean' },
  'editor-cursorBlinking': {
    type: 'select',
    options: ['blink', 'smooth', 'phase', 'expand', 'solid'],
    displayOptions: [
      { label: '闪烁', value: 'blink' },
      { label: '平滑', value: 'smooth' },
      { label: '渐变', value: 'phase' },
      { label: '扩展', value: 'expand' },
      { label: '常亮', value: 'solid' },
    ],
  },
  'editor-cursorStyle': {
    type: 'select',
    options: ['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'],
    displayOptions: [
      { label: '线条', value: 'line' },
      { label: '方块', value: 'block' },
      { label: '下划线', value: 'underline' },
      { label: '细线', value: 'line-thin' },
      { label: '方块轮廓', value: 'block-outline' },
      { label: '细线下划线', value: 'underline-thin' },
    ],
  },
  'editor-renderWhitespace': {
    type: 'select',
    options: ['none', 'boundary', 'all'],
    displayOptions: [
      { label: '不显示', value: 'none' },
      { label: '边界', value: 'boundary' },
      { label: '全部', value: 'all' },
    ],
  },

  // ========== SQL查询设置 (10项) ==========
  'sql-autoComplete': { type: 'boolean' },
  'sql-formatOnSave': { type: 'boolean' },
  'sql-resultLimit': {
    type: 'number',
    min: 100,
    max: 10000,
    step: 100,
    displayAs: 'select',
    options: ['100', '500', '1000', '2000', '5000', '10000'],
  },
  'sql-showExecutionTime': { type: 'boolean' },
  'sql-uppercaseKeywords': { type: 'boolean' },
  'sql-autoExecute': { type: 'boolean' },
  'sql-maxHistorySize': {
    type: 'number',
    min: 100,
    max: 5000,
    step: 100,
    displayAs: 'select',
    options: ['100', '200', '300', '500', '1000', '2000', '5000'],
  },
  'sql-showLineNumbers': { type: 'boolean' },
  'sql-enableAutoRecover': { type: 'boolean' },
  'sql-defaultSelectLimit': {
    type: 'number',
    min: 10,
    max: 10000,
    step: 10,
    displayAs: 'select',
    options: ['10', '50', '100', '200', '500', '1000'],
  },

  // ========== 数据导入设置 (6项) ==========
  'import-autoDetectEncoding': { type: 'boolean' },
  'import-defaultEncoding': {
    type: 'select',
    options: ['UTF-8', 'GBK', 'GB2312', 'UTF-16', 'ASCII'],
    displayOptions: [
      { label: 'UTF-8', value: 'UTF-8' },
      { label: 'GBK', value: 'GBK' },
      { label: 'GB2312', value: 'GB2312' },
      { label: 'UTF-16', value: 'UTF-16' },
      { label: 'ASCII', value: 'ASCII' },
    ],
  },
  'import-skipEmptyRows': { type: 'boolean' },
  'import-firstRowAsHeader': { type: 'boolean' },
  'import-importBatchSize': {
    type: 'number',
    min: 100,
    max: 10000,
    step: 100,
    displayAs: 'select',
    options: ['100', '500', '1000', '2000', '5000', '10000'],
  },
  'import-maxImportFileSize': {
    type: 'number',
    min: 10,
    max: 5000,
    step: 10,
    displayAs: 'select',
    options: ['10', '50', '100', '200', '500', '1000', '2000', '5000'],
  },

  // ========== 可视化设置 (8项) ==========
  'visualization-defaultChartType': {
    type: 'select',
    options: ['bar', 'line', 'pie', 'scatter', 'area', 'stackedBar', 'radar'],
    displayOptions: [
      { label: '柱状图', value: 'bar' },
      { label: '折线图', value: 'line' },
      { label: '饼图', value: 'pie' },
      { label: '散点图', value: 'scatter' },
      { label: '面积图', value: 'area' },
      { label: '堆叠柱状图', value: 'stackedBar' },
      { label: '雷达图', value: 'radar' },
    ],
  },
  'visualization-showGrid': { type: 'boolean' },
  'visualization-showLegend': { type: 'boolean' },
  'visualization-defaultColorScheme': {
    type: 'select',
    options: ['default', 'dark', 'light', 'colorful', 'pastel', 'vivid'],
    displayOptions: [
      { label: '默认配色', value: 'default' },
      { label: '深色主题', value: 'dark' },
      { label: '浅色主题', value: 'light' },
      { label: '多彩配色', value: 'colorful' },
      { label: '柔和配色', value: 'pastel' },
      { label: '鲜艳配色', value: 'vivid' },
    ],
  },
  'visualization-animation': { type: 'boolean' },
  'visualization-animationDuration': {
    type: 'number',
    min: 100,
    max: 5000,
    step: 100,
    displayAs: 'select',
    options: ['100', '300', '500', '800', '1000', '2000', '3000', '5000'],
  },
  'visualization-toolboxFeature': { type: 'boolean' },
  'visualization-dataZoom': { type: 'boolean' },

  // ========== 回收站设置 (4项) ==========
  'trash-autoCleanup': { type: 'boolean' },
  'trash-cleanupDays': {
    type: 'number',
    min: 7,
    max: 365,
    step: 7,
    displayAs: 'select',
    options: ['7', '14', '30', '60', '90', '180', '365'],
  },
  'trash-maxTrashSize': {
    type: 'number',
    min: 100,
    max: 10000,
    step: 100,
    displayAs: 'select',
    options: ['100', '500', '1024', '2048', '5120', '10000'],
  },
  'trash-confirmBeforeDelete': { type: 'boolean' },

  // ========== 性能设置 (3项) ==========
  'performance-large_table_threshold': {
    type: 'number',
    min: 1000,
    max: 10000000,
    step: 1000,
    displayAs: 'select',
    options: ['1000', '10000', '50000', '100000', '500000', '1000000', '5000000', '10000000'],
  },
  'performance-query_timeout': {
    type: 'number',
    min: 5,
    max: 600,
    step: 5,
    displayAs: 'select',
    options: ['5', '10', '30', '60', '120', '300', '600'],
  },
  'performance-result_page_size': {
    type: 'number',
    min: 100,
    max: 10000,
    step: 100,
    displayAs: 'select',
    options: ['100', '500', '1000', '2000', '5000', '10000'],
  },

  // ========== 数据库设置 (6项) ==========
  'database-autoConnect': { type: 'boolean' },
  'database-connectionTimeout': {
    type: 'number',
    min: 5,
    max: 300,
    step: 5,
    displayAs: 'select',
    options: ['5', '10', '15', '30', '60', '120', '300'],
  },
  'database-showSystemTables': { type: 'boolean' },
  'database-queryTimeout': {
    type: 'number',
    min: 10,
    max: 600,
    step: 10,
    displayAs: 'select',
    options: ['10', '30', '60', '120', '300', '600'],
  },
  'database-maxResultRows': {
    type: 'number',
    min: 100,
    max: 100000,
    step: 100,
    displayAs: 'select',
    options: ['100', '500', '1000', '5000', '10000', '50000', '100000'],
  },
  'database-enableExplainPlan': { type: 'boolean' },

  // ========== 缓存设置 (4项) ==========
  'cache-enableCache': { type: 'boolean' },
  'cache-cacheSize': {
    type: 'number',
    min: 10,
    max: 2000,
    step: 10,
    displayAs: 'select',
    options: ['10', '50', '100', '200', '500', '1000', '2000'],
  },
  'cache-cacheExpiry': {
    type: 'number',
    min: 1,
    max: 480,
    step: 5,
    displayAs: 'select',
    options: ['1', '5', '10', '30', '60', '120', '240', '480'],
  },
  'cache-cacheStrategy': {
    type: 'select',
    options: ['memory', 'disk', 'hybrid'],
    displayOptions: [
      { label: '内存', value: 'memory' },
      { label: '磁盘', value: 'disk' },
      { label: '混合', value: 'hybrid' },
    ],
  },

  // ========== 安全设置 (5项) ==========
  'security-enablePasswordProtect': { type: 'boolean' },
  'security-autoLock': { type: 'boolean' },
  'security-lockTimeout': {
    type: 'number',
    min: 1,
    max: 60,
    step: 1,
    displayAs: 'select',
    options: ['1', '2', '5', '10', '20', '30', '60'],
  },
  'security-sessionTimeout': {
    type: 'number',
    min: 10,
    max: 480,
    step: 10,
    displayAs: 'select',
    options: ['10', '30', '60', '120', '180', '240', '360', '480'],
  },
  'security-enableAuditLog': { type: 'boolean' },

  // ========== 高级设置 (8项) ==========
  'advanced-developerMode': { type: 'boolean' },
  'advanced-showDebugInfo': { type: 'boolean' },
  'advanced-logLevel': {
    type: 'select',
    options: ['debug', 'info', 'warn', 'error'],
    displayOptions: [
      { label: '调试', value: 'debug' },
      { label: '信息', value: 'info' },
      { label: '警告', value: 'warn' },
      { label: '错误', value: 'error' },
    ],
  },
  'advanced-maxConcurrentQueries': {
    type: 'number',
    min: 1,
    max: 20,
    step: 1,
    displayAs: 'select',
    options: ['1', '2', '3', '5', '10', '15', '20'],
  },
  'advanced-enableTelemetry': { type: 'boolean' },
  'advanced-checkForUpdates': { type: 'boolean' },
  'advanced-dataDir': { type: 'string' },
  'advanced-tempDir': { type: 'string' },

  // ========== 快捷键设置 (20项) ==========
  'shortcuts-newFile': { type: 'string' },
  'shortcuts-openFile': { type: 'string' },
  'shortcuts-saveFile': { type: 'string' },
  'shortcuts-saveAs': { type: 'string' },
  'shortcuts-executeQuery': { type: 'string' },
  'shortcuts-formatSql': { type: 'string' },
  'shortcuts-toggleComment': { type: 'string' },
  'shortcuts-find': { type: 'string' },
  'shortcuts-replace': { type: 'string' },
  'shortcuts-goToLine': { type: 'string' },
  'shortcuts-undo': { type: 'string' },
  'shortcuts-redo': { type: 'string' },
  'shortcuts-copy': { type: 'string' },
  'shortcuts-paste': { type: 'string' },
  'shortcuts-cut': { type: 'string' },
  'shortcuts-selectAll': { type: 'string' },
  'shortcuts-newProject': { type: 'string' },
  'shortcuts-importData': { type: 'string' },
  'shortcuts-exportData': { type: 'string' },
  'shortcuts-openSettings': { type: 'string' },

  // ========== 语言与区域设置 (6项) ==========
  'locale-language': {
    type: 'select',
    options: ['zh-CN', 'en-US'],
    displayOptions: [
      { label: '简体中文', value: 'zh-CN' },
      { label: 'English', value: 'en-US' },
    ],
  },
  'locale-dateFormat': {
    type: 'select',
    options: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'],
    displayOptions: [
      { label: '年-月-日', value: 'YYYY-MM-DD' },
      { label: '日/月/年', value: 'DD/MM/YYYY' },
      { label: '月/日/年', value: 'MM/DD/YYYY' },
    ],
  },
  'locale-timeFormat': {
    type: 'select',
    options: ['12h', '24h'],
    displayOptions: [
      { label: '12小时制', value: '12h' },
      { label: '24小时制', value: '24h' },
    ],
  },
  'locale-numberFormat': {
    type: 'select',
    options: ['1,000.00', '1.000,00', '1 000.00'],
    displayOptions: [
      { label: '1,000.00', value: '1,000.00' },
      { label: '1.000,00', value: '1.000,00' },
      { label: '1 000.00', value: '1 000.00' },
    ],
  },
  'locale-firstDayOfWeek': {
    type: 'select',
    options: ['sunday', 'monday'],
    displayOptions: [
      { label: '周日', value: 'sunday' },
      { label: '周一', value: 'monday' },
    ],
  },
  'locale-timezone': { type: 'string' },

  // ========== 自动化任务设置 (7项) ==========
  'automation-engineEnabled': { type: 'boolean' },
  'automation-defaultRetryOnFail': {
    type: 'number',
    min: 0,
    max: 10,
    step: 1,
    displayAs: 'select',
    options: ['0', '1', '2', '3', '5', '10'],
  },
  'automation-defaultTimeoutSecs': {
    type: 'number',
    min: 10,
    max: 3600,
    step: 10,
    displayAs: 'select',
    options: ['30', '60', '120', '300', '600', '1200', '3600'],
  },
  'automation-scheduleIntervalSecs': {
    type: 'number',
    min: 10,
    max: 3600,
    step: 10,
    displayAs: 'select',
    options: ['30', '60', '120', '300', '600', '1200', '3600'],
  },
  'automation-logRetentionDays': {
    type: 'number',
    min: 1,
    max: 365,
    step: 1,
    displayAs: 'select',
    options: ['7', '14', '30', '60', '90', '180', '365'],
  },
  'automation-notifyOnFailure': { type: 'boolean' },
  'automation-maxConcurrentTasks': {
    type: 'number',
    min: 1,
    max: 20,
    step: 1,
    displayAs: 'select',
    options: ['1', '2', '3', '5', '10', '15', '20'],
  },
};

const Settings: React.FC = () => {
  const { goToWorkspace, goToActivityLog } = useAppContext();
  const {
    categories,
    activeCategory,
    loading,
    error,
    loadSettings,
    updateSetting,
    resetSettings,
    setActiveCategory,
    clearError,
  } = useSettingsStore();
  const { t } = useLocale();
  
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  // 导出设置
  const handleExportSettings = async () => {
    const response = await tauriService.exportSettings();
    if (response.success && response.data) {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quickersql-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMessage(t('settings.exportSuccess'));
      setTimeout(() => setExportMessage(null), 3000);
    } else {
      setExportMessage(t('settings.exportFail') + ': ' + (response.error || ''));
      setTimeout(() => setExportMessage(null), 3000);
    }
  };

  // 导入设置
  const handleImportSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const response = await tauriService.importSettings(data);
      if (response.success) {
        await loadSettings();
        setImportMessage(t('settings.importSuccess'));
      } else {
        setImportMessage(t('settings.importFail') + ': ' + (response.error || ''));
      }
    } catch (err) {
      setImportMessage(t('settings.importFormatError'));
    }
    setTimeout(() => setImportMessage(null), 3000);
    e.target.value = '';
  };

  const renderSettingItem = (item: SettingItem) => {
    const handleChange = async (value: string) => {
      const key = `${item.category}-${item.key}`;
      setSavingKey(key);
      setSavedKey(null);
      await updateSetting(item.category, item.key, value);
      setSavingKey(null);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    };

    const configKey = `${item.category}-${item.key}`;
    const config = SETTING_CONFIGS[configKey] || { type: item.value_type };

    const renderValueControl = () => {
      switch (config.type) {
        case 'boolean':
          return (
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={item.value === 'true'}
                onChange={(e) => handleChange(e.target.checked.toString())}
              />
              <span className="slider"></span>
            </label>
          );

        case 'number':
          if (config.displayAs === 'select' && config.options) {
            return (
              <select
                value={item.value}
                onChange={(e) => handleChange(e.target.value)}
                className="setting-select"
              >
                {config.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`settings.${item.category}.${item.key}.${opt}`) || opt}
                  </option>
                ))}
              </select>
            );
          } else {
            return (
              <input
                type="number"
                value={item.value}
                onChange={(e) => handleChange(e.target.value)}
                min={config.min}
                max={config.max}
                step={config.step}
                className="setting-input"
              />
            );
          }

        case 'select':
          const options = config.displayOptions || (config.options || []).map(opt => ({ label: opt, value: opt }));
          return (
            <select
              value={item.value}
              onChange={(e) => handleChange(e.target.value)}
              className="setting-select"
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`settings.${item.category}.${item.key}.${opt.value}`) || opt.label || opt.value}
                </option>
              ))}
            </select>
          );



        default:
          // string
          return (
            <input
              type="text"
              value={item.value}
              onChange={(e) => handleChange(e.target.value)}
              className="setting-input"
            />
          );
      }
    };

    const key = `${item.category}-${item.key}`;
    const isSaving = savingKey === key;
    const isSaved = savedKey === key;

    return (
      <div key={item.id} className="setting-item">
        <div className="setting-label">
          <span className="setting-name">{t(`settings.${item.category}.${item.key}`) || item.description || item.key}</span>
        </div>
        <div className="setting-control">
          {renderValueControl()}
          {isSaving && <span className="setting-status saving">{t('common.save')}...</span>}
          {isSaved && <span className="setting-status saved"><CheckIcon size={14} /> ✓</span>}
        </div>
      </div>
    );
  };

  const activeCategoryData = categories.find((c) => c.id === activeCategory);

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <div className="settings-header">
          <button className="back-button" onClick={goToWorkspace} title="Back">
            <ChevronLeftIcon size={16} />
            <span>←</span>
          </button>
          <h2>⚙️ {t('settings.title')}</h2>
        </div>
        <ul className="settings-nav">
          {categories.map((category) => (
            <li
              key={category.id}
              className={activeCategory === category.id ? 'active' : ''}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.icon} {t(`settings.category.${category.id}`) || category.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="settings-content">
        {error && (
          <div className="settings-error">
          <p>{error}</p>
          <button onClick={clearError}>{t('common.cancel')}</button>
        </div>
        )}

        {loading ? (
          <div className="settings-loading">
            <p>{t('common.loading')}</p>
          </div>
        ) : (
          <>
            <div className="settings-category-title">
              {activeCategoryData?.icon} {t(`settings.category.${activeCategory}`) || activeCategoryData?.name}
            </div>
            <div className="auto-save-hint">
              <span className="hint-icon">💡</span>
              <span>{t('settings.autoSaveHint')}</span>
            </div>
            {(exportMessage || importMessage) && (
              <div className={`settings-toast ${exportMessage?.includes('success') || importMessage?.includes('success') ? 'success' : 'error'}`}>
                {exportMessage || importMessage}
              </div>
            )}
            <div className="settings-category-content">
              {activeCategoryData?.items.length === 0 ? (
                <div className="placeholder-card">
                  <p>{t('settings.noCategory')}</p>
                </div>
              ) : (
                <div className="settings-items">
                  {activeCategoryData?.items.map(renderSettingItem)}
                </div>
              )}
              
              {activeCategory === 'security' && (
                <div className="settings-items" style={{ marginTop: 12, padding: 16, border: '1px dashed var(--border-primary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, fontWeight: 500 }}>
                    🕓 活动记录管理
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    查看用户在软件上执行的所有操作记录
                  </div>
                  <button
                    className="export-button"
                    onClick={goToActivityLog}
                  >
                    📋 查看活动记录
                  </button>
                </div>
              )}
              
              <div className="settings-actions">
                <div className="settings-actions-left">
                  <button
                    className="export-button"
                    onClick={handleExportSettings}
                    title={t('settings.export')}
                  >
                    📤 {t('settings.export')}
                  </button>
                  <button
                    className="import-button"
                    onClick={() => document.getElementById('settings-import-input')?.click()}
                    title={t('settings.importSettings')}
                  >
                    📥 {t('settings.importSettings')}
                  </button>
                  <input
                    id="settings-import-input"
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportSettings}
                  />
                </div>
                <div className="settings-actions-right">
                  <button
                    className="reset-button"
                    onClick={() => resetSettings(activeCategory)}
                  >
                    {t('settings.resetCategory')}
                  </button>
                  <button
                    className="reset-all-button"
                    onClick={() => resetSettings()}
                  >
                    {t('settings.resetAll')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;
