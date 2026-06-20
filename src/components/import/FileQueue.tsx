import React from 'react';
import { ImportItem as ImportItemComponent } from './ImportItem';
import { useImportStore } from '../../store';
import { useLocale } from '../../context/LocaleContext';

interface FileQueueProps {
  onFileSelect: (id: string) => void;
}

export const FileQueue: React.FC<FileQueueProps> = ({ onFileSelect }) => {
  const {
    importItems,
    activeImportItemId,
    toggleParentWithChildren,
    toggleChildAndUpdateParent,
    updateImportItem,
    removeImportItem,
  } = useImportStore();
  const { t } = useLocale();

  const allItems = importItems;
  const parentExcelItems = allItems.filter(item => item.isParent && item.fileType === 'excel');
  const standaloneItems = allItems.filter(item => !item.isParent && !item.parentId);

  const displayItems: Array<{ item: any; children: any[] }> = [];

  parentExcelItems.forEach(parent => {
    const children = allItems.filter(child => child.parentId === parent.id);
    displayItems.push({ item: parent, children });
  });

  standaloneItems.forEach(item => {
    displayItems.push({ item, children: [] });
  });

  const handleToggleExpand = (itemId: string) => {
    const item = importItems.find(i => i.id === itemId);
    if (item) {
      updateImportItem(itemId, { isExpanded: !item.isExpanded });
    }
  };

  const handleParentSelect = (itemId: string) => {
    const item = importItems.find(i => i.id === itemId);
    if (item?.isParent) {
      handleToggleExpand(itemId);
    } else {
      onFileSelect(itemId);
    }
  };

  const handleChildSelect = (childId: string) => {
    onFileSelect(childId);
  };

  const handleChildToggleSelect = (childId: string) => {
    toggleChildAndUpdateParent(childId);
  };

  const handleChildTableNameChange = (childId: string, tableName: string) => {
    updateImportItem(childId, { tableName });
  };

  const handleParentToggleSelect = (parentId: string) => {
    toggleParentWithChildren(parentId);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerText}>{t('import.fileQueue')}</span>
      </div>
      <div style={styles.list}>
        {displayItems.map(({ item, children }) => (
          <ImportItemComponent
            key={item.id}
            item={item}
            isActive={activeImportItemId === item.id}
            onSelect={() => handleParentSelect(item.id)}
            onToggleSelect={() => handleParentToggleSelect(item.id)}
            onUpdateTableName={(name) => updateImportItem(item.id, { tableName: name })}
            onRemove={() => {
              if (item.isParent) {
                children.forEach(c => removeImportItem(c.id));
              }
              removeImportItem(item.id);
            }}
            onToggleExpand={() => handleToggleExpand(item.id)}
            childItems={children}
            onChildSelect={handleChildSelect}
            onChildToggleSelect={handleChildToggleSelect}
            onChildTableNameChange={handleChildTableNameChange}
            activeItemId={activeImportItemId}
          />
        ))}
        {displayItems.length === 0 && (
          <div style={styles.emptyState}>
            {t('import.noFiles')}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '380px',
    borderRight: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
  },
  headerText: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  emptyState: {
    padding: '40px 16px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
};
