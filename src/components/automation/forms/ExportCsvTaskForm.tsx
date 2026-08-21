import type React from 'react';
import type { DraftState } from './shared';
import { formStyles } from './shared';

/** 导出 CSV 任务的特有字段：SQL 文本框 + 输出路径输入框 */
export interface ExportCsvTaskFormProps {
  /** 父组件持有的表单状态 */
  form: DraftState;
  /** 父组件的状态更新函数（patch 合并） */
  updateForm: (patch: Partial<DraftState>) => void;
}

export const ExportCsvTaskForm: React.FC<ExportCsvTaskFormProps> = ({ form, updateForm }) => {
  return (
    <>
      <div style={formStyles.field}>
        <label style={formStyles.label}>SQL *</label>
        <textarea
          style={{
            ...formStyles.textarea,
            minHeight: '90px',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          }}
          value={form.csvSql}
          onChange={(e) => updateForm({ csvSql: e.target.value })}
          placeholder="SELECT * FROM ..." // safe_sql: form placeholder 中的 SQL 示例文案
        />
      </div>
      <div style={formStyles.field}>
        <label style={formStyles.label}>输出路径 *</label>
        <input
          style={formStyles.input}
          value={form.csvOutputPath}
          onChange={(e) => updateForm({ csvOutputPath: e.target.value })}
          placeholder="/path/to/export.csv"
        />
      </div>
    </>
  );
};
