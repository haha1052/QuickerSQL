import { create } from 'zustand';
import { tauriService } from '../services/tauri';
import { useToastStore } from './toastStore';
import type { ProjectInfo } from '../types';

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
  projects: ProjectInfo[];
  currentProject: string;
  /** 当前项目 ID（UUID），与后端注册表一致 */
  currentProjectId: string;
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
  setProjects: (projects: ProjectInfo[]) => void;
  setCurrentProject: (project: string) => void;
  /** 设置当前项目 ID */
  setCurrentProjectId: (id: string) => void;
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

  /**
   * 切换项目后的统一刷新协调方法（仅负责 projectStore 自身的状态更新）。
   *
   * 跨 Store 的刷新由 App.tsx 中的 handleProjectSwitchRefresh 统一编排，
   * 避免 projectStore 反向依赖其他业务 Store。
   *
   * @param newProjectId 新项目 ID
   * @param newProjectInfo 新项目信息（可选，包含名称等）
   */
  refreshAfterProjectSwitch: (newProjectId: string, newProjectInfo?: ProjectInfo) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: '',
  currentProjectId: '',
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

  setCurrentProjectId: (id) => set({ currentProjectId: id }),

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
      // 1. 获取当前数据库路径
      const pathResponse = await tauriService.getCurrentDbPath();
      if (pathResponse.success && pathResponse.data) {
        set({ currentDbPath: pathResponse.data });
      }

      // 2. 通过 getCurrentProjectId 获取当前项目 ID（新架构下目录名是 UUID，
      //    无法再从路径反推项目名，必须通过后端查询）
      const idResponse = await tauriService.getCurrentProjectId();
      if (idResponse.success && idResponse.data) {
        const projectId = idResponse.data;
        set({ currentProjectId: projectId });

        // 3. 从 projects 列表查找项目名（projects 可能已通过 startupData 或
        //    loadProjects 加载，若未加载则 currentProject 保持调用前的值）
        const { projects } = get();
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          set({ currentProject: project.name });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`获取当前数据库路径失败: ${message}`, 'error');
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * 切换项目后的统一刷新协调方法（仅负责 projectStore 自身的状态更新）。
   *
   * 步骤：
   *   1. 立即更新 currentProjectId / currentProject / 清空选中集合
   *      —— 让 UI 第一时间反映切换结果，无需等待后端往返
   *   2. 调用 loadCurrentDbPath 同步当前数据库路径与项目 ID
   *      —— 后端已切换连接，此调用获取的是新项目的路径
   *   3. 调用 loadProjects 刷新项目列表（更新 last_opened_at 排序）
   *
   * 跨 Store 的刷新（workspace/table/query/dashboard/task）由
   * App.tsx 中的 handleProjectSwitchRefresh 统一编排。
   */
  async refreshAfterProjectSwitch(newProjectId: string, newProjectInfo?: ProjectInfo) {
    // 1. 立即更新当前项目状态（乐观更新，让 UI 即时响应）
    set({
      currentProjectId: newProjectId,
      currentProject: newProjectInfo?.name || get().currentProject,
      selectedProjects: new Set(),
    });

    // 2. 加载当前数据库路径（后端已切换连接，此处获取新项目路径 + ID）
    await get().loadCurrentDbPath();

    // 3. 刷新项目列表（更新 last_opened_at 排序）
    await get().loadProjects();
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
