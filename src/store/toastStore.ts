import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast 消息内容类型
 *
 * 为了支持 i18n，store 不直接调用 `t()`（store 不在 React 树内），
 * 而是把 i18n key 与可选变量传给 Toast 组件层翻译。
 *
 * - `string`：原样显示（向后兼容）或匹配 i18n key 模式时由 Toast 组件翻译
 * - `{ key, vars }`：显式声明 i18n key + 变量，由 Toast 组件调用 `t(key, vars)` 翻译
 */
export type ToastMessage =
  | string
  | { key: string; vars?: Record<string, string | number> };

export interface Toast {
  id: string;
  message: ToastMessage;
  type: ToastType;
  duration: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  maxToasts: number;
  addToast: (message: ToastMessage, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const DEDUP_WINDOW_MS = 300;

const getDefaultDuration = (type: ToastType): number => {
  switch (type) {
    case 'success': return 3000;
    case 'warning': return 4000;
    case 'error': return 5000;
    default: return 3000;
  }
};

const getToastFingerprint = (message: ToastMessage, type: ToastType): string => {
  if (typeof message === 'string') {
    return `${type}::${message}`;
  }
  return `${type}::${message.key}::${JSON.stringify(message.vars ?? {})}`;
};

const messagesEqual = (a: ToastMessage, b: ToastMessage): boolean => {
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (typeof a === 'object' && typeof b === 'object') {
    return a.key === b.key && JSON.stringify(a.vars ?? {}) === JSON.stringify(b.vars ?? {});
  }
  return false;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  maxToasts: 5,

  addToast: (message, type = 'info', duration) => {
    const effectiveDuration = duration ?? getDefaultDuration(type);
    const fingerprint = getToastFingerprint(message, type);
    const now = Date.now();

    let existingId: string | null = null;
    set((state) => {
      for (const t of state.toasts) {
        if (
          getToastFingerprint(t.message, t.type) === fingerprint &&
          messagesEqual(t.message, message) &&
          (now - t.createdAt) < DEDUP_WINDOW_MS
        ) {
          existingId = t.id;
          break;
        }
      }
      if (existingId) {
        return {
          toasts: state.toasts.map((t) =>
            t.id === existingId ? { ...t, duration: effectiveDuration } : t
          ),
        };
      }
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...state.toasts, { id, message, type, duration: effectiveDuration, createdAt: now }];
      if (next.length > state.maxToasts) {
        next.splice(0, next.length - state.maxToasts);
      }
      return { toasts: next };
    });
    return existingId ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => set({ toasts: [] }),
}));