import React from 'react';

interface SelectFilterProps {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SelectFilter: React.FC<SelectFilterProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder,
}) => {
  return (
    <div style={styles.container}>
      <span style={styles.label}>{label}</span>
      <select
        style={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '120px',
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  select: {
    padding: '6px 10px',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    fontSize: '12px',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
  },
};
