/**
 * 数据探查（Profile）数据结构
 * 与 Rust 端 models/profile.rs 保持字段一致
 */

export interface ProfileTopValue {
  value: string;
  count: number;
}

export interface ProfileNumericStats {
  min: number | null;
  max: number | null;
  mean: number | null;
  stdDev: number | null;
  median: number | null;
}

export interface ProfileColumnSummary {
  columnName: string;
  dataType: string;
  rowCount: number;
  nonNullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRate: number;
  topValues: ProfileTopValue[];
  numeric: ProfileNumericStats;
  isNumeric: boolean;
}

export interface ProfileResult {
  target: string;
  rowCount: number;
  columnCount: number;
  columns: ProfileColumnSummary[];
  elapsedMs: number;
  sampled: boolean;
  sampleSize: number;
}
