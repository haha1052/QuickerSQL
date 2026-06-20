import React from 'react';

interface MessageProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose?: () => void;
}

export const Message: React.FC<MessageProps> = ({ message, type = 'info', onClose }) => {
  if (!message) return null;

  const getStyles = () => {
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

  const style = getStyles();

  return (
    <div style={{
      ...styles.message,
      background: style.background,
      color: style.color,
      borderBottom: `1px solid ${style.borderColor}`,
    }}>
      <span style={styles.text}>{message}</span>
      {onClose && (
        <button 
          style={styles.closeButton}
          onClick={onClose}
        >
          ×
        </button>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  message: {
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    flex: 1,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
    opacity: 0.7,
  },
};
