import React, { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../../store';

const MAX_HISTORY = 20;

interface HitRateSample {
  hitRate: number;
  hits: number;
  misses: number;
  timestamp: number;
}

const QueryCacheStatsPanel: React.FC = () => {
  const {
    cacheStats,
    cacheStatsLoading,
    cacheStatsError,
    loadCacheStats,
    configureCache,
    clearCache,
  } = useSettingsStore();

  const [capacityInput, setCapacityInput] = useState<string>('100');
  const [ttlInput, setTtlInput] = useState<string>('300');
  const [enabledInput, setEnabledInput] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [hitRateHistory, setHitRateHistory] = useState<HitRateSample[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    void loadCacheStats();
  }, []);

  useEffect(() => {
    if (cacheStats) {
      setCapacityInput(String(cacheStats.capacity));
      setEnabledInput(cacheStats.enabled);
      setHitRateHistory((prev) => {
        const sample: HitRateSample = {
          hitRate: cacheStats.hitRate,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          timestamp: Date.now(),
        };
        const next = [...prev, sample];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
    }
  }, [cacheStats]);

  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      void loadCacheStats();
    }, 5000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, loadCacheStats]);

  const handleRefresh = () => {
    void loadCacheStats();
  };

  const handleReset = () => {
    setCapacityInput('100');
    setTtlInput('300');
    setEnabledInput(true);
    void configureCache(100, 300, true);
  };

  const handleApply = () => {
    const capacity = Number(capacityInput);
    const ttl = Number(ttlInput);
    if (
      Number.isFinite(capacity) && capacity > 0 &&
      Number.isFinite(ttl) && ttl >= 0
    ) {
      void configureCache(capacity, ttl, enabledInput);
    }
  };

  const hitRatePercent = cacheStats
    ? Math.round(cacheStats.hitRate * 1000) / 10
    : 0;

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary, #ffffff)',
    border: '1px solid var(--border-primary, #e1e4e8)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    color: 'var(--text-primary, #1f2328)',
    fontSize: 14,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px dashed var(--border-default, #eaecef)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary, #6a737d)',
    fontWeight: 500,
  };

  const valueStyle: React.CSSProperties = {
    color: 'var(--text-primary, #1f2328)',
    fontVariantNumeric: 'tabular-nums',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '6px 14px',
    border: '1px solid var(--border-primary, #d0d7de)',
    borderRadius: 6,
    background: 'var(--bg-secondary, #ffffff)',
    color: 'var(--text-primary, #1f2328)',
    cursor: 'pointer',
    fontSize: 13,
    marginLeft: 8,
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'var(--accent-primary, #2f80ed)',
    borderColor: 'var(--accent-primary, #2f80ed)',
    color: '#ffffff',
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px',
    border: '1px solid var(--border-primary, #d0d7de)',
    borderRadius: 6,
    background: 'var(--bg-primary, #ffffff)',
    color: 'var(--text-primary, #1f2328)',
    fontSize: 13,
    width: 80,
  };

  const progressBarContainerStyle: React.CSSProperties = {
    flex: 1,
    marginLeft: 12,
    height: 10,
    background: 'var(--bg-tertiary, #eef0f3)',
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  };

  const progressBarFillStyle: React.CSSProperties = {
    height: '100%',
    width: `${Math.min(100, Math.max(0, hitRatePercent))}%`,
    background: '#27ae60',
    transition: 'width 0.3s ease',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary, #1f2328)',
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>🔍 查询缓存状态</span>
          <div>
            <button
              style={buttonStyle}
              onClick={handleRefresh}
              disabled={cacheStatsLoading}
            >
              {cacheStatsLoading ? '加载中...' : '刷新'}
            </button>
            <button style={buttonStyle} onClick={handleReset}>
              重置默认
            </button>
            <button style={buttonStyle} onClick={() => void clearCache()}>
              清空缓存
            </button>
          </div>
        </div>

        {cacheStatsError && (
          <div style={{
            background: 'rgba(235, 87, 87, 0.08)',
            color: '#c0392b',
            padding: '6px 10px',
            borderRadius: 6,
            marginBottom: 8,
            fontSize: 13,
          }}>
            加载失败：{cacheStatsError}
          </div>
        )}

        {!cacheStats && !cacheStatsError && !cacheStatsLoading && (
          <div style={{ padding: 8, color: 'var(--text-secondary, #6a737d)' }}>
            暂无数据
          </div>
        )}

        {cacheStats && (
          <>
            <div style={rowStyle}>
              <span style={labelStyle}>容量 (capacity)</span>
              <span style={valueStyle}>{cacheStats.capacity} 条</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>当前使用 (size)</span>
              <span style={valueStyle}>{cacheStats.size} 条</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>命中次数 (hits)</span>
              <span style={valueStyle}>{cacheStats.hits.toLocaleString()}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>未命中次数 (misses)</span>
              <span style={valueStyle}>{cacheStats.misses.toLocaleString()}</span>
            </div>
            <div style={{ ...rowStyle, alignItems: 'center' }}>
              <span style={labelStyle}>命中率 (hitRate)</span>
              <span style={{ display: 'flex', alignItems: 'center', flex: 1, marginLeft: 12 }}>
                <span style={valueStyle}>{hitRatePercent}%</span>
                <div style={progressBarContainerStyle}>
                  <div style={progressBarFillStyle} />
                </div>
              </span>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>启用状态 (enabled)</span>
              <span style={{
                ...valueStyle,
                color: cacheStats.enabled ? '#27ae60' : '#c0392b',
                fontWeight: 600,
              }}>
                {cacheStats.enabled ? 'true' : 'false'}
              </span>
            </div>
          </>
        )}
      </div>

      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>📈 命中率趋势</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary, #6a737d)' }}>
            最近 {hitRateHistory.length} / {MAX_HISTORY} 个采样点
          </span>
        </div>
        {hitRateHistory.length < 2 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary, #6a737d)', fontSize: 13 }}>
            数据不足。请开启"自动刷新"或手动刷新几次以生成趋势图。
          </div>
        ) : (() => {
          const chartWidth = 560;
          const chartHeight = 140;
          const padding = { top: 20, right: 20, bottom: 28, left: 40 };
          const innerW = chartWidth - padding.left - padding.right;
          const innerH = chartHeight - padding.top - padding.bottom;
          const maxVal = Math.max(...hitRateHistory.map((s) => s.hitRate), 0.01);
          const stepX = hitRateHistory.length > 1 ? innerW / (hitRateHistory.length - 1) : 0;
          const points = hitRateHistory.map((s, i) => {
            const x = padding.left + i * stepX;
            const y = padding.top + innerH - (s.hitRate / maxVal) * innerH;
            return `${x},${y}`;
          }).join(' ');
          return (
            <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ display: 'block' }}>
              <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="var(--border-primary, #d0d7de)" strokeWidth="1" />
              <line x1={padding.left} y1={padding.top + innerH} x2={padding.left + innerW} y2={padding.top + innerH} stroke="var(--border-primary, #d0d7de)" strokeWidth="1" />
              <text x={padding.left - 6} y={padding.top + 4} fontSize="10" fill="var(--text-tertiary, #6a737d)" textAnchor="end">
                {Math.round(maxVal * 1000) / 10}%
              </text>
              <text x={padding.left - 6} y={padding.top + innerH + 4} fontSize="10" fill="var(--text-tertiary, #6a737d)" textAnchor="end">
                0%
              </text>
              <polyline
                points={points}
                fill="none"
                stroke="#27ae60"
                strokeWidth="2"
              />
              {hitRateHistory.map((s, i) => {
                const x = padding.left + i * stepX;
                const y = padding.top + innerH - (s.hitRate / maxVal) * innerH;
                return <circle key={i} cx={x} cy={y} r="3" fill="#27ae60" />;
              })}
            </svg>
          );
        })()}
      </div>

      <div style={cardStyle}>
        <div style={{ ...headerStyle, justifyContent: 'flex-start', gap: 8 }}>
          <span style={titleStyle}>⚙️ 配置</span>
        </div>
        <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelStyle}>容量:</span>
            <input
              type="number"
              min={1}
              value={capacityInput}
              onChange={(e) => setCapacityInput(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelStyle}>TTL(秒):</span>
            <input
              type="number"
              min={0}
              value={ttlInput}
              onChange={(e) => setTtlInput(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ ...rowStyle, paddingTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabledInput}
              onChange={(e) => setEnabledInput(e.target.checked)}
            />
            <span style={labelStyle}>启用缓存</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span style={labelStyle}>自动刷新（每5秒）</span>
          </label>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none', paddingTop: 10 }}>
          <button style={primaryButtonStyle} onClick={handleApply}>
            应用配置
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueryCacheStatsPanel;
