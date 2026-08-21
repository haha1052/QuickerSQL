/**
 * vite-plugin-hardcoded-detector
 *
 * A Vite plugin that scans .ts/.tsx files for hardcoded Chinese strings
 * during development. When a new hardcoded string is introduced, the plugin
 * logs a warning in the dev console and optionally fails the build in CI.
 *
 * Usage: Add to vite.config.ts plugins array
 *   import hardcodedDetector from './scripts/vite-plugin-hardcoded-detector';
 *   plugins: [react(), hardcodedDetector()]
 *
 * Detection rules:
 * - Only scans .ts/.tsx files under src/ (excluding node_modules/__tests__)
 * - Ignores comments, console logs, imports, URLs, SQL keywords
 * - Ignores strings that look like i18n keys (domain.section pattern)
 *
 * This does NOT replace proper migration to LocaleContext.t() — it is an
 * early-warning mechanism to prevent new hardcoded strings from being
 * committed while the incremental migration is in progress.
 */
import type { Plugin } from 'vite';
import { parse } from 'path';
import { readFileSync } from 'fs';

const CJK_REGEX = /[\u4e00-\u9fff]/;

// Exclusion patterns applied to the source file before scanning
const EXCLUSION_REGEXES: RegExp[] = [
  /^\s*\/\//,
  /\/\*/,
  /\bconsole\.(log|warn|error|info|debug)\s*\(/,
  /\baddToast\s*\(/,
  /https?:\/\//,
  /^\s*import\s/,
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|TABLE|INDEX)\b\s/i,
  /zhCNTranslations|enUSTranslations/,
  /RegExp|new RegExp/,
];

interface PluginOptions {
  /** Set to true to fail the build when hardcoded strings are found (CI mode) */
  strict?: boolean;
  /** Baseline count (allow this many pre-existing hardcoded strings) */
  baseline?: number;
}

export default function hardcodedDetector(options: PluginOptions = {}): Plugin {
  const { strict = false, baseline = 0 } = options;
  const fileHits = new Map<string, { line: number; content: string }[]>();

  function scanSource(id: string, code: string): void {
    if (!id.endsWith('.tsx') && !id.endsWith('.ts')) return;
    if (!id.includes('src/')) return;
    if (id.includes('node_modules') || id.includes('__tests__')) return;
    // Skip LocaleContext itself (definition file)
    if (id.endsWith('LocaleContext.tsx')) return;
    // Skip types (can't contain runtime strings)
    if (id.includes('src/types/')) return;

    const lines = code.split('\n');
    const hits: { line: number; content: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!CJK_REGEX.test(line)) continue;

      // Apply exclusions
      const stripped = line.trim();
      if (EXCLUSION_REGEXES.some(r => r.test(stripped))) continue;

      // Skip i18n-style strings (like 'domain.key')
      const i18nKeyRegex = /['"`][a-z][a-z0-9_.]+['"`]/;
      if (i18nKeyRegex.test(line)) {
        // Only skip if the entire string literal is an i18n key
        // This allows mixed strings like 'hello ' + t('key') to still be caught
        const fullStringRegex = /['"`][^'"`]*['"`]/g;
        let m: RegExpExecArray | null;
        let hasCjkInNonKeyPart = false;
        while ((m = fullStringRegex.exec(line)) !== null) {
          if (CJK_REGEX.test(m[0]) && !/^['"`][a-z][a-z0-9_.]+['"`]$/.test(m[0])) {
            hasCjkInNonKeyPart = true;
            break;
          }
        }
        if (!hasCjkInNonKeyPart) continue;
      }

      // Skip template literals that are entirely variable-based
      if (/\$\{[^}]+\}.*[\u4e00-\u9fff]/.test(line) && !CJK_REGEX.test(line.replace(/\$\{[^}]+\}/g, ''))) {
        continue;
      }

      hits.push({ line: i + 1, content: line.trim() });
    }

    fileHits.set(id, hits);
  }

  function printReport(): void {
    let total = 0;
    const fileCounts: { id: string; count: number }[] = [];

    for (const [id, hits] of fileHits) {
      if (hits.length === 0) continue;
      total += hits.length;
      fileCounts.push({ id, count: hits.length });
    }

    if (total === 0) return;

    const relative = (id: string) => id.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');

    console.warn('\n⚠️  [i18n] Hardcoded Chinese strings detected (migration in progress):');
    console.warn('      ' + '='.repeat(60));

    for (const { id, count } of fileCounts.sort((a, b) => b.count - a.count)) {
      console.warn(`      ${relative(id)} (${count} hits)`);
      const hits = fileHits.get(id) || [];
      for (const h of hits.slice(0, 3)) {
        const preview = h.content.length > 100 ? h.content.slice(0, 100) + '...' : h.content;
        console.warn(`        L${h.line}: ${preview}`);
      }
      if (count > 3) console.warn(`        ... and ${count - 3} more`);
    }

    console.warn('      ' + '='.repeat(60));
    console.warn(`      Total: ${total} hardcoded strings (baseline: ${baseline})`);
    console.warn('      Fix: Move to LocaleContext.tsx and use t(\'key\')\n');

    if (strict && total > baseline) {
      throw new Error(
        `[i18n] Hardcoded check failed: ${total} strings found, baseline ${baseline}. ` +
        `Exceeds by ${total - baseline}. ` +
        `Migrate hardcoded strings to LocaleContext.tsx and use useLocale().t(key).`
      );
    }
  }

  let initialized = false;

  return {
    name: 'hardcoded-detector',
    enforce: 'pre' as const,

    configResolved() {
      if (!initialized) {
        initialized = true;
        // Print baseline info once per dev session
        console.info('[i18n] Hardcoded detector active — new Chinese strings will trigger warnings');
      }
    },

    transform(code: string, id: string) {
      if (!id.endsWith('.tsx') && !id.endsWith('.ts')) return null;
      scanSource(id, code);
      return null;
    },

    buildStart() {
      fileHits.clear();
    },

    buildEnd() {
      printReport();
    },

    // In serve mode, report on HMR updates
    handleHotUpdate(ctx) {
      const id = ctx.file;
      if (id.endsWith('.tsx') || id.endsWith('.ts')) {
        try {
          const code = readFileSync(id, 'utf-8');
          scanSource(id, code);
        } catch {
          // ignore read errors
        }
      }
      return [];
    },

    configureServer(server) {
      server.ws.on('connection', () => {
        // Clear and rescan on dev server connection
        fileHits.clear();
      });
    },
  };
}