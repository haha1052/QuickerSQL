import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  maxToasts: number;
  addToast: (message: string, type?: ToastType, duration?: number) => string;
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
