import React from 'react';
import { useProjectStore } from '../../store';
import { tauriService } from '../../services';

interface ProjectManagerProps {
  onClose: () => void;
  onProjectSwitch: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onClose, onProjectSwitch }) => {
  const {
    projects,
    newProjectName,
    setNewProjectName,
    customDbPath,
    setCustomDbPath,
  } = useProjectStore();

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('请输入项目名称');
      return;
    }

    const response = await tauriService.createProject(newProjectName.trim());
    if (response.success) {
      alert(`项目 "${newProjectName}" 创建成功`);
      setNewProjectName('');
      onProjectSwitch();
    } else {
      alert(`创建失败: ${response.error}`);
    }
  };

  const handleSwitchProject = async (projectName: string) => {
    const response = await tauriService.switchProject(projectName);
    if (response.success) {
      alert(`已切换到项目 "${projectName}"`);
      onProjectSwitch();
      onClose();
    } else {
      alert(`切换失败: ${response.error}`);
    }
  };

  const handleDeleteProject = async (projectName: string) => {
    if (!confirm(`确定要删除项目 "${projectName}" 吗？`)) {
      return;
    }

    const response = await tauriService.deleteProject(projectName);
    if (response.success) {
      alert(`项目 "${projectName}" 已删除`);
      onProjectSwitch();
    } else {
      alert(`删除失败: ${response.error}`);
    }
  };

  const handleOpenCustomDatabase = async () => {
    if (!customDbPath.trim()) {
      alert('请先选择数据库文件');
      return;
    }

    const response = await tauriService.openDatabaseFromPath(customDbPath);
    if (response.success) {
      alert('已切换到自定义数据库');
      onProjectSwitch();
      onClose();
    } else {
      alert(`打开失败: ${response.error}`);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>项目管理</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>创建新项目</h3>
            <div style={styles.inputGroup}>
              <input
                type="text"
                style={styles.input}
                placeholder="输入项目名称"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
              />
              <button style={styles.primaryButton} onClick={handleCreateProject}>
                创建
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>自定义数据库</h3>
            <div style={styles.inputGroup}>
              <input
                type="text"
                style={styles.input}
                placeholder="选择数据库文件..."
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
                选择文件
              </button>
              <button style={styles.primaryButton} onClick={handleOpenCustomDatabase}>
                打开
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>项目列表</h3>
            <div style={styles.projectList}>
              {projects.length === 0 ? (
                <div style={styles.emptyState}>暂无项目</div>
              ) : (
                projects.map((project) => (
                  <div key={project} style={styles.projectItem}>
                    <span style={styles.projectName}>{project}</span>
                    <div style={styles.projectActions}>
                      <button 
                        style={styles.smallButton}
                        onClick={() => handleSwitchProject(project)}
                      >
                        切换
                      </button>
                      <button 
                        style={styles.dangerButton}
                        onClick={() => handleDeleteProject(project)}
                      >
                        删除
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
    background: 'white',
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
    borderBottom: '1px solid #ddd',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
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
    color: '#333',
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  primaryButton: {
    padding: '8px 16px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  secondaryButton: {
    padding: '8px 16px',
    background: '#6c757d',
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
    borderBottom: '1px solid #eee',
  },
  projectName: {
    fontSize: '14px',
    color: '#333',
  },
  projectActions: {
    display: 'flex',
    gap: '8px',
  },
  smallButton: {
    padding: '4px 12px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  dangerButton: {
    padding: '4px 12px',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
  },
};
