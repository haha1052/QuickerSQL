import React from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';
import { useLocale } from '../../context/LocaleContext';

interface ErrorBoundaryInnerProps {
  children: React.ReactNode;
  onReset?: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** P2-18：重试次数，作为 children 的 key 强制重置子树，避免错误状态残留 */
  retryCount: number;
}

/**
 * 错误边界类组件（内部实现）
 *
 * 类组件无法直接使用 hooks，因此通过外层 `ErrorBoundary` 函数组件包装，
 * 由外层调用 `useLocale()` 获取 `t()` 并通过 prop 注入。
 *
 * P2-18：handleRetry 时通过递增 retryCount 并将其作为 children 的 key，
 * 强制 React 卸载旧子树并重新挂载新子树，避免错误状态下子组件内部状态残留。
 */
class ErrorBoundaryInner extends React.Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleRetry = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    // P2-18：递增 retryCount 触发子树重置（见 render 中的 key={retryCount}）
    this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
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

    // P2-18：用 retryCount 作为 Fragment key，retryCount 变化时 React 会卸载旧子树并重新挂载，
    // 确保子组件内部错误状态（如表单脏数据、loading 残留）被完全重置
    return (
      <React.Fragment key={this.state.retryCount}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

/**
 * 错误边界公开导出（函数组件包装层）
 *
 * 负责通过 `useLocale()` 获取 `t()`，再传给内部类组件用于 i18n 翻译。
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
