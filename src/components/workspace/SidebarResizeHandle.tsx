import React, { useCallback, useState } from 'react';
import {
  useWorkspaceStore,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
} from '../../store';
import { useLocale } from '../../context/LocaleContext';

/**
 * 侧栏可拖拽宽度调整手柄。
 *
 * 设计要点：
 * 1. 拖拽期间**直接操作外层 #sidebar-container 的 style.width**（原生 DOM），
 *    不经过 React state，避免每帧 re-render。
 * 2. 只在 **mouseup 时**把最终宽度写一次 Zustand（用于持久化）。
 * 3. 拖拽期间在 document.body 上设置 cursor + user-select，
 *    避免 textarea / 其他交互元素抢鼠标事件。
 * 4. hover 时中间 2px 竖线变主色，提示可拖拽。
 * 5. 双击复位到 SIDEBAR_DEFAULT_WIDTH。
 */
export const SidebarResizeHandle: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const { t } = useLocale();

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const handle = e.currentTarget as HTMLDivElement;
    const container = handle.parentElement as HTMLDivElement | null;
    if (!container) return;

    const startX = e.clientX;
    const startWidth = container.clientWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta));
      container.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      // 最终宽度只写一次 Zustand
      const finalWidth = container.clientWidth;
      const store = useWorkspaceStore.getState();
      store.setSidebarWidth(finalWidth);
      store.triggerAutoSave();

      // 恢复全局样式
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      handle.style.background = '';
    };

    // 拖拽期间：全局禁选文字 + 统一光标
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const onDoubleClick = useCallback(() => {
    const container = document.getElementById('sidebar-container') as HTMLDivElement | null;
    if (!container) return;
    container.style.width = `${SIDEBAR_DEFAULT_WIDTH}px`;

    const store = useWorkspaceStore.getState();
    store.setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    store.triggerAutoSave();
  }, []);

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={t('sidebar.resizeHint')}
      style={{
        position: 'absolute',
        top: 0,
        right: -4,
        width: 8,
        height: '100%',
        cursor: 'col-resize',
        background: 'transparent',
        zIndex: 10,
        transition: 'background 0.15s',
      }}
    >
      {/* 中间 2px 可见竖线（hover 时变主色） */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 3,
          width: 2,
          height: '100%',
          background: isHovered ? 'var(--primary)' : 'var(--border-primary)',
        }}
      />
    </div>
  );
};

export default SidebarResizeHandle;
