import React, { useState, useMemo } from 'react';
import type { ImportItem as ImportItemType } from '../../types';
import { CheckCircleIcon, XCircleIcon, LoaderIcon } from '../common/Icons';
import { ChevronDownIcon, ChevronRightIcon } from '../common/Icons';
import { useImportSelection } from './hooks/useImportSelection';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';

interface ImportItemProps {
  item: ImportItemType;
  isActive: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onUpdateTableName: (tableName: string) => void;
  onRemove: () => void;
  onToggleExpand?: () => void;
  childItems?: ImportItemType[];
  onChildSelect?: (childId: string) => void;
  onChildToggleSelect?: (childId: string) => void;
  onChildTableNameChange?: (childId: string, tableName: string) => void;
  activeItemId?: string | null;
}

export const ImportItem: React.FC<ImportItemProps> = ({
  item,
  isActive,
  onSelect,
  onToggleSelect,
  onUpdateTableName,
  onRemove,
  onToggleExpand,
  childItems = [],
  onChildSelect,
  onChildToggleSelect,
  onChildTableNameChange,
  activeItemId,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.tableName);
  const { getParentCheckboxState } = useImportSelection();

  const isParent = item.isParent;

  const parentCheckboxState = useMemo(() => {
    if (!isParent) return item.selected ? 'checked' : 'unchecked';
    return getParentCheckboxState(item.id);
  }, [isParent, item.id, getParentCheckboxState]);

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== item.tableName) {
      onUpdateTableName(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(item.tableName);
      setIsEditing(false);
    }
  };

  const renderStatusIcon = () => {
    switch (item.status) {
      case 'success':
        return <CheckCircleIcon size={16} color={Colors.success} />;
      case 'error':
        return <XCircleIcon size={16} color={Colors.danger} />;
      case 'importing':
        return <LoaderIcon size={16} color={Colors.primary} />;
      default:
        return null;
    }
  };

  const isExcel = item.fileType === 'excel';

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.itemRow,
          background: isActive ? Colors.primaryLight : Colors.background,
          borderLeft: isActive ? `3px solid ${Colors.primary}` : '3px solid transparent',
        }}
        onClick={onSelect}
      >
        {isParent ? (
          <div style={styles.parentCheckboxWrapper}>
            <input
              type="checkbox"
              checked={parentCheckboxState === 'checked'}
              ref={(el) => {
                if (el) {
                  el.indeterminate = parentCheckboxState === 'indeterminate';
                }
              }}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              style={styles.checkbox}
            />
          </div>
        ) : (
          <input
            type="checkbox"
            checked={item.selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            style={styles.checkbox}
          />
        )}

        {isExcel && (
          <button
            style={styles.expandBtn}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
          >
            {item.isExpanded ? (
              <ChevronDownIcon size={14} />
            ) : (
              <ChevronRightIcon size={14} />
            )}
          </button>
        )}

        <span style={styles.fileName}>
          {item.sheetName || item.fileName}
        </span>

        {!isExcel && (
          <div style={styles.tableNameWrapper}>
            <span style={styles.tableNameLabel}>表名:</span>
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                style={styles.tableNameInput}
                autoFocus
              />
            ) : (
              <span
                style={styles.tableName}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              >
                {item.tableName}
              </span>
            )}
          </div>
        )}

        {renderStatusIcon()}

        {!item.isParent && (
          <button
            style={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        )}
      </div>

      {isExcel && item.isExpanded && childItems.length > 0 && (
        <div style={styles.childContainer}>
          {childItems.map((child) => (
            <ExcelSheetItem
              key={child.id}
              item={child}
              isActive={activeItemId === child.id}
              onSelect={() => onChildSelect?.(child.id)}
              onToggleSelect={() => onChildToggleSelect?.(child.id)}
              onUpdateTableName={(name) => onChildTableNameChange?.(child.id, name)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ExcelSheetItemProps {
  item: ImportItemType;
  isActive: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onUpdateTableName: (tableName: string) => void;
}

const ExcelSheetItem: React.FC<ExcelSheetItemProps> = ({
  item,
  isActive,
  onSelect,
  onToggleSelect,
  onUpdateTableName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.tableName);

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== item.tableName) {
      onUpdateTableName(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(item.tableName);
      setIsEditing(false);
    }
  };

  return (
    <div
      style={{
        ...styles.sheetItemRow,
        background: isActive ? Colors.primaryLight : Colors.background,
        borderLeft: isActive ? `3px solid ${Colors.primary}` : '3px solid transparent',
      }}
      onClick={onSelect}
    >
      <div style={styles.indentLine}></div>
      
      <input
        type="checkbox"
        checked={item.selected}
        onChange={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        style={styles.checkbox}
      />

      <span style={styles.sheetLabel}>{item.sheetName}</span>
      <span style={styles.arrow}>→</span>

      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={styles.tableNameInput}
          autoFocus
        />
      ) : (
        <span
          style={styles.tableName}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          {item.tableName}
        </span>
      )}

      {item.status === 'success' && <CheckCircleIcon size={14} color={Colors.success} />}
      {item.status === 'error' && <XCircleIcon size={14} color={Colors.danger} />}
      {item.status === 'importing' && <LoaderIcon size={14} color={Colors.primary} />}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: `${Spacing.sm} ${Spacing.lg}`,
    cursor: 'pointer',
    transition: 'background 0.2s',
    borderBottom: `1px solid ${Colors.borderLight}`,
  },
  sheetItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: `${Spacing.sm} ${Spacing.lg} ${Spacing.sm} 40px`,
    cursor: 'pointer',
    transition: 'background 0.2s',
    borderBottom: `1px solid ${Colors.borderLight}`,
    position: 'relative',
  },
  parentCheckboxWrapper: {
    display: 'flex',
    alignItems: 'center',
  },
  checkbox: {
    cursor: 'pointer',
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: Spacing.xs,
    color: Colors.textSecondary,
  },
  fileName: {
    flex: 1,
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sheetLabel: {
    fontSize: FontSizes.small,
    color: Colors.textSecondary,
  },
  arrow: {
    color: Colors.textDisabled,
    fontSize: FontSizes.caption,
  },
  tableNameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '180px',
  },
  tableNameLabel: {
    fontSize: FontSizes.caption,
    color: Colors.textDisabled,
    whiteSpace: 'nowrap',
  },
  tableName: {
    fontSize: FontSizes.small,
    color: Colors.primary,
    padding: '2px 6px',
    borderRadius: BorderRadius.sm,
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
  },
  tableNameInput: {
    fontSize: FontSizes.small,
    padding: '2px 6px',
    border: `1px solid ${Colors.primary}`,
    borderRadius: BorderRadius.sm,
    outline: 'none',
    width: '120px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: Colors.textDisabled,
    cursor: 'pointer',
    fontSize: FontSizes.h1,
    padding: '0 4px',
    opacity: 0.6,
  },
  childContainer: {
    background: Colors.backgroundLight,
    borderLeft: `2px solid ${Colors.border}`,
    marginLeft: Spacing.lg,
  },
  indentLine: {
    position: 'absolute',
    left: '26px',
    top: '0',
    bottom: '0',
    width: '2px',
    background: Colors.border,
  },
};
