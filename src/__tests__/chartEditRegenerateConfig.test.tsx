/**
 * ChartEditSidebar 切换图表类型 → 重建 config 链路集成测试（2026-10-23 新增）
 *
 * 背景 Bug：SavedChart.config 是「SQL 结果 × chartType × 坐标轴」的派生缓存，
 * DashboardItem 渲染优先级 config 直渲 > SQL 重生成，普通图表无 lastResult，
 * 导致修改 chartType 只更新字段、直渲的旧 config 不变 —— 预览无响应、保存后也不生效。
 *
 * 本测试用真实 store + 真实组件 + mock IPC，验证：
 * 点击图表类型卡片 → 重新执行 SQL → 用新类型生成 config → 写入 store（预览数据源）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke, type InvokeArgs } from '@tauri-apps/api/core';
import { LocaleProvider } from '../context/LocaleContext';
import { ChartEditSidebar } from '../components/dashboard/ChartEditSidebar';
import { useDashboardStore } from '../store/dashboardStore';
import type { SavedChart } from '../types/dashboard';

const mockInvoke = vi.mocked(invoke);

const makeChart = (overrides: Partial<SavedChart> = {}): SavedChart => ({
  id: 'chart-1',
  name: '测试图表',
  queryId: '',
  sql: 'SELECT department, cnt FROM stats',
  chartType: 'pie',
  xAxis: 'department',
  yAxis: ['cnt'],
  title: '',
  filters: [],
  tags: [],
  description: '',
  thumbnail: null,
  // 旧饼图 config（直渲路径的输入）
  config: { series: [{ type: 'pie', name: 'cnt', data: [{ name: 'a', value: 1 }] }] },
  visualConfig: null,
  visibility: 'all',
  authorizedDashboardIds: [],
  // 关键：普通图表没有 lastResult（该字段仅自动化任务写入），渲染只能走 config 直渲
  lastResult: null,
  lastRunAt: null,
  createdBy: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const renderSidebar = (chart: SavedChart) =>
  render(
    <LocaleProvider>
      <ChartEditSidebar chart={chart} onClose={() => {}} />
    </LocaleProvider>
  );

describe('ChartEditSidebar 切换图表类型重建派生 config', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    useDashboardStore.setState({
      savedCharts: [makeChart()],
      previewVisualConfigs: {},
    } as never);
  });

  it('切换到柱状图：重新执行 SQL 并用新类型生成 config 写入 store', async () => {
    mockInvoke.mockImplementation((command: string, args?: InvokeArgs) => {
      if (command === 'execute_sql') {
        return Promise.resolve({
          results: [{ columns: ['department', 'cnt'], rows: [['a', '1'], ['b', '2']] }],
        });
      }
      if (command === 'generate_chart_config') {
        const req = (args as { request: { chart_type?: string } }).request;
        // 模拟后端：返回的 config 的 series 类型与请求的 chart_type 一致
        return Promise.resolve({
          title: { text: '', left: 'center' },
          tooltip: { trigger: 'item', axisPointer: { type: 'shadow' } },
          legend: { data: ['cnt'], top: 'bottom' },
          xAxis: [{ type: 'category', data: ['a', 'b'], name: 'department' }],
          yAxis: [{ type: 'value', name: 'cnt' }],
          series: [{ type: req.chart_type ?? 'bar', name: 'cnt', data: [1, 2] }],
        });
      }
      return Promise.resolve(null);
    });

    renderSidebar(makeChart());

    // 切到「图表配置」tab，点击「柱状图」卡片
    fireEvent.click(screen.getByText('图表配置'));
    fireEvent.click(screen.getByText('柱状图'));

    // 等待异步重建完成：store 中 chartType 与 config 都变成新类型
    await waitFor(() => {
      const chart = useDashboardStore.getState().savedCharts[0];
      expect(chart.chartType).toBe('bar');
      expect((chart.config as { series: Array<{ type: string }> }).series[0].type).toBe('bar');
    });

    // generate_chart_config 收到的是新类型
    const genCall = mockInvoke.mock.calls.find((c) => c[0] === 'generate_chart_config');
    expect(genCall).toBeTruthy();
    expect((genCall![1] as { request: { chart_type: string } }).request.chart_type).toBe('bar');
  });

  it('无 SQL 的图表：不清除原有 config（避免破坏渲染）', async () => {
    renderSidebar(makeChart({ sql: '' }));

    fireEvent.click(screen.getByText('图表配置'));
    fireEvent.click(screen.getByText('柱状图'));

    // chartType 字段仍然同步（编辑器选中态正确），但 config 保持旧值
    await waitFor(() => {
      expect(useDashboardStore.getState().savedCharts[0].chartType).toBe('bar');
    });
    const chart = useDashboardStore.getState().savedCharts[0];
    expect((chart.config as { series: Array<{ type: string }> }).series[0].type).toBe('pie');
    // 没有 SQL 可执行，不应调用 execute_sql
    expect(mockInvoke.mock.calls.some((c) => c[0] === 'execute_sql')).toBe(false);
  });

  it('多语句 SQL：从含 x/y 列的结果段重建 config（真实事故回归）', async () => {
    // 复现用户图表「各部门人员」：两条语句，results[0] 是探索查询（列中无 cn），
    // 2026-10-24 修复前盲目取 results[0] → 缺 cn 列 → 重建静默失败 → 预览永不更新
    mockInvoke.mockImplementation((command: string, args?: InvokeArgs) => {
      if (command === 'execute_sql') {
        return Promise.resolve({
          results: [
            // 语句1：SELECT * FROM employees WHERE age BETWEEN 30 AND 40 —— 无 cn 列
            {
              columns: ['id', 'name', 'age', 'city', 'department', 'salary'],
              rows: [['1', '张三', '35', '北京', '技术部', '20000']],
            },
            // 语句2：SELECT department, count(*) cn ... GROUP BY department —— 图表真正的数据段
            {
              columns: ['department', 'cn'],
              rows: [['技术部', '5'], ['人事部', '3']],
            },
          ],
        });
      }
      if (command === 'generate_chart_config') {
        const req = (args as { request: { chart_type?: string; columns?: string[] } }).request;
        // 模拟后端行为：请求列里没有 y 轴列时报错（与 Rust find_y_axis_indices 一致）
        if (req.columns && !req.columns.includes('cn')) {
          return Promise.reject(new Error('找不到Y轴列'));
        }
        return Promise.resolve({
          title: { text: '', left: 'center' },
          tooltip: { trigger: 'item', axisPointer: { type: 'shadow' } },
          legend: { data: ['cn'], top: 'bottom' },
          xAxis: [{ type: 'category', data: ['技术部', '人事部'], name: 'department' }],
          yAxis: [{ type: 'value', name: 'cn' }],
          series: [{ type: req.chart_type ?? 'bar', name: 'cn', data: [5, 3] }],
        });
      }
      return Promise.resolve(null);
    });

    renderSidebar(
      makeChart({
        sql: 'SELECT * FROM employees WHERE age BETWEEN 30 AND 40 ;\nSELECT department,count(*) cn FROM employees GROUP BY department',
        // 与用户真实图表一致：x 轴 department、y 轴 cn（仅存在于第二条语句的结果中）
        xAxis: 'department',
        yAxis: ['cn'],
      }),
    );

    fireEvent.click(screen.getByText('图表配置'));
    fireEvent.click(screen.getByText('柱状图'));

    // 切换到柱状图后，config 应基于语句2 的数据重建为 bar
    await waitFor(() => {
      const chart = useDashboardStore.getState().savedCharts[0];
      expect(chart.chartType).toBe('bar');
      expect((chart.config as { series: Array<{ type: string }> }).series[0].type).toBe('bar');
    });

    // generate_chart_config 收到的应是语句2 的列（含 cn），而非语句1 的 employees 全部列
    const genCall = mockInvoke.mock.calls.find((c) => c[0] === 'generate_chart_config');
    expect(genCall).toBeTruthy();
    const genReq = (genCall![1] as { request: { columns: string[] } }).request;
    expect(genReq.columns).toEqual(['department', 'cn']);
  });
});
