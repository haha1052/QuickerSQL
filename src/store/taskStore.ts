import { create } from 'zustand';
import type { Task, TaskRun, CreateTaskPayload, UpdateTaskPayload, TaskListResponse, TaskState } from '../types/automation';
import { tauriService } from '../services/tauri';
import { useToastStore } from './toastStore';

interface TaskStoreState {
  tasks: Task[];
  selectedTaskId: string | null;
  taskRuns: TaskRun[];
  /** 整体是否处于加载状态（向后兼容，UI 仍可直接引用） */
  loading: boolean;
  /** 当前正在执行的操作名，如 `'loadTasks'` / `'createTask'` / `'updateTask'` / `'deleteTask'` / `'enableTask'` / `'disableTask'` / `'runTaskNow'` */
  loadingAction: string | null;
  /** 当 loadingAction 与特定任务相关时，记录该任务 id；列表操作（如 loadTasks）为 null */
  loadingTaskId: string | null;
  error: string | null;
  filterState: TaskState | 'all';
  filterType: string;
  keyword: string;
  stats: { total: number; enabledCount: number; failedTasksCount: number };

  /** 判断某操作是否正在进行 —— UI 可按操作名做粒度化的 loading 展示 */
  isActionLoading: (action: string, taskId?: string | null) => boolean;
  loadTasks: () => Promise<void>;
  selectTask: (id: string | null) => void;
  createTask: (payload: CreateTaskPayload) => Promise<Task | null>;
  updateTask: (id: string, patch: UpdateTaskPayload) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  enableTask: (id: string) => Promise<Task | null>;
  disableTask: (id: string) => Promise<Task | null>;
  runTaskNow: (id: string) => Promise<TaskRun | null>;
  loadTaskRuns: (taskId: string, limit?: number) => Promise<void>;
  setFilterState: (s: TaskState | 'all') => void;
  setFilterType: (t: string) => void;
  setKeyword: (k: string) => void;
  // v3 启动优化：直接消费 get_startup_status 缓存的数据，避免独立 IPC
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

/** 统一的 startLoading / endLoading helper，避免每个 action 重复写 set 字段 */
function startLoading(set: (partial: Partial<TaskStoreState>) => void, action: string, taskId: string | null = null) {
  set({ loading: true, loadingAction: action, loadingTaskId: taskId, error: null });
}
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
