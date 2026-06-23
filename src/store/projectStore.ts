import { create } from 'zustand';
import { tauriService } from '../services/tauri';
import { useToastStore } from './toastStore';

interface DatabaseStatusItem {
  db_type: string;
  tables: string[];
  row_count: [string, number][];
  is_connected: boolean;
  path: string;
  tableCount: number;
}

interface ImportItemPayload {
  file_path: string;
  sheet_name?: string;
  table_name: string;
  has_header: boolean;
  fields: Array<{ name: string; dataType: string }>;
}

interface ProjectState {
  projects: string[];
  currentProject: string;
  showProjectModal: boolean;
  newProjectName: string;
  currentDbPath: string;
  useCustomPath: boolean;
  customDbPath: string;
  selectedProjects: Set<string>;

  // P1-5 新增：异步加载与状态
  databaseStatus: DatabaseStatusItem[];
  loading: boolean;
  importProgress: number;
  error: string | null;

  // 原有 setter
  setProjects: (projects: string[]) => void;
  setCurrentProject: (project: string) => void;
  setShowProjectModal: (show: boolean) => void;
  setNewProjectName: (name: string) => void;
  setCurrentDbPath: (path: string) => void;
  setUseCustomPath: (use: boolean) => void;
  setCustomDbPath: (path: string) => void;
  toggleSelectedProject: (project: string) => void;
  clearSelectedProjects: () => void;

  // P1-5 新增：异步 action
  getDatabaseStatus: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadCurrentDbPath: () => Promise<void>;
  importDataV2: (params: ImportItemPayload) => Promise<boolean>;
  setAllDatabaseStatus: (status: DatabaseStatusItem[]) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: '',
  showProjectModal: false,
  newProjectName: '',
  currentDbPath: '',
  useCustomPath: false,
  customDbPath: '',
  selectedProjects: new Set(),

  // P1-5 异步相关状态
  databaseStatus: [],
  loading: false,
  importProgress: 0,
  error: null,

  setProjects: (projects) => set({ projects }),

  setCurrentProject: (project) => set({ currentProject: project }),

  setShowProjectModal: (show) => set({ showProjectModal: show }),

  setNewProjectName: (name) => set({ newProjectName: name }),

  setCurrentDbPath: (path) => set({ currentDbPath: path }),

  setUseCustomPath: (use) => set({ useCustomPath: use }),

  setCustomDbPath: (path) => set({ customDbPath: path }),

  toggleSelectedProject: (project) => set((state) => {
    const nextSelected = new Set(state.selectedProjects);
    if (nextSelected.has(project)) {
      nextSelected.delete(project);
    } else {
      nextSelected.add(project);
    }
    return { selectedProjects: nextSelected };
  }),

  clearSelectedProjects: () => set({ selectedProjects: new Set() }),

  setAllDatabaseStatus: (status) => set({ databaseStatus: status }),

  async getDatabaseStatus() {
    try {
      set({ loading: true, error: null });
      const response = await tauriService.getDatabaseStatus();
      if (response.success && response.data) {
        set({ databaseStatus: [response.data] as unknown as DatabaseStatusItem[] });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`获取数据库状态失败: ${message}`, 'error');
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  async loadProjects() {
    try {
      set({ loading: true, error: null });
      const response = await tauriService.listProjects();
      if (response.success && response.data) {
        set({ projects: response.data });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`加载项目列表失败: ${message}`, 'error');
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  async loadCurrentDbPath() {
    try {
      set({ loading: true, error: null });
      const response = await tauriService.getCurrentDbPath();
      if (response.success && response.data) {
        set({ currentDbPath: response.data });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`获取当前数据库路径失败: ${message}`, 'error');
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  async importDataV2(params) {
    try {
      set({ loading: true, error: null, importProgress: 0 });
      const response = await tauriService.importDataV2(params);
      if (response.success) {
        useToastStore.getState().addToast(`表 "${params.table_name}" 导入成功`, 'success');
        set({ importProgress: 100 });
        return true;
      }
      useToastStore.getState().addToast(`导入失败: ${response.error || '未知错误'}`, 'error');
      set({ error: response.error || '导入失败' });
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`导入失败: ${message}`, 'error');
      set({ error: message });
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));
