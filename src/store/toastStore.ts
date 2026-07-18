import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast 消息支持两种形式：
 * - string：直接显示的字符串（如已翻译文本、后端原始错误）
 * - { key, vars? }：i18n key + 翻译变量，由 Toast UI 组件调用 t() 翻译
 *
 * 设计原因：stores 不在 React 树内无法调用 useLocale()，所以通过对象形式传递 i18n key，
 * 由组件层（Toast.tsx）在渲染时翻译。组件层调用 addToast 时也可直接传 string。
 */
export type ToastMessage = string | { key: string; vars?: Record<string, string | number> };

export interface Toast {
  id: string;
  message: ToastMessage;
  type: ToastType;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  maxToasts: number;
  addToast: (message: ToastMessage, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const getDefaultDuration = (type: ToastType): number => {
  switch (type) {
    case 'success': return 3000;
    case 'warning': return 4000;
    case 'error': return 5000;
    default: return 3000;
  }
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  maxToasts: 5,

  addToast: (message, type = 'info', duration) => {
    const effectiveDuration = duration ?? getDefaultDuration(type);
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => {
      const next = [...state.toasts, { id, message, type, duration: effectiveDuration }];
      if (next.length > state.maxToasts) {
        next.splice(0, next.length - state.maxToasts);
      }
      return { toasts: next };
    });
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => set({ toasts: [] }),
}));
