import React, { useEffect, useRef, useState } from 'react';
import { useToastStore, type Toast as ToastItem } from '../../store';
import { useLocale } from '../../context/LocaleContext';

/**
 * 根据 Toast 类型返回背景/文字/边框配色
 * @param type - Toast 类型（success / error / warning / 其他默认 info）
 * @returns 包含 background、color、borderColor 的样式对象
 */
const getToastStyles = (type: ToastItem['type']) => {
  switch (type) {
    case 'success':
      return {
        background: 'var(--success-bg)',
        color: 'var(--success)',
        borderColor: 'var(--success)',
      };
    case 'error':
      return {
        background: 'var(--error-bg)',
        color: 'var(--error)',
        borderColor: 'var(--error)',
      };
    case 'warning':
      return {
        background: 'var(--warning-bg)',
        color: 'var(--warning)',
        borderColor: 'var(--warning)',
      };
    default:
      return {
        background: 'var(--primary-bg)',
        color: 'var(--primary)',
        borderColor: 'var(--primary)',
      };
  }
};

/**
 * 根据 Toast 类型返回对应的 emoji 图标
 * @param type - Toast 类型
 * @returns 对应的 emoji 字符串
 */
const getIcon = (type: ToastItem['type']) => {
  switch (type) {
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    default:
      return 'ℹ️';
  }
};

interface SingleToastProps {
  /** 单条 Toast 数据，包含 id、type、message、duration 等 */
  toast: ToastItem;
  /** 移除 Toast 的回调，参数为 Toast id；动画结束后触发 */
  onRemove: (id: string) => void;
}

/**
 * 单条 Toast 组件
 *
 * 职责：
 * - 渲染单条 Toast（图标 + 消息 + 关闭按钮）
 * - 自动倒计时关闭（duration 为 0 时不自动关闭）
 * - 鼠标悬停时暂停倒计时，移开后继续剩余时长
 * - 关闭时先触发淡出动画（200ms）再调用 onRemove
 *
 * 副作用：
 * - 通过 setTimeout 实现倒计时
 * - 通过 useEffect 响应 isPaused 与 toast.duration 变化
 *
 * @param props - 见 SingleToastProps
 */
const SingleToast: React.FC<SingleToastProps> = ({ toast, onRemove }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const { t } = useLocale();

  const styles = getToastStyles(toast.type);

  // 当 message 是 { key, vars } 对象时，调用 t() 翻译；否则直接显示 string
  const displayMessage = typeof toast.message === 'string'
    ? toast.message
    : t(toast.message.key, toast.message.vars);

  useEffect(() => {
    if (toast.duration === 0) return;

    const startTimer = (remaining: number) => {
      startTimeRef.current = Date.now();
      timerRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, remaining);
    };

    startTimer(toast.duration);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        if (startTimeRef.current !== null) {
          elapsedRef.current += Date.now() - startTimeRef.current;
        }
      }
    };
  }, [toast.duration]);

  useEffect(() => {
    if (isPaused && timerRef.current !== null && startTimeRef.current !== null) {
      window.clearTimeout(timerRef.current);
      elapsedRef.current += Date.now() - startTimeRef.current;
      timerRef.current = null;
      startTimeRef.current = null;
    } else if (!isPaused && toast.duration !== 0 && timerRef.current === null) {
      const remaining = toast.duration - elapsedRef.current;
      if (remaining > 0) {
        startTimeRef.current = Date.now();
        timerRef.current = window.setTimeout(() => {
          setIsVisible(false);
        }, remaining);
      } else {
        setIsVisible(false);
      }
    }
  }, [isPaused, toast.duration]);

  useEffect(() => {
    if (!isVisible) {
      const cleanupTimer = window.setTimeout(() => {
        onRemove(toast.id);
      }, 200);
      return () => window.clearTimeout(cleanupTimer);
    }
  }, [isVisible, toast.id, onRemove]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        minWidth: 320,
        maxWidth: 360,
        padding: '12px 16px',
        borderRadius: 8,
        background: styles.background,
        color: styles.color,
        border: `1px solid ${styles.borderColor}`,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        position: 'relative',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>{getIcon(toast.type)}</span>
      <span style={{ flex: 1, lineHeight: 1.5, wordBreak: 'break-word', fontSize: 14 }}>
        {displayMessage}
      </span>
      <button
        onClick={() => {
          setIsVisible(false);
        }}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 20,
          cursor: 'pointer',
          padding: '0 0 0 8px',
          opacity: 0.7,
          color: styles.color,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
};

/**
 * Toast 容器组件
 *
 * 职责：
 * - 固定在屏幕右上角（top: 72px, right: 24px）
 * - 从 useToastStore 读取所有 toasts 并渲染为 SingleToast 列表
 * - 容器本身 pointerEvents: 'none'，单条 Toast 重新启用 'auto' 以支持悬停
 *
 * 用法：在应用根节点挂载一次即可，配合 useToastStore.addToast 使用
 */
export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      style={{
        position: 'fixed',
        top: 72,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 360,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <SingleToast toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
};
