import type * as Monaco from 'monaco-editor';

/**
 * 快捷键作用域
 * - global: 全局快捷键，在应用任何地方都生效
 * - editor: 编辑器快捷键，仅在编辑器聚焦时生效
 */
export type ShortcutScope = 'global' | 'editor';

/**
 * 快捷键命令定义
 */
export interface ShortcutCommand {
  id: string;
  scope: ShortcutScope;
  handler: () => void;
  description?: string;
}

/**
 * 快捷键绑定
 */
export interface ShortcutBinding {
  commandId: string;
  keyString: string;
  keyCode: number;
}

const KEY_CODE_MAP: Record<string, Monaco.KeyCode> = {
  A: 31,
  B: 32,
  C: 33,
  D: 34,
  E: 35,
  F: 36,
  G: 37,
  H: 38,
  I: 39,
  J: 40,
  K: 41,
  L: 42,
  M: 43,
  N: 44,
  O: 45,
  P: 46,
  Q: 47,
  R: 48,
  S: 49,
  T: 50,
  U: 51,
  V: 52,
  W: 53,
  X: 54,
  Y: 55,
  Z: 56,
  '0': 11,
  '1': 2,
  '2': 3,
  '3': 4,
  '4': 5,
  '5': 6,
  '6': 7,
  '7': 8,
  '8': 9,
  '9': 10,
  F1: 59,
  F2: 60,
  F3: 61,
  F4: 62,
  F5: 63,
  F6: 64,
  F7: 65,
  F8: 66,
  F9: 67,
  F10: 68,
  F11: 69,
  F12: 70,
  Enter: 3,
  Escape: 9,
  Tab: 2,
  Space: 10,
  Backspace: 1,
  Delete: 20,
  ArrowUp: 16,
  ArrowDown: 18,
  ArrowLeft: 15,
  ArrowRight: 17,
  Home: 14,
  End: 13,
  PageUp: 11,
  PageDown: 12,
  ',': 84,
  '/': 89,
};

const KEY_CODE_TO_STRING_MAP: Record<number, string> = Object.entries(KEY_CODE_MAP).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<number, string>,
);

const MODIFIER_MAP: Record<string, number> = {
  Ctrl: 2048,
  Cmd: 2048,
  Control: 2048,
  Meta: 2048,
  Shift: 1024,
  Alt: 512,
  Option: 512,
};

const MODIFIER_VALUES: Array<[number, string]> = [
  [2048, 'Ctrl'],
  [1024, 'Shift'],
  [512, 'Alt'],
];

/**
 * 将快捷键字符串解析为 Monaco 的 keyCode 组合值
 * @param keyString 快捷键字符串，如 "Ctrl+Enter"、"Ctrl+Shift+F"
 * @returns Monaco keyCode 组合值，解析失败返回 0
 */
export function parseShortcut(keyString: string): number {
  if (!keyString || typeof keyString !== 'string') {
    return 0;
  }

  const parts = keyString
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) {
    return 0;
  }

  let result = 0;
  let hasKey = false;

  for (const part of parts) {
    const upperPart = part.charAt(0).toUpperCase() + part.slice(1);

    if (MODIFIER_MAP[upperPart] !== undefined) {
      result |= MODIFIER_MAP[upperPart];
    } else {
      const upperKey = part.toUpperCase();
      let keyCode: Monaco.KeyCode | undefined;

      if (KEY_CODE_MAP[upperKey] !== undefined) {
        keyCode = KEY_CODE_MAP[upperKey];
      } else if (KEY_CODE_MAP[upperPart] !== undefined) {
        keyCode = KEY_CODE_MAP[upperPart];
      } else if (part.length === 1 && /[a-zA-Z]/.test(part)) {
        keyCode = KEY_CODE_MAP[part.toUpperCase()];
      }

      if (keyCode !== undefined) {
        result |= keyCode;
        hasKey = true;
      } else {
        return 0;
      }
    }
  }

  if (!hasKey) {
    return 0;
  }

  return result;
}

/**
 * 将 Monaco keyCode 数字格式化为快捷键字符串
 * @param keyCode Monaco keyCode 组合值
 * @returns 格式化后的快捷键字符串，如 "Ctrl+Enter"
 */
export function formatShortcut(keyCode: number): string {
  if (!keyCode || keyCode === 0) {
    return '';
  }

  const parts: string[] = [];
  let remaining = keyCode;

  for (const [modValue, modName] of MODIFIER_VALUES) {
    if ((remaining & modValue) === modValue) {
      parts.push(modName);
      remaining -= modValue;
    }
  }

  if (remaining > 0) {
    const keyName = KEY_CODE_TO_STRING_MAP[remaining];
    if (keyName) {
      parts.push(keyName);
    } else {
      return '';
    }
  }

  return parts.join('+');
}

/**
 * 快捷键管理器
 *
 * 管理快捷键命令的注册、绑定、冲突检测等功能
 */
export class ShortcutManager {
  private commands: Map<string, ShortcutCommand> = new Map();
  private bindings: Map<string, ShortcutBinding> = new Map();
  private defaultBindings: Map<string, string> = new Map();

  /**
   * 注册一个快捷键命令
   * @param command 快捷键命令定义
   * @returns 注销函数
   */
  registerCommand(command: ShortcutCommand): () => void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }

    this.commands.set(command.id, command);

    return () => {
      this.commands.delete(command.id);
      this.bindings.delete(command.id);
    };
  }

  /**
   * 绑定快捷键到命令
   * @param commandId 命令 ID
   * @param keyString 快捷键字符串
   */
  bindShortcut(commandId: string, keyString: string): void {
    if (!this.commands.has(commandId)) {
      throw new Error(`Command "${commandId}" is not registered`);
    }

    const keyCode = parseShortcut(keyString);
    if (keyCode === 0) {
      throw new Error(`Invalid shortcut: ${keyString}`);
    }

    this.bindings.set(commandId, {
      commandId,
      keyString,
      keyCode,
    });
  }

  /**
   * 解绑命令的快捷键
   * @param commandId 命令 ID
   */
  unbindShortcut(commandId: string): void {
    this.bindings.delete(commandId);
  }

  /**
   * 更新命令的快捷键
   * @param commandId 命令 ID
   * @param keyString 新的快捷键字符串
   */
  updateShortcut(commandId: string, keyString: string): void {
    this.bindShortcut(commandId, keyString);
  }

  /**
   * 获取命令的当前快捷键字符串
   * @param commandId 命令 ID
   * @returns 快捷键字符串，如果未绑定则返回 undefined
   */
  getShortcut(commandId: string): string | undefined {
    const binding = this.bindings.get(commandId);
    return binding?.keyString;
  }

  /**
   * 获取命令的默认快捷键字符串
   * @param commandId 命令 ID
   * @returns 默认快捷键字符串，如果未设置则返回 undefined
   */
  getDefaultShortcut(commandId: string): string | undefined {
    return this.defaultBindings.get(commandId);
  }

  /**
   * 批量设置默认快捷键
   * @param defaults 默认快捷键映射 { commandId: keyString }
   */
  setDefaultShortcuts(defaults: Record<string, string>): void {
    for (const [commandId, keyString] of Object.entries(defaults)) {
      this.defaultBindings.set(commandId, keyString);
    }
  }

  /**
   * 将单个命令的快捷键重置为默认值
   * @param commandId 命令 ID
   */
  resetToDefault(commandId: string): void {
    const defaultKey = this.defaultBindings.get(commandId);
    if (defaultKey) {
      this.bindShortcut(commandId, defaultKey);
    } else {
      this.unbindShortcut(commandId);
    }
  }

  /**
   * 将所有命令的快捷键重置为默认值
   */
  resetAllToDefault(): void {
    for (const commandId of this.commands.keys()) {
      this.resetToDefault(commandId);
    }
  }

  /**
   * 查找快捷键冲突
   * @param keyString 快捷键字符串
   * @param scope 作用域
   * @param excludeCommandId 排除的命令 ID（可选）
   * @returns 冲突的命令 ID 数组
   */
  findConflicts(
    keyString: string,
    scope: ShortcutScope,
    excludeCommandId?: string,
  ): string[] {
    const keyCode = parseShortcut(keyString);
    if (keyCode === 0) {
      return [];
    }

    const conflicts: string[] = [];

    for (const [commandId, binding] of this.bindings) {
      if (excludeCommandId && commandId === excludeCommandId) {
        continue;
      }

      if (binding.keyCode !== keyCode) {
        continue;
      }

      const command = this.commands.get(commandId);
      if (command && command.scope === scope) {
        conflicts.push(commandId);
      }
    }

    return conflicts;
  }

  /**
   * 获取所有快捷键绑定
   * @returns 所有快捷键绑定数组
   */
  getAllBindings(): ShortcutBinding[] {
    return Array.from(this.bindings.values());
  }

  /**
   * 按作用域获取命令列表
   * @param scope 作用域
   * @returns 该作用域下的所有命令
   */
  getCommandsByScope(scope: ShortcutScope): ShortcutCommand[] {
    const result: ShortcutCommand[] = [];
    for (const command of this.commands.values()) {
      if (command.scope === scope) {
        result.push(command);
      }
    }
    return result;
  }
}

/**
 * 全局快捷键管理器单例
 */
const shortcutManager = new ShortcutManager();

export default shortcutManager;
