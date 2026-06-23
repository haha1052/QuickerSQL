/**
 * 虚拟滚动工具（M7.2 新增）
 *
 * 功能：
 * - 计算可视区域内需要渲染的条目索引范围（start ~ end）
 * - 支持自定义行高、过度扫描（overscan）以改善滚动体验
 * - 返回一个包含 totalHeight + 渲染窗口信息的对象，供组件消费
 *
 * 典型用法：
 *   const range = computeVisibleRange(scrollTop, viewportHeight, itemHeight, totalItems, 5);
 *   <div style={{ height: range.totalHeight, position: 'relative' }}>
 *     {items.slice(range.start, range.end).map((item, idx) =>
 *       <div key={item.id} style={{
 *         position: 'absolute',
 *         top: (range.start + idx) * itemHeight,
 *         height: itemHeight,
 *       }}>{item.label}</div>
 *     )}
 *   </div>
 */

export interface VirtualRange {
  /** 第一个需要渲染的条目的索引（含） */
  start: number;
  /** 最后一个需要渲染的条目的索引（不含） */
  end: number;
  /** 所有条目占据的总高度（px） */
  totalHeight: number;
  /** 每条的行高（回传值，便于组件使用） */
  itemHeight: number;
  /** 过度扫描的行数（渲染在可视区域上下的额外行数） */
  overscan: number;
}

/**
 * 计算虚拟滚动的可视范围
 *
 * @param scrollTop      当前滚动位置（px）
 * @param viewportHeight 视口高度（px）
 * @param itemHeight     单行高度（px）
 * @param totalItems     总条目数
 * @param overscan       上下过度扫描行数（默认 5）
 */
export function computeVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 5,
): VirtualRange {
  if (itemHeight <= 0) {
    return { start: 0, end: 0, totalHeight: 0, itemHeight: 0, overscan };
  }

  const safeTotal = Math.max(totalItems, 0);
  const startRaw = Math.floor(Math.max(scrollTop, 0) / itemHeight);
  const visibleCount = Math.ceil(Math.max(viewportHeight, 0) / itemHeight);

  let start = Math.max(startRaw - overscan, 0);
  let end = Math.min(startRaw + visibleCount + overscan, safeTotal);

  // 防止极端参数导致 start > end
  if (start > end) start = end;

  return {
    start,
    end,
    totalHeight: safeTotal * itemHeight,
    itemHeight,
    overscan,
  };
}

/**
 * 计算某条索引对应的偏移量（top），便于渲染绝对定位
 */
export function indexToOffset(index: number, itemHeight: number): number {
  return Math.max(index, 0) * itemHeight;
}

/**
 * 根据高度自适应地估算需要渲染的条目数（用于初始状态、滚动到中间）
 */
export function estimateScrollToIndex(
  index: number,
  itemHeight: number,
  viewportHeight: number,
): number {
  if (index <= 0 || itemHeight <= 0) return 0;
  // 滚动到目标行时保持其在视口垂直居中
  return Math.max(index * itemHeight - viewportHeight / 2, 0);
}
