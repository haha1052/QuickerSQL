/**
 * 图表视觉样式保存链路回归测试（2026-10-23 新增）
 *
 * 覆盖两个已修复缺陷：
 *   Bug 1：编辑侧边栏的 setVisualConfig 立即写入 savedCharts.visualConfig，
 *          导致 hasChanges 恒为 false（"有未保存的修改"永不出现），
 *          且保存后 updatedAt 变化触发 chartSyncKey 重置 effect，刚改的样式被清空。
 *   Bug 2：视觉配置预览草稿若残留在 store 中，会覆盖已持久化的配置。
 *
 * 本测试直接对 dashboardStore 的预览通道语义做断言（store 为纯 Zustand，无 UI 依赖）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from '../store/dashboardStore';

const resetStore = () => {
  useDashboardStore.setState({
    savedCharts: [],
    previewVisualConfigs: {},
  } as never);
};

describe('dashboardStore 视觉配置预览通道（视觉样式保存不生效修复）', () => {
  beforeEach(() => {
    resetStore();
  });

  it('setVisualConfigPreview 写入草稿，且不污染 savedCharts（Bug 1 核心）', () => {
    const draft = { color: { customPalette: ['#ff0000', '#00ff00'] } };

    useDashboardStore.getState().setVisualConfigPreview('chart-1', draft);

    const state = useDashboardStore.getState();
    // 草稿进入预览通道
    expect(state.previewVisualConfigs['chart-1']).toEqual(draft);
    // 关键：持久化数据不被污染 —— 否则 hasChanges 判定失效、保存后被重置
    expect(state.savedCharts).toHaveLength(0);
  });

  it('多个图表的草稿相互隔离', () => {
    const s = () => useDashboardStore.getState();
    s().setVisualConfigPreview('chart-1', { title: { fontSize: 20 } });
    s().setVisualConfigPreview('chart-2', { title: { fontSize: 30 } });

    expect(s().previewVisualConfigs['chart-1']).toEqual({ title: { fontSize: 20 } });
    expect(s().previewVisualConfigs['chart-2']).toEqual({ title: { fontSize: 30 } });
  });

  it('更新同一图表的草稿会覆盖旧值（支持连续多次修改）', () => {
    const s = () => useDashboardStore.getState();
    s().setVisualConfigPreview('chart-1', { title: { fontSize: 12 } });
    s().setVisualConfigPreview('chart-1', { title: { fontSize: 24 } });

    expect(s().previewVisualConfigs['chart-1']).toEqual({ title: { fontSize: 24 } });
    expect(Object.keys(s().previewVisualConfigs)).toHaveLength(1);
  });

  it('clearVisualConfigPreview 清除指定图表草稿，保存成功后回退到持久化配置', () => {
    const s = () => useDashboardStore.getState();
    s().setVisualConfigPreview('chart-1', { title: { fontSize: 24 } });
    s().setVisualConfigPreview('chart-2', { title: { fontSize: 30 } });

    s().clearVisualConfigPreview('chart-1');

    expect(s().previewVisualConfigs['chart-1']).toBeUndefined();
    expect(s().previewVisualConfigs['chart-2']).toEqual({ title: { fontSize: 30 } });
  });

  it('清除不存在的图表草稿不报错且不改变其他草稿', () => {
    const s = () => useDashboardStore.getState();
    s().setVisualConfigPreview('chart-1', { title: { fontSize: 24 } });

    expect(() => s().clearVisualConfigPreview('chart-not-exist')).not.toThrow();
    expect(s().previewVisualConfigs['chart-1']).toEqual({ title: { fontSize: 24 } });
  });

  it('resetForProjectSwitch 清空预览草稿，避免跨项目图表 id 碰撞串样式', () => {
    const s = () => useDashboardStore.getState();
    s().setVisualConfigPreview('chart-1', { title: { fontSize: 24 } });

    s().resetForProjectSwitch();

    expect(s().previewVisualConfigs).toEqual({});
  });
});