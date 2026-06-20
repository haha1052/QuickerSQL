import React from 'react';
import { useProjectStore } from '../../store';
import { tauriService } from '../../services';
import { useLocale } from '../../context/LocaleContext';

interface ProjectManagerProps {
  onClose: () => void;
  onProjectSwitch: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onClose, onProjectSwitch }) => {
  const { t } = useLocale();
  const {
    projects,
    newProjectName,
    setNewProjectName,
    customDbPath,
    setCustomDbPath,
  } = useProjectStore();

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert(t('projectManager.pleaseEnterProjectName'));
      return;
    }

    const response = await tauriService.createProject(newProjectName.trim());
    if (response.success) {
      alert(t('projectManager.projectCreated'));
      setNewProjectName('');
      onProjectSwitch();
    } else {
      alert(`${t('common.error')}: ${response.error}`);
    }
  };

  const handleSwitchProject = async (projectName: string) => {
    const response = await tauriService.switchProject(projectName);
    if (response.success) {
      alert(t('projectManager.projectSwitched'));
      onProjectSwitch();
      onClose();
    } else {
      alert(`${t('common.error')}: ${response.error}`);
    }
  };

  const handleDeleteProject = async (projectName: string) => {
    if (!confirm(t('projectManager.confirmDeleteProject'))) {
      return;
    }

    const response = await tauriService.deleteProject(projectName);
    if (response.success) {
      alert(t('projectManager.projectDeleted'));
      onProjectSwitch();
    } else {
      alert(`${t('common.error')}: ${response.error}`);
    }
  };

  const handleOpenCustomDatabase = async () => {
    if (!customDbPath.trim()) {
      alert(t('projectManager.pleaseSelectDatabaseFile'));
      return;
    }

    const response = await tauriService.openDatabaseFromPath(customDbPath);
    if (response.success) {
      alert(t('projectManager.customDatabaseOpened'));
      onProjectSwitch();
      onClose();
    } else {
      alert(`${t('common.error')}: ${response.error}`);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t('projectManager.title')}</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
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
              <button style={styles.secondaryButton} onClick={async () => {
                const { open } = await import('@tauri-apps/plugin-dialog');
                const selected = await open({
                  multiple: false,
                  filters: [{ name: 'SQLite Database', extensions: ['db'] }],
                });
                if (selected) {
                  const path = Array.isArray(selected) ? selected[0] : selected;
                  setCustomDbPath(path);
                }
              }}>
                {t('projectManager.selectFile')}
              </button>
              <button style={styles.primaryButton} onClick={handleOpenCustomDatabase}>
                {t('common.confirm')}
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>{t('projectManager.projectList')}</h3>
            <div style={styles.projectList}>
              {projects.length === 0 ? (
                <div style={styles.emptyState}>{t('common.noData')}</div>
              ) : (
                projects.map((project) => (
                  <div key={project} style={styles.projectItem}>
                    <span style={styles.projectName}>{project}</span>
                    <div style={styles.projectActions}>
                      <button 
                        style={styles.smallButton}
                        onClick={() => handleSwitchProject(project)}
                      >
                        {t('projectManager.switch')}
                      </button>
                      <button 
                        style={styles.dangerButton}
                        onClick={() => handleDeleteProject(project)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    width: '600px',
    maxHeight: '80vh',
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
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
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
  projectList: {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  projectItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderBottom: '1px solid var(--border-primary)',
  },
  projectName: {
    fontSize: '14px',
    color: 'var(--text-primary)',
  },
  projectActions: {
    display: 'flex',
    gap: '8px',
  },
  smallButton: {
    padding: '4px 12px',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  dangerButton: {
    padding: '4px 12px',
    background: 'var(--error)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--text-tertiary)',
    fontSize: '14px',
  },
};
