export const Colors = {
  primary: 'var(--primary)',
  primaryDark: '#0056b3',
  primaryLight: 'var(--primary-bg)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--error)',
  info: 'var(--info, #17a2b8)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textDisabled: '#999999',
  border: 'var(--border-primary)',
  borderLight: 'var(--border-secondary)',
  background: 'var(--bg-secondary)',
  backgroundLight: 'var(--bg-tertiary)',
  backgroundDark: 'var(--bg-primary)',
} as const;

export const Spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
} as const;

export const FontSizes = {
  h1: '18px',
  h2: '16px',
  body: '14px',
  small: '13px',
  caption: '12px',
} as const;

export const BorderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
} as const;
