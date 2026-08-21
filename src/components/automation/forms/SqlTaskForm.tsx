import type React from 'react';
import type { DraftState } from './shared';
import { formStyles } from './shared';

/** SQL 执行任务的特有字段：SQL 文本框 */
export interface SqlTaskFormProps {
  /** 父组件持有的表单状态 */
  form: DraftState;
  /** 父组件的状态更新函数（patch 合并） */
  updateForm: (patch: Partial<DraftState>) => void;
}

export const SqlTaskForm: React.FC<SqlTaskFormProps> = ({ form, updateForm }) => {
  return (
    <div style={formStyles.field}>
      <label style={formStyles.label}>SQL *</label>
      <textarea
        style={{
          ...formStyles.textarea,
          minHeight: '120px',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        }}
        value={form.sql}
        onChange={(e) => updateForm({ sql: e.target.value })}
        placeholder="SELECT * FROM my_table WHERE ..." // safe_sql: form placeholder 中的 SQL 示例文案
      />
    </div>
  );
};
