import { test, expect } from '@playwright/test';

test.describe('基本启动测试', () => {
  test('应用应能启动并响应 HTTP（当 E2E_WITH_WEBSERVER=1 时）', async ({ request }) => {
    test.skip(process.env.E2E_WITH_WEBSERVER !== '1', '未启用 webServer 模式');
    const res = await request.get('http://localhost:1420/');
    expect(res.ok()).toBeTruthy();
  });

  test('占位断言：测试框架正常工作', () => {
    expect(1 + 1).toBe(2);
  });
});
