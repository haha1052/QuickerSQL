import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type {
  ApiResponse,
  DatabaseStatus,
  BatchExecuteResult,
  CsvPreview,
  ExcelPreview,
  ImportRequest,
  DatabaseInfo,
  QueryHistoryListRequest,
  QueryHistoryListResponse,
  QueryHistoryItem,
  UpdateFavoriteRequest,
  SettingsListResponse,
  SettingItem,
  UpdateSettingRequest,
  ExportSettingsResponse,
  ImportSettingsRequest,
  QueryCacheStats,
  QueryAuditLogsRequest,
  AuditLogsListResponse,
  TableInfo,
  ColumnInfo,
} from '../types';
import type {
  Dashboard,
  SavedChart,
  SavedQuery,
  DashboardItem,
} from '../types/dashboard';
import type {
  Task,
  TaskRun,
  TaskListResponse,
  CreateTaskPayload,
  UpdateTaskPayload,
} from '../types/automation';
import type {
  ProfileResult,
} from '../types/profile';

/**
 * Tauri Service Layer
 * 统一封装所有与后端的通信
 */
class TauriService {
  private static instance: TauriService;

  private constructor() {}

  public static getInstance(): TauriService {
    if (!TauriService.instance) {
      TauriService.instance = new TauriService();
    }
    return TauriService.instance;
  }

  /**
   * Generic invoke wrapper with unified error handling
   */
  private async invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<ApiResponse<T>> {
    try {
      const data = await invoke<T>(command, args);
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  // ============ Database Operations ============

  /**
   * Get list of available databases
   */
  async listDatabases(): Promise<ApiResponse<DatabaseInfo[]>> {
    return this.invokeCommand<DatabaseInfo[]>('list_databases');
  }

  /**
   * Get database status
   */
  async getDatabaseStatus(): Promise<ApiResponse<DatabaseStatus>> {
    return this.invokeCommand<DatabaseStatus>('get_database_status');
  }

  /**
   * Get all database status
   */
  async getAllDatabaseStatus(): Promise<ApiResponse<DatabaseStatus[]>> {
    return this.invokeCommand<DatabaseStatus[]>('get_all_database_status');
  }

  // ============ File Operations ============

  /**
   * Load CSV file
   */
  async loadCsv(filePath: string): Promise<ApiResponse<CsvPreview>> {
    return this.invokeCommand<CsvPreview>('load_csv', { filePath });
  }

  /**
   * Get Excel sheets
   */
  async getExcelSheets(filePath: string): Promise<ApiResponse<ExcelPreview>> {
    return this.invokeCommand<ExcelPreview>('get_excel_sheets', { filePath });
  }

  /**
   * Load Excel sheet
   */
  async loadExcelSheet(filePath: string, sheetName: string): Promise<ApiResponse<CsvPreview>> {
    return this.invokeCommand<CsvPreview>('load_excel_sheet', { filePath, sheetName });
  }

  // ============ Import Operations ============

  /**
   * Import data (V1 - deprecated)
   */
  async importData(request: ImportRequest): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('import_data', { request });
  }

  /**
   * Import data (V2 - preferred, reads complete file)
   * 添加 30 秒全局超时保护，防止长时间阻塞
   */
  async importDataV2(request: {
    file_path: string;
    sheet_name?: string;
    table_name: string;
    has_header: boolean;
    fields: Array<{ name: string; dataType: string }>;
  }): Promise<ApiResponse<string>> {
    const TIMEOUT_MS = 30000; // 30 秒超时
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    // 创建超时 Promise
    const timeoutPromise = new Promise<ApiResponse<string>>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: '导入超时，请检查文件/数据库',
        });
      }, TIMEOUT_MS);
    });

    // 创建导入任务 Promise
    const importTask = this.invokeCommand<string>('import_data_v2', { request });

    // 使用 Promise.race 竞争
    const result = await Promise.race([importTask, timeoutPromise]);
    
    // 清理 setTimeout（无论哪个先完成，避免内存泄漏）
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    return result;
  }

  // ============ Query Operations ============

  /**
   * Execute SQL query
   */
  async executeSql(sql: string): Promise<ApiResponse<BatchExecuteResult>> {
    return this.invokeCommand<BatchExecuteResult>('execute_sql', { sql });
  }

  /**
   * List tables with metadata (row_count / column_count / is_system_table)
   */
  async listTables(): Promise<ApiResponse<TableInfo[]>> {
    return this.invokeCommand<TableInfo[]>('list_tables');
  }

  /**
   * Get columns of a table (via PRAGMA table_info)
   */
  async getTableColumns(tableName: string): Promise<ApiResponse<ColumnInfo[]>> {
    return this.invokeCommand<ColumnInfo[]>('get_table_columns', { tableName });
  }

  /**
   * Delete table
   */
  async deleteTable(tableName: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('delete_table', { tableName });
  }

  /**
   * Rename a table
   * Note: System tables are not allowed to be renamed (enforced by backend)
   */
  async renameTable(oldTableName: string, newTableName: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('rename_table', { oldTableName, newTableName });
  }

  /**
   * Get extended table meta info (index count, estimated size)
   */
  async getTableMeta(tableName: string): Promise<ApiResponse<{ index_count: number; size_bytes: number }>> {
    return this.invokeCommand<{ index_count: number; size_bytes: number }>('get_table_meta', { tableName });
  }

  /**
   * Get table row count
   */
  async getTableRowCount(tableName: string): Promise<ApiResponse<number>> {
    return this.invokeCommand<number>('get_table_row_count', { tableName });
  }

  // ============ Project Operations ============

  /**
   * Create project
   */
  async createProject(projectName: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('create_project', { projectName });
  }

  /**
   * Open project
   */
  async openProject(dbPath: string): Promise<ApiResponse<boolean>> {
    return this.invokeCommand<boolean>('open_project', { dbPath });
  }

  /**
   * List projects
   */
  async listProjects(): Promise<ApiResponse<string[]>> {
    return this.invokeCommand<string[]>('list_projects');
  }

  /**
   * Delete project
   */
  async deleteProject(projectName: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('delete_project', { projectName });
  }

  /**
   * Rename project
   */
  async renameProject(oldName: string, newName: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('rename_project', { oldName, newName });
  }

  /**
   * Switch project
   */
  async switchProject(projectName: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('switch_project', { projectName });
  }

  /**
   * Open database from path
   */
  async openDatabaseFromPath(dbPath: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('open_database_from_path', { dbPath });
  }

  /**
   * Export database
   */
  async exportDatabase(destPath: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('export_database', { destPath });
  }

  /**
   * Get current database path
   */
  async getCurrentDbPath(): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('get_current_db_path');
  }

  /**
   * Export selected projects
   */
  async exportSelectedProjects(selectedProjects: string[], destDir: string): Promise<ApiResponse<string[]>> {
    return this.invokeCommand<string[]>('export_selected_projects', { selectedProjects, destDir });
  }

  // ============ Utility Operations ============

  /**
   * Write text file
   */
  async writeTextFile(path: string, content: string): Promise<ApiResponse<void>> {
    return this.invokeCommand<void>('write_text_file', { path, content });
  }

  /**
   * Save chart image with file dialog
   */
  async saveChartImage(base64Data: string, defaultFileName: string): Promise<boolean> {
    try {
      // 打开文件保存对话框
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [
          {
            name: 'PNG Image',
            extensions: ['png'],
          },
        ],
      });

      if (!filePath) {
        return false;
      }

      // 调用后端命令保存文件（通过统一的 invokeCommand 通道，确保错误处理一致
      const result = await this.invokeCommand<void>('save_chart_image', {
        request: {
          file_path: filePath,
          base64_data: base64Data,
        },
      });

      return result.success;
    } catch (error) {
      console.error('Failed to save chart image:', error);
      return false;
    }
  }

  // ============ Trash Operations ============

  /**
   * Get trash list
   */
  async getTrashList(): Promise<ApiResponse<{ items: Array<{
    id: string;
    original_table_name: string;
    trash_table_name?: string;
    trash_file_path?: string;
    row_count: number;
    strategy: string;
    deleted_at: string;
    deleted_by?: string;
  }>; total: number }>> {
    return this.invokeCommand('get_trash_list');
  }

  /**
   * Move table to trash
   */
  async moveToTrash(tableName: string): Promise<ApiResponse<{
    id: string;
    original_table_name: string;
    trash_table_name?: string;
    trash_file_path?: string;
    row_count: number;
    strategy: string;
    deleted_at: string;
    deleted_by?: string;
  }>> {
    return this.invokeCommand('move_to_trash', { tableName });
  }

  /**
   * Restore table from trash
   */
  async restoreFromTrash(trashId: string): Promise<ApiResponse<string>> {
    return this.invokeCommand('restore_from_trash', { trashId });
  }

  /**
   * Permanent delete from trash
   */
  async permanentDelete(trashId: string): Promise<ApiResponse<string>> {
    return this.invokeCommand('permanent_delete', { trashId });
  }

  // ============ Query History Operations ============

  /**
   * Get query history list
   */
  async getQueryHistory(
    request: QueryHistoryListRequest
  ): Promise<ApiResponse<QueryHistoryListResponse>> {
    return this.invokeCommand('get_query_history', { request });
  }

  /**
   * Record query history (manual recording)
   */
  async recordQueryHistory(request: {
    sql: string;
    name?: string | null;
    execution_time_ms?: number | null;
    row_count?: number | null;
    success: boolean;
    error_message?: string | null;
  }): Promise<ApiResponse<QueryHistoryItem>> {
    return this.invokeCommand('record_query_history', { request });
  }

  /**
   * Execute SQL and automatically record to query history (unified dual-write encapsulation)
   * 同时写入前端 store 和后端持久化存储
   */
  async executeSqlAndRecord(request: {
    sql: string;
    name?: string;
    execution_time_ms?: number | null;
    row_count?: number | null;
    success: boolean;
    error_message?: string | null;
  }): Promise<ApiResponse<QueryHistoryItem>> {
    return this.invokeCommand('record_query_history', { request });
  }

  /**
   * Update favorite status of a query history item
   */
  async updateQueryFavorite(request: UpdateFavoriteRequest): Promise<ApiResponse<void>> {
    return this.invokeCommand('update_query_favorite', { request });
  }

  /**
   * Delete query history item
   */
  async deleteQueryHistory(id: string): Promise<ApiResponse<void>> {
    return this.invokeCommand('delete_query_history', { id });
  }

  /**
   * Cleanup old history items
   */
  async cleanupOldHistory(keepDays?: number | null): Promise<ApiResponse<number>> {
    return this.invokeCommand('cleanup_old_history', { keepDays });
  }

  // ============ Chart Operations ============

  /**
   * Get recommended chart types for data
   */
  async getRecommendedChartTypes(request: {
    columns: string[];
    rows: string[][];
  }): Promise<ApiResponse<string[]>> {
    return this.invokeCommand('get_recommended_chart_types', { request });
  }

  /**
   * Get saved query by ID
   */
  async getSavedQuery(id: string): Promise<ApiResponse<SavedQuery>> {
    return this.invokeCommand<SavedQuery>('get_saved_query', { id });
  }

  /**
   * Generate chart configuration
   */
  async generateChartConfig(request: {
    columns: string[];
    rows: string[][];
    chart_type?: string | null;
    x_axis_column?: string | null;
    y_axis_columns?: string[] | null;
  }): Promise<ApiResponse<{
    title: { text?: string; left: string };
    tooltip: { trigger: string; axisPointer: { type: string } };
    legend: { data: string[]; top: string };
    xAxis: Array<{ type?: string; data?: string[]; name?: string }>;
    yAxis: Array<{ type?: string; data?: string[]; name?: string }>;
    series: Array<{
      name: string;
      type: string;
      data: number[];
      stack?: string;
      areaStyle?: object;
    }>;
    dataZoom?: Array<{ type: string; start: number; end: number }>;
  }>> {
    return this.invokeCommand('generate_chart_config', { request });
  }

  // ============ Settings Operations ============

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<ApiResponse<SettingsListResponse>> {
    return this.invokeCommand('get_all_settings_cmd');
  }

  /**
   * Get single setting
   */
  async getSetting(category: string, key: string): Promise<ApiResponse<SettingItem | null>> {
    return this.invokeCommand('get_setting_cmd', { category, key });
  }

  /**
   * Update single setting
   */
  async updateSetting(category: string, key: string, value: string): Promise<ApiResponse<SettingItem>> {
    return this.invokeCommand('update_setting_cmd', { category, key, value });
  }

  /**
   * Batch update settings
   */
  async batchUpdateSettings(settings: UpdateSettingRequest[]): Promise<ApiResponse<SettingItem[]>> {
    return this.invokeCommand('batch_update_settings_cmd', { settings });
  }

  /**
   * Reset settings (category or all)
   */
  async resetSettings(category?: string): Promise<ApiResponse<void>> {
    return this.invokeCommand('reset_settings_cmd', { category });
  }

  /**
   * Export settings to file
   */
  async exportSettings(): Promise<ApiResponse<ExportSettingsResponse>> {
    return this.invokeCommand('export_settings_cmd');
  }

  /**
   * Import settings from file
   */
  async importSettings(request: ImportSettingsRequest): Promise<ApiResponse<void>> {
    return this.invokeCommand('import_settings_cmd', { request });
  }

  // ============ Query Cache Operations ============

  /**
   * Get query cache statistics (capacity, size, hits, misses, hit rate, enabled state)
   */
  async getQueryCacheStats(): Promise<ApiResponse<QueryCacheStats>> {
    return this.invokeCommand<QueryCacheStats>('get_query_cache_stats');
  }

  /**
   * Configure query cache (capacity, ttl, enabled)
   * Note: Tauri v2 converts camelCase to snake_case for Rust parameters,
   * but we explicitly pass snake_case keys here for clarity.
   */
  async configureQueryCache(params: {
    capacity: number;
    ttlSeconds: number;
    enabled: boolean;
  }): Promise<ApiResponse<boolean>> {
    return this.invokeCommand<boolean>('configure_query_cache', {
      capacity: params.capacity,
      ttl_seconds: params.ttlSeconds,
      enabled: params.enabled,
    });
  }

  /**
   * Clear the query cache (reset hits/misses/entries)
   * Returns the new stats snapshot after clearing
   */
  async clearQueryCache(): Promise<ApiResponse<QueryCacheStats>> {
    return this.invokeCommand<QueryCacheStats>('clear_query_cache');
  }

  // ============ Audit Log Operations ============

  /**
   * Query audit logs with filters
   */
  async getAuditLogs(
    request: QueryAuditLogsRequest
  ): Promise<ApiResponse<AuditLogsListResponse>> {
    return this.invokeCommand('query_audit_logs_cmd', { request });
  }

  /**
   * Count total audit logs
   */
  async countAuditLogs(): Promise<ApiResponse<number>> {
    return this.invokeCommand('count_audit_logs_cmd');
  }

  /**
   * Clean up expired audit logs
   */
  async cleanupExpiredAuditLogs(retentionDays: number): Promise<ApiResponse<number>> {
    return this.invokeCommand('cleanup_expired_audit_logs_cmd', { retention_days: retentionDays });
  }

  /**
   * Clear all audit logs
   */
  async clearAllAuditLogs(): Promise<ApiResponse<void>> {
    return this.invokeCommand('clear_all_audit_logs_cmd');
  }

  // ============ App State Operations ============

  /**
   * Get single app state (application-level configuration,
   * 应用级状态（如：是否首次启动、版本号等）
   */
  async getAppState(
    category: string,
    key: string
  ): Promise<ApiResponse<{ category: string; key: string; value: string } | null>> {
    return this.invokeCommand('get_app_state_cmd', { category, key });
  }

  /**
   * Get all app states by category
   */
  async getAppStatesByCategory(
    category: string
  ): Promise<ApiResponse<Array<{ category: string; key: string; value: string }>>> {
    return this.invokeCommand('get_app_states_by_category_cmd', { category });
  }

  /**
   * Update app state (creates if not exists)
   */
  async updateAppState(
    category: string,
    key: string,
    value: string,
    description?: string
  ): Promise<ApiResponse<void>> {
    return this.invokeCommand('update_app_state_cmd', {
      category, key, value, description });
  }

  // ============ Workspace Persistence ============

  /**
   * Save current workspace layout
   * 保存当前工作区布局（tabs + panels）
   */
  async saveWorkspace(tabs: Array<{
    id: string; title: string; tab_type: string; position: number; is_active: boolean; panels: Array<{
      id: string; panel_type: string; title: string; size: number; sql_content?: string | null; is_active: boolean; position: number;
    }>;
  }>): Promise<ApiResponse<void>> {
    return this.invokeCommand('save_workspace_cmd', { tabs });
  }

  /**
   * Load saved workspace layout
   */
  async loadWorkspace(): Promise<ApiResponse<Array<{
    id: string; title: string; tab_type: string; position: number; is_active: boolean; panels: Array<{
      id: string; panel_type: string; title: string; size: number; sql_content?: string | null; is_active: boolean; position: number;
    }>;
  }>>> {
    return this.invokeCommand('load_workspace_cmd');
  }

  // ============ Dashboard Operations ============

  /**
   * Get saved charts with optional filters
   */
  async getSavedCharts(queryId?: string, tags?: string[]): Promise<ApiResponse<SavedChart[]>> {
    const args: Record<string, unknown> = {};
    if (queryId !== undefined && queryId !== null) {
      args.queryId = queryId;
    }
    if (tags !== undefined && tags !== null) {
      args.tags = tags;
    }
    return this.invokeCommand<SavedChart[]>('get_saved_charts', args);
  }

  /**
   * Create a new saved chart
   * 注意：Tauri v2 #[tauri::command] 会自动将 Rust 的 snake_case 参数名转换为 camelCase
   * 因此前端必须传递 camelCase 参数名（如 queryId），后端接收时是 snake_case（如 query_id）
   */
  async createSavedChart(params: {
    name: string;
    queryId: string;
    querySql: string;
    chartType: string;
    xAxis: string;
    yAxis: string[];
    title?: string;
    tags?: string[];
    description?: string;
    config?: Record<string, unknown>;
    visibility?: 'all' | 'restricted';
    authorizedDashboardIds?: string[];
  }): Promise<ApiResponse<SavedChart>> {
    const args = {
      name: params.name,
      queryId: params.queryId,
      querySql: params.querySql || '',
      chartType: params.chartType,
      xAxis: params.xAxis,
      yAxis: JSON.stringify(params.yAxis || []),
      title: params.title || '',
      tags: params.tags || [],
      description: params.description || '',
      config: params.config && Object.keys(params.config).length > 0
        ? JSON.stringify(params.config, (_key, value) => {
          if (typeof value === 'number' && !Number.isFinite(value)) {
            return null;
          }
          return value;
        })
        : null,
      visibility: params.visibility || 'all',
      authorizedDashboardIds: params.authorizedDashboardIds || [],
    };
    return this.invokeCommand<SavedChart>('create_saved_chart', args);
  }

  /**
   * Update a saved chart（编辑图表配置、类型、坐标轴、SQL、授权范围等）
   */
  async updateSavedChart(params: {
    id: string;
    name?: string;
    chartType?: string;
    xAxis?: string;
    yAxis?: string[];
    title?: string;
    tags?: string[];
    description?: string;
    config?: Record<string, unknown>;
    visibility?: 'all' | 'restricted';
    authorizedDashboardIds?: string[];
    sql?: string;
  }): Promise<ApiResponse<SavedChart>> {
    const args: Record<string, unknown> = {
      id: params.id,
    };
    if (params.name !== undefined) args.name = params.name;
    if (params.chartType !== undefined) args.chartType = params.chartType;
    if (params.xAxis !== undefined) args.xAxis = params.xAxis;
    if (params.yAxis !== undefined) args.yAxis = JSON.stringify(params.yAxis);
    if (params.title !== undefined) args.title = params.title;
    if (params.tags !== undefined) args.tags = params.tags;
    if (params.description !== undefined) args.description = params.description;
    if (params.config !== undefined) {
      args.config = Object.keys(params.config).length > 0
        ? JSON.stringify(params.config, (_key, value) => {
          if (typeof value === 'number' && !Number.isFinite(value)) return null;
          return value;
        })
        : null;
    }
    if (params.visibility !== undefined) args.visibility = params.visibility;
    if (params.authorizedDashboardIds !== undefined) {
      args.authorizedDashboardIds = params.authorizedDashboardIds;
    }
    if (params.sql !== undefined) args.sql = params.sql;

    return this.invokeCommand<SavedChart>('update_saved_chart', args);
  }

  /**
   * Delete a saved chart
   */
  async deleteSavedChart(id: string): Promise<ApiResponse<void>> {
    return this.invokeCommand<void>('delete_saved_chart', { id });
  }

  /**
   * Get all dashboards
   */
  async getDashboards(): Promise<ApiResponse<Dashboard[]>> {
    return this.invokeCommand<Dashboard[]>('get_dashboards');
  }

  /**
   * Get a single dashboard
   */
  async getDashboard(id: string): Promise<ApiResponse<Dashboard>> {
    return this.invokeCommand<Dashboard>('get_dashboard', { id });
  }

  /**
   * Create a new dashboard
   */
  async createDashboard(name: string, description?: string): Promise<ApiResponse<Dashboard>> {
    return this.invokeCommand<Dashboard>('create_dashboard', { name, description });
  }

  /**
   * Update a dashboard
   */
  async updateDashboard(id: string, updates: Partial<Dashboard>): Promise<ApiResponse<Dashboard>> {
    return this.invokeCommand<Dashboard>('update_dashboard', {
      id,
      name: updates.name,
      description: updates.description,
      layout: updates.layout ? JSON.stringify(updates.layout) : null,
      filters: updates.filters ? JSON.stringify(updates.filters) : null,
      refreshIntervalSecs: updates.refreshIntervalSecs,
    });
  }

  /**
   * Delete a dashboard
   */
  async deleteDashboard(id: string): Promise<ApiResponse<void>> {
    return this.invokeCommand<void>('delete_dashboard', { id });
  }

  /**
   * Add a chart to a dashboard
   */
  async addChartToDashboard(
    dashboardId: string,
    chartId: string,
    layout: { x: number; y: number; width: number; height: number }
  ): Promise<ApiResponse<DashboardItem>> {
    return this.invokeCommand<DashboardItem>('add_chart_to_dashboard', {
      dashboardId: dashboardId,
      chartId: chartId,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    });
  }

  /**
   * Update a dashboard item
   */
  async updateDashboardItem(id: string, updates: Partial<DashboardItem>): Promise<ApiResponse<DashboardItem>> {
    return this.invokeCommand<DashboardItem>('update_dashboard_item', {
      id,
      x: updates.x,
      y: updates.y,
      width: updates.width,
      height: updates.height,
      configOverrides: updates.configOverrides ? JSON.stringify(updates.configOverrides) : null,
    });
  }

  /**
   * Remove a chart from a dashboard
   */
  async removeChartFromDashboard(itemId: string): Promise<ApiResponse<void>> {
    return this.invokeCommand<void>('remove_chart_from_dashboard', { itemId: itemId });
  }

  // ========= 数据探查（Profile） Operations =========

  /**
   * 对指定数据表执行数据探查。
   * 超过 5 万行时默认启用采样，可通过 forceFullScan=true 强制全量扫描。
   */
  async profileTable(
    tableName: string,
    forceFullScan?: boolean
  ): Promise<ApiResponse<ProfileResult>> {
    return this.invokeCommand<ProfileResult>('profile_table', {
      tableName,
      forceFullScan: forceFullScan ?? false,
    });
  }

  /**
   * 对前端传入的查询结果（列名 + 二维字符串）做内存内数据探查。
   * 用于：用户刚跑了 SQL，对该 SELECT 结果做统计。
   */
  async profileResult(
    columns: string[],
    rows: string[][]
  ): Promise<ApiResponse<ProfileResult>> {
    return this.invokeCommand<ProfileResult>('profile_result', { columns, rows });
  }

  // ============ Automation Tasks Commands ============

  async listAutomationTasks(filterState?: string, filterType?: string, keyword?: string): Promise<ApiResponse<TaskListResponse>> {
    return this.invokeCommand<TaskListResponse>('list_automation_tasks', { filterState, filterType, keyword });
  }

  async getAutomationTask(id: string): Promise<ApiResponse<Task>> {
    return this.invokeCommand<Task>('get_automation_task', { id });
  }

  async createAutomationTask(req: CreateTaskPayload): Promise<ApiResponse<Task>> {
    return this.invokeCommand<Task>('create_automation_task', { req });
  }

  async updateAutomationTask(id: string, patch: UpdateTaskPayload): Promise<ApiResponse<Task>> {
    return this.invokeCommand<Task>('update_automation_task', { id, patch });
  }

  async deleteAutomationTask(id: string): Promise<ApiResponse<void>> {
    return this.invokeCommand<void>('delete_automation_task', { id });
  }

  async enableAutomationTask(id: string): Promise<ApiResponse<Task>> {
    return this.invokeCommand<Task>('enable_automation_task', { id });
  }

  async disableAutomationTask(id: string): Promise<ApiResponse<Task>> {
    return this.invokeCommand<Task>('disable_automation_task', { id });
  }

  async runAutomationTaskNow(id: string): Promise<ApiResponse<TaskRun>> {
    return this.invokeCommand<TaskRun>('run_automation_task_now', { id });
  }

  async getAutomationTaskRuns(taskId: string, limit?: number): Promise<ApiResponse<TaskRun[]>> {
    return this.invokeCommand<TaskRun[]>('get_automation_task_runs', { taskId, limit });
  }

  /**
   * P0-2 启动优化：一次性获取所有启动所需数据
   * 减少前端启动时的并发 IPC 调用，降低数据库锁竞争
   *
   * v2 扩展：新增 settings + tablesList，
   * 让 SettingsContext 与 DatabaseExplorer 免二次 IPC。
   */
  async getStartupStatus(): Promise<ApiResponse<{
    hasLaunched: boolean;
    currentDbPath: string;
    projectList: string[];
    databaseStatus: { isConnected: boolean; path: string; tableCount: number };
    workspaceLayout: Array<{
      id: string;
      title: string;
      tabType: string;
      position: number;
      isActive: boolean;
      panels: Array<{
        id: string;
        panelType: string;
        title: string;
        size: number;
        sqlContent: string | null;
        isActive: boolean;
        position: number;
      }>;
    }> | null;
    settings: Array<{ category: string; key: string; value: string }>;
    tablesList: string[] | null;
    dashboards: Array<{
      id: string;
      name: string;
      description: string;
      isDefault: boolean;
      refreshIntervalSecs: number;
      createdAt: number;
      updatedAt: number;
    }>;
    savedCharts: Array<{
      id: string;
      name: string;
      chartType: string;
      xAxis: string;
      yAxis: string[];
      title: string;
      tags: string[];
      description: string;
      visibility: string;
      createdAt: number;
      updatedAt: number;
    }>;
    tasks: Array<{
      id: string;
      name: string;
      description: string;
      taskType: string;
      scheduleMode: string;
      scheduleValue: string;
      state: string;
      nextRunAt: number | null;
      lastRunStatus: string | null;
      lastRunDurationMs: number | null;
      totalRuns: number;
      successRuns: number;
      failedRuns: number;
      createdAt: number;
      updatedAt: number;
    }>;
    timing: {
      appInitTsMs: number;
      rustAppInitMs?: number;
      rustSqliteConnectMs?: number;
      rustSystemTablesInitMs?: number;
      dbConnectMs: number;
      hasLaunchedMs: number;
      dbPathMs: number;
      projectListMs: number;
      databaseStatusMs: number;
      workspaceMs: number;
      settingsMs: number;
      tablesListMs: number;
      dashboardsMs: number;
      savedChartsMs: number;
      tasksMs: number;
      totalBackendMs: number;
    } | null;
    startupTimestampMs: number;
  }>> {
    return this.invokeCommand('get_startup_status');
  }

  /**
   * v10 splash 启动优化：把小窗口（400×400）放大到主应用尺寸（1200×800），
   * 同时允许用户拖拽调整窗口大小。必须在 React 渲染主应用之前调用，
   * 避免用户看到"大窗口 + 内容还没加载"的视觉断层。
   *
   * v14 (S4)：返回值中附带透明窗口诊断信息，前端据此决定是否应用降级
   */
  async windowResizeToMain(): Promise<ApiResponse<{
    width: number;
    height: number;
    transparencyEffective: boolean;
    needsFallback: boolean;
    fallbackLevel: string;
  }>> {
    return this.invokeCommand('window_resize_to_main');
  }

  /**
   * S5: 获取启动诊断信息（透明窗口状态 + 环境信息），
   * 供前端 splash 判断是否需要降级为填充卡片样式。
   */
  async getStartupDiagnostics(): Promise<ApiResponse<{
    transparentWindowEffective: boolean;
    fallbackLevel: string;
    rustDwmExtendOk: boolean;
    rustDwmBorderColorOk: boolean;
    rustDwmTransitionsDisabled: boolean;
    rustStyleBitsCleared: boolean;
    rustExStyleBitsCleared: boolean;
  }>> {
    return this.invokeCommand('get_startup_diagnostics');
  }
}

export const tauriService = TauriService.getInstance();
export default tauriService;

// ============ Window Control Service ============

/**
 * Window control service
 * 统一封装窗口控制操作
 */
export const windowService = {
  /**
   * Minimize window
   */
  minimize: async (): Promise<void> => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const window = getCurrentWindow();
      await window.minimize();
    } catch (e) {
      console.error('最小化失败:', e);
    }
  },

  /**
   * Toggle maximize window
   */
  toggleMaximize: async (): Promise<void> => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const window = getCurrentWindow();
      await window.toggleMaximize();
    } catch (e) {
      console.error('最大化失败:', e);
    }
  },

  /**
   * Close window
   */
  close: async (): Promise<void> => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const window = getCurrentWindow();
      await window.close();
    } catch (e) {
      console.error('关闭失败:', e);
    }
  },
};