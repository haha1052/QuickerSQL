import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import type { ProjectInfo } from '../../types';

/**
 * 单个项目条目的渲染（含 rename / duplicate 内联编辑模式）。
 *
 * 设计：纯展示组件，所有状态与回调通过 props 传入。
 */
interface ProjectItemProps {
  project: ProjectInfo;
  isCurrent: boolean;
  isRenaming: boolean;
  isDuplicating: boolean;
  renameInputValue: string;
  setRenameInputValue: (v: string) => void;
  duplicateInputValue: string;
  setDuplicateInputValue: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onConfirmDuplicate: () => void;
  onCancelDuplicate: () => void;
  onStartRename: (project: ProjectInfo) => void;
  onStartDuplicate: (project: ProjectInfo) => void;
  onSwitchProject: (id: string) => void;
  onDeleteProject: (project: ProjectInfo) => void;
  onExportProject: (project: ProjectInfo) => void;
  onRenameKeyPress: (e: React.KeyboardEvent) => void;
  onDuplicateKeyPress: (e: React.KeyboardEvent) => void;
  formatCreatedDate: (iso: string) => string;
}

const ProjectItem: React.FC<ProjectItemProps> = ({
  project,
  isCurrent,
  isRenaming,
  isDuplicating,
  renameInputValue,
  setRenameInputValue,
  duplicateInputValue,
  setDuplicateInputValue,
  onConfirmRename,
  onCancelRename,
  onConfirmDuplicate,
  onCancelDuplicate,
  onStartRename,
  onStartDuplicate,
  onSwitchProject,
  onDeleteProject,
  onExportProject,
  onRenameKeyPress,
  onDuplicateKeyPress,
  formatCreatedDate,
}) => {
  const { t } = useLocale();

  return (
    <div style={projectListStyles.projectItem}>
      <div style={projectListStyles.projectInfo}>
        {isRenaming ? (
          <input
            type="text"
            style={projectListStyles.inlineInput}
            value={renameInputValue}
            onChange={(e) => setRenameInputValue(e.target.value)}
            onKeyDown={onRenameKeyPress}
            autoFocus
          />
        ) : isDuplicating ? (
          <input
            type="text"
            style={projectListStyles.inlineInput}
            value={duplicateInputValue}
            onChange={(e) => setDuplicateInputValue(e.target.value)}
            onKeyDown={onDuplicateKeyPress}
            autoFocus
          />
        ) : (
          <>
            <div style={projectListStyles.projectNameRow}>
              <span style={projectListStyles.projectName}>{project.name}</span>
              {isCurrent && (
                <span style={projectListStyles.currentBadge}>
                  {t('projectManager.currentProject')}
                </span>
              )}
            </div>
            <div style={projectListStyles.projectMeta}>
              <span style={projectListStyles.metaText}>
                {t('projectManager.createdAt')}:{' '}
                {formatCreatedDate(project.createdAt)}
              </span>
              {project.description && (
                <span style={projectListStyles.metaText}>
                  {' · '}
                  {project.description}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div style={projectListStyles.projectActions}>
        {isRenaming ? (
          <>
            <button style={projectListStyles.smallButton} onClick={onConfirmRename}>
              {t('common.confirm')}
            </button>
            <button
              style={projectListStyles.secondarySmallButton}
              onClick={onCancelRename}
            >
              {t('common.cancel')}
            </button>
          </>
        ) : isDuplicating ? (
          <>
            <button style={projectListStyles.smallButton} onClick={onConfirmDuplicate}>
              {t('common.confirm')}
            </button>
            <button
              style={projectListStyles.secondarySmallButton}
              onClick={onCancelDuplicate}
            >
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <>
            <button
              style={projectListStyles.smallButton}
              onClick={() => onStartRename(project)}
            >
              {t('projectManager.rename')}
            </button>
            <button
              style={projectListStyles.smallButton}
              onClick={() => onStartDuplicate(project)}
            >
              {t('projectManager.duplicate')}
            </button>
            <button
              style={projectListStyles.smallButton}
              onClick={() => onExportProject(project)}
            >
              {t('projectManager.export')}
            </button>
            <button
              style={isCurrent ? projectListStyles.disabledSmallButton : projectListStyles.smallButton}
              onClick={() => onSwitchProject(project.id)}
              disabled={isCurrent}
            >
              {t('projectManager.switch')}
            </button>
            <button
              style={projectListStyles.dangerButton}
              onClick={() => onDeleteProject(project)}
            >
              {t('common.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * 项目列表区子组件。
 *
 * 职责：
 * - 渲染项目列表容器
 * - 渲染每个项目条目（委托给内部 ProjectItem 组件）
 * - 渲染空状态提示
 *
 * 设计：纯展示组件，所有状态由父组件通过 props 传入。
 */
export interface ProjectListProps {
  projects: ProjectInfo[];
  currentProjectId: string | null;
  renamingProjectId: string | null;
  renameInputValue: string;
  setRenameInputValue: (v: string) => void;
  duplicatingProjectId: string | null;
  duplicateInputValue: string;
  setDuplicateInputValue: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onConfirmDuplicate: () => void;
  onCancelDuplicate: () => void;
  onStartRename: (project: ProjectInfo) => void;
  onStartDuplicate: (project: ProjectInfo) => void;
  onSwitchProject: (id: string) => void;
  onDeleteProject: (project: ProjectInfo) => void;
  onExportProject: (project: ProjectInfo) => void;
  onRenameKeyPress: (e: React.KeyboardEvent) => void;
  onDuplicateKeyPress: (e: React.KeyboardEvent) => void;
  formatCreatedDate: (iso: string) => string;
}

export const ProjectList: React.FC<ProjectListProps> = (props) => {
  const { t } = useLocale();
  const { projects, currentProjectId, renamingProjectId, duplicatingProjectId } = props;

  return (
    <div style={projectListStyles.projectList}>
      {projects.length === 0 ? (
        <div style={projectListStyles.emptyState}>{t('common.noData')}</div>
      ) : (
        projects.map((project) => {
          const isCurrent = project.id === currentProjectId;
          const isRenaming = renamingProjectId === project.id;
          const isDuplicating = duplicatingProjectId === project.id;

          return (
            <ProjectItem
              key={project.id}
              project={project}
              isCurrent={isCurrent}
              isRenaming={isRenaming}
              isDuplicating={isDuplicating}
              renameInputValue={props.renameInputValue}
              setRenameInputValue={props.setRenameInputValue}
              duplicateInputValue={props.duplicateInputValue}
              setDuplicateInputValue={props.setDuplicateInputValue}
              onConfirmRename={props.onConfirmRename}
              onCancelRename={props.onCancelRename}
              onConfirmDuplicate={props.onConfirmDuplicate}
              onCancelDuplicate={props.onCancelDuplicate}
              onStartRename={props.onStartRename}
              onStartDuplicate={props.onStartDuplicate}
              onSwitchProject={props.onSwitchProject}
              onDeleteProject={props.onDeleteProject}
              onExportProject={props.onExportProject}
              onRenameKeyPress={props.onRenameKeyPress}
              onDuplicateKeyPress={props.onDuplicateKeyPress}
              formatCreatedDate={props.formatCreatedDate}
            />
          );
        })
      )}
    </div>
  );
};

/** 列表与项目条目相关样式（独立维护，避免主文件膨胀） */
const projectListStyles: Record<string, React.CSSProperties> = {
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
};
