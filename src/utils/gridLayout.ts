/**
 * 仪表盘网格布局工具函数
 *
 * 画布约定: 12 列网格，每行高度 80px
 * 每个图表项由 { x, y, width, height } 描述:
 *   x, y: 左上角所在的网格坐标 (从 0 开始)
 *   width: 占用的列数 (1~12)
 *   height: 占用的行数 (1~...)
 */

const GRID_COLUMNS = 12;

/**
 * 计算新图表在仪表盘画布中的自动放置位置
 *
 * 策略:
 *   1. 如果当前没有任何图表, 放在 (0, 0)
 *   2. 否则尝试放在当前最后一行的右侧:
 *        a. 找到最后一行 (y 最大的行)
 *        b. 如果这一行最右侧到 12 列之间还有 ≥ width 的空间
 *        c. 放在该空间的最左侧
 *   3. 否则追加到新的一行 (x=0, y=当前最底部)
 */
export function calculateNextPosition(
  items: Array<{ x: number; y: number; width: number; height: number }>,
  newItemSize: { width: number; height: number } = { width: 6, height: 4 }
): { x: number; y: number; width: number; height: number } {
  if (!items || items.length === 0) {
    return { x: 0, y: 0, width: newItemSize.width, height: newItemSize.height };
  }

  // 找到当前布局中占据的最大行号 (y + height)
  let maxBottom = 0;
  for (const item of items) {
    const bottom = item.y + item.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  // 找到最后一行 (y 最大的行): 所有与最后一行重叠的 items
  // 我们以 "y ≤ maxBottom - 1 且 y + height > maxBottom - 1" 的定义作为最后一行
  const lastRowY = maxBottom - 1;
  const rowItems = items.filter(
    (item) => item.y <= lastRowY && item.y + item.height > lastRowY
  );

  // 计算当前行的最右列
  let currentRowRight = 0;
  for (const item of rowItems) {
    const right = item.x + item.width;
    if (right > currentRowRight) currentRowRight = right;
  }

  // 如果最后一行右侧还有足够空间, 放到右侧
  if (GRID_COLUMNS - currentRowRight >= newItemSize.width) {
    return {
      x: currentRowRight,
      y: lastRowY,
      width: newItemSize.width,
      height: newItemSize.height,
    };
  }

  // 否则放到新的一行 (y = maxBottom)
  return {
    x: 0,
    y: maxBottom,
    width: newItemSize.width,
    height: newItemSize.height,
  };
}

export { GRID_COLUMNS };
