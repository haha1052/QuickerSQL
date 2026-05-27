import React from 'react';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../styles/design-system';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  startIcon,
  endIcon,
  children,
  className,
  style,
  disabled,
  ...props
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.sm,
    fontSize: size === 'sm' ? FontSizes.small : size === 'lg' ? FontSizes.h2 : FontSizes.body,
    fontWeight: 500,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.6 : 1,
    ...(size === 'sm' && {
      padding: '6px 12px',
    }),
    ...(size === 'md' && {
      padding: '8px 16px',
    }),
    ...(size === 'lg' && {
      padding: '10px 20px',
    }),
  };

  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: Colors.primary,
      color: Colors.background,
      borderColor: Colors.primary,
    },
    secondary: {
      background: '#6c757d',
      color: Colors.background,
      borderColor: '#6c757d',
    },
    outline: {
      background: 'transparent',
      color: Colors.primary,
      borderColor: Colors.border,
    },
    danger: {
      background: Colors.danger,
      color: Colors.background,
      borderColor: Colors.danger,
    },
  };

  return (
    <button
      className={className}
      style={{ ...baseStyles, ...variantStyles[variant], ...style }}
      disabled={disabled}
      {...props}
    >
      {startIcon}
      {children}
      {endIcon}
    </button>
  );
};
