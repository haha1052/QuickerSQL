import { create } from 'zustand';
import { useToastStore } from './toastStore';
import type { TabType, DatabaseStatus } from '../types';

// AppStoreState: 应用全局状态（不同于后端 Rust AppState）
interface AppStoreState {
  activeTab: TabType;
  message: string;
  messageType: 'success' | 'error' | 'info' | 'warning';
  isLoading: boolean;
  allDatabaseStatus: DatabaseStatus[];
  
  setActiveTab: (tab: TabType) => void;
  setMessage: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  clearMessage: () => void;
  setLoading: (loading: boolean) => void;
  setAllDatabaseStatus: (status: DatabaseStatus[]) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  activeTab: 'csv',
  message: '',
  messageType: 'info',
  isLoading: false,
  allDatabaseStatus: [],

  setActiveTab: (tab) => set({ activeTab: tab }),
  
  setMessage: (message, type = 'info') => {
    useToastStore.getState().addToast(message, type);
  },

  clearMessage: () => {
    useToastStore.getState().clearToasts();
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setAllDatabaseStatus: (status) => set({ allDatabaseStatus: status }),
}));
