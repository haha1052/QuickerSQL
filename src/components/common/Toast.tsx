import React, { useEffect, useRef, useState } from 'react';
import { useToastStore, type Toast as ToastItem } from '../../store';
import { useLocale } from '../../context/LocaleContext';

/**
 * i18n key 模式：以小写字母开头，至少一个点，无空格。
 *
 * 例如 'error.task.load_failed' 匹配；'Some plain text' 不匹配（避免
 * 对纯文本消息调用 `t()` 而产生 dev 模式下的 missing-key 警告）。
 */
const I18N_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+$/;

const looksLikeI18nKey = (s: string): boolean => I18N_KEY_PATTERN.test(s);

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
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const SingleToast: React.FC<SingleToastProps> = ({ toast, onRemove }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const { t } = useLocale();

  const styles = getToastStyles(toast.type);

  /**
   * 解析 toast.message 为可显示字符串：
   * - 对象形式 `{ key, vars }` → `t(key, vars)`
   * - 字符串形式：若匹配 i18n key 模式则 `t(msg)`，否则原样返回
   */
  const resolveMessage = (msg: ToastItem['message']): string => {
    if (typeof msg === 'string') {
      return looksLikeI18nKey(msg) ? t(msg) : msg;
    }
    return t(msg.key, msg.vars);
  };

  const displayMessage = resolveMessage(toast.message);

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
