import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean; // 分隔符
}

export interface ContextMenuProps {
  x: number;           // 鼠标 X
  y: number;           // 鼠标 Y
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  // 计算溢出：若菜单超出右边缘或下边缘，则翻转
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x;
      let top = y;
      if (rect.right > vw) left = vw - rect.width - 8;
      if (rect.bottom > vh) top = vh - rect.height - 8;
      setMenuPos({ left, top });
    }
  }, [x, y]);

  // 点击外部或按 ESC 关闭
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: menuPos.left,
        top: menuPos.top,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: '6px',
        padding: '4px',
        minWidth: '200px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        zIndex: 9999,
      }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${idx}`}
              style={{
                height: 1,
                background: 'var(--border-primary)',
                margin: '4px 0',
              }}
            />
          );
        }
        return (
          <button
            key={item.label}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              border: 'none',
              background: 'transparent',
              color: item.danger ? 'var(--danger-color, #d9534f)' : 'var(--text-primary)',
              borderRadius: '4px',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.5 : 1,
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
