//! 查询缓存服务（M7.2 新增）
//!
//! 支持多种策略的只读查询结果缓存，核心特性：
//! - 默认策略：LRU（容量 100 条，每条 5 分钟 TTL）
//! - 缓存键 = SQL 语句 hash，确保不同参数查询互不污染
//! - 写操作（INSERT / UPDATE / DELETE / DROP / ALTER / CREATE）
//!   触发全量失效，避免缓存数据不一致
//! - 通过 `cache.enabled` 设置项控制开关，默认开启
//! - 提供 `stats()` 接口返回命中率/总命中/总失效，供前端监控
//!
//! 架构约束：
//! - 本服务不直接获取数据库连接，由调用方（如 sql_service）传入数据
//! - 缓存内容为只读副本，不保留连接引用

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::database::traits::QueryResult;

/// 缓存策略枚举
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum CacheStrategy {
    /// LRU 策略：最近最少使用淘汰
    #[default]
    Lru,
    /// 不缓存：get 永远返回 None，set 不存储
    None,
}

impl From<&str> for CacheStrategy {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "none" => CacheStrategy::None,
            "lru" | "memory" => CacheStrategy::Lru,
            _ => CacheStrategy::Lru,
        }
    }
}

/// 估算 QueryResult 的内存占用（字节）
///
/// 用于总大小上限驱逐，避免大结果集导致 OOM。
/// 估算公式：列名长度 + 行数据长度 + 每个单元格固定开销 + 基础开销。
fn estimate_size(result: &QueryResult) -> usize {
    // 列名长度 + 每列 Vec 元素指针开销
    let columns_size: usize = result.columns.iter().map(|c| c.len() + 8).sum();
    // 每个单元格字符串长度 + 16 字节开销（String 结构体 + Vec 元素指针）
    let rows_size: usize = result
        .rows
        .iter()
        .flat_map(|row| row.iter())
        .map(|cell| cell.len() + 16)
        .sum();
    columns_size + rows_size + 64 // 基础开销（结构体头 + Vec 头等）
}

/// 单个缓存条目
struct CacheEntry {
    result: QueryResult,
    created_at: Instant,
    ttl: Duration,
    /// 该条目估算的内存占用（字节），用于总大小上限驱逐
    estimated_size_bytes: usize,
}

/// 缓存统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    /// 缓存容量上限
    pub capacity: usize,
    /// 当前缓存条目数量
    pub size: usize,
    /// 缓存命中次数
    pub hits: u64,
    /// 缓存未命中次数
    pub misses: u64,
    /// 缓存过期次数
    pub expired_count: u64,
    /// 命中率（0.0 ~ 1.0）
    pub hit_rate: f64,
    /// 缓存是否启用
    pub enabled: bool,
    /// 当前缓存策略
    pub strategy: CacheStrategy,
    /// 当前所有条目估算总内存占用（字节）
    pub total_size_bytes: usize,
    /// 总内存占用上限（字节）
    pub max_total_size_bytes: usize,
}

/// LRU 查询缓存内部状态
struct InnerCache {
    entries: HashMap<String, CacheEntry>,
    capacity: usize,
    ttl: Duration,
    hits: u64,
    misses: u64,
    expired_count: u64,
    lru_order: Vec<String>, // 头部 = 最旧，尾部 = 最新
    /// 当前所有条目估算总内存占用（字节）
    total_size_bytes: usize,
    /// 总内存占用上限（字节），默认 256MB
    max_total_size_bytes: usize,
}

impl InnerCache {
    /// 创建默认 256MB 总大小上限的缓存（仅测试使用）
    #[cfg(test)]
    fn new(capacity: usize, ttl: Duration) -> Self {
        Self::with_max_size(capacity, ttl, 256 * 1024 * 1024)
    }

    /// 创建指定总大小上限的缓存
    fn with_max_size(capacity: usize, ttl: Duration, max_total_size_bytes: usize) -> Self {
        Self {
            entries: HashMap::new(),
            capacity,
            ttl,
            hits: 0,
            misses: 0,
            expired_count: 0,
            lru_order: Vec::new(),
            total_size_bytes: 0,
            max_total_size_bytes,
        }
    }

    /// 获取缓存结果；命中返回 Some，未命中或过期返回 None
    fn get(&mut self, key: &str) -> Option<QueryResult> {
        // 先检查是否存在，避免借用冲突
        let exists = self.entries.contains_key(key);
        if !exists {
            self.misses += 1;
            return None;
        }

        // 提取（clone）必要信息后再做变更，避免借用冲突
        let (created_at, ttl) = {
            if let Some(entry) = self.entries.get(key) {
                (entry.created_at, entry.ttl)
            } else {
                self.misses += 1;
                return None;
            }
        };

        if created_at.elapsed() >= ttl {
            // 过期 —— 惰性删除，计为一次 miss，并统计过期次数
            self.entries.remove(key);
            if let Some(pos) = self.lru_order.iter().position(|k| k == key) {
                self.lru_order.remove(pos);
            }
            self.misses += 1;
            self.expired_count += 1;
            return None;
        }

        // 更新 LRU 顺序：移动到末尾
        if let Some(pos) = self.lru_order.iter().position(|k| k == key) {
            let moved = self.lru_order.remove(pos);
            self.lru_order.push(moved);
        }

        self.hits += 1;
        self.entries.get(key).map(|e| e.result.clone())
    }

    /// 放入新缓存；超过容量或总大小上限时驱逐最久未使用的条目
    fn set(&mut self, key: String, result: QueryResult) {
        // 计算新条目估算大小
        let new_size = estimate_size(&result);

        // 如果 key 已存在，先减去旧条目大小并移除 lru_order 中的旧位置
        if let Some(old_entry) = self.entries.remove(&key) {
            self.total_size_bytes = self
                .total_size_bytes
                .saturating_sub(old_entry.estimated_size_bytes);
            if let Some(pos) = self.lru_order.iter().position(|k| k == &key) {
                self.lru_order.remove(pos);
            }
        }
        self.lru_order.push(key.clone());

        self.entries.insert(
            key,
            CacheEntry {
                result,
                created_at: Instant::now(),
                ttl: self.ttl,
                estimated_size_bytes: new_size,
            },
        );
        self.total_size_bytes = self.total_size_bytes.saturating_add(new_size);

        // 容量上限：从 lru_order 头部驱逐最旧条目
        while self.entries.len() > self.capacity {
            self.evict_oldest();
        }

        // 总大小上限：从 lru_order 头部驱逐最旧条目，保留至少 1 条避免无限驱逐
        while self.total_size_bytes > self.max_total_size_bytes && self.entries.len() > 1 {
            self.evict_oldest();
        }
    }

    /// 从 lru_order 头部驱逐最旧条目（同步更新 total_size_bytes）
    fn evict_oldest(&mut self) {
        if let Some(oldest_key) = self.lru_order.first().cloned() {
            self.lru_order.remove(0);
            if let Some(entry) = self.entries.remove(&oldest_key) {
                self.total_size_bytes = self
                    .total_size_bytes
                    .saturating_sub(entry.estimated_size_bytes);
            }
        }
    }

    /// 全量失效（写操作 / 手动刷新时调用）
    fn invalidate_all(&mut self) {
        let cleared = self.entries.len();
        self.entries.clear();
        self.lru_order.clear();
        if cleared > 0 {
            log::debug!("QueryCache 已清除 {} 条缓存（写操作触发）", cleared);
        }
    }

    /// 失效指定 key 对应的条目；返回是否命中并删除
    ///
    /// 与 `invalidate_all` 一致：仅删除 `entries` 与 `lru_order` 中的对应项，
    /// 不影响统计计数器（hits/misses/expired_count）。
    /// 返回 `true` 表示命中并删除，`false` 表示 key 不存在。
    fn invalidate(&mut self, key: &str) -> bool {
        if let Some(entry) = self.entries.remove(key) {
            self.total_size_bytes = self
                .total_size_bytes
                .saturating_sub(entry.estimated_size_bytes);
            if let Some(pos) = self.lru_order.iter().position(|k| k == key) {
                self.lru_order.remove(pos);
            }
            log::debug!("QueryCache 已失效单条缓存: key_len={}", key.len());
            true
        } else {
            false
        }
    }

    /// 动态调整容量与 TTL（设置项变更时调用）
    fn configure(&mut self, capacity: usize, ttl_seconds: u64) {
        self.capacity = capacity;
        self.ttl = Duration::from_secs(ttl_seconds);
        // 容量收缩时执行驱逐
        while self.entries.len() > self.capacity {
            if let Some(oldest_key) = self.lru_order.first().cloned() {
                self.lru_order.remove(0);
                self.entries.remove(&oldest_key);
            } else {
                break;
            }
        }
    }

    /// 返回当前统计快照
    fn stats(&self, enabled: bool, strategy: CacheStrategy) -> CacheStats {
        let total = self.hits.saturating_add(self.misses);
        let hit_rate = if total == 0 {
            0.0
        } else {
            self.hits as f64 / total as f64
        };
        CacheStats {
            capacity: self.capacity,
            size: self.entries.len(),
            hits: self.hits,
            misses: self.misses,
            expired_count: self.expired_count,
            hit_rate,
            enabled,
            strategy,
            total_size_bytes: self.total_size_bytes,
            max_total_size_bytes: self.max_total_size_bytes,
        }
    }
}

/// 查询缓存服务（线程安全，可跨命令调用共享）
pub struct QueryCacheService {
    inner: Mutex<InnerCache>,
    /// 开关 —— 默认从设置项读取，fallback 为 true
    enabled: Mutex<bool>,
    /// 缓存策略
    strategy: Mutex<CacheStrategy>,
}

impl QueryCacheService {
    /// 创建新的查询缓存服务
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(InnerCache::with_max_size(
                100,
                Duration::from_secs(300),
                256 * 1024 * 1024,
            )),
            enabled: Mutex::new(true),
            strategy: Mutex::new(CacheStrategy::Lru),
        }
    }

    /// 从设置项更新运行期配置（容量/TTL/开关/策略）
    ///
    /// 参数：
    /// - `capacity`：容量上限（建议 20 ~ 500）
    /// - `ttl_seconds`：单条缓存有效期（秒）
    /// - `enabled`：是否启用缓存
    /// - `strategy`：缓存策略（可选，None 时不更改）
    pub fn configure(
        &self,
        capacity: usize,
        ttl_seconds: u64,
        enabled: bool,
        strategy: Option<CacheStrategy>,
    ) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.configure(capacity.max(1), ttl_seconds.max(5));
        }
        if let Ok(mut flag) = self.enabled.lock() {
            *flag = enabled;
        }
        if let Some(s) = strategy {
            self.set_strategy(s);
        }
        log::info!(
            "QueryCache 配置已更新：enabled={}, capacity={}, ttl={}s",
            enabled,
            capacity,
            ttl_seconds
        );
    }

    /// 设置缓存策略
    pub fn set_strategy(&self, strategy: CacheStrategy) {
        if let Ok(mut s) = self.strategy.lock() {
            let old_strategy = std::mem::replace(&mut *s, strategy.clone());
            if old_strategy != strategy {
                if matches!(strategy, CacheStrategy::None) {
                    if let Ok(mut inner) = self.inner.lock() {
                        inner.invalidate_all();
                    }
                }
                log::info!("QueryCache 策略已更新：{:?} -> {:?}", old_strategy, strategy);
            }
        }
    }

    /// 获取当前缓存策略
    pub fn get_strategy(&self) -> CacheStrategy {
        self.strategy.lock().map(|s| s.clone()).unwrap_or_default()
    }

    /// 是否启用
    pub fn is_enabled(&self) -> bool {
        self.enabled.lock().map(|v| *v).unwrap_or(true)
    }

    /// 查询缓存；命中返回 Some(QueryResult)，未命中返回 None
    ///
    /// 外部约定：仅对 SELECT 类查询调用；调用方自行判断是否为缓存友好的查询。
    pub fn get(&self, cache_key: &str) -> Option<QueryResult> {
        if !self.is_enabled() {
            return None;
        }
        let strategy = self.get_strategy();
        match strategy {
            CacheStrategy::None => None,
            CacheStrategy::Lru => {
                let mut inner = self.inner.lock().ok()?;
                inner.get(cache_key)
            }
        }
    }

    /// 写入缓存；调用方需要先判断是否为 SELECT 查询
    pub fn set(&self, cache_key: String, result: QueryResult) {
        if !self.is_enabled() {
            return;
        }
        let strategy = self.get_strategy();
        match strategy {
            CacheStrategy::None => {}
            CacheStrategy::Lru => {
                if let Ok(mut inner) = self.inner.lock() {
                    inner.set(cache_key, result);
                }
            }
        }
    }

    /// 写操作触发的全量失效（INSERT / UPDATE / DELETE / DROP 等）
    pub fn invalidate_all(&self) {
        let strategy = self.get_strategy();
        match strategy {
            CacheStrategy::None => {}
            CacheStrategy::Lru => {
                if let Ok(mut inner) = self.inner.lock() {
                    inner.invalidate_all();
                }
            }
        }
    }

    /// 失效指定缓存 key 对应的条目（若存在）
    ///
    /// 与 [`invalidate_all`](Self::invalidate_all) 一致的锁/策略处理：
    /// - `None` 策略下永远不存储，故返回 `false`
    /// - `Lru` 策略下命中并删除返回 `true`，key 不存在返回 `false`
    ///
    /// 参数：
    /// - `key`: 缓存键（通常由 [`make_cache_key`] 生成）
    ///
    /// 返回：是否真的删除了条目（`true` = 命中并删除，`false` = 不存在）
    pub fn invalidate(&self, key: &str) -> bool {
        let strategy = self.get_strategy();
        match strategy {
            CacheStrategy::None => false,
            CacheStrategy::Lru => {
                if let Ok(mut inner) = self.inner.lock() {
                    inner.invalidate(key)
                } else {
                    false
                }
            }
        }
    }

    /// 返回统计快照
    pub fn stats(&self) -> CacheStats {
        let enabled = self.is_enabled();
        let strategy = self.get_strategy();
        match self.inner.lock() {
            Ok(inner) => inner.stats(enabled, strategy),
            Err(_) => CacheStats {
                capacity: 0,
                size: 0,
                hits: 0,
                misses: 0,
                expired_count: 0,
                hit_rate: 0.0,
                enabled,
                strategy,
                total_size_bytes: 0,
                max_total_size_bytes: 0,
            },
        }
    }
}

impl Default for QueryCacheService {
    fn default() -> Self {
        Self::new()
    }
}

/// 构造缓存键（暴露给 service 层使用）
///
/// 约定：`prefix_sql` 为去除参数绑定后的 SQL 模板，`params_hash` 为参数值
/// 的稳定字符串化。这里使用简化的 `sql + "|" + params_concat` 作为键，
/// 足以覆盖多数场景。
pub fn make_cache_key(sql: &str, params: &[String]) -> String {
    let params_str = if params.is_empty() {
        String::new()
    } else {
        params.join(",")
    };
    format!("{}|{}|{}", sql.len(), sql, params_str)
}

/// 判断一条 SQL 是否应该走缓存（非常保守的白名单判断）
///
/// 规则：
/// - 必须以 `SELECT` / `PRAGMA` / `WITH` 开头（大小写不敏感）
/// - 不包含 `/* NO_CACHE */` 提示标记
pub fn is_cacheable(sql: &str) -> bool {
    let trimmed = sql.trim_start();
    if trimmed.contains("/* NO_CACHE */") || trimmed.contains("-- NO_CACHE") {
        return false;
    }
    let upper = trimmed[..std::cmp::min(12, trimmed.len())].to_uppercase();
    upper.starts_with("SELECT") || upper.starts_with("PRAGMA") || upper.starts_with("WITH")
}

/// 判断一条 SQL 是否为写操作（需全量失效缓存）
pub fn is_write_operation(sql: &str) -> bool {
    let upper = sql.trim_start()[..std::cmp::min(12, sql.trim_start().len())].to_uppercase();
    upper.starts_with("INSERT")
        || upper.starts_with("UPDATE")
        || upper.starts_with("DELETE")
        || upper.starts_with("DROP")
        || upper.starts_with("ALTER")
        || upper.starts_with("CREATE")
        || upper.starts_with("REPLACE")
        || upper.starts_with("TRUNCATE")
}

// ============================================================
// 内联测试模块（M7.3 要求：每个 service 至少 3 个测试）
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_result(rows_count: usize) -> QueryResult {
        QueryResult {
            columns: vec!["c1".to_string(), "c2".to_string()],
            rows: (0..rows_count)
                .map(|i| vec![format!("v{}", i), format!("val{}", i)])
                .collect(),
            affected_rows: None,
        }
    }

    #[test]
    fn test_get_set_basic_hit() {
        let cache = QueryCacheService::new();
        let key = "SELECT 1".to_string();
        let result = dummy_result(3);
        cache.set(key.clone(), result.clone());

        // 立即获取应该命中
        let hit = cache.get(&key).expect("应该命中");
        assert_eq!(hit.rows.len(), 3);
        assert_eq!(hit.columns, vec!["c1".to_string(), "c2".to_string()]);

        // 统计：hits=1, misses=0
        let s = cache.stats();
        assert_eq!(s.hits, 1);
        assert_eq!(s.misses, 0);
        assert_eq!(s.size, 1);
    }

    #[test]
    fn test_invalidate_all_after_write() {
        let cache = QueryCacheService::new();
        cache.set("k1".to_string(), dummy_result(1));
        cache.set("k2".to_string(), dummy_result(2));

        // 模拟写操作
        cache.invalidate_all();

        assert!(cache.get("k1").is_none());
        assert!(cache.get("k2").is_none());
        assert_eq!(cache.stats().size, 0);
    }

    #[test]
    fn test_lru_eviction_at_capacity() {
        let cache = QueryCacheService::new();
        // 先配为 3 条的小容量以便快速验证 LRU
        cache.configure(3, 300, true, None);

        for i in 0..5u64 {
            cache.set(format!("k{}", i), dummy_result(i as usize));
        }
        assert_eq!(cache.stats().size, 3, "超过容量时应该驱逐至 3 条");

        // 再 set 一次 k2（最近访问过），然后插入新条目
        cache.set("k2".to_string(), dummy_result(99));
        cache.set("k_new".to_string(), dummy_result(10));

        // 总容量仍然 <=3
        assert!(cache.stats().size <= 3);
    }

    #[test]
    fn test_is_cacheable_white_list() {
        assert!(is_cacheable("SELECT * FROM users"));
        assert!(is_cacheable("PRAGMA table_info(users)"));
        assert!(is_cacheable("WITH cte AS (SELECT 1) SELECT * FROM cte"));
        assert!(!is_cacheable("INSERT INTO users VALUES(1)"));
        assert!(!is_cacheable("DROP TABLE users"));
        assert!(!is_cacheable("SELECT /* NO_CACHE */ * FROM t"));
    }

    #[test]
    fn test_is_write_operation_matches() {
        assert!(is_write_operation("INSERT INTO t VALUES(1)"));
        assert!(is_write_operation("UPDATE t SET a=1"));
        assert!(is_write_operation("DELETE FROM t WHERE 1=1"));
        assert!(is_write_operation("DROP TABLE users"));
        assert!(is_write_operation("ALTER TABLE t ADD COLUMN c INT"));
        assert!(is_write_operation("  CREATE TABLE new_t(a INT)")); // 前面有空格
        assert!(!is_write_operation("SELECT * FROM t"));
    }

    #[test]
    fn test_make_cache_key_distinct_by_params() {
        let sql = "SELECT * FROM users WHERE id = ?";
        let k1 = make_cache_key(sql, &["1".to_string()]);
        let k2 = make_cache_key(sql, &["2".to_string()]);
        assert_ne!(k1, k2);
    }

    #[test]
    fn test_disabled_cache_bypasses() {
        let cache = QueryCacheService::new();
        cache.configure(100, 300, false, None);
        cache.set("k1".to_string(), dummy_result(5));
        assert!(cache.get("k1").is_none(), "禁用后应不返回任何内容");
        assert!(!cache.stats().enabled);
    }

    #[test]
    fn test_cache_entry_ttl_expiry() {
        // 直接测试 InnerCache 以避开 QueryCacheService::configure 的最小 TTL 限制
        let mut inner = InnerCache::new(100, Duration::from_secs(1)); // 1 秒 TTL
        inner.set("k1".to_string(), dummy_result(2));
        assert!(inner.get("k1").is_some());
        assert_eq!(inner.hits, 1);
        assert_eq!(inner.misses, 0);
        assert_eq!(inner.expired_count, 0);

        // 等待 2 秒使其过期
        std::thread::sleep(Duration::from_secs(2));
        assert!(inner.get("k1").is_none(), "超过 TTL 的缓存应被惰性淘汰");
        // 过期应计为一次 miss，同时 expired_count 增加
        assert_eq!(inner.hits, 1);
        assert_eq!(inner.misses, 1);
        assert_eq!(inner.expired_count, 1);
    }

    #[test]
    fn test_stats_hit_rate_calculation() {
        let cache = QueryCacheService::new();
        cache.set("k1".to_string(), dummy_result(1));
        cache.set("k2".to_string(), dummy_result(1));

        let _ = cache.get("k1"); // 命中
        let _ = cache.get("k1"); // 命中
        let _ = cache.get("k_missing"); // 未命中

        let s = cache.stats();
        assert_eq!(s.hits, 2);
        assert_eq!(s.misses, 1);
        assert!((s.hit_rate - 2.0 / 3.0).abs() < 1e-9);
    }

    #[test]
    fn test_none_strategy_never_caches() {
        let cache = QueryCacheService::new();
        cache.set_strategy(CacheStrategy::None);
        cache.set("k1".to_string(), dummy_result(3));
        assert!(cache.get("k1").is_none(), "None 策略下 get 应永远返回 None");
        assert_eq!(cache.stats().size, 0, "None 策略下不应存储任何内容");
        assert_eq!(cache.stats().strategy, CacheStrategy::None);
    }

    #[test]
    fn test_strategy_switch_clears_cache() {
        let cache = QueryCacheService::new();
        cache.set("k1".to_string(), dummy_result(1));
        cache.set("k2".to_string(), dummy_result(2));
        assert_eq!(cache.stats().size, 2);

        cache.set_strategy(CacheStrategy::None);
        assert_eq!(cache.stats().size, 0, "切换到 None 策略时应清空缓存");

        cache.set_strategy(CacheStrategy::Lru);
        cache.set("k3".to_string(), dummy_result(3));
        assert!(cache.get("k3").is_some(), "切回 LRU 策略后应能正常缓存");
        assert_eq!(cache.stats().strategy, CacheStrategy::Lru);
    }

    #[test]
    fn test_default_strategy_is_lru() {
        let cache = QueryCacheService::new();
        assert_eq!(cache.get_strategy(), CacheStrategy::Lru);
        assert_eq!(cache.stats().strategy, CacheStrategy::Lru);
    }

    #[test]
    fn test_strategy_from_string() {
        assert_eq!(CacheStrategy::from("lru"), CacheStrategy::Lru);
        assert_eq!(CacheStrategy::from("none"), CacheStrategy::None);
        assert_eq!(CacheStrategy::from("LRU"), CacheStrategy::Lru);
        assert_eq!(CacheStrategy::from("NONE"), CacheStrategy::None);
        assert_eq!(CacheStrategy::from("memory"), CacheStrategy::Lru);
        assert_eq!(CacheStrategy::from("unknown"), CacheStrategy::Lru);
    }

    #[test]
    fn test_none_strategy_invalidate_is_noop() {
        let cache = QueryCacheService::new();
        cache.set_strategy(CacheStrategy::None);
        cache.invalidate_all();
        let s = cache.stats();
        assert_eq!(s.size, 0);
        assert_eq!(s.strategy, CacheStrategy::None);
    }

    #[test]
    fn test_total_size_limit_evicts_oldest() {
        // 设置 max_total_size_bytes 较小（1KB），插入多个大条目验证驱逐
        let mut inner = InnerCache::with_max_size(100, Duration::from_secs(300), 1024);
        // 构造大结果集：每条 ~5KB 以上，远超 1KB 上限
        let big_result = QueryResult {
            columns: vec!["col".to_string(); 10],
            rows: (0..20)
                .map(|i| (0..10).map(|j| format!("value_{}_{}", i, j)).collect())
                .collect(),
            affected_rows: None,
        };
        // 测试前提：单条应超过 1KB 上限
        let first_size = estimate_size(&big_result);
        assert!(first_size > 1024, "测试前提：单条应超过 1KB 上限");

        inner.set("k1".to_string(), big_result.clone());
        // 仅 1 条时即使超过上限也保留（避免无限驱逐）
        assert_eq!(inner.entries.len(), 1);
        assert_eq!(inner.total_size_bytes, first_size);

        // 插入第二条，应驱逐 k1（最旧）保留 k2
        inner.set("k2".to_string(), big_result.clone());
        // 总大小不超过上限或仅保留 1 条
        assert!(
            inner.total_size_bytes <= inner.max_total_size_bytes || inner.entries.len() == 1,
            "总大小应不超过上限或仅保留 1 条"
        );
        assert!(!inner.entries.contains_key("k1"), "最旧的 k1 应被驱逐");
        assert_eq!(inner.entries.len(), 1, "超过总大小上限时仅保留最新 1 条");
    }

    #[test]
    fn test_stats_includes_size_fields() {
        let mut inner = InnerCache::with_max_size(10, Duration::from_secs(60), 2048);
        let result = QueryResult {
            columns: vec!["c1".to_string()],
            rows: vec![vec!["hello".to_string()]],
            affected_rows: None,
        };
        let expected_size = estimate_size(&result);
        inner.set("k1".to_string(), result);
        let s = inner.stats(true, CacheStrategy::Lru);
        assert_eq!(s.total_size_bytes, expected_size);
        assert_eq!(s.max_total_size_bytes, 2048);
    }

    #[test]
    fn test_invalidate_reduces_total_size() {
        let mut inner =
            InnerCache::with_max_size(100, Duration::from_secs(300), 256 * 1024 * 1024);
        let result = dummy_result(10);
        let expected_size = estimate_size(&result);
        inner.set("k1".to_string(), result);
        assert_eq!(inner.total_size_bytes, expected_size);
        assert!(inner.total_size_bytes > 0);

        let removed = inner.invalidate("k1");
        assert!(removed);
        assert_eq!(inner.total_size_bytes, 0, "invalidate 后总大小应归零");

        // 不存在的 key 不影响 total_size_bytes
        let removed2 = inner.invalidate("nonexistent");
        assert!(!removed2);
        assert_eq!(inner.total_size_bytes, 0);
    }
}
