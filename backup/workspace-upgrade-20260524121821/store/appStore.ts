import { create } from 'zustand';
import type { TabType, DatabaseStatus } from '../types';

interface AppState {
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

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'csv',
  message: '',
  messageType: 'info',
  isLoading: false,
  allDatabaseStatus: [],

  setActiveTab: (tab) => set({ activeTab: tab }),
  
  setMessage: (message, type = 'info') => set({ message, messageType: type }),
  
  clearMessage: () => set({ message: '', messageType: 'info' }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setAllDatabaseStatus: (status) => set({ allDatabaseStatus: status }),
}));
