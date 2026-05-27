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
          background: '#d4edda',
          color: '#155724',
          borderColor: '#c3e6cb',
        };
      case 'error':
        return {
          background: '#f8d7da',
          color: '#721c24',
          borderColor: '#f5c6cb',
        };
      case 'warning':
        return {
          background: '#fff3cd',
          color: '#856404',
          borderColor: '#ffeaa7',
        };
      default:
        return {
          background: '#d1ecf1',
          color: '#0c5460',
          borderColor: '#bee5eb',
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
