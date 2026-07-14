import React, { useState, useEffect } from 'react';
import { useProjectStore, useAppStore } from '../../store';
import { tauriService } from '../../services';
import { useLocale } from '../../context/LocaleContext';
import type { ProjectInfo } from '../../types';

interface ProjectManagerProps {
  onClose: () => void;
  onProjectSwitch: (newProjectId?: string, newProjectInfo?: ProjectInfo) => void;
  onProjectRename?: (newName: string, isCurrent: boolean) => void;
}

/**
 * 项目管理弹窗组件。
 * 重构后采用 ID-based 调用：所有项目操作通过项目 ID 与 tauriService 交互。
 *
 * 支持操作：
 * - 创建新项目（创建后自动切换）
 * - 切换项目
 * - 重命名项目
 * - 复制项目（另存为新项目）
 * - 删除项目（带确认）
 * - 导入项目（从 .qsql/.db/.sqlite 文件）
 * - 导出项目（导出为 .qsql 文件）
 * - 打开自定义数据库（保留旧入口）
 */
export const ProjectManager: React.FC<ProjectManagerProps> = ({
  onClose,
  onProjectSwitch,
  onProjectRename,
}) => {
  const { t, formatDate } = useLocale();
  const { setMessage } = useAppStore();
  const {
    projects,
    newProjectName,
    setNewProjectName,
    customDbPath,
    setCustomDbPath,
  } = useProjectStore();

  // 重命名状态：保存项目 ID 用于调用 API，input 值用于编辑
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  // 复制项目状态
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);
  const [duplicateInputValue, setDuplicateInputValue] = useState('');

  // 导入项目状态
  const [importName, setImportName] = useState('');
  const [importFilePath, setImportFilePath] = useState<string | null>(null);

  // 当前项目 ID（用于判断"当前项目"标记与禁用切换按钮）
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // 加载错误提示
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // 初始化：获取当前项目 ID
  useEffect(() => {
    void (async () => {
      try {
        const response = await tauriService.getCurrentProjectId();
        if (response.success && response.data) {
          setCurrentProjectId(response.data);
        } else if (!response.success) {
          setLoadingError(response.error || null);
        }
      } catch (err) {
        // 获取当前项目 ID 失败不阻塞弹窗使用，仅记录日志
        console.error('Failed to get current project id:', err);
      }
    })();
  }, []);

  /** 创建新项目，成功后自动切换到新项目并关闭弹窗 */
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setMessage(t('projectManager.pleaseEnterProjectName'), 'warning');
      return;
    }

    try {
      const response = await tauriService.createProject(newProjectName.trim());
      if (response.success && response.data) {
        const newProject = response.data;
        // 创建成功后自动切换到新项目
        const switchResp = await tauriService.switchProject(newProject.id);
        if (switchResp.success) {
          setMessage(t('projectManager.projectCreated'), 'success');
          setNewProjectName('');
          setCurrentProjectId(newProject.id);
          onProjectSwitch(newProject.id, newProject);
          onClose();
        } else {
          // 切换失败时仍提示创建成功，但保留弹窗以便用户处理
          setMessage(
            `${t('projectManager.projectCreated')} / ${t('common.error')}: ${switchResp.error}`,
            'warning',
          );
          onProjectSwitch();
        }
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  /** 切换到指定项目 */
  const handleSwitchProject = async (projectId: string) => {
    if (projectId === currentProjectId) {
      // 已是当前项目，无需切换
      return;
    }
    try {
      const response = await tauriService.switchProject(projectId);
      if (response.success && response.data) {
        setMessage(t('projectManager.projectSwitched'), 'success');
        setCurrentProjectId(response.data.id);
        onProjectSwitch(response.data.id, response.data);
        onClose();
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  /** 删除项目（带确认提示） */
  const handleDeleteProject = async (project: ProjectInfo) => {
    const confirmMsg = t('projectManager.confirmDeleteWithName', { name: project.name });
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const response = await tauriService.deleteProject(project.id);
      if (response.success) {
        setMessage(t('projectManager.projectDeleted'), 'success');
        // 若删除的是当前项目，后端会切换到 default；前端刷新状态
        onProjectSwitch();
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  /** 打开自定义数据库（保留旧入口） */
  const handleOpenCustomDatabase = async () => {
    if (!customDbPath.trim()) {
      setMessage(t('projectManager.pleaseSelectDatabaseFile'), 'warning');
      return;
    }

    try {
      const response = await tauriService.openDatabaseFromPath(customDbPath);
      if (response.success) {
        setMessage(t('projectManager.customDatabaseOpened'), 'success');
        onProjectSwitch();
        onClose();
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  /** 进入重命名模式 */
  const handleStartRename = (project: ProjectInfo) => {
    setRenamingProjectId(project.id);
    setRenameInputValue(project.name);
  };

  const handleCancelRename = () => {
    setRenamingProjectId(null);
    setRenameInputValue('');
  };

  /** 确认重命名 */
  const handleConfirmRename = async () => {
    if (!renamingProjectId || !renameInputValue.trim()) {
      setMessage(t('projectManager.pleaseEnterProjectName'), 'warning');
      return;
    }

    const trimmedName = renameInputValue.trim();
    const original = projects.find((p) => p.id === renamingProjectId);
    if (original && original.name === trimmedName) {
      // 名称未变化，直接退出编辑模式
      handleCancelRename();
      return;
    }

    try {
      const response = await tauriService.renameProject(renamingProjectId, trimmedName);
      if (response.success && response.data) {
        setMessage(t('projectManager.projectRenamed'), 'success');
        if (onProjectRename) {
          const isCurrent = renamingProjectId === currentProjectId;
          onProjectRename(trimmedName, isCurrent);
        } else {
          onProjectSwitch();
        }
        handleCancelRename();
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  /** 进入复制模式 */
  const handleStartDuplicate = (project: ProjectInfo) => {
    setDuplicatingProjectId(project.id);
    setDuplicateInputValue(`${project.name} ${t('projectManager.copySuffix')}`);
  };

  const handleCancelDuplicate = () => {
    setDuplicatingProjectId(null);
    setDuplicateInputValue('');
  };

  /** 确认复制项目 */
  const handleConfirmDuplicate = async () => {
    if (!duplicatingProjectId || !duplicateInputValue.trim()) {
      setMessage(t('projectManager.pleaseEnterProjectName'), 'warning');
      return;
    }

    try {
      const response = await tauriService.duplicateProject(
        duplicatingProjectId,
        duplicateInputValue.trim(),
      );
      if (response.success && response.data) {
        setMessage(t('projectManager.projectDuplicated'), 'success');
        handleCancelDuplicate();
        // 仅刷新列表，不自动切换（用户可能想继续操作原项目）
        onProjectSwitch();
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  /** 导出项目为 .qsql 文件 */
  const handleExportProject = async (project: ProjectInfo) => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const defaultName = `${project.name}.qsql`;
      const destPath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'QuickerSQL Project', extensions: ['qsql'] }],
      });

      if (!destPath) {
        // 用户取消保存
        return;
      }

      const response = await tauriService.exportProject(project.id, destPath);
      if (response.success) {
        setMessage(`${t('projectManager.projectExported')}: ${destPath}`, 'success');
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  /** 选择导入文件 */
  const handleSelectImportFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'QuickerSQL Project / SQLite', extensions: ['db', 'qsql', 'sqlite'] },
        ],
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        setImportFilePath(path);
        // 若用户未填名字，自动用文件名（去扩展名）作为默认名
        if (!importName.trim()) {
          const fileName = path.split(/[\\/]/).pop() || '';
          const baseName = fileName.replace(/\.(db|qsql|sqlite)$/i, '');
          setImportName(baseName);
        }
      }
    } catch (err) {
      console.error('Failed to select import file:', err);
    }
  };

  /** 执行导入项目 */
  const handleImportProject = async () => {
    if (!importFilePath) {
      setMessage(t('projectManager.pleaseSelectDatabaseFile'), 'warning');
      return;
    }
    if (!importName.trim()) {
      setMessage(t('projectManager.pleaseEnterProjectName'), 'warning');
      return;
    }

    try {
      const response = await tauriService.importProject(importFilePath, importName.trim());
      if (response.success && response.data) {
        setMessage(t('projectManager.projectImported'), 'success');
        const imported = response.data;
        // 询问是否切换到导入的项目
        const shouldSwitch = confirm(t('projectManager.confirmSwitchToImported'));
        if (shouldSwitch) {
          const switchResp = await tauriService.switchProject(imported.id);
          if (switchResp.success) {
            setCurrentProjectId(imported.id);
            onProjectSwitch(imported.id, imported);
            setImportName('');
            setImportFilePath(null);
            onClose();
            return;
          }
        }
        // 否则只刷新列表
        onProjectSwitch();
        setImportName('');
        setImportFilePath(null);
      } else {
        setMessage(`${t('common.error')}: ${response.error}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessage(`${t('common.error')}: ${message}`, 'error');
    }
  };

  const handleRenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleConfirmRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  const handleDuplicateKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleConfirmDuplicate();
    } else if (e.key === 'Escape') {
      handleCancelDuplicate();
    }
  };

  /** 格式化创建时间显示 */
  const formatCreatedDate = (isoString: string): string => {
    const formatted = formatDate(isoString);
    return formatted || isoString;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t('projectManager.title')}</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="close">
            ×
          </button>
        </div>

        <div style={styles.content}>
          {/* 创建新项目区域 — 突出显示 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('projectManager.createNewProject')}</h3>
            <div style={styles.inputGroup}>
              <input
                type="text"
                style={styles.input}
                placeholder={t('projectManager.enterProjectName')}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
              />
              <button style={styles.primaryButton} onClick={handleCreateProject}>
                {t('common.confirm')}
              </button>
            </div>
          </div>

          {/* 导入项目区域 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('projectManager.importProject')}</h3>
            <div style={styles.inputGroup}>
              <input
                type="text"
                style={styles.input}
                placeholder={t('projectManager.enterProjectName')}
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
              />
              <button style={styles.secondaryButton} onClick={handleSelectImportFile}>
                {t('projectManager.selectFile')}
              </button>
              <button style={styles.primaryButton} onClick={handleImportProject}>
                {t('projectManager.importButton')}
              </button>
            </div>
            {importFilePath && (
              <div style={styles.filePathHint} title={importFilePath}>
                {importFilePath}
              </div>
            )}
          </div>

          {/* 自定义数据库区域 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('projectManager.customDatabase')}</h3>
            <div style={styles.inputGroup}>
              <input
                type="text"
                style={styles.input}
                placeholder={t('projectManager.selectDatabaseFile')}
                value={customDbPath}
                readOnly
              />
              <button
                style={styles.secondaryButton}
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
              <button style={styles.primaryButton} onClick={handleOpenCustomDatabase}>
                {t('common.confirm')}
              </button>
            </div>
          </div>

          {/* 项目列表区域 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('projectManager.projectList')}</h3>
            <div style={styles.projectList}>
              {projects.length === 0 ? (
                <div style={styles.emptyState}>{t('common.noData')}</div>
              ) : (
                projects.map((project) => {
                  const isCurrent = project.id === currentProjectId;
                  const isRenaming = renamingProjectId === project.id;
                  const isDuplicating = duplicatingProjectId === project.id;

                  return (
                    <div key={project.id} style={styles.projectItem}>
                      <div style={styles.projectInfo}>
                        {isRenaming ? (
                          <input
                            type="text"
                            style={styles.inlineInput}
                            value={renameInputValue}
                            onChange={(e) => setRenameInputValue(e.target.value)}
                            onKeyDown={handleRenameKeyPress}
                            autoFocus
                          />
                        ) : isDuplicating ? (
                          <input
                            type="text"
                            style={styles.inlineInput}
                            value={duplicateInputValue}
                            onChange={(e) => setDuplicateInputValue(e.target.value)}
                            onKeyDown={handleDuplicateKeyPress}
                            autoFocus
                          />
                        ) : (
                          <>
                            <div style={styles.projectNameRow}>
                              <span style={styles.projectName}>{project.name}</span>
                              {isCurrent && (
                                <span style={styles.currentBadge}>
                                  {t('projectManager.currentProject')}
                                </span>
                              )}
                            </div>
                            <div style={styles.projectMeta}>
                              <span style={styles.metaText}>
                                {t('projectManager.createdAt')}:{' '}
                                {formatCreatedDate(project.createdAt)}
                              </span>
                              {project.description && (
                                <span style={styles.metaText}>
                                  {' · '}
                                  {project.description}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div style={styles.projectActions}>
                        {isRenaming ? (
                          <>
                            <button
                              style={styles.smallButton}
                              onClick={handleConfirmRename}
                            >
                              {t('common.confirm')}
                            </button>
                            <button
                              style={styles.secondarySmallButton}
                              onClick={handleCancelRename}
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : isDuplicating ? (
                          <>
                            <button
                              style={styles.smallButton}
                              onClick={handleConfirmDuplicate}
                            >
                              {t('common.confirm')}
                            </button>
                            <button
                              style={styles.secondarySmallButton}
                              onClick={handleCancelDuplicate}
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              style={styles.smallButton}
                              onClick={() => handleStartRename(project)}
                            >
                              {t('projectManager.rename')}
                            </button>
                            <button
                              style={styles.smallButton}
                              onClick={() => handleStartDuplicate(project)}
                            >
                              {t('projectManager.duplicate')}
                            </button>
                            <button
                              style={styles.smallButton}
                              onClick={() => handleExportProject(project)}
                            >
                              {t('projectManager.export')}
                            </button>
                            <button
                              style={
                                isCurrent
                                  ? styles.disabledSmallButton
                                  : styles.smallButton
                              }
                              onClick={() => handleSwitchProject(project.id)}
                              disabled={isCurrent}
                            >
                              {t('projectManager.switch')}
                            </button>
                            <button
                              style={styles.dangerButton}
                              onClick={() => handleDeleteProject(project)}
                            >
                              {t('common.delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {loadingError && (
            <div style={styles.errorHint}>{loadingError}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  // FR-8: 弹窗尺寸加大 — 720x560，最大 90vw/85vh
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    width: '720px',
    height: '560px',
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid var(--border-primary)',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
    color: 'var(--text-primary)',
  },
  content: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  },
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
  // 项目列表 — 给足高度并显示滚动条
  projectList: {
    maxHeight: '320px',
    overflowY: 'auto',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    background: 'var(--bg-tertiary)',
  },
  projectItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-primary)',
    gap: '12px',
  },
  projectInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  projectNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  projectName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  currentBadge: {
    fontSize: '11px',
    padding: '1px 6px',
    borderRadius: '8px',
    background: 'var(--primary)',
    color: 'white',
    flexShrink: 0,
  },
  projectMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  projectActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  smallButton: {
    padding: '4px 10px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  secondarySmallButton: {
    padding: '4px 10px',
    background: 'var(--text-secondary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  disabledSmallButton: {
    padding: '4px 10px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-tertiary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '12px',
    opacity: 0.6,
  },
  dangerButton: {
    padding: '4px 10px',
    background: 'var(--error)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  inlineInput: {
    width: '100%',
    padding: '4px 8px',
    border: '1px solid var(--primary)',
    borderRadius: '4px',
    fontSize: '14px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--text-tertiary)',
    fontSize: '14px',
  },
  errorHint: {
    marginTop: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    color: 'var(--error)',
    background: 'rgba(255, 0, 0, 0.05)',
    borderRadius: '4px',
  },
};
