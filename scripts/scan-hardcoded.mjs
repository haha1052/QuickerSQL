// 临时硬编码扫描脚本 — 复用 vite-plugin-hardcoded-detector 的排除逻辑
// 用法: node scripts/scan-hardcoded.mjs
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const CJK = /[\u4e00-\u9fff]/;

const EXCLUDE_FILE = [
  /\\context\\LocaleContext\.tsx$/,
  /\\__tests__\\/,
  /\.test\.tsx?$/,
  /\\types\\/,
  /\\scripts\\/,
];

const EXCLUDE_LINE = [
  /^\s*\/\//,
  /\/\*/,
  /\bconsole\.(log|warn|error|info|debug)\s*\(/,
  /\baddToast\s*\(/,
  /https?:\/\//,
  /^\s*import\s/,
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|TABLE|INDEX)\b\s/i,
  /zhCNTranslations|enUSTranslations|zhCNLocaleText|enUSLocaleText/,
  /RegExp|new RegExp/,
  // 纯 type 定义行的中文注释
  /^\s*\*?\s*\*/,
  // i18n:skip 白名单 — 标记"错误匹配逻辑/非 UI 展示文案"的中文（如 errorLower.includes('路径不存在')）
  /i18n:skip/,
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(extname(p))) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(SRC);
const hits = [];

for (const file of files) {
  const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  if (EXCLUDE_FILE.some(r => r.test(file) || r.test(rel))) continue;

  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!CJK.test(line)) continue;
    const stripped = line.trim();
    if (EXCLUDE_LINE.some(r => r.test(stripped))) continue;

    // 跳过纯 i18n key 字符串
    const fullStr = /['"`][^'"`]*['"`]/g;
    let m, hasCjkNonKey = false;
    while ((m = fullStr.exec(line)) !== null) {
      const s = m[0];
      if (CJK.test(s) && !/^['"`][a-z][a-z0-9_.]+['"`]$/.test(s)) {
        hasCjkNonKey = true;
        break;
      }
    }
    if (!hasCjkNonKey) continue;

    // 跳过纯变量插值模板
    if (/\$\{[^}]+\}.*[\u4e00-\u9fff]/.test(line) && !CJK.test(line.replace(/\$\{[^}]+\}/g, ''))) continue;

    hits.push({ file: rel, line: i + 1, content: stripped });
  }
}

// 按文件分组统计
const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}

console.log(`\n=== 硬编码扫描结果 ===`);
console.log(`总计: ${hits.length} 处 UI 中文硬编码，分布在 ${byFile.size} 个文件\n`);

const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [file, list] of sorted) {
  console.log(`\n--- ${file} (${list.length} 处) ---`);
  for (const h of list.slice(0, 8)) {
    const preview = h.content.length > 120 ? h.content.slice(0, 120) + '...' : h.content;
    console.log(`  L${h.line}: ${preview}`);
  }
  if (list.length > 8) console.log(`  ... 还有 ${list.length - 8} 处`);
}
