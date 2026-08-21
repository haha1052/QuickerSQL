import React from 'react';
import { CheckIcon } from '../common/Icons';
import { useLocale } from '../../context/LocaleContext';
import { parseShortcut } from '../../utils/shortcutManager';
import type { SettingItem, SettingMeta } from '../../types';

interface SettingItemRowProps {
  item: SettingItem;
  meta: SettingMeta | undefined;
  draftValue: string | undefined;
  savingKey: string | null;
  savedKey: string | null;
  activeSliderKey: string | null;
  editingShortcutKey: string | null;
  shortcutInputValue: string;
  allCategoryItems: SettingItem[]; // for conflict detection
  onDraftChange: (key: string, value: string) => void;
  onDebouncedSave: (category: string, key: string, value: string) => void;
  onUpdateSetting: (category: string, key: string, value: string) => Promise<void>;
  onSetSavingKey: (key: string | null) => void;
  onSetSavedKey: (key: string | null) => void;
  onSetEditingShortcutKey: (key: string | null) => void;
  onSetShortcutInputValue: (value: string) => void;
  onSetActiveSliderKey: (key: string | null) => void;
}

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

const SettingItemRowComponent: React.FC<SettingItemRowProps> = ({
  item,
  meta,
  draftValue,
  savingKey,
  savedKey,
  activeSliderKey,
  editingShortcutKey,
  shortcutInputValue,
  allCategoryItems,
  onDraftChange,
  onDebouncedSave,
  onUpdateSetting,
  onSetSavingKey,
  onSetSavedKey,
  onSetEditingShortcutKey,
  onSetShortcutInputValue,
  onSetActiveSliderKey,
}) => {
  const { t } = useLocale();

  const tOr = (key: string, fallback: string): string => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  if (!meta) {
    return null;
  }

  const isImplemented = meta.is_implemented;
  const itemKey = `${item.category}-${item.key}`;

  const handleChange = (value: string) => {
    if (!isImplemented) return;
    const key = `${item.category}-${item.key}`;

    // 对数值类型执行 clamp 校验
    let finalValue = value;
    if (item.value_type === 'number') {
      if (meta?.min_value !== null && meta?.min_value !== undefined &&
          meta?.max_value !== null && meta?.max_value !== undefined) {
        const numVal = parseFloat(value);
        if (!isNaN(numVal)) {
          const clamped = Math.max(meta.min_value, Math.min(meta.max_value, numVal));
          finalValue = String(clamped);
        }
      }
    }

    onDraftChange(key, finalValue);
    onDebouncedSave(item.category, item.key, finalValue);
  };

  const isShortcutEditing = editingShortcutKey === itemKey;

  const startEditShortcut = () => {
    onSetShortcutInputValue(item.value);
    onSetEditingShortcutKey(itemKey);
  };

  const cancelEditShortcut = () => {
    onSetEditingShortcutKey(null);
    onSetShortcutInputValue('');
  };

  const saveShortcut = async () => {
    const keyCode = parseShortcut(shortcutInputValue);
    if (keyCode === 0) return;

    onSetSavingKey(itemKey);
    onSetSavedKey(null);
    await onUpdateSetting(item.category, item.key, shortcutInputValue);
    onSetSavingKey(null);
    onSetSavedKey(itemKey);
    onSetEditingShortcutKey(null);
    onSetShortcutInputValue('');
    setTimeout(() => onSetSavedKey(null), 2000);
  };

  const resetToDefault = async () => {
    const defaultValue = meta.default_value;
    onSetSavingKey(itemKey);
    onSetSavedKey(null);
    await onUpdateSetting(item.category, item.key, defaultValue);
    onSetSavingKey(null);
    onSetSavedKey(itemKey);
    onSetEditingShortcutKey(null);
    onSetShortcutInputValue('');
    setTimeout(() => onSetSavedKey(null), 2000);
  };

  const isShortcutValid = (): boolean => {
    return parseShortcut(shortcutInputValue) !== 0;
  };

  const findShortcutConflicts = (): Array<{ key: string; name: string }> => {
    if (item.category !== 'shortcuts') return [];

    const inputKeyCode = parseShortcut(shortcutInputValue);
    if (inputKeyCode === 0) return [];

    const conflicts: Array<{ key: string; name: string }> = [];

    for (const otherItem of allCategoryItems) {
      const otherKey = `${otherItem.category}-${otherItem.key}`;
      if (otherKey === itemKey) continue;

      const otherKeyCode = parseShortcut(otherItem.value);
      if (otherKeyCode !== 0 && otherKeyCode === inputKeyCode) {
        conflicts.push({
          key: otherItem.key,
          name: otherItem.description || otherItem.key,
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
            onChange={(e) => onSetShortcutInputValue(e.target.value)}
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
                onClick={() => onSetActiveSliderKey(isSliderActive ? null : itemKey)}
              >
                {Math.max(min, Math.min(max, parseFloat(item.value) || min))}
              </span>
            </div>
          );
        } else {
          const min = meta?.min_value;
          const max = meta?.max_value;
          const step = meta?.step ?? 1;
          const hasMinMax = min !== null && min !== undefined && max !== null && max !== undefined;
          return (
            <div className="setting-number-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                value={draftValue ?? item.value}
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
        return (
          <input
            type="text"
            value={draftValue ?? item.value}
            onChange={(e) => handleChange(e.target.value)}
            className="setting-input"
          />
        );
    }
  };

  const isSaving = savingKey === itemKey;
  const isSaved = savedKey === itemKey;

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

export const SettingItemRow = React.memo(SettingItemRowComponent);
SettingItemRow.displayName = 'SettingItemRow';
