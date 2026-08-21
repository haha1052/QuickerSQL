#!/usr/bin/env node
/**
 * check-hardcoded-i18n.mjs
 *
 * CI-friendly script to detect hardcoded Chinese strings in frontend
 * production code. Scans src/ directory and reports violations.
 *
 * Usage:
 *   node scripts/check-hardcoded-i18n.mjs                # default baseline 0
 *   node scripts/check-hardcoded-i18n.mjs --baseline 30  # allow up to 30 pre-existing
 *   node scripts/check-hardcoded-i18n.mjs --strict        # fail on any violation
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const projectRoot = join(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
const baselineIdx = args.indexOf('--baseline');
const baseline = baselineIdx !== -1 ? parseInt(args[baselineIdx + 1], 10) : 0;
const strict = args.includes('--strict');

const CJK_REGEX = /[\u4e00-\u9fff]/;

const SCAN_DIRS = [
  'src/components',
  'src/pages',
  'src/store',
  'src/services',
  'src/utils',
  'src/context',
];

/**
 * Determine if a line is primarily a comment or documentation.
 * We skip these because Chinese in comments doesn't need i18n.
 */
function isCommentLine(line) {
  const trimmed = line.trim();
  // Pure comment lines
  if (/^\/\/.*$/.test(trimmed)) return true;
  if (/^\/\*.*$/.test(trimmed)) return true;
  if (/^\*($|\s|\/)/.test(trimmed)) return true;
  if (/^\*\//.test(trimmed)) return true;
  // Block comment content lines
  if (/^\s*\*\s/.test(line) || /^\s*\*\//.test(line)) return true;
  return false;
}

/**
 * Determine if a line has Chinese that should be flagged.
 * Only flags: actual code strings (quoted literals / template literals) containing Chinese
 * Does NOT flag: comments, JSDoc, SQL keywords in code structure
 */
function extractHardcodedStrings(line) {
  const stripped = line.trim();

  // Skip comments
  if (isCommentLine(line)) return [];

  // Skip import statements
  if (/^\s*import\s/.test(line)) return [];

  // Skip console logging
  if (/console\.(log|warn|error|info|debug)\s*\(/.test(line)) return [];

  // Skip addToast calls (they go through Toast's i18n layer already)
  if (/addToast\s*\(/.test(line)) return [];

  // Skip URLs
  if (/https?:\/\//.test(line)) return [];

  // Skip RegExp constructors
  if (/RegExp|new RegExp/.test(line)) return [];

  // Skip SQL statement parser/formatter files
  if (/sqlStatementParser|sqlFormatter/.test(line)) return [];

  const hits = [];

  // Pattern 1: Single/double-quoted string literals with Chinese
  // Match '...' or "..." and check if the content has Chinese
  const quotedRegex = /['"`]([^'"`]*?)['"`]/g;
  let match;
  while ((match = quotedRegex.exec(line)) !== null) {
    const content = match[1];
    if (CJK_REGEX.test(content)) {
      // Skip i18n key patterns (domain.section)
      if (/^[a-z][a-z0-9_.]+$/.test(content)) continue;
      // Skip pure SQL keywords
      if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|TABLE|INDEX)\b/i.test(content)) continue;
      hits.push(match[0]);
    }
  }

  // Pattern 2: Template literals with Chinese (check non-variable parts)
  const templateRegex = /`([^`]*)`/g;
  while ((match = templateRegex.exec(line)) !== null) {
    const content = match[1];
    if (CJK_REGEX.test(content)) {
      // Remove ${...} variable parts and check if Chinese still remains
      const withoutVars = content.replace(/\$\{[^}]+\}/g, '');
      if (CJK_REGEX.test(withoutVars)) {
        hits.push(match[0]);
      }
    }
  }

  // Pattern 3: JSX text content between tags
  // e.g., <div>中文文本</div>
  const jsxTextRegex = />([^<{]*?)<\/[a-zA-Z]/g;
  while ((match = jsxTextRegex.exec(line)) !== null) {
    const content = match[1].trim();
    if (content && CJK_REGEX.test(content) && !/^[a-z][a-z0-9_.]+$/.test(content)) {
      hits.push(match[0]);
    }
  }

  return hits;
}

function walkDir(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (entry === 'node_modules' || entry === '__tests__' || entry === 'generated') continue;
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

// Collect files
let allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles = allFiles.concat(walkDir(join(projectRoot, dir)));
}

// Exclude: types-only dir, i18n definition file, test files
allFiles = allFiles.filter(f =>
  !f.includes(`${join('src','types')}${/[\\/]/.test(f) ? '/' : ''}`) &&
  !f.endsWith(`LocaleContext${/[\\/]/.test(f) ? '.' : ''}tsx`)
);

// Scan each file
const results = [];
let totalHits = 0;

for (const filePath of allFiles) {
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const found = extractHardcodedStrings(line);
    if (found.length > 0) {
      hits.push({
        line: i + 1,
        content: line.trim(),
        matched: found.slice(0, 2).join('; '),
      });
    }
  }

  if (hits.length > 0) {
    results.push({
      file: relative(projectRoot, filePath),
      hitCount: hits.length,
      hits,
    });
    totalHits += hits.length;
  }
}

// Output
console.log('\n=== Hardcoded Chinese Detection (i18n Gate) ===');
console.log(`Files scanned: ${allFiles.length}`);
console.log(`Files with hardcoded Chinese: ${results.length}`);
console.log(`Total hardcoded hits: ${totalHits}`);
console.log('');

if (totalHits > 0) {
  console.log('=== Hardcoded Details (grouped by file) ===\n');
  for (const r of results.sort((a, b) => b.hitCount - a.hitCount)) {
    console.log(`FILE: ${r.file} (${r.hitCount} hits)`);
    for (const h of r.hits.slice(0, 5)) {
      const preview = h.content.length > 120 ? h.content.slice(0, 120) + '...' : h.content;
      console.log(`  L${h.line}: ${preview}`);
    }
    if (r.hitCount > 5) console.log(`  ... and ${r.hitCount - 5} more`);
    console.log('');
  }
}

// Exit code
const threshold = strict ? 0 : baseline;
if (totalHits <= threshold) {
  console.log(`PASS: hardcoded check passed (${totalHits} hits, threshold ${threshold})`);
  process.exit(0);
} else {
  const exceeded = totalHits - threshold;
  console.error(`FAIL: hardcoded check failed (${totalHits} hits, threshold ${threshold}, exceeded by ${exceeded})`);
  console.error('Action: Move hardcoded strings to LocaleContext.tsx and use useLocale().t(key)');
  console.error('Reference: docs/架构现状.md §国际化, .trae/rules/architecture.md §1.2');
  process.exit(1);
}