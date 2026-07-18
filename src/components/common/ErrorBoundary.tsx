import React from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useLocale } from '../../context/LocaleContext';

interface ErrorBoundaryInnerProps {
  /** 子组件树；发生错误时被替换为错误兜底 UI */
  children: React.ReactNode;
  /** 重置回调；点击「重试」时调用，由外层包装层传入 */
  onReset?: () => void;
  /** i18n 翻译函数（避免类组件无法使用 useLocale hook） */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

interface ErrorBoundaryState {
  /** 是否已捕获错误 */
  hasError: boolean;
  /** 捕获到的错误对象；无错误时为 null */
  error: Error | null;
}

/**
 * ErrorBoundary 内部类组件（接收 t 作为 prop，避免类组件无法使用 hooks 的限制）
 */
class ErrorBoundaryInner extends React.Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleRetry = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { t } = this.props;
      const errorMessage = this.state.error?.message ?? t('error.boundary.unknown');
      const displayMessage = errorMessage.length > 200
        ? errorMessage.substring(0, 200) + '...'
        : errorMessage;

      return (
        <div style={containerStyle}>
          <div style={cardStyle}>
            <div style={iconStyle}>⚠️</div>
            <h1 style={titleStyle}>{t('error.boundary.title')}</h1>
            <p style={messageStyle}>{displayMessage}</p>
            <div style={buttonContainerStyle}>
              <button
                onClick={this.handleRetry}
                style={{ ...buttonStyle, ...primaryButtonStyle }}
              >
                {t('error.boundary.retry')}
              </button>
              <button
                onClick={this.handleGoHome}
                style={{ ...buttonStyle, ...secondaryButtonStyle }}
              >
                {t('error.boundary.goHome')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * ErrorBoundary 公开导出（函数组件包装层，注入 t()）
 *
 * 用法：
 * ```tsx
 * <ErrorBoundary onReset={handleReset}>
 *   <App />
 * </ErrorBoundary>
 * ```
 *
 * @param props.children - 受保护的子组件树
 * @param props.onReset - 可选的重置回调，点击「重试」时与内部 state 一并触发
 */
export const ErrorBoundary: React.FC<{
  children: React.ReactNode;
  onReset?: () => void;
}> = ({ children, onReset }) => {
  const { t } = useLocale();
  return (
    <ErrorBoundaryInner t={t} onReset={onReset}>
      {children}
    </ErrorBoundaryInner>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  width: '100%',
  background: 'var(--bg-primary)',
  padding: Spacing.xl,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  borderRadius: BorderRadius.lg,
  padding: Spacing.xxl,
  maxWidth: '480px',
  width: '100%',
  textAlign: 'center',
  boxShadow: 'var(--shadow)',
  border: '1px solid var(--border-primary)',
};

const iconStyle: React.CSSProperties = {
  fontSize: '48px',
  marginBottom: Spacing.lg,
};

const titleStyle: React.CSSProperties = {
  fontSize: FontSizes.h1,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: Spacing.md,
};

const messageStyle: React.CSSProperties = {
  fontSize: FontSizes.body,
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
  marginBottom: Spacing.xl,
  wordBreak: 'break-word',
};

const buttonContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: Spacing.md,
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const buttonStyle: React.CSSProperties = {
  padding: `${Spacing.sm} ${Spacing.lg}`,
  borderRadius: BorderRadius.sm,
  fontSize: FontSizes.body,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  border: '1px solid transparent',
};

const primaryButtonStyle: React.CSSProperties = {
  background: Colors.primary,
  color: Colors.background,
  borderColor: Colors.primary,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: Colors.primary,
  borderColor: Colors.border,
};
