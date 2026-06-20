import React from 'react';

interface TextFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const TextFilter: React.FC<TextFilterProps> = ({
  label,
  value,
  onChange,
  placeholder,
}) => {
  return (
    <div style={styles.container}>
      <span style={styles.label}>{label}</span>
      <input
        style={styles.input}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '160px',
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  input: {
    padding: '6px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '12px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
};
