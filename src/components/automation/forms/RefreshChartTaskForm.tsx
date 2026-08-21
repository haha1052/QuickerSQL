import type React from 'react';
import { useLocale } from '../../../context/LocaleContext';
import type { DraftState } from './shared';
import { formStyles } from './shared';

/** 刷新图表任务的特有字段：图表 ID 输入框 */
export interface RefreshChartTaskFormProps {
  /** 父组件持有的表单状态 */
  form: DraftState;
  /** 父组件的状态更新函数（patch 合并） */
  updateForm: (patch: Partial<DraftState>) => void;
}

export const RefreshChartTaskForm: React.FC<RefreshChartTaskFormProps> = ({ form, updateForm }) => {
  const { t } = useLocale();
  return (
    <div style={formStyles.field}>
      <label style={formStyles.label}>chartId *</label>
      <input
        style={formStyles.input}
        value={form.chartId}
        onChange={(e) => updateForm({ chartId: e.target.value })}
        placeholder={t('task.chartId')}
      />
    </div>
  );
};
