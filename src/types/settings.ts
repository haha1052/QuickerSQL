// Settings Types
export interface SettingMeta {
  category: string;
  key: string;
  value_type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  default_value: string;
  description?: string | null;
  options?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  step?: number | null;
  is_visible: boolean;
  is_system: boolean;
  is_implemented: boolean;
}

export interface SettingMetaCategory {
  id: string;
  name: string;
  icon?: string | null;
  items: SettingMeta[];
}

export interface SettingsMetaResponse {
  categories: SettingMetaCategory[];
  total_items: number;
}

export interface SettingItem {
  id: string;
  category: string;
  key: string;
  value: string;
  value_type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  description?: string | null;
  options?: string | null;
  is_visible: boolean;
  is_system: boolean;
  updated_at: string;
}

export interface SettingCategory {
  id: string;
  name: string;
  icon?: string | null;
  items: SettingItem[];
}

export interface SettingsListResponse {
  categories: SettingCategory[];
  total_items: number;
}

export interface UpdateSettingRequest {
  category: string;
  key: string;
  value: string;
}

export interface ExportSettingsResponse {
  version: string;
  exported_at: string;
  settings: SettingItem[];
}

export interface ImportSettingsRequest {
  version: string;
  settings: SettingItem[];
}

export interface QueryCacheStats {
  capacity: number;
  size: number;
  hits: number;
  misses: number;
  expiredCount: number;
  hitRate: number;
  enabled: boolean;
  strategy: string;
}
