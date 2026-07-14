//! 任务调度时间计算工具
//! 支持 interval（秒数）、manual（不自动调度）、cron（5字段）三种模式

use chrono::{Local, TimeZone, DateTime, Datelike, Timelike};

/// 计算下一次运行时间（unix 秒数）
/// - interval: schedule_value 为秒数字符串（"3600"）
/// - manual: 返回 None
/// - cron: schedule_value 为标准 5 字段（"0 */1 * * *"）
pub fn compute_next_run(now_unix: i64, mode: &str, value: &str) -> Option<i64> {
    match mode {
        "interval" => {
            let secs: i64 = value.parse().unwrap_or(3600);
            let secs = secs.max(10);
            Some(now_unix + secs)
        }
        "manual" => None,
        "cron" => cron_next_after(now_unix, value),
        _ => None,
    }
}

/// 将 unix 时间格式化为用户可读字符串（本地时区）
pub fn format_local(unix_sec: i64) -> String {
    let dt: DateTime<Local> = Local.timestamp_opt(unix_sec, 0).single().unwrap_or_else(Local::now);
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

// ============================================================================
// 以下为自研的标准 5 字段 Cron 解析器
// 字段顺序：Minute Hour DayOfMonth Month DayOfWeek
// 支持语法：
//   *           通配
//   N           精确值
//   N-M         闭区间
//   N,M,...     枚举（逗号分隔）
//   */N         每 N（步进）
//   N-M/S       在区间上按步进 S
// ============================================================================

fn cron_next_after(now_unix: i64, expr: &str) -> Option<i64> {
    let parts: Vec<&str> = expr.split_whitespace().collect();
    if parts.len() != 5 {
        return None;
    }

    let mins = parse_field(parts[0], 0, 59)?;
    let hours = parse_field(parts[1], 0, 23)?;
    let doms = parse_field(parts[2], 1, 31)?;
    let months = parse_field(parts[3], 1, 12)?;
    let dows = parse_field(parts[4], 0, 6)?;

    // 从当前分钟 + 1 开始，最多搜索 366 天 × 1440 分钟
    let now: DateTime<Local> = Local.timestamp_opt(now_unix, 0).single().unwrap_or_else(Local::now);
    // 将 now 对齐到下一个整分钟（秒/纳秒置 0，若当前秒>0 则+1分钟）
    let base = match now.with_second(0).and_then(|d| d.with_nanosecond(0)) {
        Some(d) => d,
        None => now,
    };
    let mut dt = if now.second() > 0 || now.nanosecond() > 0 {
        base + chrono::Duration::minutes(1)
    } else {
        base
    };

    let max_iter = 366 * 24 * 60;
    for _ in 0..max_iter {
        let minute = dt.minute() as i32;
        let hour = dt.hour() as i32;
        let dom = dt.day() as i32;
        let month = dt.month() as i32;
        // chrono 的 weekday(): Mon=1 Tue=2 ... Sun=7；我们要 Sun=0 Mon=1 ... Sat=6
        let dow_chrono = dt.weekday().number_from_monday();  // Mon=1..Sun=7
        let dow = if dow_chrono == 7 { 0 } else { dow_chrono as i32 };

        if months.contains(&month)
            && doms.contains(&dom)
            && dows.contains(&dow)
            && hours.contains(&hour)
            && mins.contains(&minute)
        {
            return Some(dt.timestamp());
        }

        dt += chrono::Duration::minutes(1);
    }
    None
}

/// 解析一个 cron 字段，返回命中值的集合
/// lo/hi 为字段允许范围（如 minute 为 0..59）
fn parse_field(field: &str, lo: i32, hi: i32) -> Option<Vec<i32>> {
    // 按逗号拆分为多个子表达式，结果合并
    let mut set: Vec<i32> = Vec::new();
    for part in field.split(',') {
        let vals = parse_part(part, lo, hi)?;
        for v in vals {
            if !set.contains(&v) {
                set.push(v);
            }
        }
    }
    set.sort();
    Some(set)
}

fn parse_part(part: &str, lo: i32, hi: i32) -> Option<Vec<i32>> {
    // 形式 1: "*/N"
    if let Some(stripped) = part.strip_prefix("*/") {
        let step: i32 = stripped.parse().ok()?;
        if step <= 0 { return None; }
        let mut out = Vec::new();
        let mut v = lo;
        while v <= hi {
            out.push(v);
            v += step;
        }
        return Some(out);
    }

    // 形式 2: "*"
    if part == "*" {
        return Some((lo..=hi).collect());
    }

    // 形式 3: "N-M/S" 或 "N-M"
    if let Some(dash_idx) = part.find('-') {
        let start_part = &part[..dash_idx];
        let rest = &part[dash_idx + 1..];
        let (end_str, step) = match rest.find('/') {
            Some(slash_idx) => (&rest[..slash_idx], rest[slash_idx + 1..].parse::<i32>().ok()?),
            None => (rest, 1),
        };
        let start: i32 = start_part.parse().ok()?;
        let end: i32 = end_str.parse().ok()?;
        if start < lo || end > hi || start > end || step <= 0 { return None; }
        let mut out = Vec::new();
        let mut v = start;
        while v <= end {
            out.push(v);
            v += step;
        }
        return Some(out);
    }

    // 形式 4: "N"
    if let Ok(v) = part.parse::<i32>() {
        if v < lo || v > hi { return None; }
        return Some(vec![v]);
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interval_computation() {
        let now = 1_700_000_000i64;
        assert_eq!(compute_next_run(now, "interval", "3600"), Some(now + 3600));
    }

    #[test]
    fn manual_returns_none() {
        assert_eq!(compute_next_run(0, "manual", ""), None);
    }

    #[test]
    fn parse_star() {
        let vals = parse_field("*", 0, 59).unwrap();
        assert_eq!(vals.len(), 60);
        assert_eq!(vals[0], 0);
        assert_eq!(vals[59], 59);
    }

    #[test]
    fn parse_star_step() {
        let vals = parse_field("*/15", 0, 59).unwrap();
        assert_eq!(vals, vec![0, 15, 30, 45]);
    }

    #[test]
    fn parse_range_with_step() {
        let vals = parse_field("10-30/10", 0, 59).unwrap();
        assert_eq!(vals, vec![10, 20, 30]);
    }

    #[test]
    fn parse_list() {
        let vals = parse_field("2,4,6", 0, 59).unwrap();
        assert_eq!(vals, vec![2, 4, 6]);
    }

    // ========================================================================
    // compute_next_run 测试
    // ========================================================================

    #[test]
    fn interval_with_invalid_value_uses_default() {
        // 解析失败时应该使用默认值 3600
        let now = 1_700_000_000i64;
        assert_eq!(compute_next_run(now, "interval", "invalid"), Some(now + 3600));
    }

    #[test]
    fn interval_with_empty_value_uses_default() {
        let now = 1_700_000_000i64;
        assert_eq!(compute_next_run(now, "interval", ""), Some(now + 3600));
    }

    #[test]
    fn interval_minimum_value_is_10_seconds() {
        // interval 最小值为 10 秒
        let now = 1_700_000_000i64;
        assert_eq!(compute_next_run(now, "interval", "5"), Some(now + 10));
    }

    #[test]
    fn interval_exact_10_seconds() {
        let now = 1_700_000_000i64;
        assert_eq!(compute_next_run(now, "interval", "10"), Some(now + 10));
    }

    #[test]
    fn interval_large_value() {
        let now = 1_700_000_000i64;
        assert_eq!(compute_next_run(now, "interval", "86400"), Some(now + 86400));
    }

    #[test]
    fn unknown_mode_returns_none() {
        assert_eq!(compute_next_run(0, "unknown", ""), None);
    }

    #[test]
    fn cron_mode_basic() {
        // 每天 10:00:00 运行
        let now = 1_700_000_000i64; // 2023-11-15 15:33:20 CST
        let result = compute_next_run(now, "cron", "0 10 * * *");
        assert!(result.is_some());
        let next = result.unwrap();
        // 下一次应该是今天或明天的 10:00
        assert!(next > now);
    }

    #[test]
    fn cron_invalid_expression_returns_none() {
        assert_eq!(compute_next_run(0, "cron", "*"), None);
        assert_eq!(compute_next_run(0, "cron", "* *"), None);
        assert_eq!(compute_next_run(0, "cron", ""), None);
    }

    #[test]
    fn cron_too_many_fields_returns_none() {
        assert_eq!(compute_next_run(0, "cron", "0 10 * * * *"), None);
    }

    // ========================================================================
    // format_local 测试
    // ========================================================================

    #[test]
    fn format_local_basic() {
        let formatted = format_local(1_700_000_000i64);
        assert!(formatted.contains("2023"));
        assert!(formatted.contains(":"));
    }

    #[test]
    fn format_local_known_timestamp() {
        // 2023-11-15 00:00:00 CST
        let formatted = format_local(1_700_000_000i64);
        assert!(formatted.starts_with("2023-"));
    }

    #[test]
    fn format_local_zero() {
        let formatted = format_local(0);
        // 应该能正常格式化，不会 panic
        assert!(!formatted.is_empty());
    }

    // ========================================================================
    // parse_field 异常情况测试
    // ========================================================================

    #[test]
    fn parse_field_single_value() {
        let vals = parse_field("30", 0, 59).unwrap();
        assert_eq!(vals, vec![30]);
    }

    #[test]
    fn parse_field_range() {
        let vals = parse_field("10-15", 0, 59).unwrap();
        assert_eq!(vals, vec![10, 11, 12, 13, 14, 15]);
    }

    #[test]
    fn parse_field_value_out_of_range_low() {
        assert!(parse_field("-1", 0, 59).is_none());
    }

    #[test]
    fn parse_field_value_out_of_range_high() {
        assert!(parse_field("60", 0, 59).is_none());
    }

    #[test]
    fn parse_field_range_start_greater_than_end() {
        assert!(parse_field("30-10", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_step_zero() {
        // */0 是无效的
        assert!(parse_part("*/0", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_step_negative() {
        assert!(parse_part("*/-1", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_range_end_greater_than_hi() {
        assert!(parse_field("0-60", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_range_start_less_than_lo() {
        assert!(parse_field("-1-10", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_not_a_number() {
        assert!(parse_field("abc", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_range_with_invalid_step() {
        // 10-30/0 应该返回 None
        assert!(parse_field("10-30/0", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_range_with_invalid_step_format() {
        // 10-30/s 应该是 None
        assert!(parse_field("10-30/s", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_start_not_number() {
        // a-10 应该返回 None
        assert!(parse_field("a-10", 0, 59).is_none());
    }

    #[test]
    fn parse_field_invalid_end_not_number() {
        // 10-a 应该返回 None
        assert!(parse_field("10-a", 0, 59).is_none());
    }

    #[test]
    fn parse_field_step_in_star() {
        // */5 应该解析为 0,5,10,...,55
        let vals = parse_field("*/5", 0, 59).unwrap();
        let expected: Vec<i32> = (0..=55).step_by(5).collect();
        assert_eq!(vals, expected);
    }

    #[test]
    fn parse_field_step_larger_than_range() {
        // */60 在 0-59 范围内应该只返回 0
        let vals = parse_field("*/60", 0, 59).unwrap();
        assert_eq!(vals, vec![0]);
    }

    // ========================================================================
    // parse_part 边界测试
    // ========================================================================

    #[test]
    fn parse_part_wildcard() {
        let vals = parse_part("*", 0, 59).unwrap();
        assert_eq!(vals.len(), 60);
    }

    #[test]
    fn parse_part_single_value() {
        let vals = parse_part("42", 0, 59).unwrap();
        assert_eq!(vals, vec![42]);
    }

    #[test]
    fn parse_part_range_only() {
        let vals = parse_part("5-10", 0, 59).unwrap();
        assert_eq!(vals, vec![5, 6, 7, 8, 9, 10]);
    }

    #[test]
    fn parse_part_range_with_step() {
        let vals = parse_part("0-10/2", 0, 59).unwrap();
        assert_eq!(vals, vec![0, 2, 4, 6, 8, 10]);
    }

    #[test]
    fn parse_part_step_zero() {
        assert!(parse_part("*/0", 0, 59).is_none());
    }

    #[test]
    fn parse_part_step_negative() {
        assert!(parse_part("*/-1", 0, 59).is_none());
    }

    #[test]
    fn parse_part_invalid_format() {
        assert!(parse_part("abc", 0, 59).is_none());
        assert!(parse_part("", 0, 59).is_none());
    }

    // ========================================================================
    // cron_next_after 集成测试
    // ========================================================================

    #[test]
    fn cron_next_after_basic() {
        // 每天 12:00 运行
        let now = 1_700_000_000i64;
        let result = cron_next_after(now, "0 12 * * *");
        assert!(result.is_some());
        let next = result.unwrap();
        assert!(next > now);
    }

    #[test]
    fn cron_next_after_weekdays_only() {
        // 周一到周五 9:00 运行
        let now = 1_700_000_000i64;
        let result = cron_next_after(now, "0 9 * * 1-5");
        assert!(result.is_some());
        let next = result.unwrap();
        assert!(next > now);
    }

    #[test]
    fn cron_next_after_monthly() {
        // 每月 1 号 0:00 运行
        let now = 1_700_000_000i64;
        let result = cron_next_after(now, "0 0 1 * *");
        assert!(result.is_some());
        let next = result.unwrap();
        assert!(next > now);
    }
}
