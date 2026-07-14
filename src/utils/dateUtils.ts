/**
 * 日期时间工具函数
 * 支持 locale.firstDayOfWeek 和 locale.timezone 设置
 */

// 获取日历首日（0=周日，1=周一）
export function getCalendarFirstDay(firstDayOfWeek?: string): number {
  switch (firstDayOfWeek) {
    case 'monday': return 1;
    case 'saturday': return 6;
    case 'sunday': return 0;
    default: return 0; // 默认周日
  }
}

// 转换时区
export function convertTimezone(date: Date, timezone: string): Date {
  if (!timezone) return date;

  try {
    // 使用 Intl API 转换时区
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

    return new Date(
      parseInt(getPart('year')),
      parseInt(getPart('month')) - 1,
      parseInt(getPart('day')),
      parseInt(getPart('hour')),
      parseInt(getPart('minute')),
      parseInt(getPart('second'))
    );
  } catch {
    return date; // 如果时区无效，返回原日期
  }
}

// 格式化日期（支持时区和首日）
export function formatDate(
  date: Date,
  options?: {
    timezone?: string;
    firstDayOfWeek?: string;
    format?: 'short' | 'long' | 'full';
  }
): string {
  const { timezone, format = 'short' } = options || {};

  let targetDate = date;
  if (timezone) {
    targetDate = convertTimezone(date, timezone);
  }

  const formatOptions: Intl.DateTimeFormatOptions = (() => {
    switch (format) {
      case 'short':
        return { month: 'numeric' as const, day: 'numeric' as const };
      case 'long':
        return { year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const };
      case 'full':
        return { weekday: 'long' as const, year: 'numeric' as const, month: 'long' as const, day: 'numeric' as const };
      default:
        return { month: 'numeric' as const, day: 'numeric' as const };
    }
  })();

  return new Intl.DateTimeFormat('zh-CN', {
    ...formatOptions,
    ...(timezone && { timeZone: timezone }),
  }).format(targetDate);
}

// 格式化时间（支持时区）
export function formatTime(
  date: Date,
  options?: {
    timezone?: string;
    includeSeconds?: boolean;
  }
): string {
  const { timezone, includeSeconds = false } = options || {};

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' }),
    hour12: false,
    ...(timezone && { timeZone: timezone }),
  }).format(date);
}

// 格式化日期时间（支持时区）
export function formatDateTime(
  date: Date,
  options?: {
    timezone?: string;
    firstDayOfWeek?: string;
  }
): string {
  return `${formatDate(date, options)} ${formatTime(date, options)}`;
}
