import { invoke } from '@tauri-apps/api/core';
import type {
  ApiResponse,
  DatabaseStatus,
  BatchExecuteResult,
  CsvPreview,
  ExcelPreview,
  ImportRequest,
  DatabaseInfo,
} from '../types';

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
      console.error(`Command '${command}' failed:`, error);
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
   */
  async importDataV2(request: {
    file_path: string;
    sheet_name?: string;
    table_name: string;
    has_header: boolean;
    fields: Array<{ name: string; dataType: string }>;
  }): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('import_data_v2', { request });
  }

  // ============ Query Operations ============

  /**
   * Execute SQL query
   */
  async executeSql(sql: string): Promise<ApiResponse<BatchExecuteResult>> {
    return this.invokeCommand<BatchExecuteResult>('execute_sql', { sql });
  }

  /**
   * List tables
   */
  async listTables(): Promise<ApiResponse<string[]>> {
    return this.invokeCommand<string[]>('list_tables');
  }

  /**
   * Delete table
   */
  async deleteTable(tableName: string): Promise<ApiResponse<string>> {
    return this.invokeCommand<string>('delete_table', { tableName });
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
}

export const tauriService = TauriService.getInstance();
export default tauriService;
