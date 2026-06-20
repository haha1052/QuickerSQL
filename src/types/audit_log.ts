export type AuditLogModule =
  | 'sql'
  | 'import'
  | 'project'
  | 'settings'
  | 'trash'
  | 'chart';

export type AuditLogAction =
  | 'query_execute'
  | 'table_delete'
  | 'data_import'
  | 'project_create'
  | 'project_switch'
  | 'project_delete'
  | 'setting_update'
  | 'trash_restore'
  | 'trash_permanent_delete'
  | 'chart_generate';

export type AuditLogStatus = 'success' | 'failed';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  module: AuditLogModule;
  action: AuditLogAction;
  description: string;
  status: AuditLogStatus;
  duration_ms?: number | null;
  details?: string | null;
}

export interface RecordAuditLogRequest {
  module: AuditLogModule;
  action: AuditLogAction;
  description: string;
  status: AuditLogStatus;
  duration_ms?: number | null;
  details?: string | null;
}

export interface QueryAuditLogsRequest {
  module?: AuditLogModule | null;
  status?: AuditLogStatus | null;
  search?: string | null;
  offset?: number | null;
  limit?: number | null;
}

export interface AuditLogsListResponse {
  items: AuditLogItem[];
  total: number;
}
