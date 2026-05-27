import React, { useEffect, useRef, useState } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = x - rect.width;
      }

      if (y + rect.height > viewportHeight) {
        newY = y - rect.height;
      }

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        background: Colors.background,
        border: `1px solid ${Colors.border}`,
        borderRadius: BorderRadius.md,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        padding: Spacing.xs,
        zIndex: 1000,
        minWidth: '140px',
      }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            if (!item.disabled) {
              item.onClick();
              onClose();
            }
          }}
          disabled={item.disabled}
          style={{
            width: '100%',
            padding: `${Spacing.sm} ${Spacing.md}`,
            border: 'none',
            background: 'transparent',
            textAlign: 'left',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            fontSize: FontSizes.small,
            color: item.disabled ? Colors.textDisabled : item.danger ? Colors.danger : Colors.textPrimary,
            borderRadius: BorderRadius.sm,
            transition: 'background 0.2s',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
