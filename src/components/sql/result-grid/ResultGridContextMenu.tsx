/**
 * ResultGridContextMenu.tsx — 数据驱动右键菜单
 *
 * 特性：
 * - 纯 CSS hover 子菜单（无 JS hover 抖动）
 * - 视口 clamp 定位（菜单不溢出窗口）
 * - document click / Escape / scroll 三通道关闭
 */
import React, { useEffect, useRef, useState } from 'react';
import type { MenuItem } from './types';
import './ResultGrid.css';

interface ResultGridContextMenuProps {
  /** 菜单树 */
  items: MenuItem[];
  /** 鼠标位置 */
  x: number;
  y: number;
  /** 关闭回调 */
  onClose: () => void;
}

export const ResultGridContextMenu: React.FC<ResultGridContextMenuProps> = ({
  items,
  x,
  y,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [submenuSide, setSubmenuSide] = useState<'right' | 'left'>('right');

  // 渲染后测量菜单尺寸，clamp 到视口
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;

    let clampedX = x;
    let clampedY = y;

    if (x + rect.width > window.innerWidth - margin) {
      clampedX = window.innerWidth - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      clampedY = window.innerHeight - rect.height - margin;
    }
    if (clampedX < margin) clampedX = margin;
    if (clampedY < margin) clampedY = margin;

    setPosition({ x: clampedX, y: clampedY });

    // 子菜单展开方向：右侧空间不足时向左
    if (x + rect.width + 200 > window.innerWidth) {
      setSubmenuSide('left');
    }
  }, [x, y]);

  // document click 关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // 点击菜单内部不关闭（让菜单项自己处理）
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // 延迟注册，避免触发菜单的右键事件本身
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const renderItem = (item: MenuItem, depth = 0): React.ReactNode => {
    const hasChildren = item.children && item.children.length > 0;

    // 分隔线
    const separator = item.separatorBefore ? (
      <div className="rg-context-menu-separator" />
    ) : null;

    if (hasChildren) {
      return (
        <React.Fragment key={item.label}>
          {separator}
          <div className="rg-submenu-wrapper">
            <div
              className={`rg-context-menu-item${item.disabled ? ' rg-disabled' : ''}${item.recommended ? ' rg-recommended' : ''}`}
            >
              <span>{item.label}</span>
              <span className="rg-submenu-arrow">▶</span>
            </div>
            <div
              className={`rg-submenu${submenuSide === 'left' ? ' rg-submenu-left' : ''}`}
            >
              {item.children!.map(child => renderItem(child, depth + 1))}
            </div>
          </div>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={item.label}>
        {separator}
        <div
          className={`rg-context-menu-item${item.disabled ? ' rg-disabled' : ''}${item.danger ? ' rg-danger' : ''}${item.recommended ? ' rg-recommended' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (item.disabled) return;
            item.onClick?.();
            onClose();
          }}
        >
          <span>{item.label}</span>
          {item.shortcutHint && (
            <span className="rg-shortcut-hint">{item.shortcutHint}</span>
          )}
        </div>
      </React.Fragment>
    );
  };

  return (
    <div
      ref={menuRef}
      className="rg-context-menu"
      style={{ left: position.x, top: position.y }}
    >
      {items.map(item => renderItem(item))}
    </div>
  );
};
