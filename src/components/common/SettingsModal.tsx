import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../AppWrapper';
import { QueryCacheStatsPanel } from '../settings';
import { SettingItemRow } from '../settings/SettingItemRow';
import { ConfirmModal } from '../settings/ConfirmModal';
import { useSettingsStore, useToastStore } from '../../store';
import { tauriService, restartApp } from '../../services';
import type { SettingMeta } from '../../types';
import { useLocale } from '../../context/LocaleContext';
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

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [activeSliderKey, setActiveSliderKey] = useState<string | null>(null);
  const [editingShortcutKey, setEditingShortcutKey] = useState<string | null>(null);
  const [shortcutInputValue, setShortcutInputValue] = useState<string>('');
  const [draftValues, setDraftValues] = useState<Map<string, string>>(new Map());
  // P2-13: 替换原生 confirm/alert，使用项目内弹窗与 toast
  // confirmType: 'resetFirstLaunch' | 'restartApp' | null
  const [confirmType, setConfirmType] = useState<'resetFirstLaunch' | 'restartApp' | null>(null);
  const { addToast } = useToastStore();

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

  const activeCategoryData = categories.find((c) => c.id === activeCategory);

  const allItemsInCategory = useMemo(() => {
    if (!activeCategoryData) return [];
    return activeCategoryData.items;
  }, [activeCategoryData]);

  const handleDraftChange = (key: string, value: string) => {
    setDraftValues(prev => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  };

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
                      {allItemsInCategory.map((item) => (
                        <SettingItemRow
                          key={item.id}
                          item={item}
                          meta={getMeta(item.category, item.key)}
                          draftValue={draftValues.get(`${item.category}-${item.key}`)}
                          savingKey={savingKey}
                          savedKey={savedKey}
                          activeSliderKey={activeSliderKey}
                          editingShortcutKey={editingShortcutKey}
                          shortcutInputValue={shortcutInputValue}
                          allCategoryItems={allItemsInCategory}
                          onDraftChange={handleDraftChange}
                          onDebouncedSave={debouncedSave}
                          onUpdateSetting={updateSetting}
                          onSetSavingKey={setSavingKey}
                          onSetSavedKey={setSavedKey}
                          onSetEditingShortcutKey={setEditingShortcutKey}
                          onSetShortcutInputValue={setShortcutInputValue}
                          onSetActiveSliderKey={setActiveSliderKey}
                        />
                      ))}
                    </div>
                  )}

                  {activeCategory === 'security' && (
                    <>
                      <div className="settings-info-card">
                        <div className="settings-info-card-title">
                          🕓 {t('settings.activityLog')}
                        </div>
                        <div className="settings-info-card-desc">
                          {t('settings.activityLogDesc')}
                        </div>
                        <button
                          className="export-button"
                          onClick={goToActivityLog}
                        >
                          📋 {t('settings.viewActivityLog')}
                        </button>
                      </div>
                      <div className="settings-info-card">
                        <div className="settings-info-card-title">
                          🦆 {t('settings.firstLaunch')}
                        </div>
                        <div className="settings-info-card-desc">
                          {t('settings.firstLaunchDesc')}
                        </div>
                        <div className="settings-info-card-actions">
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
                            onClick={() => {
                              // P2-13: 替换原生 confirm 为项目内确认弹窗
                              setConfirmType('resetFirstLaunch');
                            }}
                          >
                            🔄 {t('settings.resetFirstLaunch')}
                          </button>
                        </div>
                      </div>
                      <div className="settings-info-card">
                        <div className="settings-info-card-title">
                          🔄 {t('settings.restartApp')}
                        </div>
                        <div className="settings-info-card-desc">
                          {t('settings.restartAppDesc')}
                        </div>
                        <button
                          className="btn-restart"
                          onClick={() => {
                            // P2-13: 替换原生 confirm 为项目内确认弹窗
                            setConfirmType('restartApp');
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

      {/* P2-13: 设置确认弹窗（替代原生 confirm，覆盖 resetFirstLaunch 与 restartApp 两处） */}
      <ConfirmModal
        confirmType={confirmType}
        onClose={() => setConfirmType(null)}
        onConfirm={async () => {
          const action = confirmType;
          setConfirmType(null);
          try {
            if (action === 'resetFirstLaunch') {
              await tauriService.updateAppState('welcome', 'has_launched', 'false', 'first_launch');
              // P2-13: 替换原生 alert 为项目 toast（成功消息）
              addToast(t('settings.resetFirstLaunchSuccess'), 'success');
            } else if (action === 'restartApp') {
              await restartApp();
            }
          } catch (e) {
            console.error('[SettingsModal] 确认操作失败:', e);
            addToast(`${(e as Error).message}`, 'error');
          }
        }}
      />
    </div>
  );
};

const SettingsModalComponent: React.FC = () => {
  const showSettingsModal = useSettingsStore((s) => s.showSettingsModal);
  if (!showSettingsModal) return null;
  return <SettingsModalContent />;
};

/** P2-2: 用 React.memo 包装以避免父组件重渲染时的无谓更新 */
export const SettingsModal = React.memo(SettingsModalComponent);
SettingsModal.displayName = 'SettingsModal';
