/**
 * 仪表盘导出工具
 *
 * 将仪表盘的所有图表导出为一张 PNG 图片。
 *
 * 原理：
 *   1. 遍历画布中所有 ECharts 实例（通过 data-echarts-container 标记定位 DOM）
 *   2. 调用每个实例的 getDataURL() 获取图表的 base64 PNG
 *   3. 按网格布局将各图表绘制到一张大 Canvas 上
 *   4. 导出 Canvas 为 PNG 文件
 *
 * 优势：无需额外依赖（html2canvas 等），直接利用 ECharts 内置能力
 */

// P0-2 启动优化：将 echarts 从同步 import 改为调用时动态 import
// 本文件只有在用户点击"导出仪表盘"时才会执行，避免启动时加载大库
import type { Dashboard } from '../types/dashboard';

/**
 * 画布网格参数（与 DashboardCanvas 保持一致）
 *
 * 定义仪表盘画布的网格系统：
 *   - columns: 总列数
 *   - rowHeight: 每行高度（像素）
 *   - gap: 网格间距（像素）
 *   - padding: 画布内边距（像素）
 */
const GRID = {
  columns: 12,
  rowHeight: 80,
  gap: 16,
  padding: 16,
};

/**
 * 导出仪表盘为 PNG 图片
 *
 * @param dashboard 当前仪表盘（含 layout 布局信息）
 * @param canvasEl 画布 DOM 元素（用于获取实际像素尺寸）
 * @param filename 导出文件名（不含扩展名）
 * @returns 导出结果对象，包含 success 标志和 message 提示信息
 */
export async function exportDashboardToPng(
  dashboard: Dashboard,
  canvasEl: HTMLElement | null,
  filename: string = `仪表盘_${dashboard.name}`,
): Promise<{ success: boolean; message: string }> {
  if (!canvasEl || dashboard.layout.length === 0) {
    return { success: false, message: '仪表盘为空，无法导出' };
  }

  try {
    // P0-2 启动优化：按需动态加载 echarts（仅在导出时才加载）
    const echarts = await import('echarts');

    // 获取画布实际像素尺寸
    const canvasRect = canvasEl.getBoundingClientRect();
    const canvasWidth = Math.round(canvasRect.width);
    // 计算画布总高度：最底部行 + padding
    let maxBottomRow = 0;
    for (const item of dashboard.layout) {
      const bottom = item.y + item.height;
      if (bottom > maxBottomRow) maxBottomRow = bottom;
    }
    const canvasHeight = maxBottomRow * GRID.rowHeight + (maxBottomRow - 1) * GRID.gap + GRID.padding * 2;

    // 创建输出 Canvas
    const outputCanvas = document.createElement('canvas');
    // 使用 2x 分辨率提高清晰度
    const scale = 2;
    outputCanvas.width = canvasWidth * scale;
    outputCanvas.height = canvasHeight * scale;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      return { success: false, message: '无法创建画布上下文' };
    }
    ctx.scale(scale, scale);

    // 绘制白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 计算每列宽度（减去 padding 和 gap）
    const colWidth = (canvasWidth - GRID.padding * 2 - GRID.gap * (GRID.columns - 1)) / GRID.columns;

    // 遍历所有图表，获取 ECharts 实例并导出
    const chartContainers = canvasEl.querySelectorAll('[data-echarts-container="true"]');
    const chartDataList: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      dataUrl: string;
    }> = [];

    for (let i = 0; i < chartContainers.length; i++) {
      const container = chartContainers[i] as HTMLElement;
      const instance = echarts.getInstanceByDom(container);
      if (!instance) continue;

      // 获取图表的 PNG base64
      const dataUrl = instance.getDataURL({
        type: 'png',
        pixelRatio: scale,
        backgroundColor: '#ffffff',
      });

      // 找到对应的 layout item（按 DOM 顺序与 layout 顺序对应）
      const item = dashboard.layout[i];
      if (!item) continue;

      chartDataList.push({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        dataUrl,
      });
    }

    if (chartDataList.length === 0) {
      return { success: false, message: '未找到可导出的图表' };
    }

    // 按顺序将每个图表绘制到输出 Canvas
    const drawPromises = chartDataList.map(
      (chartData) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            // 计算图表在画布中的像素位置
            const px = GRID.padding + chartData.x * (colWidth + GRID.gap);
            const py = GRID.padding + chartData.y * (GRID.rowHeight + GRID.gap);
            const pw = chartData.width * colWidth + (chartData.width - 1) * GRID.gap;
            const ph = chartData.height * GRID.rowHeight + (chartData.height - 1) * GRID.gap;

            // 绘制卡片背景（圆角白色 + 边框）
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            roundRect(ctx, px, py, pw, ph, 8);
            ctx.fill();
            ctx.stroke();

            // 绘制图表图片（留 padding）
            const innerPadding = 12;
            ctx.drawImage(img, px + innerPadding, py + innerPadding, pw - innerPadding * 2, ph - innerPadding * 2);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = chartData.dataUrl;
        }),
    );

    await Promise.all(drawPromises);

    // 导出 PNG 文件
    const blob = await new Promise<Blob | null>((resolve) => {
      outputCanvas.toBlob(resolve, 'image/png');
    });

    if (!blob) {
      return { success: false, message: '生成图片失败' };
    }

    // 触发下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, message: '导出成功' };
  } catch (e) {
    console.error('[exportDashboardToPng] 导出失败:', e);
    return { success: false, message: `导出失败：${e}` };
  }
}

/**
 * 在 Canvas 上绘制圆角矩形路径（仅描边路径，不填充不描边）
 *
 * 使用二次贝塞尔曲线绘制四个圆角，调用后可继续调用 ctx.fill() / ctx.stroke()。
 *
 * @param ctx Canvas 2D 渲染上下文
 * @param x 矩形左上角 x 坐标
 * @param y 矩形左上角 y 坐标
 * @param width 矩形宽度
 * @param height 矩形高度
 * @param radius 圆角半径（像素）
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default exportDashboardToPng;
