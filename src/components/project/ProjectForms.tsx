import React from 'react';
import { useLocale } from '../../context/LocaleContext';

/**
 * 项目管理弹窗中的三个表单区子组件集合：
 * - CreateNewProjectForm：创建新项目
 * - ImportProjectForm：从文件导入项目
 * - CustomDatabaseForm：打开自定义数据库
 *
 * 设计：纯展示组件，所有状态/回调由父组件通过 props 传入。
 */

interface CreateNewProjectFormProps {
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  onCreateProject: () => void;
}

/** 创建新项目表单 */
export const CreateNewProjectForm: React.FC<CreateNewProjectFormProps> = ({
  newProjectName,
  setNewProjectName,
  onCreateProject,
}) => {
  const { t } = useLocale();
  return (
    <div style={formStyles.section}>
      <h3 style={formStyles.sectionTitle}>{t('projectManager.createNewProject')}</h3>
      <div style={formStyles.inputGroup}>
        <input
          type="text"
          style={formStyles.input}
          placeholder={t('projectManager.enterProjectName')}
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onCreateProject()}
        />
        <button style={formStyles.primaryButton} onClick={onCreateProject}>
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
};

interface ImportProjectFormProps {
  importName: string;
  setImportName: (v: string) => void;
  importFilePath: string | null;
  onSelectImportFile: () => void;
  onImportProject: () => void;
}

/** 从文件导入项目表单 */
export const ImportProjectForm: React.FC<ImportProjectFormProps> = ({
  importName,
  setImportName,
  importFilePath,
  onSelectImportFile,
  onImportProject,
}) => {
  const { t } = useLocale();
  return (
    <div style={formStyles.section}>
      <h3 style={formStyles.sectionTitle}>{t('projectManager.importProject')}</h3>
      <div style={formStyles.inputGroup}>
        <input
          type="text"
          style={formStyles.input}
          placeholder={t('projectManager.enterProjectName')}
          value={importName}
          onChange={(e) => setImportName(e.target.value)}
        />
        <button style={formStyles.secondaryButton} onClick={onSelectImportFile}>
          {t('projectManager.selectFile')}
        </button>
        <button style={formStyles.primaryButton} onClick={onImportProject}>
          {t('projectManager.importButton')}
        </button>
      </div>
      {importFilePath && (
        <div style={formStyles.filePathHint} title={importFilePath}>
          {importFilePath}
        </div>
      )}
    </div>
  );
};

interface CustomDatabaseFormProps {
  customDbPath: string;
  setCustomDbPath: (v: string) => void;
  onOpenCustomDatabase: () => void;
}

/** 打开自定义数据库表单（保留旧入口） */
export const CustomDatabaseForm: React.FC<CustomDatabaseFormProps> = ({
  customDbPath,
  setCustomDbPath,
  onOpenCustomDatabase,
}) => {
  const { t } = useLocale();
  return (
    <div style={formStyles.section}>
      <h3 style={formStyles.sectionTitle}>{t('projectManager.customDatabase')}</h3>
      <div style={formStyles.inputGroup}>
        <input
          type="text"
          style={formStyles.input}
          placeholder={t('projectManager.selectDatabaseFile')}
          value={customDbPath}
          readOnly
        />
        <button
          style={formStyles.secondaryButton}
          onClick={async () => {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
              multiple: false,
              filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            });
            if (selected) {
              const path = Array.isArray(selected) ? selected[0] : selected;
              setCustomDbPath(path);
            }
          }}
        >
          {t('projectManager.selectFile')}
        </button>
        <button style={formStyles.primaryButton} onClick={onOpenCustomDatabase}>
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
};

/** 表单区共用样式（section 容器、输入框、按钮等） */
const formStyles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '15px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    fontSize: '14px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
  },
  primaryButton: {
    padding: '8px 16px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  secondaryButton: {
    padding: '8px 16px',
    background: 'var(--text-secondary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  filePathHint: {
    marginTop: '6px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
