import React from 'react';

interface DateRangePickerProps {
  label: string;
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label,
  startDate,
  endDate,
  onChange,
}) => {
  return (
    <div style={styles.container}>
      <span style={styles.label}>{label}</span>
      <div style={styles.inputGroup}>
        <input
          type="date"
          style={styles.input}
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
        />
        <span style={styles.separator}>—</span>
        <input
          type="date"
          style={styles.input}
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
        />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
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
  separator: {
    color: 'var(--text-tertiary)',
    fontSize: '12px',
  },
};
