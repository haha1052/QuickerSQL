import type React from 'react';
import { useLocale } from '../../../context/LocaleContext';
import type { DraftState } from './shared';
import { formStyles } from './shared';

/** 刷新仪表盘任务的特有字段：仪表盘 ID 输入框 */
export interface RefreshDashboardTaskFormProps {
  /** 父组件持有的表单状态 */
  form: DraftState;
  /** 父组件的状态更新函数（patch 合并） */
  updateForm: (patch: Partial<DraftState>) => void;
}

export const RefreshDashboardTaskForm: React.FC<RefreshDashboardTaskFormProps> = ({
  form,
  updateForm,
}) => {
  const { t } = useLocale();
  return (
    <div style={formStyles.field}>
      <label style={formStyles.label}>dashboardId *</label>
      <input
        style={formStyles.input}
        value={form.dashboardId}
        onChange={(e) => updateForm({ dashboardId: e.target.value })}
        placeholder={t('automation.placeholder.dashboardId')}
      />
    </div>
  );
};
