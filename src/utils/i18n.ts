/**
 * i18n Utility - Internationalization Helper
 *
 * This module provides:
 * 1. Typed i18n key access (via TKey type) to prevent typos
 * 2. Dev-time missing-key detection: logs warnings when keys are missing
 * 3. Convenience helpers for common i18n patterns
 *
 * Integration:
 * - Import `useLocale` from `../context/LocaleContext` in components
 * - Use `t('domain.key')` for all user-facing strings
 * - For new components, follow the template in docs/i18n-component-template.ts
 *
 * Naming Convention:
 *   domain.section.item  (lowercase, dot-separated)
 *
 * Example domains:
 *   common.*     - Shared UI labels
 *   error.*      - Error messages
 *   toast.*      - Toast notifications
 *   import.*     - Data import feature
 *   dashboard.*  - Dashboard feature
 *   chart.*      - Chart feature
 *   automation.* - Automation task feature
 *   sql.*        - SQL editor/query feature
 */

/**
 * Check if a string contains Chinese characters (CJK unified ideographs)
 * Utility for dev-time detection of hardcoded strings
 */
export function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fff]/.test(str);
}

/**
 * Strip comments from a source line for hardcoded detection
 */
export function stripComments(line: string): string {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '')
    .trim();
}

/**
 * Extract string literals containing Chinese from source code
 * Used for static analysis tooling
 */
export function extractChineseLiterals(source: string): { value: string; line: number }[] {
  const lines = source.split('\n');
  const results: { value: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripComments(line);

    // Skip import statements
    if (/^\s*import\s/.test(line)) continue;
    // Skip console logging
    if (/console\.(log|warn|error|info|debug)\s*\(/.test(line)) continue;

    // Match string literals containing Chinese
    const stringRegex = /['"`]([^'"`]*[\u4e00-\u9fff]+[^'"`]*)['"`]/g;
    let match: RegExpExecArray | null;
    while ((match = stringRegex.exec(stripped)) !== null) {
      const value = match[1];
      // Exclusion: i18n keys (domain.section pattern), URLs, SQL keywords
      if (/^[a-z][a-z0-9_.]+$/.test(value)) continue;
      if (/^https?:\/\//.test(value)) continue;
      if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(value)) continue; // safe_sql: SQL 关键字检测逻辑（i18n 文案中跳过 SQL 语句）

      results.push({ value, line: i + 1 });
    }
  }

  return results;
}

/**
 * Dev-time validator: checks if a translation key exists in the loaded translations
 * Logs a warning in DEV mode when a component references a non-existent key
 *
 * Usage (in LocaleContext.tsx's t() function):
 *   if (import.meta.env.DEV) {
 *     validateKey(key);
 *   }
 */
const knownKeys = new Set<string>();
const missingKeys = new Set<string>();

export function registerKnownKeys(keys: readonly string[]): void {
  for (const k of keys) knownKeys.add(k);
}

export function validateKey(key: string): 'known' | 'missing' | 'zh-fallback' {
  if (knownKeys.has(key)) return 'known';
  if (!missingKeys.has(key)) {
    missingKeys.add(key);
    console.warn(`[i18n] Missing translation key: "${key}"`);
  }
  return 'missing';
}

export function getMissingKeys(): string[] {
  return Array.from(missingKeys);
}

/**
 * Component template metadata for i18n compliance
 * New components should include this comment block
 */
export const I18N_TEMPLATE = `/**
 * @i18n This component uses internationalization via useLocale()
 * @i18n-domain {component-domain} - replace with actual domain prefix
 * @i18n-keys Expected keys used:
 *   - {domain}.title
 *   - {domain}.label
 *   - error.{domain}.action_failed
 */`;