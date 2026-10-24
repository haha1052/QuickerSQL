import type React from 'react';
import { Colors, Spacing, FontSizes } from '../../../styles/design-system';
import { useLocale } from '../../../context/LocaleContext';
import type {
  Task,
  DependencyType,
  DependencyConfig,
  TimeIntervalConfig,
  CronConfig,
  TaskSuccessConfig,
  TaskCompletedConfig,
} from '../../../types/automation';
import { CRON_PRESETS, DEPENDENCY_TYPE_LABELS, parseCron, formStyles } from './shared';

/** 依赖编辑子模态框的 props（由父组件管理状态，本组件只负责渲染与回调） */
export interface DependencyEditorModalProps {
  /** 是否显示 */
  open: boolean;
  /** 正在编辑的依赖索引（null 表示新增） */
  editingDepIndex: number | null;
  /** 当前依赖类型 */
  depFormType: DependencyType;
  /** 当前依赖配置（可能为 null） */
  depFormConfig: DependencyConfig | null;
  /** 可选的前置任务列表 */
  availableTasks: Task[];
  /** 类型变更回调（父组件会重置对应配置） */
  onTypeChange: (type: DependencyType) => void;
  /** 配置变更回调 */
  onConfigChange: (config: DependencyConfig) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: () => void;
}

/** 触发条件编辑子模态框（从 TaskEditorModal 提取，行为完全等价） */
export const DependencyEditorModal: React.FC<DependencyEditorModalProps> = ({
  open,
  editingDepIndex,
  depFormType,
  depFormConfig,
  availableTasks,
  onTypeChange,
  onConfigChange,
  onClose,
  onSave,
}) => {
  const { t } = useLocale();

  if (!open) return null;

  return (
    <div style={formStyles.overlay} onClick={onClose}>
      <div style={formStyles.depFormModal} onClick={(e) => e.stopPropagation()}>
        <div style={formStyles.header}>
          <h3 style={formStyles.title}>
            {editingDepIndex !== null ? t('dep.editTitle') : t('dep.addTitle')}
          </h3>
          <button style={formStyles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={formStyles.body}>
          <div style={formStyles.field}>
            <label style={formStyles.label}>{t('dep.typeLabel')}</label>
            <select
              style={formStyles.select}
              value={depFormType}
              onChange={(e) => {
                const type = e.target.value as DependencyType;
                onTypeChange(type);
              }}
              disabled={editingDepIndex !== null}
            >
              {(Object.keys(DEPENDENCY_TYPE_LABELS) as DependencyType[]).map((key) => (
                <option key={key} value={key}>
                  {t(DEPENDENCY_TYPE_LABELS[key])}
                </option>
              ))}
            </select>
          </div>

          {depFormType === 'time_interval' && depFormConfig && (
            <div style={formStyles.field}>
              <label style={formStyles.label}>{t('dep.intervalLabel')}</label>
              <div style={{ display: 'flex', gap: Spacing.sm }}>
                <input
                  style={{ ...formStyles.input, flex: 1 }}
                  type="number"
                  min={1}
                  value={(depFormConfig as TimeIntervalConfig).intervalSeconds}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || '0', 10);
                    onConfigChange({
                      intervalSeconds: Math.max(1, val || 1),
                    } as TimeIntervalConfig);
                  }}
                />
                <select style={formStyles.select} value="seconds" disabled>
                  <option value="seconds">{t('dep.seconds')}</option>
                </select>
              </div>
              <div style={formStyles.quickIntervalRow}>
                {[
                  { label: t('dep.preset1min'), secs: 60 },
                  { label: t('dep.preset5min'), secs: 300 },
                  { label: t('dep.preset1hour'), secs: 3600 },
                  { label: t('dep.preset1day'), secs: 86400 },
                ].map((p) => (
                  <button
                    key={p.label}
                    style={formStyles.quickBtn}
                    onClick={() => {
                      onConfigChange({
                        intervalSeconds: p.secs,
                      } as TimeIntervalConfig);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {depFormType === 'cron' && depFormConfig && (
            <>
              <div style={formStyles.field}>
                <label style={formStyles.label}>{t('dep.cronLabel')}</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  {[t('dep.minute'), t('dep.hour'), t('dep.day'), t('dep.month'), t('dep.week')].map((label, idx) => (
                    <div key={idx} style={{ flex: 1, minWidth: 0 }}>
                      <label
                        style={{
                          fontSize: FontSizes.caption,
                          color: Colors.textSecondary,
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        {label}
                      </label>
                      <input
                        style={{
                          ...formStyles.input,
                          padding: '6px 8px',
                          fontSize: FontSizes.small,
                        }}
                        value={parseCron((depFormConfig as CronConfig).expression)[idx]}
                        onChange={(e) => {
                          const parts = parseCron((depFormConfig as CronConfig).expression);
                          parts[idx] = e.target.value.trim() || '*';
                          onConfigChange({
                            ...(depFormConfig as CronConfig),
                            expression: parts.join(' '),
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <select
                  style={{
                    ...formStyles.select,
                    fontSize: FontSizes.small,
                    padding: '4px 8px',
                  }}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onConfigChange({
                        ...(depFormConfig as CronConfig),
                        expression: e.target.value,
                      });
                    }
                  }}
                >
                  <option value="">{t('dep.selectPreset')}</option>
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {t(p.label)}（{p.value}）
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    fontSize: FontSizes.small,
                    color: Colors.textSecondary,
                    marginTop: '6px',
                  }}
                >
                  {t('dep.cronCurrent')}
                  <span
                    style={{
                      fontFamily: 'Consolas, monospace',
                      color: Colors.textPrimary,
                    }}
                  >
                    {parseCron((depFormConfig as CronConfig).expression).join(' ')}
                  </span>
                </div>
              </div>
              <div style={formStyles.field}>
                <label style={formStyles.label}>{t('dep.timezoneLabel')}</label>
                <select
                  style={formStyles.select}
                  value={(depFormConfig as CronConfig).timezone || 'local'}
                  onChange={(e) => {
                    onConfigChange({
                      ...(depFormConfig as CronConfig),
                      timezone: e.target.value,
                    });
                  }}
                >
                  <option value="local">本地时区</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Shanghai">Asia/Shanghai</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                </select>
              </div>
            </>
          )}

          {(depFormType === 'task_success' || depFormType === 'task_completed') &&
            depFormConfig && (
              <>
                <div style={formStyles.field}>
                  <label style={formStyles.label}>{t('dep.predecessorLabel')}</label>
                  <select
                    style={formStyles.select}
                    value={
                      (depFormConfig as TaskSuccessConfig | TaskCompletedConfig).upstreamTaskId
                    }
                    onChange={(e) => {
                      onConfigChange({
                        ...(depFormConfig as TaskSuccessConfig | TaskCompletedConfig),
                        upstreamTaskId: e.target.value,
                      });
                    }}
                  >
                    {availableTasks.length === 0 && <option value="">{t('dep.noAvailableTasks')}</option>}
                    {availableTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={formStyles.field}>
                  <label style={formStyles.label}>{t('dep.delaySecondsLabel')}</label>
                  <input
                    style={formStyles.input}
                    type="number"
                    min={0}
                    value={
                      (depFormConfig as TaskSuccessConfig | TaskCompletedConfig).delaySeconds || 0
                    }
                    onChange={(e) => {
                      const val = parseInt(e.target.value || '0', 10);
                      onConfigChange({
                        ...(depFormConfig as TaskSuccessConfig | TaskCompletedConfig),
                        delaySeconds: Math.max(0, val || 0),
                      });
                    }}
                  />
                </div>
              </>
            )}
        </div>
        <div style={formStyles.footer}>
          <button style={formStyles.cancelBtn} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button style={formStyles.saveBtn} onClick={onSave}>
            {t('dep.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
