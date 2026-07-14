import React, { useState } from 'react';
import { tauriService } from '../../services/tauri';
import { useLocale } from '../../context/LocaleContext';
import type { ProfileResult, ProfileColumnSummary } from '../../types/profile';

/**
 * 数据探查面板：对指定表或查询结果生成列级统计。
 *
 * props:
 * - `targetTableName`: 当传入时，按钮触发对该表的数据库探查。
 * - `targetResult`: 当传入 { columns, rows } 时，按钮触发对内存数据的探查。
 *   两者择一，后者优先（避免用户在 SQL 结果上产生歧义）。
 */

interface ProfilePanelProps {
  targetTableName?: string | null;
  targetResult?: { columns: string[]; rows: string[][] } | null;
  onClose?: () => void;
}

const empty = (): ProfileResult => ({
  target: '',
  rowCount: 0,
  columnCount: 0,
  columns: [],
  elapsedMs: 0,
  sampled: false,
  sampleSize: 0,
});

const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmt = (v: number | null | undefined) =>
  v == null ? '—' : Number.isInteger(v) ? v.toString() : v.toFixed(3);

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  targetTableName,
  targetResult,
  onClose,
}) => {
  const { t } = useLocale();
  const [result, setResult] = useState<ProfileResult>(empty());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTarget = Boolean(targetTableName) || Boolean(targetResult);
  const isEmpty = result.columns.length === 0 && !loading;

  const run = async (forceFull: boolean) => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (targetResult && targetResult.columns.length > 0) {
        res = await tauriService.profileResult(targetResult.columns, targetResult.rows);
      } else if (targetTableName) {
        res = await tauriService.profileTable(targetTableName, forceFull);
      } else {
        setError('请先选择表或运行 SQL 后再探查');
        return;
      }
      if (!res.success || !res.data) {
        throw new Error(res.error || '探查失败');
      }
      setResult(res.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.title}>📊 数据探查</div>
        <div style={styles.actions}>
          {targetTableName && !targetResult && (
            <button style={styles.secondaryBtn} onClick={() => run(true)} disabled={loading}>
              全量扫描
            </button>
          )}
          <button
            style={styles.primaryBtn}
            onClick={() => run(false)}
            disabled={!hasTarget || loading}
          >
            {loading ? '分析中...' : '开始探查'}
          </button>
          {onClose && (
            <button style={styles.secondaryBtn} onClick={onClose}>
              关闭
            </button>
          )}
        </div>
      </div>

      {result.target && (
        <div style={styles.meta}>
          <div>
            <span style={styles.metaLabel}>对象：</span>
            <span style={styles.metaValue}>{result.target}</span>
          </div>
          <div>
            <span style={styles.metaLabel}>{t('profile.rowCount')}</span>
            <span style={styles.metaValue}>{result.rowCount.toLocaleString()}</span>
          </div>
          <div>
            <span style={styles.metaLabel}>列数：</span>
            <span style={styles.metaValue}>{result.columnCount}</span>
          </div>
          {result.sampled && (
            <div style={{ color: '#d97706' }}>
              已采样（{result.sampleSize.toLocaleString()} 行，超过 5 万行自动采样）
            </div>
          )}
          <div>
            <span style={styles.metaLabel}>耗时：</span>
            <span style={styles.metaValue}>{result.elapsedMs} ms</span>
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {isEmpty && !loading && (
        <div style={styles.empty}>
          点击「开始探查」对 {targetTableName ? `表「${targetTableName}」` : '当前 SQL 结果'} 生成列级统计。
        </div>
      )}

      {result.columns.length > 0 && (
        <div style={styles.grid}>
          {result.columns.map((c) => (
            <ColumnCard key={c.columnName} summary={c} />
          ))}
        </div>
      )}
    </div>
  );
};

const ColumnCard: React.FC<{ summary: ProfileColumnSummary }> = ({ summary }) => {
  const s = summary;
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.colName}>{s.columnName}</div>
        <div style={{ ...styles.typeTag, background: s.isNumeric ? '#dbeafe' : '#f3f4f6', color: s.isNumeric ? '#1e40af' : '#374151' }}>
          {s.dataType || 'TEXT'}
        </div>
      </div>

      <div style={styles.statRow}>
        <div style={styles.statCell}>
          <div style={styles.statLabel}>非空</div>
          <div style={styles.statValue}>{s.nonNullCount.toLocaleString()}</div>
          <div style={styles.bar}>
            <div
              style={{
                ...styles.barFill,
                width: `${Math.min(100, (1 - s.nullRate) * 100).toFixed(1)}%`,
                background: '#10b981',
              }}
            />
          </div>
        </div>
        <div style={styles.statCell}>
          <div style={styles.statLabel}>空值率</div>
          <div style={styles.statValue}>{percent(s.nullRate)}</div>
          <div style={styles.bar}>
            <div
              style={{
                ...styles.barFill,
                width: `${(s.nullRate * 100).toFixed(1)}%`,
                background: s.nullRate > 0.3 ? '#ef4444' : '#6b7280',
              }}
            />
          </div>
        </div>
        <div style={styles.statCell}>
          <div style={styles.statLabel}>唯一值</div>
          <div style={styles.statValue}>
            {s.uniqueCount.toLocaleString()} ({percent(s.uniqueRate)})
          </div>
        </div>
      </div>

      {s.isNumeric && s.numeric.min != null && (
        <div style={styles.numericBox}>
          <div style={styles.numericTitle}>数值统计</div>
          <div style={styles.numericGrid}>
            <div><span style={styles.statLabel}>min </span>{fmt(s.numeric.min)}</div>
            <div><span style={styles.statLabel}>max </span>{fmt(s.numeric.max)}</div>
            <div><span style={styles.statLabel}>mean </span>{fmt(s.numeric.mean)}</div>
            <div><span style={styles.statLabel}>std </span>{fmt(s.numeric.stdDev)}</div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={styles.statLabel}>median </span>{fmt(s.numeric.median)}
            </div>
          </div>
        </div>
      )}

      {s.topValues.length > 0 && (
        <div style={styles.topBox}>
          <div style={styles.topTitle}>Top {s.topValues.length} 高频值</div>
          {s.topValues.map((t, i) => {
            const widthPct = s.rowCount > 0 ? (t.count / s.rowCount) * 100 : 0;
            return (
              <div key={i} style={styles.topRow}>
                <div style={styles.topVal} title={t.value}>
                  {t.value.length > 28 ? t.value.slice(0, 28) + '…' : t.value || '(空串)'}
                </div>
                <div style={styles.topBar}>
                  <div style={{ ...styles.topBarFill, width: `${Math.max(3, widthPct)}%` }} />
                </div>
                <div style={styles.topCount}>{t.count.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '12px 14px',
    background: '#ffffff',
    height: '100%',
    overflowY: 'auto' as const,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 13,
    color: '#1f2937',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  } as React.CSSProperties,
  title: {
    fontSize: 15,
    fontWeight: 600,
  } as React.CSSProperties,
  actions: { display: 'flex', gap: 6 } as React.CSSProperties,
  primaryBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
  } as React.CSSProperties,
  secondaryBtn: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
  } as React.CSSProperties,
  meta: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 14,
    padding: '8px 10px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    marginBottom: 10,
    fontSize: 12,
  } as React.CSSProperties,
  metaLabel: { color: '#6b7280', marginRight: 4 } as React.CSSProperties,
  metaValue: { fontWeight: 500 } as React.CSSProperties,
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '8px 10px',
    borderRadius: 4,
    marginBottom: 10,
    fontSize: 12,
  } as React.CSSProperties,
  empty: {
    color: '#6b7280',
    padding: 30,
    textAlign: 'center' as const,
    border: '1px dashed #d1d5db',
    borderRadius: 4,
    fontSize: 13,
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 10,
  } as React.CSSProperties,
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: 10,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  colName: { fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  typeTag: {
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 500,
  } as React.CSSProperties,
  statRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
    padding: '6px 0',
  } as React.CSSProperties,
  statCell: { display: 'flex', flexDirection: 'column' as const, gap: 3 } as React.CSSProperties,
  statLabel: { fontSize: 11, color: '#6b7280' } as React.CSSProperties,
  statValue: { fontSize: 12, fontWeight: 500 } as React.CSSProperties,
  bar: {
    height: 4,
    background: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden' as const,
    marginTop: 2,
  } as React.CSSProperties,
  barFill: { height: '100%', transition: 'width 0.3s' } as React.CSSProperties,
  numericBox: {
    padding: '6px 8px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 4,
  } as React.CSSProperties,
  numericTitle: { fontSize: 11, color: '#166534', fontWeight: 500, marginBottom: 4 } as React.CSSProperties,
  numericGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 3,
    fontSize: 12,
    color: '#065f46',
  } as React.CSSProperties,
  topBox: {
    padding: '6px 8px',
    background: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
  } as React.CSSProperties,
  topTitle: { fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  topRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 40px',
    gap: 6,
    alignItems: 'center',
    fontSize: 11,
    padding: '2px 0',
  } as React.CSSProperties,
  topVal: { overflow: 'hidden', textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const, color: '#374151' } as React.CSSProperties,
  topBar: { height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' as const } as React.CSSProperties,
  topBarFill: { height: '100%', background: '#60a5fa' } as React.CSSProperties,
  topCount: { textAlign: 'right' as const, color: '#6b7280' } as React.CSSProperties,
};

export default ProfilePanel;
