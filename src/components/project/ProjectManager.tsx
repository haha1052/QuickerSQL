import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import type { ProjectInfo } from '../../types';
import { ProjectList } from './ProjectList';
import {
  CreateNewProjectForm,
  ImportProjectForm,
  CustomDatabaseForm,
} from './ProjectForms';
import { useProjectManagerHandlers } from './useProjectManagerHandlers';

interface ProjectManagerProps {
  onClose: () => void;
  onProjectSwitch: (newProjectId?: string, newProjectInfo?: ProjectInfo) => void;
  onProjectRename?: (newName: string, isCurrent: boolean) => void;
}

/**
 * 项目管理弹窗组件（主容器）。
 *
 * 子组件拆分（P2 Task 4）：
 * - `ProjectList`：项目列表区与单条目渲染（含 rename / duplicate 内联编辑）
 * - `CreateNewProjectForm` / `ImportProjectForm` / `CustomDatabaseForm`：三块表单
 * - `useProjectManagerHandlers`：集中管理本地 UI 状态与事件处理函数
 *
 * 主文件职责：组合子组件、保留 container 样式、暴露 onClose / onProjectSwitch / onProjectRename 回调。
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
const ProjectManagerComponent: React.FC<ProjectManagerProps> = ({
  onClose,
  onProjectSwitch,
  onProjectRename,
}) => {
  const { t } = useLocale();

  const h = useProjectManagerHandlers({ onClose, onProjectSwitch, onProjectRename });

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
          <CreateNewProjectForm
            newProjectName={h.newProjectName}
            setNewProjectName={h.setNewProjectName}
            onCreateProject={h.handleCreateProject}
          />

          {/* 导入项目区域 */}
          <ImportProjectForm
            importName={h.importName}
            setImportName={h.setImportName}
            importFilePath={h.importFilePath}
            onSelectImportFile={h.handleSelectImportFile}
            onImportProject={h.handleImportProject}
          />

          {/* 自定义数据库区域 */}
          <CustomDatabaseForm
            customDbPath={h.customDbPath}
            setCustomDbPath={h.setCustomDbPath}
            onOpenCustomDatabase={h.handleOpenCustomDatabase}
          />

          {/* 项目列表区域 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('projectManager.projectList')}</h3>
            <ProjectList
              projects={h.projects}
              currentProjectId={h.currentProjectId}
              renamingProjectId={h.renamingProjectId}
              renameInputValue={h.renameInputValue}
              setRenameInputValue={h.setRenameInputValue}
              duplicatingProjectId={h.duplicatingProjectId}
              duplicateInputValue={h.duplicateInputValue}
              setDuplicateInputValue={h.setDuplicateInputValue}
              onConfirmRename={h.handleConfirmRename}
              onCancelRename={h.handleCancelRename}
              onConfirmDuplicate={h.handleConfirmDuplicate}
              onCancelDuplicate={h.handleCancelDuplicate}
              onStartRename={h.handleStartRename}
              onStartDuplicate={h.handleStartDuplicate}
              onSwitchProject={h.handleSwitchProject}
              onDeleteProject={h.handleDeleteProject}
              onExportProject={h.handleExportProject}
              onRenameKeyPress={h.handleRenameKeyPress}
              onDuplicateKeyPress={h.handleDuplicateKeyPress}
              formatCreatedDate={h.formatCreatedDate}
            />
          </div>

          {h.loadingError && (
            <div style={styles.errorHint}>{h.loadingError}</div>
          )}
        </div>
      </div>
    </div>
  );
};

/** P2-2: 用 React.memo 包装以避免父组件重渲染时的无谓更新 */
export const ProjectManager = React.memo(ProjectManagerComponent);
ProjectManager.displayName = 'ProjectManager';

/** 容器相关样式 — 列表/表单/按钮样式由各子组件自维护 */
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
  // 列表区域容器（section / sectionTitle 仅 ProjectList 之上的标题层用）
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '15px',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
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
