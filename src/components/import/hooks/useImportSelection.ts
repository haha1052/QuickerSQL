import { useCallback, useMemo } from 'react';
import { useImportStore } from '../../../store';
import type { ImportItem } from '../../../types';

export function useImportSelection() {
  const {
    importItems,
    toggleImportItemSelection,
    toggleParentWithChildren,
    toggleChildAndUpdateParent,
    toggleAllSelected,
  } = useImportStore();

  const getParentCheckboxState = useCallback(
    (parentId: string) => {
      const children = importItems.filter((i) => i.parentId === parentId);
      if (children.length === 0) return 'unchecked';

      const selectedCount = children.filter((i) => i.selected).length;
      if (selectedCount === 0) return 'unchecked';
      if (selectedCount === children.length) return 'checked';
      return 'indeterminate';
    },
    [importItems]
  );

  const handleToggleSelect = useCallback(
    (item: ImportItem) => {
      if (item.isParent) {
        toggleParentWithChildren(item.id);
      } else if (item.parentId) {
        toggleChildAndUpdateParent(item.id);
      } else {
        toggleImportItemSelection(item.id);
      }
    },
    [toggleParentWithChildren, toggleChildAndUpdateParent, toggleImportItemSelection]
  );

  const getChildItems = useCallback(
    (parentId: string) => {
      return importItems.filter((i) => i.parentId === parentId);
    },
    [importItems]
  );

  const selectableItems = useMemo(() => {
    return importItems.filter((item) => !item.isParent);
  }, [importItems]);

  const selectedItems = useMemo(() => {
    return importItems.filter((item) => item.selected);
  }, [importItems]);

  const allSelected = useMemo(() => {
    return selectableItems.length > 0 && selectableItems.every((item) => item.selected);
  }, [selectableItems]);

  return {
    getParentCheckboxState,
    handleToggleSelect,
    getChildItems,
    selectableItems,
    selectedItems,
    allSelected,
    toggleAllSelected,
  };
}
