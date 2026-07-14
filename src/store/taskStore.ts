/**
 * 自动化任务状态管理 Store
 *
 * 基于 Zustand 实现，负责管理自动化任务相关的状态与操作，包括：
 *   - 任务列表的加载、筛选与搜索
 *   - 任务的增删改查、启用/禁用、立即执行
 *   - 任务运行日志的加载
 *   - 任务统计数据（总数、启用数、失败数）
 *   - 细粒度的加载状态管理（按操作名 + 任务 ID）
 *
 * 设计特点：
 *   1. 细粒度 loading 状态：通过 loadingAction + loadingTaskId 区分不同操作的加载状态
 *   2. 支持按状态、类型、关键词多维度筛选
 *   3. 启动时优先消费 StartupContext 缓存的 tasks 数据，减少一次 IPC 调用
 *   4. 操作失败时通过 toastStore 统一提示用户
 */

import { create } from 'zustand';
import type { Task, TaskRun, CreateTaskPayload, UpdateTaskPayload, TaskListResponse, TaskState, TaskDependency, DependencyType } from '../types/automation';
import { tauriService } from '../services/tauri';
import { useToastStore } from './toastStore';

/**
 * 自动化任务 Store 状态与操作接口
 *
 * 管理任务列表、运行日志、筛选条件、统计数据等状态，
 * 以及任务的 CRUD、启用/禁用、立即执行等操作。
 */
interface TaskStoreState {
  /** 任务列表 */
  tasks: Task[];
  /** 当前选中的任务 ID */
  selectedTaskId: string | null;
  /** 当前选中任务的运行日志列表 */
  taskRuns: TaskRun[];
  /** 整体是否处于加载状态（向后兼容，UI 仍可直接引用） */
  loading: boolean;
  /** 当前正在执行的操作名，如 `'loadTasks'` / `'createTask'` / `'updateTask'` / `'deleteTask'` / `'enableTask'` / `'disableTask'` / `'runTaskNow'` */
  loadingAction: string | null;
  /** 当 loadingAction 与特定任务相关时，记录该任务 id；列表操作（如 loadTasks）为 null */
  loadingTaskId: string | null;
  /** 最近一次错误消息 */
  error: string | null;
  /** 按任务状态筛选 */
  filterState: TaskState | 'all';
  /** 按任务类型筛选 */
  filterType: string;
  /** 搜索关键词 */
  keyword: string;
  /** 任务统计数据 */
  stats: { total: number; enabledCount: number; failedTasksCount: number };
  /** 任务依赖缓存，key 为 taskId */
  dependencies: Record<string, TaskDependency[]>;

  /**
   * 判断某操作是否正在进行 —— UI 可按操作名做粒度化的 loading 展示
   *
   * @param action 操作名
   * @param taskId 可选的任务 ID，不传则只匹配操作名
   * @returns 指定操作是否正在加载
   */
  isActionLoading: (action: string, taskId?: string | null) => boolean;
  /** 加载任务列表（应用当前筛选条件） */
  loadTasks: () => Promise<void>;
  /**
   * 选中指定任务（同时加载该任务的运行日志）
   *
   * @param id 任务 ID，null 表示取消选中
   */
  selectTask: (id: string | null) => void;
  /**
   * 创建新任务
   *
   * @param payload 任务创建参数
   * @returns 创建成功的任务对象，失败返回 null
   */
  createTask: (payload: CreateTaskPayload) => Promise<Task | null>;
  /**
   * 更新任务
   *
   * @param id 任务 ID
   * @param patch 要更新的字段
   * @returns 更新后的任务对象，失败返回 null
   */
  updateTask: (id: string, patch: UpdateTaskPayload) => Promise<Task | null>;
  /**
   * 删除任务
   *
   * @param id 任务 ID
   * @returns 操作是否成功
   */
  deleteTask: (id: string) => Promise<boolean>;
  /**
   * 启用任务
   *
   * @param id 任务 ID
   * @returns 启用后的任务对象，失败返回 null
   */
  enableTask: (id: string) => Promise<Task | null>;
  /**
   * 禁用任务
   *
   * @param id 任务 ID
   * @returns 禁用后的任务对象，失败返回 null
   */
  disableTask: (id: string) => Promise<Task | null>;
  /**
   * 立即执行任务
   *
   * @param id 任务 ID
   * @returns 任务运行记录，失败返回 null
   */
  runTaskNow: (id: string) => Promise<TaskRun | null>;
  /**
   * 加载指定任务的运行日志
   *
   * @param taskId 任务 ID
   * @param limit 返回记录数限制，默认 50
   */
  loadTaskRuns: (taskId: string, limit?: number) => Promise<void>;
  /**
   * 设置任务状态筛选条件
   *
   * @param s 任务状态或 'all'（全部）
   */
  setFilterState: (s: TaskState | 'all') => void;
  /**
   * 设置任务类型筛选条件
   *
   * @param t 任务类型
   */
  setFilterType: (t: string) => void;
  /**
   * 设置搜索关键词
   *
   * @param k 搜索关键词
   */
  setKeyword: (k: string) => void;
  /**
   * 加载指定任务的依赖列表
   *
   * @param taskId 任务 ID
   */
  loadDependencies: (taskId: string) => Promise<void>;
  /**
   * 为任务添加依赖
   *
   * @param taskId 任务 ID
   * @param depType 依赖类型
   * @param depConfig 依赖配置（JSON 字符串）
   */
  addDependency: (taskId: string, depType: DependencyType, depConfig: string) => Promise<void>;
  /**
   * 更新任务依赖配置
   *
   * @param depId 依赖 ID
   * @param depConfig 新的依赖配置（JSON 字符串）
   */
  updateDependency: (depId: string, depConfig: string) => Promise<void>;
  /**
   * 删除任务依赖
   *
   * @param taskId 任务 ID
   * @param depId 依赖 ID
   */
  deleteDependency: (taskId: string, depId: string) => Promise<void>;
  /**
   * 替换任务的所有依赖
   *
   * @param taskId 任务 ID
   * @param deps 新的依赖列表
   */
  replaceDependencies: (
    taskId: string,
    deps: Array<{ dependencyType: DependencyType; dependencyConfig: string }>
  ) => Promise<void>;
  /**
   * 从 get_startup_status 缓存数据设置任务列表（启动优化，避免独立 IPC）
   *
   * v3 启动优化：直接消费 get_startup_status 缓存的数据，
   * 避免任务页面初始化时再发一次 list_automation_tasks IPC。
   *
   * @param tasks 后端返回的任务列表数据
   */
  setTasksFromStartup: (tasks: Array<{
    id: string;
    name: string;
    description: string;
    taskType: string;
    scheduleMode: string;
    scheduleValue: string;
    state: string;
    nextRunAt: number | null;
    lastRunStatus: string | null;
    lastRunDurationMs: number | null;
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    createdAt: number;
    updatedAt: number;
  }>) => void;
}

/**
 * 统一设置加载状态为开始（避免每个 action 重复写 set 字段）
 *
 * @param set Zustand set 函数
 * @param action 操作名
 * @param taskId 关联的任务 ID（可选）
 */
function startLoading(set: (partial: Partial<TaskStoreState>) => void, action: string, taskId: string | null = null) {
  set({ loading: true, loadingAction: action, loadingTaskId: taskId, error: null });
}

/**
 * 统一清除加载状态（避免每个 action 重复写 set 字段）
 *
 * @param set Zustand set 函数
 */
function endLoading(set: (partial: Partial<TaskStoreState>) => void) {
  set({ loading: false, loadingAction: null, loadingTaskId: null });
}

export const useTaskStore = create<TaskStoreState>()((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  taskRuns: [],
  loading: false,
  loadingAction: null,
  loadingTaskId: null,
  error: null,
  filterState: 'all',
  filterType: 'all',
  keyword: '',
  stats: { total: 0, enabledCount: 0, failedTasksCount: 0 },
  dependencies: {},

  isActionLoading: (action, taskId = null) => {
    const s = get();
    if (s.loadingAction !== action) return false;
    if (taskId != null) return s.loadingTaskId === taskId;
    return true;
  },

  async loadTasks() {
    startLoading(set, 'loadTasks');
    try {
      const { filterState, filterType, keyword } = get();
      const fs = filterState === 'all' ? undefined : filterState;
      const ft = filterType === 'all' ? undefined : filterType;
      const kw = keyword.length > 0 ? keyword : undefined;

      const response = await tauriService.listAutomationTasks(fs, ft, kw);
      if (!response.success) {
        throw new Error(response.error || '加载任务列表失败');
      }
      const data = response.data as TaskListResponse;
      set({
        tasks: data.tasks || [],
        stats: {
          total: data.total ?? data.tasks?.length ?? 0,
          enabledCount: data.enabledCount ?? 0,
          failedTasksCount: data.failedTasksCount ?? 0,
        },
      });
      endLoading(set);
    } catch (err) {
      useToastStore.getState().addToast(`加载任务列表失败: ${String(err)}`, 'error');
      set({ error: String(err) });
      endLoading(set);
    }
  },

  selectTask(id) {
    set({ selectedTaskId: id });
    if (id) {
      get().loadTaskRuns(id, 50);
    } else {
      set({ taskRuns: [] });
    }
  },

  async createTask(payload) {
    startLoading(set, 'createTask');
    try {
      const response = await tauriService.createAutomationTask(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || '创建任务失败');
      }
      useToastStore.getState().addToast(`任务 "${response.data.name}" 已创建`, 'success');
      await get().loadTasks();
      return response.data;
    } catch (err) {
      useToastStore.getState().addToast(`创建任务失败: ${String(err)}`, 'error');
      set({ error: String(err) });
      return null;
    } finally {
      endLoading(set);
    }
  },

  async updateTask(id, patch) {
    startLoading(set, 'updateTask', id);
    try {
      const response = await tauriService.updateAutomationTask(id, patch);
      if (!response.success || !response.data) {
        throw new Error(response.error || '更新任务失败');
      }
      await get().loadTasks();
      return response.data;
    } catch (err) {
      useToastStore.getState().addToast(`更新任务失败: ${String(err)}`, 'error');
      set({ error: String(err) });
      return null;
    } finally {
      endLoading(set);
    }
  },

  async deleteTask(id) {
    startLoading(set, 'deleteTask', id);
    try {
      const response = await tauriService.deleteAutomationTask(id);
      if (!response.success) {
        throw new Error(response.error || '删除任务失败');
      }
      useToastStore.getState().addToast('任务已删除', 'success');
      if (get().selectedTaskId === id) {
        set({ selectedTaskId: null, taskRuns: [] });
      }
      await get().loadTasks();
      return true;
    } catch (err) {
      useToastStore.getState().addToast(`删除任务失败: ${String(err)}`, 'error');
      set({ error: String(err) });
      return false;
    } finally {
      endLoading(set);
    }
  },

  async enableTask(id) {
    startLoading(set, 'enableTask', id);
    try {
      const response = await tauriService.enableAutomationTask(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || '启用任务失败');
      }
      useToastStore.getState().addToast(`任务已启用`, 'success');
      await get().loadTasks();
      return response.data;
    } catch (err) {
      useToastStore.getState().addToast(`启用任务失败: ${String(err)}`, 'error');
      set({ error: String(err) });
      return null;
    } finally {
      endLoading(set);
    }
  },

  async disableTask(id) {
    startLoading(set, 'disableTask', id);
    try {
      const response = await tauriService.disableAutomationTask(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || '禁用任务失败');
      }
      useToastStore.getState().addToast(`任务已禁用`, 'success');
      await get().loadTasks();
      return response.data;
    } catch (err) {
      useToastStore.getState().addToast(`禁用任务失败: ${String(err)}`, 'error');
      set({ error: String(err) });
      return null;
    } finally {
      endLoading(set);
    }
  },

  async runTaskNow(id) {
    startLoading(set, 'runTaskNow', id);
    try {
      const response = await tauriService.runAutomationTaskNow(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || '执行任务失败');
      }
      useToastStore.getState().addToast(`任务执行成功`, 'success');
      await get().loadTasks();
      if (get().selectedTaskId === id) {
        await get().loadTaskRuns(id, 50);
      }
      return response.data;
    } catch (err) {
      useToastStore.getState().addToast(`执行任务失败: ${String(err)}`, 'error');
      set({ error: String(err) });
      return null;
    } finally {
      endLoading(set);
    }
  },

  async loadTaskRuns(taskId, limit) {
    try {
      const response = await tauriService.getAutomationTaskRuns(taskId, limit);
      if (response.success && response.data) {
        set({ taskRuns: response.data });
      }
    } catch (err) {
      console.error('加载任务运行日志失败:', err);
    }
  },

  setFilterState(s) {
    set({ filterState: s });
  },

  setFilterType(t) {
    set({ filterType: t });
  },

  setKeyword(k) {
    set({ keyword: k });
  },

  async loadDependencies(taskId) {
    try {
      const response = await tauriService.listTaskDependencies(taskId);
      if (response.success && response.data) {
        set((state) => ({
          dependencies: {
            ...state.dependencies,
            [taskId]: response.data as TaskDependency[],
          },
        }));
      }
    } catch (err) {
      console.error('加载任务依赖失败:', err);
    }
  },

  async addDependency(taskId, depType, depConfig) {
    try {
      const response = await tauriService.addTaskDependency(taskId, depType, depConfig);
      if (response.success && response.data) {
        set((state) => {
          const currentDeps = state.dependencies[taskId] || [];
          return {
            dependencies: {
              ...state.dependencies,
              [taskId]: [...currentDeps, response.data as TaskDependency],
            },
          };
        });
        useToastStore.getState().addToast('依赖已添加', 'success');
      }
    } catch (err) {
      useToastStore.getState().addToast(`添加依赖失败: ${String(err)}`, 'error');
    }
  },

  async updateDependency(depId, depConfig) {
    try {
      const response = await tauriService.updateTaskDependency(depId, depConfig);
      if (response.success && response.data) {
        const updatedDep = response.data as TaskDependency;
        set((state) => {
          const taskId = updatedDep.taskId;
          const currentDeps = state.dependencies[taskId] || [];
          return {
            dependencies: {
              ...state.dependencies,
              [taskId]: currentDeps.map((d) => (d.id === depId ? updatedDep : d)),
            },
          };
        });
        useToastStore.getState().addToast('依赖已更新', 'success');
      }
    } catch (err) {
      useToastStore.getState().addToast(`更新依赖失败: ${String(err)}`, 'error');
    }
  },

  async deleteDependency(taskId, depId) {
    try {
      const response = await tauriService.deleteTaskDependency(depId);
      if (response.success && response.data) {
        set((state) => {
          const currentDeps = state.dependencies[taskId] || [];
          return {
            dependencies: {
              ...state.dependencies,
              [taskId]: currentDeps.filter((d) => d.id !== depId),
            },
          };
        });
        useToastStore.getState().addToast('依赖已删除', 'success');
      }
    } catch (err) {
      useToastStore.getState().addToast(`删除依赖失败: ${String(err)}`, 'error');
    }
  },

  async replaceDependencies(taskId, deps) {
    try {
      const response = await tauriService.replaceTaskDependencies(taskId, deps);
      if (response.success && response.data) {
        set((state) => ({
          dependencies: {
            ...state.dependencies,
            [taskId]: response.data as TaskDependency[],
          },
        }));
        useToastStore.getState().addToast('依赖已更新', 'success');
      }
    } catch (err) {
      useToastStore.getState().addToast(`更新依赖失败: ${String(err)}`, 'error');
    }
  },

  setTasksFromStartup(tasks) {
    const { enabledCount, failedCount, total } = tasks.reduce(
      (acc, t) => {
        acc.total++;
        if (t.state === 'enabled') acc.enabledCount++;
        if (t.lastRunStatus === 'failed') acc.failedCount++;
        return acc;
      },
      { enabledCount: 0, failedCount: 0, total: 0 }
    );
    set({
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        taskType: t.taskType as Task['taskType'],
        payload: '',
        scheduleMode: t.scheduleMode as Task['scheduleMode'],
        scheduleValue: t.scheduleValue,
        timezone: '',
        state: t.state as Task['state'],
        projectId: '',
        nextRunAt: t.nextRunAt,
        lastRunAt: null,
        lastRunStatus: t.lastRunStatus as Task['lastRunStatus'] | null,
        lastRunDurationMs: t.lastRunDurationMs,
        totalRuns: t.totalRuns,
        successRuns: t.successRuns,
        failedRuns: t.failedRuns,
        retryOnFail: 0,
        retryIntervalSecs: 60,
        timeoutSecs: 300,
        notifyOnSuccess: false,
        notifyOnFailure: false,
        tags: '',
        createdBy: '',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      stats: { total, enabledCount, failedTasksCount: failedCount },
    });
  },
}));
