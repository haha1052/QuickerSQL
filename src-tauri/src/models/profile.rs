//! 数据探查（Profile）数据结构定义
//! 为表或查询结果提供列级别的统计摘要：数据类型、行数、空值率、唯一值数、
//! Top 5 频率值、数值列的 min/max/mean/std/median。

use serde::{Deserialize, Serialize};

/// 单条 Top 值（值 / 出现次数）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileTopValue {
    pub value: String,
    pub count: i64,
}

/// 数值列统计
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileNumericStats {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub mean: Option<f64>,
    pub std_dev: Option<f64>,
    pub median: Option<f64>,
}

/// 单个列的探查摘要
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileColumnSummary {
    /// 列名
    pub column_name: String,
    /// 推断的数据类型（inferred / sqlite_type / duckdb_type）
    pub data_type: String,
    /// 总行数
    pub row_count: i64,
    /// 非空行数
    pub non_null_count: i64,
    /// 空值率（0.0 ~ 1.0）
    pub null_rate: f64,
    /// 去重后的值数量
    pub unique_count: i64,
    /// 唯一值率（0.0 ~ 1.0）
    pub unique_rate: f64,
    /// Top N 高频值
    pub top_values: Vec<ProfileTopValue>,
    /// 数值列统计；非数值列全为 null
    pub numeric: ProfileNumericStats,
    /// 是否被推断为数值列
    pub is_numeric: bool,
}

/// 一次探查任务的总结果
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileResult {
    /// 被探查的对象：表名或 "SQL Result"
    pub target: String,
    /// 总行数
    pub row_count: i64,
    /// 总列数
    pub column_count: i64,
    /// 每列的摘要
    pub columns: Vec<ProfileColumnSummary>,
    /// 本次探查耗时（毫秒），用于前端性能展示
    pub elapsed_ms: i64,
    /// 是否对大表做了采样
    pub sampled: bool,
    /// 采样行数（未采样时等于 row_count）
    pub sample_size: i64,
}
