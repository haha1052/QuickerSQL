/**
 * 错误码 → i18n key 映射工具
 *
 * P3-7: 错误码机制框架
 * 后端返回 AppError JSON（序列化后放入 Result::Err(String)），前端通过
 * tryParseAppError 解析 JSON，再用 mapErrorToI18nKey 映射为 i18n key，
 * 最后通过 useLocale().t(key, params) 渲染本地化消息。
 *
 * 设计要点：
 * - 纯函数，不依赖 React hook，可在任何地方调用
 * - tryParseAppError 失败时返回 null，调用方可回退到原始 error 字符串
 * - 未映射的 errorCode 回退到 AppError.message（后端后备英文消息）
 */

/** 错误码 → i18n key 映射表 */
const ERROR_CODE_TO_I18N_KEY: Record<string, string> = {
  'dashboard.not_found': 'error.dashboardNotFound',
  'dashboard.create_failed': 'error.dashboardCreateFailed',
  'dashboard.update_failed': 'error.dashboardUpdateFailed',
  'dashboard.delete_failed': 'error.dashboardDeleteFailed',
  'dashboard.invalid_params': 'error.dashboardInvalidParams',
};

/** 后端 AppError 序列化后的 JSON 结构（camelCase） */
export interface AppErrorPayload {
  /** 错误码（如 "dashboard.not_found"） */
  errorCode: string;
  /** 错误参数（用于 i18n 模板变量替换） */
  params: Record<string, string>;
  /** 后备英文消息（i18n key 缺失时显示） */
  message: string;
}

/**
 * 尝试解析 error 字符串为 AppErrorPayload
 *
 * 后端 AppError 序列化为 JSON 后以 `{` 开头，据此与普通错误消息区分。
 * 若字符串不是合法 JSON 或不包含 errorCode 字段，返回 null。
 *
 * @param error - 来自 ApiResponse.error 的字符串
 * @returns 解析成功返回 AppErrorPayload，否则返回 null
 */
export function tryParseAppError(error: string): AppErrorPayload | null {
  if (!error || typeof error !== 'string' || !error.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(error) as unknown;
    // 验证解析结果是对象且包含 errorCode 字段
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).errorCode === 'string'
    ) {
      const obj = parsed as Record<string, unknown>;
      return {
        errorCode: obj.errorCode as string,
        params:
          typeof obj.params === 'object' && obj.params !== null && !Array.isArray(obj.params)
            ? (obj.params as Record<string, string>)
            : {},
        message: typeof obj.message === 'string' ? obj.message : '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 将 AppErrorPayload 映射为 i18n key
 *
 * 若 errorCode 未在映射表中注册，返回空字符串（调用方应回退到 error.message）。
 *
 * @param error - 解析后的 AppErrorPayload
 * @returns i18n key（如 "error.dashboardNotFound"），未映射返回空字符串
 */
export function mapErrorToI18nKey(error: AppErrorPayload): string {
  return ERROR_CODE_TO_I18N_KEY[error.errorCode] ?? '';
}

/**
 * 便捷方法：从 error 字符串直接提取 i18n key
 *
 * 等价于先调用 tryParseAppError 再调用 mapErrorToI18nKey。
 * 若解析失败或未映射，返回空字符串。
 *
 * @param error - 来自 ApiResponse.error 的字符串
 * @returns i18n key 或空字符串
 */
export function tryMapErrorToI18nKey(error: string): string {
  const appError = tryParseAppError(error);
  if (!appError) {
    return '';
  }
  return mapErrorToI18nKey(appError);
}

/**
 * 获取错误的可显示消息
 *
 * 优先级：
 * 1. 若是 AppError 且有 i18n key，返回 i18n key（调用方应通过 t() 渲染）
 * 2. 若是 AppError 但无 i18n key，返回 AppError.message（后备英文消息）
 * 3. 若不是 AppError，返回原始 error 字符串
 *
 * @param error - 来自 ApiResponse.error 的字符串
 * @returns 可显示的消息或 i18n key
 */
export function getDisplayableErrorMessage(error: string): string {
  const appError = tryParseAppError(error);
  if (!appError) {
    return error;
  }
  const i18nKey = mapErrorToI18nKey(appError);
  return i18nKey || appError.message || error;
}
