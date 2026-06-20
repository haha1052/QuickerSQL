// 面板类型
export type PanelType = 
  | 'sql_editor' 
  | 'results_grid' 
  | 'chart' 
  | 'query_plan'
  | 'explorer'
  | 'history'
  | 'schema';

// 单个面板
export interface Panel {
  id: string;
  type: PanelType;
  title: string;
  size: number; // 面板大小比例
  active: boolean;
  content: string | null;
}

// 工作区标签页类型
export type WorkspaceTabType = 'sql' | 'import' | 'visualization';

// 工作区标签页
export interface WorkspaceTab {
  id: string;
  title: string;
  type: WorkspaceTabType;
  panels: Panel[];
  active: boolean;
  createdAt: number;
  queryId: string; // 关联的查询 id
}

// 侧边栏状态
export interface SidebarState {
  collapsed: boolean;
  width: number;
  activeTab: 'explorer' | 'history' | 'snippets' | 'trash';
}

// 完整的工作区状态
export interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  sidebar: SidebarState;
}
