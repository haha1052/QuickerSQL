import React, { useState } from 'react';
import { DateRangePicker } from './DateRangePicker';
import { SelectFilter } from './SelectFilter';
import { TextFilter } from './TextFilter';
import { useDashboardStore } from '../../../store';
import { useLocale } from '../../../context/LocaleContext';
import type { DashboardFilter } from '../../../types/dashboard';

interface DashboardFilterBarProps {
  filters: DashboardFilter[];
}

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  filters,
}) => {
  const { filterValues, setFilterValue, resetFilters, refreshCharts } = useDashboardStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useLocale();

  if (filters.length === 0) {
    return null;
  }

  const handleDateRange = (
    field: string,
    startDate: string,
    endDate: string
  ) => {
    setFilterValue(field, `${startDate}|${endDate}`);
  };

  const handleApply = () => {
    refreshCharts();
  };

  const hasActiveFilters = Object.keys(filterValues).some(
    (k) => filterValues[k] !== ''
  );

  return (
    <div style={styles.bar}>
      <div style={styles.barHeader}>
        <span style={styles.barTitle}>筛选器</span>
        <button
          style={styles.toggleBtn}
          onClick={() => setIsCollapsed((v) => !v)}
        >
          {isCollapsed ? t('dashboard.expand') : t('dashboard.collapse')}
        </button>
      </div>

      {!isCollapsed && (
        <div style={styles.barContent}>
          <div style={styles.filterGrid}>
            {filters.map((f) => {
              const val = filterValues[f.field] ?? f.defaultValue;

              if (f.type === 'date-range') {
                const valStr = typeof val === 'string' ? val : val.join('|');
                const parts = valStr.split('|');
                return (
                  <DateRangePicker
                    key={f.id}
                    label={f.label}
                    startDate={parts[0] || ''}
                    endDate={parts[1] || ''}
                    onChange={(start, end) => handleDateRange(f.field, start, end)}
                  />
                );
              }

              if (f.type === 'select') {
                return (
                  <SelectFilter
                    key={f.id}
                    label={f.label}
                    options={f.options || []}
                    value={typeof val === 'string' ? val : val.join(',')}
                    onChange={(v) => setFilterValue(f.field, v)}
                    placeholder={t('filter.all')}
                  />
                );
              }

              return (
                <TextFilter
                  key={f.id}
                  label={f.label}
                  value={typeof val === 'string' ? val : val.join('')}
                  onChange={(v) => setFilterValue(f.field, v)}
                  placeholder={t('common.inputPlaceholder')}
                />
              );
            })}
          </div>

          <div style={styles.barActions}>
            <button
              style={styles.resetBtn}
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              重置
            </button>
            <button style={styles.applyBtn} onClick={handleApply}>
              应用筛选
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '10px 16px',
  },
  barHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  barTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '0.3px',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px 4px',
  },
  barContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  filterGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'flex-start',
  },
  barActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '4px',
  },
  resetBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  applyBtn: {
    padding: '6px 14px',
    background: 'var(--primary)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  },
};
