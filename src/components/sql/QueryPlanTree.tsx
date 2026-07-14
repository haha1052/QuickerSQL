import React from 'react';
import { useLocale } from '../../context/LocaleContext';

interface QueryPlanTreeProps {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  statement: string;
}

interface PlanNode {
  id: number;
  parent: number | null;
  detail: string;
  children: PlanNode[];
  depth: number;
}

/**
 * Detects if the result is from an EXPLAIN or EXPLAIN QUERY PLAN statement.
 */
export function isExplainResult(statement: string): boolean {
  const trimmed = statement.trimStart().toUpperCase();
  return trimmed.startsWith('EXPLAIN ') || trimmed.startsWith('EXPLAIN QUERY PLAN ');
}

/**
 * Renders EXPLAIN / EXPLAIN QUERY PLAN results.
 *
 * For SQLite EXPLAIN QUERY PLAN (columns: id, parent, notused, detail):
 *   - Parses rows into a tree based on parent-child relationships.
 *   - Renders as an indented tree.
 *
 * For DuckDB EXPLAIN (typically returns a formatted text plan):
 *   - Renders as pre-formatted text.
 */
export const QueryPlanTree: React.FC<QueryPlanTreeProps> = ({ columns, rows, statement }) => {
  const { t } = useLocale();
  const isSQLiteExplainQueryPlan =
    statement.trimStart().toUpperCase().startsWith('EXPLAIN QUERY PLAN ');

  // SQLite EXPLAIN QUERY PLAN format: id | parent | notused | detail
  const hasTreeStructure =
    isSQLiteExplainQueryPlan &&
    columns.length >= 4 &&
    columns[0]?.toLowerCase() === 'id' &&
    columns[1]?.toLowerCase() === 'parent';

  if (hasTreeStructure && rows.length > 0) {
    // Build tree from id/parent/detail
    const nodeMap = new Map<number, PlanNode>();
    const roots: PlanNode[] = [];

    rows.forEach((row) => {
      const id = Number(row[0] ?? 0);
      const parent = row[1] === null || row[1] === undefined || row[1] === '' ? null : Number(row[1]);
      const detail = String(row[3] ?? '');
      nodeMap.set(id, { id, parent, detail, children: [], depth: 0 });
    });

    // Link children to parents and compute depth
    nodeMap.forEach((node) => {
      if (node.parent !== null && nodeMap.has(node.parent)) {
        const parentNode = nodeMap.get(node.parent)!;
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const setDepth = (nodes: PlanNode[], depth: number) => {
      nodes.forEach((node) => {
        node.depth = depth;
        setDepth(node.children, depth + 1);
      });
    };
    setDepth(roots, 0);

    const flattenNodes = (nodes: PlanNode[]): PlanNode[] => {
      const result: PlanNode[] = [];
      nodes.forEach((node) => {
        result.push(node);
        result.push(...flattenNodes(node.children));
      });
      return result;
    };

    const flatNodes = flattenNodes(roots);

    return (
      <div style={styles.container}>
        <div style={styles.title}>{t('query.explainPlan')}</div>
        <div style={styles.tree}>
          {flatNodes.map((node) => (
            <div
              key={node.id}
              style={{
                ...styles.node,
                paddingLeft: `${node.depth * 24 + 8}px`,
              }}
            >
              {node.depth > 0 && <span style={styles.branch}>├─ </span>}
              <span style={styles.nodeText}>{node.detail}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // DuckDB EXPLAIN or other formats: render as pre-formatted text
  const textLines = rows.map((row) => row.map((cell) => String(cell ?? '')).join(' | '));

  return (
    <div style={styles.container}>
      <div style={styles.title}>{t('query.explainPlan')}</div>
      <pre style={styles.pre}>
        {textLines.join('\n')}
      </pre>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    overflow: 'auto',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-color)',
  },
  tree: {
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    fontSize: '13px',
    lineHeight: '1.8',
  },
  node: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  branch: {
    color: 'var(--text-tertiary)',
    marginRight: '4px',
    userSelect: 'none',
  },
  nodeText: {
    color: 'var(--text-primary)',
  },
  pre: {
    margin: 0,
    padding: '8px',
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    fontSize: '13px',
    lineHeight: '1.6',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '4px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
};
