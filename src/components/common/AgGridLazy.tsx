import React, { useEffect, useRef, useState } from 'react';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import type { TableColumnDef, TableRowData } from '../../types/table';

// P0-2 启动优化：ag-grid 懒加载封装
// 原始的 import AgGridReact / ModuleRegistry 在启动时会立即加载大体积库，
// 通过动态 import 将首次加载延迟到组件挂载时（≈100-300ms 节省）

interface AgGridLazyProps {
  rowData: TableRowData[];
  columnDefs: TableColumnDef[];
  localeText?: Record<string, string>;
  defaultColDef?: ColDef<TableRowData>;
  domLayout?: 'autoHeight' | 'normal' | 'print';
  style?: React.CSSProperties;
  className?: string;
  containerStyle?: React.CSSProperties;
  onGridReady?: (params: GridReadyEvent<TableRowData>) => void;
  pagination?: boolean;
  paginationPageSize?: number;
  suppressRowHoverHighlight?: boolean;
  animateRows?: boolean;
  [key: string]: unknown;
}

interface AgGridReactModule {
  AgGridReact: React.ComponentType<Record<string, unknown>>;
}

interface AgGridCommunityModule {
  ModuleRegistry: {
    registerModules: (modules: unknown[]) => void;
  };
  AllCommunityModule: unknown;
}

/**
 * 懒加载版的 <AgGridReact />：
 * - 首次调用 `getAgGridComponents()` → 一次性 import 所有需要的 ag-grid 模块
 * - 注册到全局 ModuleRegistry（只注册一次）
 * - 返回 AgGridReact 组件
 */
let moduleRegistrationPromise: Promise<AgGridReactModule> | null = null;
let cachedAgGridReact: AgGridReactModule | null = null;

function getAgGridComponents(): Promise<AgGridReactModule> {
  if (cachedAgGridReact) return Promise.resolve(cachedAgGridReact);
  if (moduleRegistrationPromise) return moduleRegistrationPromise;

  moduleRegistrationPromise = Promise.all([
    import('ag-grid-react'),
    import('ag-grid-community'),
  ]).then(([react, community]) => {
    const comm = community as unknown as AgGridCommunityModule;
    try {
      comm.ModuleRegistry.registerModules([comm.AllCommunityModule]);
    } catch {
      // 多实例场景下重复注册是安全的
    }
    cachedAgGridReact = react as unknown as AgGridReactModule;
    return cachedAgGridReact;
  });
  return moduleRegistrationPromise;
}

export const AgGridLazy: React.FC<AgGridLazyProps> = (props) => {
  const [AgGridReact, setAgGridReact] = useState<AgGridReactModule | null>(null);
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);
  const gridApiRef = useRef<GridApi<TableRowData> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    getAgGridComponents()
      .then((cmp) => {
        if (mountedRef.current) {
          setAgGridReact(cmp);
          // 下一帧再渲染表格，避免首帧内容跳动
          setTimeout(() => mountedRef.current && setReady(true), 0);
        }
      })
      .catch((e: unknown) => {
        console.error('[AgGridLazy] 动态加载失败:', e);
      });
    return () => {
      mountedRef.current = false;
      if (gridApiRef.current) {
        try {
          gridApiRef.current.destroy();
        } catch {
          /* ignore */
        }
        gridApiRef.current = null;
      }
    };
  }, []);

  if (!AgGridReact || !ready) {
    // 加载过程中显示占位骨架屏（与 ag-grid 主题尺寸大致匹配）
    return (
      <div
        className={props.className}
        style={{
          ...props.style,
          background: 'var(--bg-secondary)',
          borderRadius: 4,
        }}
      >
        <div style={{
          height: 40,
          background: 'linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0.1), rgba(0,0,0,0.04))',
          borderRadius: 4,
        }} />
      </div>
    );
  }

  const {
    rowData,
    columnDefs,
    localeText,
    defaultColDef,
    domLayout,
    style,
    className,
    containerStyle,
    onGridReady,
    ...rest
  } = props;

  // 透传原生回调，并缓存 api 实例
  const handleGridReady = (params: GridReadyEvent<TableRowData>) => {
    gridApiRef.current = params.api ?? null;
    if (onGridReady) {
      onGridReady(params);
    }
  };

  const Component = AgGridReact.AgGridReact;
  return (
    <div
      className={className}
      style={{ ...style, ...containerStyle }}
    >
      <Component
        rowData={rowData}
        columnDefs={columnDefs}
        localeText={localeText}
        defaultColDef={defaultColDef}
        animateRows={props.animateRows ?? true}
        domLayout={domLayout}
        onGridReady={handleGridReady}
        {...rest}
      />
    </div>
  );
};

export default AgGridLazy;