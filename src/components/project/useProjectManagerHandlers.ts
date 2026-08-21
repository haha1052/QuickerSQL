import { useState, useEffect } from 'react';
import { useProjectStore, useAppStore } from '../../store';
import { tauriService } from '../../services';
import { useLocale } from '../../context/LocaleContext';
import type { ProjectInfo } from '../../types';

/**
 * 项目管理弹窗的状态与事件处理 hook。
 *
 * 设计动机：将所有本地 UI 状态（rename / duplicate / import / 当前项目 ID）
 * 与对应的回调函数集中管理，使 ProjectManager 主文件专注于"组合子组件"。
 *
 * 输入：父组件传入的 onClose / onProjectSwitch / onProjectRename 回调。
 * 输出：所有本地状态、setter、以及事件处理函数。
 *
 * 与项目内既有 useImportSelection / useQueryExecution 等 hook 模式一致。
 */
export interface UseProjectManagerHandlersParams {
  onClose: () => void;
  onProjectSwitch: (newProjectId?: string, newProjectInfo?: ProjectInfo) => void;
  onProjectRename?: (newName: string, isCurrent: boolean) => void;
}

export interface UseProjectManagerHandlersResult {
  // 本地 UI 状态
  renamingProjectId: string | null;
  renameInputValue: string;
  setRenameInputValue: (v: string) => void;
  duplicatingProjectId: string | null;
  duplicateInputValue: string;
  setDuplicateInputValue: (v: string) => void;
  importName: string;
  setImportName: (v: string) => void;
  importFilePath: string | null;
  currentProjectId: string | null;
  loadingError: string | null;
  // 来自 store 的表单绑定字段（透传给子组件）
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  customDbPath: string;
  setCustomDbPath: (v: string) => void;
  projects: ProjectInfo[];
  // 事件处理函数
  handleCreateProject: () => Promise<void>;
  handleSwitchProject: (projectId: string) => Promise<void>;
  handleDeleteProject: (project: ProjectInfo) => Promise<void>;
  handleOpenCustomDatabase: () => Promise<void>;
  handleStartRename: (project: ProjectInfo) => void;
  handleCancelRename: () => void;
  handleConfirmRename: () => Promise<void>;
  handleStartDuplicate: (project: ProjectInfo) => void;
  handleCancelDuplicate: () => void;
  handleConfirmDuplicate: () => Promise<void>;
  handleExportProject: (project: ProjectInfo) => Promise<void>;
  handleSelectImportFile: () => Promise<void>;
  handleImportProject: () => Promise<void>;
  handleRenameKeyPress: (e: React.KeyboardEvent) => void;
  handleDuplicateKeyPress: (e: React.KeyboardEvent) => void;
  formatCreatedDate: (isoString: string) => string;
}

export function useProjectManagerHandlers(
  params: UseProjectManagerHandlersParams,
): UseProjectManagerHandlersResult {
  const { onClose, onProjectSwitch, onProjectRename } = params;
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

  return {
    renamingProjectId,
    renameInputValue,
    setRenameInputValue,
    duplicatingProjectId,
    duplicateInputValue,
    setDuplicateInputValue,
    importName,
    setImportName,
    importFilePath,
    currentProjectId,
    loadingError,
    newProjectName,
    setNewProjectName,
    customDbPath,
    setCustomDbPath,
    projects,
    handleCreateProject,
    handleSwitchProject,
    handleDeleteProject,
    handleOpenCustomDatabase,
    handleStartRename,
    handleCancelRename,
    handleConfirmRename,
    handleStartDuplicate,
    handleCancelDuplicate,
    handleConfirmDuplicate,
    handleExportProject,
    handleSelectImportFile,
    handleImportProject,
    handleRenameKeyPress,
    handleDuplicateKeyPress,
    formatCreatedDate,
  };
}
