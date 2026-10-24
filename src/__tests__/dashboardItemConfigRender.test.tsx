/**
 * DashboardItem 渲染链集成测试（2026-10-23 新增）
 *
 * 背景 Bug：切换图表类型后预览/保存均不渲染新图表。根因是 SavedChart.config 是
 * 「SQL 结果 × chartType × 坐标轴」的派生缓存，DashboardItem 渲染优先级
 * config 直渲 > SQL 重生成，普通图表无 lastResult，旧 config 永远短路渲染。
 *
 * 本测试闭合验证链的最后一环：ChartEditSidebar 的 regenerateConfig 把新 config
 * 写入 store 后，DashboardItem（真实组件）能否驱动 ChartCanvas 用新 config
 * 重新 setOption —— 即「store → DashboardItem → ChartCanvas」链路。
 *
 * 配套测试：chartEditRegenerateConfig.test.tsx 验证「点击类型卡片 → 写 store」，
 * 本测试验证「store 更新 → 图表重渲染」。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LocaleProvider } from '../context/LocaleContext';
import { DashboardItem } from '../components/dashboard/DashboardItem';
import { useDashboardStore } from '../store/dashboardStore';
import type { DashboardItem as DashboardItemType, SavedChart } from '../types/dashboard';

// echarts 假实例：只关心 setOption 收到的配置（hoisted 保证工厂引用可用）
const { setOptionMock, fakeEchartsInstance } = vi.hoisted(() => {
  const setOption = vi.fn();
  const instance = {
    setOption,
    dispose: vi.fn(),
    resize: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  return { setOptionMock: setOption, fakeEchartsInstance: instance };
});

vi.mock('echarts', () => ({
  init: vi.fn(() => fakeEchartsInstance),
}));

const PIE_CONFIG = {
  series: [{ type: 'pie', name: 'cnt', data: [{ name: 'a', value: 1 }] }],
};

const BAR_CONFIG = {
  series: [{ type: 'bar', name: 'cnt', data: [1, 2] }],
};

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
  config: PIE_CONFIG,
  visualConfig: null,
  visibility: 'all',
  authorizedDashboardIds: [],
  lastResult: null,
  lastRunAt: null,
  createdBy: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const makeItem = (overrides: Partial<DashboardItemType> = {}): DashboardItemType => ({
  id: 'item-1',
  dashboardId: 'dash-1',
  chartId: 'chart-1',
  x: 0,
  y: 0,
  width: 6,
  height: 4,
  configOverrides: {},
  position: 0,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

/** 取 setOption 最近一次收到的配置 */
const lastSetOptionConfig = (): { series: Array<{ type: string }> } => {
  const calls = setOptionMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as { series: Array<{ type: string }> };
};

const renderItem = (item: DashboardItemType) =>
  render(
    <LocaleProvider>
      <DashboardItem item={item} isEditing={false} />
    </LocaleProvider>
  );

describe('DashboardItem：store 中 config 更新驱动 ChartCanvas 重渲染', () => {
  beforeEach(() => {
    setOptionMock.mockClear();
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    useDashboardStore.setState({
      savedCharts: [makeChart()],
      previewVisualConfigs: {},
      dashboards: [],
    } as never);
  });

  it('config 直渲路径：初次渲染用饼图 config，store 更新后改用柱状图 config', async () => {
    renderItem(makeItem());

    // 初次渲染：config 直渲（无 lastResult），setOption 收到饼图配置
    await waitFor(() => {
      expect(setOptionMock).toHaveBeenCalled();
    });
    expect(lastSetOptionConfig().series[0].type).toBe('pie');

    // 模拟 ChartEditSidebar.regenerateConfig 的写入：新类型 config 进 store
    await act(async () => {
      useDashboardStore.getState().updateSavedChartLocal('chart-1', {
        chartType: 'bar',
        config: BAR_CONFIG,
      });
    });

    // ChartCanvas 的 [chartConfig] effect 重新触发，setOption 收到柱状图配置
    await waitFor(() => {
      expect(lastSetOptionConfig().series[0].type).toBe('bar');
    });
  });

  it('仅更新 chartType 字段而 config 不变时：渲染结果保持旧 config（派生缓存语义）', async () => {
    renderItem(makeItem());

    await waitFor(() => {
      expect(setOptionMock).toHaveBeenCalled();
    });
    const callsAfterFirstRender = setOptionMock.mock.calls.length;

    // 只改 chartType（不重建 config）—— 直渲路径输出不应变化，
    // 这正是「切换类型预览无响应」Bug 的根因形态，此用例锁定该语义不被意外改变
    await act(async () => {
      useDashboardStore.getState().updateSavedChartLocal('chart-1', {
        chartType: 'bar',
      });
    });

    // 等待 effect 跑完，确认没有新的 setOption 调用（config 字符串未变，被去重拦截）
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(setOptionMock.mock.calls.length).toBe(callsAfterFirstRender);
    expect(lastSetOptionConfig().series[0].type).toBe('pie');
  });
});
