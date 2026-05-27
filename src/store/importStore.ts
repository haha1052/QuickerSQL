import { create } from 'zustand';
import type { ImportItem } from '../types';

interface ImportState {
  importItems: ImportItem[];
  activeImportItemId: string | null;
  loading: boolean;
  hasHeader: boolean;
  
  setImportItems: (items: ImportItem[]) => void;
  addImportItems: (items: ImportItem[]) => void;
  updateImportItem: (id: string, updates: Partial<ImportItem>) => void;
  removeImportItem: (id: string) => void;
  clearImportItems: () => void;
  setActiveImportItemId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  toggleImportItemSelection: (id: string) => void;
  toggleParentWithChildren: (parentId: string) => void;
  toggleChildAndUpdateParent: (childId: string) => void;
  setAllSelected: (selected: boolean) => void;
  toggleAllSelected: () => void;
  setHasHeader: (hasHeader: boolean) => void;
}

export const useImportStore = create<ImportState>((set, get) => ({
  importItems: [],
  activeImportItemId: null,
  loading: false,
  hasHeader: true,

  setImportItems: (items) => set({ importItems: items }),
  
  addImportItems: (items) => set((state) => ({ 
    importItems: [...state.importItems, ...items] 
  })),
  
  updateImportItem: (id, updates) => set((state) => ({
    importItems: state.importItems.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  })),
  
  removeImportItem: (id) => set((state) => {
    const itemToRemove = state.importItems.find((item) => item.id === id);
    let filteredItems: ImportItem[];
    
    if (itemToRemove?.isParent) {
      const childIds = state.importItems
        .filter((item) => item.parentId === id)
        .map((item) => item.id);
      filteredItems = state.importItems.filter((item) => 
        item.id !== id && !childIds.includes(item.id)
      );
    } else {
      filteredItems = state.importItems.filter((item) => item.id !== id);
    }
    
    let newActiveId = state.activeImportItemId;
    if (state.activeImportItemId === id || 
        (itemToRemove?.parentId && state.activeImportItemId === itemToRemove.parentId)) {
      const remainingSelectable = filteredItems.filter((item) => !item.isParent);
      newActiveId = remainingSelectable.length > 0 ? remainingSelectable[0].id : null;
    }
    
    return { 
      importItems: filteredItems, 
      activeImportItemId: newActiveId 
    };
  }),
  
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
  
  toggleParentWithChildren: (parentId) => set((state) => {
    const parent = state.importItems.find((item) => item.id === parentId);
    if (!parent?.isParent) return state;
    
    const children = state.importItems.filter((item) => item.parentId === parentId);
    const allChildrenSelected = children.length > 0 && children.every((item) => item.selected);
    const newSelected = !allChildrenSelected;
    
    return {
      importItems: state.importItems.map((item) => {
        if (item.id === parentId || item.parentId === parentId) {
          return { ...item, selected: newSelected };
        }
        return item;
      }),
    };
  }),
  
  toggleChildAndUpdateParent: (childId) => set((state) => {
    const child = state.importItems.find((item) => item.id === childId);
    if (!child?.parentId) {
      return {
        importItems: state.importItems.map((item) =>
          item.id === childId ? { ...item, selected: !item.selected } : item
        ),
      };
    }
    
    const parentId = child.parentId;
    const newChildSelected = !child.selected;
    const siblings = state.importItems.filter((item) => item.parentId === parentId && item.id !== childId);
    const allSiblingsSelected = siblings.every((item) => item.selected);
    const parentShouldBeSelected = newChildSelected && allSiblingsSelected && siblings.length > 0;
    
    return {
      importItems: state.importItems.map((item) => {
        if (item.id === childId) {
          return { ...item, selected: newChildSelected };
        }
        if (item.id === parentId) {
          return { ...item, selected: parentShouldBeSelected };
        }
        return item;
      }),
    };
  }),
  
  setAllSelected: (selected) => set((state) => ({
    importItems: state.importItems.map((item) => 
      item.isParent ? { ...item, selected } : { ...item, selected }
    ),
  })),

  toggleAllSelected: () => {
    const state = get();
    const selectableItems = state.importItems.filter(item => !item.isParent);
    const allSelected = selectableItems.length > 0 && selectableItems.every(item => item.selected);
    
    set((currentState) => {
      const newSelected = !allSelected;
      return {
        importItems: currentState.importItems.map((item) => 
          ({ ...item, selected: newSelected })
        ),
      };
    });
  },
  
  setHasHeader: (hasHeader) => set({ hasHeader }),
}));
