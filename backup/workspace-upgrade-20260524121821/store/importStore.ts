import { create } from 'zustand';
import type { ImportItem } from '../types';

interface ImportState {
  importItems: ImportItem[];
  activeImportItemId: string | null;
  loading: boolean;
  
  setImportItems: (items: ImportItem[]) => void;
  addImportItems: (items: ImportItem[]) => void;
  updateImportItem: (id: string, updates: Partial<ImportItem>) => void;
  removeImportItem: (id: string) => void;
  clearImportItems: () => void;
  setActiveImportItemId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  toggleImportItemSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  importItems: [],
  activeImportItemId: null,
  loading: false,

  setImportItems: (items) => set({ importItems: items }),
  
  addImportItems: (items) => set((state) => ({ 
    importItems: [...state.importItems, ...items] 
  })),
  
  updateImportItem: (id, updates) => set((state) => ({
    importItems: state.importItems.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  })),
  
  removeImportItem: (id) => set((state) => ({
    importItems: state.importItems.filter((item) => item.id !== id),
    activeImportItemId: state.activeImportItemId === id 
      ? (state.importItems.find((item) => item.id !== id)?.id || null)
      : state.activeImportItemId,
  })),
  
  clearImportItems: () => set({ 
    importItems: [], 
    activeImportItemId: null 
  }),
  
  setActiveImportItemId: (id) => set({ activeImportItemId: id }),
  
  setLoading: (loading) => set({ loading }),
  
  toggleImportItemSelection: (id) => set((state) => ({
    importItems: state.importItems.map((item) =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ),
  })),
  
  selectAll: () => set((state) => ({
    importItems: state.importItems.map((item) => ({ ...item, selected: true })),
  })),
  
  deselectAll: () => set((state) => ({
    importItems: state.importItems.map((item) => ({ ...item, selected: false })),
  })),
}));
