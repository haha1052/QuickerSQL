import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../AppWrapper';
import { CheckIcon } from './Icons';
import { QueryCacheStatsPanel } from '../settings';
import { useSettingsStore } from '../../store';
import { tauriService, restartApp } from '../../services';
import type { SettingItem, SettingMeta } from '../../types';
import { useLocale } from '../../context/LocaleContext';
import { parseShortcut } from '../../utils/shortcutManager';
import '../../pages/Settings.css';

const QUERY_CACHE_CATEGORY_ID = 'query-cache';

const SettingsModalContent: React.FC = () => {
  const { goToActivityLog, goToWelcome, goToGuide } = useAppContext();
  const {
    showSettingsModal,
    closeSettingsModal,
    categories,
    settingsMeta,
    settingsMetaLoaded,
    activeCategory,
    loading,
    error,
    loadSettings,
    loadSettingsMeta,
    updateSetting,
    resetSettings,
    setActiveCategory,
    clearError,
  } = useSettingsStore();
  const { t } = useLocale();
  
  const tOr = (key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [activeSliderKey, setActiveSliderKey] = useState<string | null>(null);
  const [editingShortcutKey, setEditingShortcutKey] = useState<string | null>(null);
  const [shortcutInputValue, setShortcutInputValue] = useState<string>('');
  const [draftValues, setDraftValues] = useState<Map<string, string>>(new Map());

  const metaMap = useMemo(() => {
    const map = new Map<string, SettingMeta>();
    settingsMeta.forEach(cat => {
      cat.items.forEach(item => {
        map.set(`${item.category}-${item.key}`, item);
      });
    });
    return map;
  }, [settingsMeta]);

  const getMeta = (category: string, key: string): SettingMeta | undefined => {
    return metaMap.get(`${category}-${key}`);
  };

  const parseOptions = (optionsStr?: string | null): string[] => {
    if (!optionsStr) return [];
    try {
      const parsed = JSON.parse(optionsStr);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  };

  const debouncedSave = useMemo(() => {
    const timers = new Map<string, number>();
    
    return (category: string, key: string, value: string) => {
      const mapKey = `${category}-${key}`;
      
      if (timers.has(mapKey)) {
        clearTimeout(timers.get(mapKey)!);
      }
      
      const timer = window.setTimeout(async () => {
        setSavingKey(mapKey);
        setSavedKey(null);
        await updateSetting(category, key, value);
        setSavingKey(null);
        setSavedKey(mapKey);
        window.setTimeout(() => setSavedKey(null), 2000);
        
        setDraftValues(prev => {
          const next = new Map(prev);
          next.delete(mapKey);
          return next;
        });
        
        timers.delete(mapKey);
      }, 300);
      
      timers.set(mapKey, timer);
    };
  }, [updateSetting]);

  // ESC 键关闭模态窗口
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSettingsModal) {
        closeSettingsModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showSettingsModal, closeSettingsModal]);

  // 加载设置和元数据
  useEffect(() => {
    if (showSettingsModal) {
      loadSettings();
      if (!settingsMetaLoaded) {
        loadSettingsMeta();
      }
    }
  }, [showSettingsModal, settingsMetaLoaded]);

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
    const meta = getMeta(item.category, item.key);

    if (!meta) {
      return null;
    }

    const isImplemented = meta.is_implemented;

    const handleChange = (value: string) => {
      if (!isImplemented) return;
      const key = `${item.category}-${item.key}`;

      // 对数值类型执行 clamp 校验
      let finalValue = value;
      if (item.value_type === 'number') {
        const numMeta = getMeta(item.category, item.key);
        if (numMeta?.min_value !== null && numMeta?.min_value !== undefined &&
            numMeta?.max_value !== null && numMeta?.max_value !== undefined) {
          const numVal = parseFloat(value);
          if (!isNaN(numVal)) {
            const clamped = Math.max(numMeta.min_value, Math.min(numMeta.max_value, numVal));
            finalValue = String(clamped);
          }
        }
      }

      setDraftValues(prev => {
        const next = new Map(prev);
        next.set(key, finalValue);
        return next;
      });

      debouncedSave(item.category, item.key, finalValue);
    };

    const itemKey = `${item.category}-${item.key}`;
    const isShortcutEditing = editingShortcutKey === itemKey;

    const startEditShortcut = () => {
      setShortcutInputValue(item.value);
      setEditingShortcutKey(itemKey);
    };

    const cancelEditShortcut = () => {
      setEditingShortcutKey(null);
      setShortcutInputValue('');
    };

    const saveShortcut = async () => {
      const keyCode = parseShortcut(shortcutInputValue);
      if (keyCode === 0) return;

      setSavingKey(itemKey);
      setSavedKey(null);
      await updateSetting(item.category, item.key, shortcutInputValue);
      setSavingKey(null);
      setSavedKey(itemKey);
      setEditingShortcutKey(null);
      setShortcutInputValue('');
      setTimeout(() => setSavedKey(null), 2000);
    };

    const resetToDefault = async () => {
      const defaultValue = meta.default_value;
      setSavingKey(itemKey);
      setSavedKey(null);
      await updateSetting(item.category, item.key, defaultValue);
      setSavingKey(null);
      setSavedKey(itemKey);
      setEditingShortcutKey(null);
      setShortcutInputValue('');
      setTimeout(() => setSavedKey(null), 2000);
    };

    const isShortcutValid = (): boolean => {
      return parseShortcut(shortcutInputValue) !== 0;
    };

    const findShortcutConflicts = (): Array<{ key: string; name: string }> => {
      if (!activeCategoryData || item.category !== 'shortcuts') return [];

      const inputKeyCode = parseShortcut(shortcutInputValue);
      if (inputKeyCode === 0) return [];

      const conflicts: Array<{ key: string; name: string }> = [];

      for (const otherItem of activeCategoryData.items) {
        const otherKey = `${otherItem.category}-${otherItem.key}`;
        if (otherKey === itemKey) continue;

        const otherKeyCode = parseShortcut(otherItem.value);
        if (otherKeyCode !== 0 && otherKeyCode === inputKeyCode) {
          const otherMeta = getMeta(otherItem.category, otherItem.key);
          conflicts.push({
            key: otherItem.key,
            name: otherMeta?.description || otherItem.key,
          });
        }
      }

      return conflicts;
    };

    const renderShortcutEditor = () => {
      if (!isShortcutEditing) {
        return (
          <div className="shortcut-display" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="shortcut-value"
              style={{
                padding: '6px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 13,
                color: 'var(--text-primary)',
                minWidth: 120,
                textAlign: 'center',
              }}
            >
              {item.value || t('settings.notSet')}
            </span>
            <button
              type="button"
              className="edit-shortcut-btn"
              onClick={startEditShortcut}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              {t('common.edit')}
            </button>
          </div>
        );
      }

      const isValid = isShortcutValid();
      const conflicts = findShortcutConflicts();

      return (
        <div className="shortcut-editor" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={shortcutInputValue}
              onChange={(e) => setShortcutInputValue(e.target.value)}
              placeholder={t('settings.shortcutHint')}
              className="setting-input"
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              type="button"
              className="reset-default-btn"
              onClick={resetToDefault}
              title={t('settings.restoreDefault')}
              style={{
                padding: '6px 10px',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {t('settings.restoreDefault')}
            </button>
          </div>

          <div className="shortcut-validation" style={{ fontSize: 12, minHeight: 18 }}>
            {!isValid && (
              <span style={{ color: 'var(--status-error, #ef4444)' }}>{t('settings.invalidShortcut')}</span>
            )}
            {isValid && conflicts.length === 0 && (
              <span style={{ color: 'var(--status-success, #22c55e)' }}>{t('settings.validShortcut')}</span>
            )}
            {isValid && conflicts.length > 0 && (
              <span style={{ color: 'var(--status-warning, #f59e0b)' }}>
                {t('settings.shortcutConflict', { name: conflicts.map(c => c.name).join(', ') })}
              </span>
            )}
          </div>

          <div className="shortcut-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="cancel-btn"
              onClick={cancelEditShortcut}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="save-btn"
              onClick={saveShortcut}
              disabled={!isValid}
              style={{
                padding: '6px 16px',
                background: isValid ? 'var(--accent-primary)' : 'var(--bg-disabled)',
                border: 'none',
                borderRadius: 6,
                cursor: isValid ? 'pointer' : 'not-allowed',
                fontSize: 13,
                color: isValid ? 'var(--text-on-accent)' : 'var(--text-disabled)',
              }}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      );
    };

    const options = parseOptions(meta.options);
    const hasRange = meta.min_value !== null && meta.min_value !== undefined &&
                     meta.max_value !== null && meta.max_value !== undefined;

    const renderValueControl = () => {
      if (item.category === 'shortcuts') {
        return renderShortcutEditor();
      }

      switch (meta.value_type) {
        case 'boolean':
          return (
            <select
              value={item.value}
              onChange={(e) => handleChange(e.target.value)}
              className="setting-select boolean-select"
            >
              <option value="true">
                {tOr(`settings.${item.category}.${item.key}.true`, t('settings.booleanOn'))}
              </option>
              <option value="false">
                {tOr(`settings.${item.category}.${item.key}.false`, t('settings.booleanOff'))}
              </option>
            </select>
          );

        case 'number':
          if (options.length > 0) {
            return (
              <select
                value={item.value}
                onChange={(e) => handleChange(e.target.value)}
                className="setting-select"
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {tOr(`settings.${item.category}.${item.key}.${opt}`, opt)}
                  </option>
                ))}
              </select>
            );
          } else if (hasRange) {
            const min = meta.min_value as number;
            const max = meta.max_value as number;
            const step = meta.step ?? 1;
            const currentVal = parseFloat(item.value) || min;
            const itemKey = `${item.category}-${item.key}`;
            const isSliderActive = activeSliderKey === itemKey;
            
            return (
              <div className="setting-slider-wrapper">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={currentVal}
                  onChange={(e) => handleChange(e.target.value)}
                  className={`setting-slider ${isSliderActive ? 'active' : ''}`}
                />
                <span
                  className="setting-slider-value"
                  onClick={() => setActiveSliderKey(isSliderActive ? null : itemKey)}
                >
                  {Math.max(min, Math.min(max, parseFloat(item.value) || min))}
                </span>
              </div>
            );
          } else {
            const itemKey = `${item.category}-${item.key}`;
            const min = meta?.min_value;
            const max = meta?.max_value;
            const step = meta?.step ?? 1;
            const hasMinMax = min !== null && min !== undefined && max !== null && max !== undefined;
            return (
              <div className="setting-number-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={draftValues.get(itemKey) ?? item.value}
                  onChange={(e) => handleChange(e.target.value)}
                  className="setting-input"
                  min={min ?? undefined}
                  max={max ?? undefined}
                  step={step}
                />
                {hasMinMax && (
                  <span className="setting-range-hint" style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {min} ~ {max}
                  </span>
                )}
              </div>
            );
          }

        case 'select':
        case 'multiselect':
          const selectOptions = options.map(opt => ({ label: opt, value: opt }));
          return (
            <select
              value={item.value}
              onChange={(e) => handleChange(e.target.value)}
              className="setting-select"
            >
              {selectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {tOr(`settings.${item.category}.${item.key}.${opt.value}`, opt.label || opt.value)}
                </option>
              ))}
            </select>
          );

        default:
          const itemKey = `${item.category}-${item.key}`;
          return (
            <input
              type="text"
              value={draftValues.get(itemKey) ?? item.value}
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
      <div
        key={item.id}
        className="setting-item"
        style={{
          opacity: isImplemented ? 1 : 0.5,
          pointerEvents: isImplemented ? 'auto' : 'none',
        }}
      >
        <div className="setting-label">
          <span className="setting-name">
            {tOr(`settings.${item.category}.${item.key}`, meta.description || item.key)}
            {!isImplemented && (
              <span style={{
                marginLeft: 8,
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'var(--bg-secondary)',
                color: 'var(--text-tertiary)',
              }}>
                {t('settings.inDevelopment')}
              </span>
            )}
          </span>
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

  const allItemsInCategory = useMemo(() => {
    if (!activeCategoryData) return [];
    return activeCategoryData.items;
  }, [activeCategoryData]);

  return (
    <div className="settings-modal-overlay" onClick={closeSettingsModal} role="presentation">
      <div
        className="settings-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settings-modal-header">
          <h2 id="settings-modal-title">⚙️ {t('settings.title')}</h2>
          <button className="settings-modal-close" onClick={closeSettingsModal} title={t('common.cancel')} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className="settings-modal-body">
          <div className="settings-sidebar">
            <ul className="settings-nav" role="tablist" aria-label={t('settings.categories')}>
              {categories.map((category) => {
                return (
                  <li
                    key={category.id}
                    className={activeCategory === category.id ? 'active' : ''}
                    onClick={() => setActiveCategory(category.id)}
                    role="tab"
                    aria-selected={activeCategory === category.id}
                    tabIndex={activeCategory === category.id ? 0 : -1}
                  >
                    {category.icon} {t(`settings.category.${category.id}`) || category.name}
                  </li>
                );
              })}
              <li
                className={activeCategory === QUERY_CACHE_CATEGORY_ID ? 'active' : ''}
                onClick={() => setActiveCategory(QUERY_CACHE_CATEGORY_ID)}
                role="tab"
                aria-selected={activeCategory === QUERY_CACHE_CATEGORY_ID}
                tabIndex={activeCategory === QUERY_CACHE_CATEGORY_ID ? 0 : -1}
              >
                🔍 {t(`settings.category.${QUERY_CACHE_CATEGORY_ID}`)}
              </li>
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
            ) : activeCategory === QUERY_CACHE_CATEGORY_ID ? (
              <>
                <div className="settings-category-title">
                  🔍 {t(`settings.category.${QUERY_CACHE_CATEGORY_ID}`)}
                </div>
                <div className="settings-category-content">
                  <QueryCacheStatsPanel />
                </div>
              </>
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
                  ) : allItemsInCategory.length === 0 ? (
                    <div className="placeholder-card">
                      <p>{t('settings.noItemsInCategory')}</p>
                    </div>
                  ) : (
                    <div className="settings-items">
                      {allItemsInCategory.map(renderSettingItem)}
                    </div>
                  )}
                  
                  {activeCategory === 'security' && (
                    <>
                      <div className="settings-items" style={{ marginTop: 12, padding: 16, border: '1px dashed var(--border-primary)', borderRadius: 8 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, fontWeight: 500 }}>
                          🕓 {t('settings.activityLog')}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                          {t('settings.activityLogDesc')}
                        </div>
                        <button
                          className="export-button"
                          onClick={goToActivityLog}
                        >
                          📋 {t('settings.viewActivityLog')}
                        </button>
                      </div>
                      <div className="settings-items" style={{ marginTop: 12, padding: 16, border: '1px dashed var(--border-primary)', borderRadius: 8 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, fontWeight: 500 }}>
                          🦆 {t('settings.firstLaunch')}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                          {t('settings.firstLaunchDesc')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button
                            className="reset-all-button"
                            onClick={() => {
                              goToWelcome();
                              closeSettingsModal();
                            }}
                          >
                            {t('settings.viewWelcomePage')}
                          </button>
                          <button
                            className="reset-all-button"
                            onClick={() => {
                              goToGuide();
                              closeSettingsModal();
                            }}
                          >
                            {t('settings.viewGuide')}
                          </button>
                          <button
                            className="reset-all-button"
                            onClick={async () => {
                              if (confirm(t('settings.resetFirstLaunchConfirm'))) {
                                await tauriService.updateAppState('welcome', 'has_launched', 'false', 'first_launch');
                                alert(t('settings.resetFirstLaunchSuccess'));
                              }
                            }}
                          >
                            🔄 {t('settings.resetFirstLaunch')}
                          </button>
                        </div>
                      </div>
                      <div className="settings-items" style={{ marginTop: 12, padding: 16, border: '1px dashed var(--border-primary)', borderRadius: 8 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, fontWeight: 500 }}>
                          🔄 {t('settings.restartApp')}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                          {t('settings.restartAppDesc')}
                        </div>
                        <button
                          className="btn-restart"
                          onClick={async () => {
                            if (confirm(t('settings.restartAppConfirm'))) {
                            await restartApp();
                          }
                          }}
                        >
                          🔄 {t('settings.restartApp')}
                        </button>
                      </div>
                    </>
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
      </div>
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const showSettingsModal = useSettingsStore((s) => s.showSettingsModal);
  if (!showSettingsModal) return null;
  return <SettingsModalContent />;
};
