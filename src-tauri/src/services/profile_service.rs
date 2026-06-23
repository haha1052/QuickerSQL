//! 数据探查服务
//! 为表或查询结果提供列级别的统计摘要。
//!
//! 安全设计：
//! - 所有对用户提供的 table_name 都会先经过 `SqlIdentifier` 校验，再拼入 SQL。
//! - 对查询结果数据（in-memory）直接使用 Rust 逻辑计算，不拼入 SQL。

use crate::database::SqlIdentifier;
use crate::database::traits::{MutexGuardConnection, QueryResult as DbQueryResult, ToSql};
use crate::models::profile::{
    ProfileColumnSummary, ProfileNumericStats, ProfileResult, ProfileTopValue,
};
use std::time::Instant;

/// 超过这个行数自动启用采样，避免对超大数据表长时间扫描
const SAMPLING_THRESHOLD_ROWS: i64 = 50_000;
/// 采样行数默认值
const DEFAULT_SAMPLE_SIZE: i64 = 10_000;
/// Top N 频率值
const TOP_N: usize = 5;

pub struct ProfileService;

impl ProfileService {
    /// 对指定数据表执行探查
    ///
    /// `force_full_scan`: true = 即使超过 `SAMPLING_THRESHOLD_ROWS` 也走全量扫描，
    /// 默认 false，将自动采样。
    pub fn profile_table(
        conn: &MutexGuardConnection<'_>,
        table_name: &str,
        force_full_scan: bool,
    ) -> Result<ProfileResult, String> {
        // 1) 校验与引用表名
        if !SqlIdentifier::is_safe_identifier(table_name) {
            return Err(format!("不安全的表名: {}", table_name));
        }
        let quoted = SqlIdentifier::quote_identifier(table_name);

        // 2) 获取表的列信息（PRAGMA table_info 是 SQLite 原生）
        //    columns: [cid, name, type, notnull, dflt_value, pk]
        let schema = conn
            .query(&format!("PRAGMA table_info({})", quoted), &[])
            .map_err(|e| format!("读取表结构失败: {}", e))?;

        if schema.rows.is_empty() {
            return Err(format!("表不存在或无列: {}", table_name));
        }

        let column_names: Vec<String> = schema
            .rows
            .iter()
            .map(|r| r.get(1).cloned().unwrap_or_default())
            .collect();
        let column_types: Vec<String> = schema
            .rows
            .iter()
            .map(|r| r.get(2).cloned().unwrap_or_else(|| "TEXT".into()))
            .collect();

        // 3) 决定是否采样
        let count_sql = format!("SELECT COUNT(*) FROM {}", quoted);
        let total_rows: i64 = Self::scalar_i64(conn, &count_sql).unwrap_or(0);
        let (sampled, sample_size) = if !force_full_scan && total_rows > SAMPLING_THRESHOLD_ROWS
        {
            (true, DEFAULT_SAMPLE_SIZE.min(total_rows))
        } else {
            (false, total_rows)
        };

        let t0 = Instant::now();

        // 4) 取数据（采样时用 LIMIT）
        let data_sql = if sampled {
            format!("SELECT * FROM {} LIMIT ?", quoted)
        } else {
            format!("SELECT * FROM {}", quoted)
        };
        let data = if sampled {
            let size_param = sample_size as i64;
            let params: [&dyn ToSql; 1] = [&size_param];
            conn.query(&data_sql, &params)
        } else {
            let empty: [&dyn ToSql; 0] = [];
            conn.query(&data_sql, &empty)
        }
        .map_err(|e| format!("读取表数据失败: {}", e))?;

        let mut row_count = data.rows.len() as i64;
        if !sampled {
            row_count = total_rows;
        }

        let columns = Self::summarize_columns(&column_names, &column_types, &data);
        let elapsed_ms = t0.elapsed().as_millis() as i64;

        Ok(ProfileResult {
            target: table_name.to_string(),
            row_count,
            column_count: column_names.len() as i64,
            columns,
            elapsed_ms,
            sampled,
            sample_size: if sampled { sample_size } else { total_rows },
        })
    }

    /// 对一段查询结果（前端传回来的列 + 二维字符串）做内存内的探查
    /// 用于：用户刚跑了一条 SQL，想对该 SELECT 的结果做统计。
    pub fn profile_result(
        columns: &[String],
        rows: &[Vec<String>],
    ) -> Result<ProfileResult, String> {
        let t0 = Instant::now();
        let col_types: Vec<String> = columns
            .iter()
            .enumerate()
            .map(|(idx, _)| Self::infer_type_from_rows(idx, rows))
            .collect();

        let fake = DbQueryResult {
            columns: columns.to_vec(),
            rows: rows.to_vec(),
        };

        let summaries = Self::summarize_columns(columns, &col_types, &fake);
        Ok(ProfileResult {
            target: "SQL Result".to_string(),
            row_count: rows.len() as i64,
            column_count: columns.len() as i64,
            columns: summaries,
            elapsed_ms: t0.elapsed().as_millis() as i64,
            sampled: false,
            sample_size: rows.len() as i64,
        })
    }

    // ========= 内部：对每列做聚合统计 =========
    fn summarize_columns(
        column_names: &[String],
        column_types: &[String],
        data: &DbQueryResult,
    ) -> Vec<ProfileColumnSummary> {
        let n_cols = column_names.len();
        let total_rows = data.rows.len() as f64;

        (0..n_cols)
            .map(|i| {
                let mut non_null = 0i64;
                let mut unique: std::collections::HashMap<String, i64> =
                    std::collections::HashMap::new();
                let mut numeric_values: Vec<f64> = Vec::new();
                let declared_type = column_types.get(i).cloned().unwrap_or_default();
                let declared_is_numeric = matches_type_as_numeric(&declared_type);

                for row in &data.rows {
                    let v = row.get(i).cloned().unwrap_or_default();
                    if v.is_empty() {
                        // SQLite 把 NULL 字符串化后为空串的情况（本项目通用约定）
                        continue;
                    }
                    non_null += 1;
                    *unique.entry(v.clone()).or_insert(0) += 1;
                    if declared_is_numeric {
                        if let Ok(f) = v.parse::<f64>() {
                            numeric_values.push(f);
                        }
                    }
                }

                let unique_count = unique.len() as i64;
                let mut top: Vec<ProfileTopValue> = unique
                    .into_iter()
                    .map(|(k, c)| ProfileTopValue { value: k, count: c })
                    .collect();
                top.sort_by(|a, b| b.count.cmp(&a.count).then(a.value.cmp(&b.value)));
                top.truncate(TOP_N);

                let numeric = if declared_is_numeric && !numeric_values.is_empty() {
                    numeric_values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                    let min = *numeric_values.first().unwrap_or(&0.0);
                    let max = *numeric_values.last().unwrap_or(&0.0);
                    let sum: f64 = numeric_values.iter().sum();
                    let mean = sum / numeric_values.len() as f64;
                    let variance: f64 = numeric_values
                        .iter()
                        .map(|x| (x - mean).powi(2))
                        .sum::<f64>()
                        / numeric_values.len().max(1) as f64;
                    let std_dev = variance.sqrt();
                    let median = if numeric_values.is_empty() {
                        0.0
                    } else if numeric_values.len() % 2 == 1 {
                        numeric_values[numeric_values.len() / 2]
                    } else {
                        let mid = numeric_values.len() / 2;
                        (numeric_values[mid - 1] + numeric_values[mid]) / 2.0
                    };
                    ProfileNumericStats {
                        min: Some(min),
                        max: Some(max),
                        mean: Some(mean),
                        std_dev: Some(std_dev),
                        median: Some(median),
                    }
                } else {
                    ProfileNumericStats::default()
                };

                ProfileColumnSummary {
                    column_name: column_names[i].clone(),
                    data_type: declared_type.clone(),
                    row_count: total_rows as i64,
                    non_null_count: non_null,
                    null_rate: if total_rows > 0.0 {
                        (total_rows - non_null as f64) / total_rows
                    } else {
                        0.0
                    },
                    unique_count,
                    unique_rate: if total_rows > 0.0 {
                        unique_count as f64 / total_rows
                    } else {
                        0.0
                    },
                    top_values: top,
                    is_numeric: declared_is_numeric && !numeric_values.is_empty(),
                    numeric,
                }
            })
            .collect()
    }

    // ========= 内部：辅助函数 =========
    fn scalar_i64(conn: &MutexGuardConnection<'_>, sql: &str) -> Option<i64> {
        let empty: [&dyn ToSql; 0] = [];
        let r = conn.query(sql, &empty).ok()?;
        let first = r.rows.first()?;
        first.first()?.parse::<i64>().ok()
    }

    fn infer_type_from_rows(col_idx: usize, rows: &[Vec<String>]) -> String {
        let mut numeric = 0i64;
        let mut integer = 0i64;
        let mut total = 0i64;
        for row in rows {
            if let Some(v) = row.get(col_idx) {
                if v.is_empty() {
                    continue;
                }
                total += 1;
                if v.parse::<i64>().is_ok() {
                    integer += 1;
                    numeric += 1;
                } else if v.parse::<f64>().is_ok() {
                    numeric += 1;
                }
            }
        }
        if total == 0 {
            return "UNKNOWN".into();
        }
        if integer == total {
            return "INTEGER".into();
        }
        if numeric * 10 >= total * 9 {
            // ≥90% 可解析为数值，认为是数值列
            return "REAL".into();
        }
        "TEXT".into()
    }
}

fn matches_type_as_numeric(t: &str) -> bool {
    let up = t.to_uppercase();
    up.contains("INT")
        || up.contains("REAL")
        || up.contains("FLOAT")
        || up.contains("DOUBLE")
        || up.contains("NUMERIC")
        || up.contains("DECIMAL")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_result_basic_string_columns() {
        let cols = vec!["name".into(), "age".into()];
        let rows = vec![
            vec!["Alice".into(), "30".into()],
            vec!["Bob".into(), "".into()],
            vec!["Alice".into(), "25".into()],
            vec!["".into(), "40".into()],
        ];
        let res = ProfileService::profile_result(&cols, &rows).unwrap();
        assert_eq!(res.row_count, 4);
        assert_eq!(res.column_count, 2);
        assert_eq!(res.columns[0].column_name, "name");
        assert_eq!(res.columns[0].non_null_count, 3);
        // name 非数值
        assert!(!res.columns[0].is_numeric);
        // age 被推断为 INTEGER，有数值统计
        assert_eq!(res.columns[1].data_type, "INTEGER");
        assert!(res.columns[1].is_numeric);
        assert!(res.columns[1].numeric.mean.is_some());
    }

    #[test]
    fn profile_result_empty_rows() {
        let cols = vec!["a".into()];
        let rows: Vec<Vec<String>> = vec![];
        let res = ProfileService::profile_result(&cols, &rows).unwrap();
        assert_eq!(res.row_count, 0);
        assert_eq!(res.columns[0].null_rate, 0.0);
    }

    #[test]
    fn matches_type_numeric_variants() {
        assert!(matches_type_as_numeric("INTEGER"));
        assert!(matches_type_as_numeric("real"));
        assert!(matches_type_as_numeric("NUMERIC"));
        assert!(!matches_type_as_numeric("TEXT"));
        assert!(!matches_type_as_numeric("BLOB"));
    }
}
