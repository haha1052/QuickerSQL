/**
 * updateSavedChart IPC 参数命名回归测试（2026-10-23 新增）
 *
 * Bug 根因：tauri.ts 的 updateSavedChart 曾向 invoke 传递 snake_case 扁平参数
 * （chart_type / x_axis / y_axis / visual_config / authorized_dashboard_ids）。
 * Tauri v2 的 #[tauri::command] 只接受 camelCase 键（单词参数两种命名恰好一致，
 * 所以 name/title/tags/description/config/visibility/sql 侥幸通过），
 * 多词参数被 serde 静默丢弃 → 后端收到 None → 服务层跳过对应 UPDATE 列 →
 * 「视觉样式保存不生效」；保存后 chartSyncKey effect 再用旧值回填编辑器，
 * 表现为「修改被保存键清除」。
 *
 * 本测试锁定 camelCase 契约，防止回归。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { tauriService } from '../services';

const mockInvoke = vi.mocked(invoke);

describe('updateSavedChart IPC 参数命名契约（Tauri v2 camelCase）', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ id: 'chart-1' } as never);
    // invokeCommand 的 isTauriEnv() 守卫：注入 Tauri 内部对象放行 IPC
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  });

  it('多词参数必须以 camelCase 传递（修复视觉样式保存不生效的核心断言）', async () => {
    await tauriService.updateSavedChart({
      id: 'chart-1',
      name: '测试图表',
      chartType: 'bar',
      xAxis: '月份',
      yAxis: ['销售额', '利润'],
      title: '月度销售',
      description: 'desc',
      tags: ['a'],
      visibility: 'all',
      authorizedDashboardIds: ['dash-1'],
      sql: 'SELECT 1',
      visualConfig: { title: { fontSize: 20 } },
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [command, args] = mockInvoke.mock.calls[0] as [string, Record<string, unknown>];
    expect(command).toBe('update_saved_chart');

    // camelCase 键必须存在且值正确
    expect(args.chartType).toBe('bar');
    expect(args.xAxis).toBe('月份');
    expect(args.yAxis).toBe(JSON.stringify(['销售额', '利润']));
    expect(args.visualConfig).toBe(JSON.stringify({ title: { fontSize: 20 } }));
    expect(args.authorizedDashboardIds).toEqual(['dash-1']);
    // 单词参数两种命名一致，保持原样
    expect(args.id).toBe('chart-1');
    expect(args.name).toBe('测试图表');

    // snake_case 键一律不得出现（曾被 serde 静默丢弃导致保存丢失）
    expect(args).not.toHaveProperty('chart_type');
    expect(args).not.toHaveProperty('x_axis');
    expect(args).not.toHaveProperty('y_axis');
    expect(args).not.toHaveProperty('visual_config');
    expect(args).not.toHaveProperty('authorized_dashboard_ids');
  });

  it('未提供的可选参数不进入 args（避免误清空后端字段）', async () => {
    await tauriService.updateSavedChart({ id: 'chart-1', name: '仅改名' });

    const [, args] = mockInvoke.mock.calls[0] as [string, Record<string, unknown>];
    expect(args).toEqual({ id: 'chart-1', name: '仅改名' });
  });

  it('visualConfig 为空对象时也应传递（与侧边栏默认值 {} 一致）', async () => {
    await tauriService.updateSavedChart({ id: 'chart-1', visualConfig: {} });

    const [, args] = mockInvoke.mock.calls[0] as [string, Record<string, unknown>];
    expect(args.visualConfig).toBe('{}');
  });
});
