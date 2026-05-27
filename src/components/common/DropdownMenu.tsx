import React, { useEffect, useRef, useState } from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';

interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ 
  trigger, 
  items, 
  position = 'bottom-left' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setIsOpen(!isOpen);
  const closeDropdown = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const getMenuPosition = () => {
    if (!triggerRef.current) return { top: 0, left: 0 };
    
    const rect = triggerRef.current.getBoundingClientRect();
    
    switch (position) {
      case 'bottom-left':
        return { top: rect.bottom + 4, left: rect.left };
      case 'bottom-right':
        return { top: rect.bottom + 4, right: window.innerWidth - rect.right };
      case 'top-left':
        return { bottom: window.innerHeight - rect.top + 4, left: rect.left };
      case 'top-right':
        return { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right };
      default:
        return { top: rect.bottom + 4, left: rect.left };
    }
  };

  const menuPosition = getMenuPosition();

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div ref={triggerRef} onClick={toggleDropdown}>
        {trigger}
      </div>
      
      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            ...menuPosition,
            background: Colors.background,
            border: `1px solid ${Colors.border}`,
            borderRadius: BorderRadius.md,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            padding: Spacing.xs,
            zIndex: 1000,
            minWidth: '160px',
          }}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                if (!item.disabled) {
                  item.onClick();
                  closeDropdown();
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
      )}
    </div>
  );
};
