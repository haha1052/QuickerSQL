/**
 * 日志工具 - 根据 developerMode 和 logLevel 设置控制日志输出
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let developerMode = false;
let currentLogLevel: LogLevel = 'info';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  if (!developerMode) {
    return level === 'error' || level === 'warn';
  }
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[currentLogLevel];
}

export function setDeveloperMode(enabled: boolean): void {
  developerMode = enabled;
  if (enabled) {
    console.info('[Developer Mode] 已启用');
  }
}

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function devLog(...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.log('[DEV]', ...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.warn('[DEV]', ...args);
  }
}

export function devError(...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error('[DEV]', ...args);
  }
}

export function devInfo(...args: unknown[]): void {
  if (shouldLog('info')) {
    console.info('[DEV]', ...args);
  }
}
