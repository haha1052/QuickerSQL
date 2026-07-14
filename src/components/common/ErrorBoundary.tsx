import React from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
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
      const errorMessage = this.state.error?.message ?? '未知错误';
      const displayMessage = errorMessage.length > 200 
        ? errorMessage.substring(0, 200) + '...' 
        : errorMessage;

      return (
        <div style={containerStyle}>
          <div style={cardStyle}>
            <div style={iconStyle}>⚠️</div>
            <h1 style={titleStyle}>出了点问题</h1>
            <p style={messageStyle}>{displayMessage}</p>
            <div style={buttonContainerStyle}>
              <button
                onClick={this.handleRetry}
                style={{ ...buttonStyle, ...primaryButtonStyle }}
              >
                重试
              </button>
              <button
                onClick={this.handleGoHome}
                style={{ ...buttonStyle, ...secondaryButtonStyle }}
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
