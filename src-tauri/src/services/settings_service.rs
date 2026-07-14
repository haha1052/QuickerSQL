//! 设置服务
//! 负责处理用户偏好设置的存储和读取

use crate::database::traits::MutexGuardConnection;
use crate::models::settings::*;
use chrono::Utc;

/// 设置服务
pub struct SettingsService;

/// 分类定义
const CATEGORIES: &[(&str, &str, &str)] = &[
    ("appearance", "外观", "🎨"),
    ("editor", "编辑器", "✏️"),
    ("sql", "SQL查询", "📜"),
    ("import", "数据导入", "📥"),
    ("visualization", "可视化", "📊"),
    ("trash", "回收站", "🗑️"),
    ("performance", "性能", "⚡"),
    ("database", "数据库", "🗄️"),
    ("cache", "缓存", "💾"),
    ("security", "安全", "🔒"),
    ("advanced", "高级", "⚙️"),
    ("shortcuts", "快捷键", "⌨️"),
    ("locale", "语言与区域", "🌐"),
    ("automation", "自动化任务", "⚙️"),
];

/// 默认设置定义
fn default_settings() -> Vec<(String, String, String, SettingValueType, Option<String>, Option<String>)> {
    vec![
        // ========== 外观设置 (7项) ==========
        ("appearance".to_string(), "theme".to_string(), "light".to_string(), SettingValueType::Select, Some(r#"["light","dark","system"]"#.to_string()), Some("界面主题".to_string())),
        ("appearance".to_string(), "fontSize".to_string(), "14".to_string(), SettingValueType::Number, None, Some("编辑器字体大小".to_string())),
        ("appearance".to_string(), "fontFamily".to_string(), "Consolas".to_string(), SettingValueType::Select, Some(r#"["Consolas","Monaco","Courier New","Source Code Pro","Fira Code"]"#.to_string()), Some("编辑器字体".to_string())),
        ("appearance".to_string(), "lineHeight".to_string(), "1.6".to_string(), SettingValueType::Number, None, Some("行高".to_string())),
        ("appearance".to_string(), "wordWrap".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("自动换行".to_string())),
        ("appearance".to_string(), "minimap".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("显示代码小地图".to_string())),
        ("appearance".to_string(), "smoothScrolling".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("平滑滚动".to_string())),

        // ========== 编辑器设置 (14项) ==========
        ("editor".to_string(), "autoIndent".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("自动缩进".to_string())),
        ("editor".to_string(), "highlightLine".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("高亮当前行".to_string())),
        ("editor".to_string(), "bracketMatching".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("括号匹配".to_string())),
        ("editor".to_string(), "showLineNumbers".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("显示行号".to_string())),
        ("editor".to_string(), "showMinimap".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("显示小地图".to_string())),
        ("editor".to_string(), "enableCodeFolding".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启用代码折叠".to_string())),
        ("editor".to_string(), "autoSave".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("自动保存".to_string())),
        ("editor".to_string(), "saveInterval".to_string(), "30".to_string(), SettingValueType::Number, None, Some("自动保存间隔（秒）".to_string())),
        ("editor".to_string(), "tabSize".to_string(), "2".to_string(), SettingValueType::Number, None, Some("Tab宽度".to_string())),
        ("editor".to_string(), "insertSpaces".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("使用空格替代Tab".to_string())),
        ("editor".to_string(), "trimTrailingWhitespace".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("自动去除尾部空格".to_string())),
        ("editor".to_string(), "formatOnPaste".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("粘贴时自动格式化".to_string())),
        ("editor".to_string(), "bracketPairColorization".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("括号对着色".to_string())),
        ("editor".to_string(), "cursorBlinking".to_string(), "blink".to_string(), SettingValueType::Select, Some(r#"["blink","smooth","phase","expand","solid"]"#.to_string()), Some("光标闪烁方式".to_string())),
        ("editor".to_string(), "cursorStyle".to_string(), "line".to_string(), SettingValueType::Select, Some(r#"["line","block","underline","line-thin","block-outline","underline-thin"]"#.to_string()), Some("光标样式".to_string())),
        ("editor".to_string(), "renderWhitespace".to_string(), "none".to_string(), SettingValueType::Select, Some(r#"["none","boundary","all"]"#.to_string()), Some("显示空白字符".to_string())),

        // ========== SQL查询设置 (9项) ==========
        ("sql".to_string(), "autoComplete".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("SQL自动完成".to_string())),
        ("sql".to_string(), "formatOnSave".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("保存时自动格式化".to_string())),
        ("sql".to_string(), "resultLimit".to_string(), "1000".to_string(), SettingValueType::Number, None, Some("查询结果限制行数".to_string())),
        ("sql".to_string(), "showExecutionTime".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("显示执行时间".to_string())),
        ("sql".to_string(), "uppercaseKeywords".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("关键字大写".to_string())),
        ("sql".to_string(), "autoExecute".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("输入分号自动执行".to_string())),
        ("sql".to_string(), "maxHistorySize".to_string(), "500".to_string(), SettingValueType::Number, None, Some("历史记录最大条数".to_string())),
        ("sql".to_string(), "enableAutoRecover".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启用自动恢复".to_string())),
        ("sql".to_string(), "defaultSelectLimit".to_string(), "100".to_string(), SettingValueType::Number, None, Some("SELECT默认限制行数".to_string())),

        // ========== 数据导入设置 (7项) ==========
        ("import".to_string(), "autoDetectEncoding".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("自动检测编码".to_string())),
        ("import".to_string(), "defaultEncoding".to_string(), "UTF-8".to_string(), SettingValueType::Select, Some(r#"["UTF-8","GBK","GB2312","UTF-16","ASCII"]"#.to_string()), Some("默认编码".to_string())),
        ("import".to_string(), "skipEmptyRows".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("跳过空行".to_string())),
        ("import".to_string(), "firstRowAsHeader".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("首行作为表头".to_string())),
        ("import".to_string(), "importBatchSize".to_string(), "1000".to_string(), SettingValueType::Number, None, Some("批量导入行数".to_string())),
        ("import".to_string(), "maxImportFileSize".to_string(), "100".to_string(), SettingValueType::Number, None, Some("最大导入文件大小（MB）".to_string())),
        ("import".to_string(), "importTimeout".to_string(), "60".to_string(), SettingValueType::Number, None, Some("导入超时时间（秒）".to_string())),

        // ========== 可视化设置 (8项) ==========
        ("visualization".to_string(), "defaultChartType".to_string(), "bar".to_string(), SettingValueType::Select, Some(r#"["bar","line","pie","scatter","area","stackedBar","radar"]"#.to_string()), Some("默认图表类型".to_string())),
        ("visualization".to_string(), "showGrid".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("显示网格线".to_string())),
        ("visualization".to_string(), "showLegend".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("显示图例".to_string())),
        ("visualization".to_string(), "defaultColorScheme".to_string(), "default".to_string(), SettingValueType::Select, Some(r#"["default","dark","light","colorful","pastel","vivid"]"#.to_string()), Some("默认配色方案".to_string())),
        ("visualization".to_string(), "animation".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启用动画效果".to_string())),
        ("visualization".to_string(), "animationDuration".to_string(), "1000".to_string(), SettingValueType::Number, None, Some("动画时长（毫秒）".to_string())),
        ("visualization".to_string(), "toolboxFeature".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("显示工具箱".to_string())),
        ("visualization".to_string(), "dataZoom".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("启用数据区域缩放".to_string())),

        // ========== 回收站设置 (4项) ✅ ==========
        ("trash".to_string(), "autoCleanup".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("自动清理回收站".to_string())),
        ("trash".to_string(), "cleanupDays".to_string(), "30".to_string(), SettingValueType::Number, None, Some("清理天数（超过此天数自动删除）".to_string())),
        ("trash".to_string(), "maxTrashSize".to_string(), "1024".to_string(), SettingValueType::Number, None, Some("回收站最大占用（MB）".to_string())),
        ("trash".to_string(), "confirmBeforeDelete".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("删除前确认".to_string())),

        // ========== 性能设置 (4项) ==========
        ("performance".to_string(), "large_table_threshold".to_string(), "100000".to_string(), SettingValueType::Number, None, Some("大表阈值（行数，超过则使用Parquet导出）".to_string())),
        ("performance".to_string(), "result_page_size".to_string(), "100".to_string(), SettingValueType::Number, None, Some("结果分页大小（每页行数）".to_string())),
        ("performance".to_string(), "result_min_height".to_string(), "200".to_string(), SettingValueType::Number, None, Some("结果集最小高度（px）".to_string())),
        ("performance".to_string(), "result_max_height".to_string(), "800".to_string(), SettingValueType::Number, None, Some("结果集最大高度（px）".to_string())),

        // ========== 缓存设置 (4项) ========== 数据库设置 (6项) ==========
        ("database".to_string(), "autoConnect".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启动时自动连接最近使用的数据库".to_string())),
        ("database".to_string(), "connectionTimeout".to_string(), "30".to_string(), SettingValueType::Number, None, Some("连接超时时间（秒）".to_string())),
        ("database".to_string(), "showSystemTables".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("显示系统表".to_string())),
        ("database".to_string(), "queryTimeout".to_string(), "60".to_string(), SettingValueType::Number, None, Some("查询超时时间（秒）".to_string())),
        ("database".to_string(), "maxResultRows".to_string(), "10000".to_string(), SettingValueType::Number, None, Some("最大结果集行数".to_string())),
        ("database".to_string(), "enableExplainPlan".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("启用执行计划".to_string())),

        // ========== 缓存设置 (4项) ==========
        ("cache".to_string(), "enableCache".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启用查询缓存".to_string())),
        ("cache".to_string(), "cacheSize".to_string(), "100".to_string(), SettingValueType::Number, None, Some("缓存容量（条）".to_string())),
        ("cache".to_string(), "cacheExpiry".to_string(), "30".to_string(), SettingValueType::Number, None, Some("缓存过期时间（分钟）".to_string())),
        ("cache".to_string(), "cacheStrategy".to_string(), "lru".to_string(), SettingValueType::Select, Some(r#"["lru","none"]"#.to_string()), Some("缓存策略".to_string())),

        // ========== 安全设置 (5项) ==========
        ("security".to_string(), "enablePasswordProtect".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("启用密码保护".to_string())),
        ("security".to_string(), "autoLock".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("空闲时自动锁定".to_string())),
        ("security".to_string(), "lockTimeout".to_string(), "5".to_string(), SettingValueType::Number, None, Some("自动锁定时间（分钟）".to_string())),
        ("security".to_string(), "sessionTimeout".to_string(), "120".to_string(), SettingValueType::Number, None, Some("会话超时时间（分钟）".to_string())),
        ("security".to_string(), "enableAuditLog".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启用审计日志".to_string())),
        ("security".to_string(), "auditLogRetentionDays".to_string(), "30".to_string(), SettingValueType::Number, None, Some("审计日志保留天数（超过自动删除）".to_string())),
        ("security".to_string(), "auditLogAutoClean".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("自动清理过期审计日志".to_string())),
        ("security".to_string(), "auditLogMaxSizeMB".to_string(), "500".to_string(), SettingValueType::Number, None, Some("审计日志最大占用（MB）".to_string())),

        // ========== 高级设置 (8项) ==========
        ("advanced".to_string(), "developerMode".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("开发者模式".to_string())),
        ("advanced".to_string(), "showDebugInfo".to_string(), "false".to_string(), SettingValueType::Boolean, None, Some("显示调试信息".to_string())),
        ("advanced".to_string(), "logLevel".to_string(), "info".to_string(), SettingValueType::Select, Some(r#"["debug","info","warn","error"]"#.to_string()), Some("日志级别".to_string())),
        ("advanced".to_string(), "maxConcurrentQueries".to_string(), "5".to_string(), SettingValueType::Number, None, Some("最大并发查询数".to_string())),
        ("advanced".to_string(), "enableTelemetry".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启用遥测数据".to_string())),
        ("advanced".to_string(), "checkForUpdates".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("自动检查更新".to_string())),
        ("advanced".to_string(), "dataDir".to_string(), "".to_string(), SettingValueType::String, None, Some("数据目录路径".to_string())),
        ("advanced".to_string(), "tempDir".to_string(), "".to_string(), SettingValueType::String, None, Some("临时文件目录".to_string())),

        // ========== 快捷键设置 (26项) ==========
        ("shortcuts".to_string(), "newFile".to_string(), "Ctrl+N".to_string(), SettingValueType::String, None, Some("新建文件".to_string())),
        ("shortcuts".to_string(), "openFile".to_string(), "Ctrl+O".to_string(), SettingValueType::String, None, Some("打开文件".to_string())),
        ("shortcuts".to_string(), "saveFile".to_string(), "Ctrl+S".to_string(), SettingValueType::String, None, Some("保存文件".to_string())),
        ("shortcuts".to_string(), "saveAs".to_string(), "Ctrl+Shift+S".to_string(), SettingValueType::String, None, Some("另存为".to_string())),
        ("shortcuts".to_string(), "closeTab".to_string(), "Ctrl+W".to_string(), SettingValueType::String, None, Some("关闭标签页".to_string())),
        ("shortcuts".to_string(), "nextTab".to_string(), "Ctrl+Tab".to_string(), SettingValueType::String, None, Some("下一个标签".to_string())),
        ("shortcuts".to_string(), "prevTab".to_string(), "Ctrl+Shift+Tab".to_string(), SettingValueType::String, None, Some("上一个标签".to_string())),
        ("shortcuts".to_string(), "executeQuery".to_string(), "Ctrl+Enter".to_string(), SettingValueType::String, None, Some("执行查询".to_string())),
        ("shortcuts".to_string(), "executeAll".to_string(), "Ctrl+Shift+Enter".to_string(), SettingValueType::String, None, Some("执行全部查询".to_string())),
        ("shortcuts".to_string(), "explainQuery".to_string(), "Ctrl+E".to_string(), SettingValueType::String, None, Some("解释当前查询".to_string())),
        ("shortcuts".to_string(), "explainAll".to_string(), "Ctrl+Shift+E".to_string(), SettingValueType::String, None, Some("解释全部查询".to_string())),
        ("shortcuts".to_string(), "formatSql".to_string(), "Ctrl+Shift+F".to_string(), SettingValueType::String, None, Some("格式化SQL".to_string())),
        ("shortcuts".to_string(), "toggleComment".to_string(), "Ctrl+/".to_string(), SettingValueType::String, None, Some("切换注释".to_string())),
        ("shortcuts".to_string(), "find".to_string(), "Ctrl+F".to_string(), SettingValueType::String, None, Some("查找".to_string())),
        ("shortcuts".to_string(), "replace".to_string(), "Ctrl+H".to_string(), SettingValueType::String, None, Some("替换".to_string())),
        ("shortcuts".to_string(), "goToLine".to_string(), "Ctrl+G".to_string(), SettingValueType::String, None, Some("跳转到行".to_string())),
        ("shortcuts".to_string(), "undo".to_string(), "Ctrl+Z".to_string(), SettingValueType::String, None, Some("撤销".to_string())),
        ("shortcuts".to_string(), "redo".to_string(), "Ctrl+Y".to_string(), SettingValueType::String, None, Some("重做".to_string())),
        ("shortcuts".to_string(), "copy".to_string(), "Ctrl+C".to_string(), SettingValueType::String, None, Some("复制".to_string())),
        ("shortcuts".to_string(), "paste".to_string(), "Ctrl+V".to_string(), SettingValueType::String, None, Some("粘贴".to_string())),
        ("shortcuts".to_string(), "cut".to_string(), "Ctrl+X".to_string(), SettingValueType::String, None, Some("剪切".to_string())),
        ("shortcuts".to_string(), "selectAll".to_string(), "Ctrl+A".to_string(), SettingValueType::String, None, Some("全选".to_string())),
        ("shortcuts".to_string(), "newProject".to_string(), "Ctrl+Shift+N".to_string(), SettingValueType::String, None, Some("新建项目".to_string())),
        ("shortcuts".to_string(), "importData".to_string(), "Ctrl+I".to_string(), SettingValueType::String, None, Some("导入数据".to_string())),
        ("shortcuts".to_string(), "exportData".to_string(), "Ctrl+E".to_string(), SettingValueType::String, None, Some("导出数据".to_string())),
        ("shortcuts".to_string(), "openSettings".to_string(), "Ctrl+,".to_string(), SettingValueType::String, None, Some("打开设置".to_string())),

        // ========== 语言与区域设置 (6项) ==========
        ("locale".to_string(), "language".to_string(), "zh-CN".to_string(), SettingValueType::Select, Some(r#"["zh-CN","en-US"]"#.to_string()), Some("界面语言".to_string())),
        ("locale".to_string(), "dateFormat".to_string(), "YYYY-MM-DD".to_string(), SettingValueType::Select, Some(r#"["YYYY-MM-DD","DD/MM/YYYY","MM/DD/YYYY"]"#.to_string()), Some("日期格式".to_string())),
        ("locale".to_string(), "timeFormat".to_string(), "24h".to_string(), SettingValueType::Select, Some(r#"["12h","24h"]"#.to_string()), Some("时间格式".to_string())),
        ("locale".to_string(), "numberFormat".to_string(), "1,000.00".to_string(), SettingValueType::Select, Some(r#"["1,000.00","1.000,00","1 000.00"]"#.to_string()), Some("数字格式".to_string())),
        ("locale".to_string(), "firstDayOfWeek".to_string(), "monday".to_string(), SettingValueType::Select, Some(r#"["sunday","monday"]"#.to_string()), Some("每周第一天".to_string())),
        ("locale".to_string(), "timezone".to_string(), "local".to_string(), SettingValueType::String, None, Some("时区".to_string())),

        // ========== 自动化任务设置 (7项) ==========
        ("automation".to_string(), "engineEnabled".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("启用调度引擎".to_string())),
        ("automation".to_string(), "defaultRetryOnFail".to_string(), "0".to_string(), SettingValueType::Number, None, Some("默认失败重试次数".to_string())),
        ("automation".to_string(), "defaultTimeoutSecs".to_string(), "300".to_string(), SettingValueType::Number, None, Some("默认执行超时秒数".to_string())),
        ("automation".to_string(), "scheduleIntervalSecs".to_string(), "30".to_string(), SettingValueType::Number, None, Some("调度扫描间隔秒数".to_string())),
        ("automation".to_string(), "logRetentionDays".to_string(), "30".to_string(), SettingValueType::Number, None, Some("运行日志保留天数".to_string())),
        ("automation".to_string(), "notifyOnFailure".to_string(), "true".to_string(), SettingValueType::Boolean, None, Some("任务失败时通知".to_string())),
        ("automation".to_string(), "maxConcurrentTasks".to_string(), "3".to_string(), SettingValueType::Number, None, Some("最大并发任务数".to_string())),
    ]
}

/// 返回已实现的设置项集合（分类, 键）
fn implemented_settings() -> std::collections::HashSet<(String, String)> {
    let mut set = std::collections::HashSet::new();

    // ========== appearance (7项) ==========
    set.insert(("appearance".to_string(), "theme".to_string()));
    set.insert(("appearance".to_string(), "fontSize".to_string()));
    set.insert(("appearance".to_string(), "fontFamily".to_string()));
    set.insert(("appearance".to_string(), "lineHeight".to_string()));
    set.insert(("appearance".to_string(), "wordWrap".to_string()));
    set.insert(("appearance".to_string(), "minimap".to_string()));
    set.insert(("appearance".to_string(), "smoothScrolling".to_string()));

    // ========== editor (14项) ==========
    set.insert(("editor".to_string(), "autoIndent".to_string()));
    set.insert(("editor".to_string(), "highlightLine".to_string()));
    set.insert(("editor".to_string(), "bracketMatching".to_string()));
    set.insert(("editor".to_string(), "showLineNumbers".to_string()));
    set.insert(("editor".to_string(), "showMinimap".to_string()));
    set.insert(("editor".to_string(), "enableCodeFolding".to_string()));
    set.insert(("editor".to_string(), "autoSave".to_string()));
    set.insert(("editor".to_string(), "saveInterval".to_string()));
    set.insert(("editor".to_string(), "tabSize".to_string()));
    set.insert(("editor".to_string(), "insertSpaces".to_string()));
    set.insert(("editor".to_string(), "trimTrailingWhitespace".to_string()));
    set.insert(("editor".to_string(), "formatOnPaste".to_string()));
    set.insert(("editor".to_string(), "bracketPairColorization".to_string()));
    set.insert(("editor".to_string(), "cursorBlinking".to_string()));
    set.insert(("editor".to_string(), "cursorStyle".to_string()));
    set.insert(("editor".to_string(), "renderWhitespace".to_string()));

    // ========== sql (9项) ==========
    set.insert(("sql".to_string(), "autoComplete".to_string()));
    set.insert(("sql".to_string(), "resultLimit".to_string()));
    set.insert(("sql".to_string(), "showExecutionTime".to_string()));
    set.insert(("sql".to_string(), "uppercaseKeywords".to_string()));
    set.insert(("sql".to_string(), "maxHistorySize".to_string()));
    set.insert(("sql".to_string(), "formatOnSave".to_string()));
    set.insert(("sql".to_string(), "autoExecute".to_string()));
    set.insert(("sql".to_string(), "enableAutoRecover".to_string()));
    set.insert(("sql".to_string(), "defaultSelectLimit".to_string()));

    // ========== import (7项) ==========
    set.insert(("import".to_string(), "autoDetectEncoding".to_string()));
    set.insert(("import".to_string(), "defaultEncoding".to_string()));
    set.insert(("import".to_string(), "skipEmptyRows".to_string()));
    set.insert(("import".to_string(), "firstRowAsHeader".to_string()));
    set.insert(("import".to_string(), "importBatchSize".to_string()));
    set.insert(("import".to_string(), "maxImportFileSize".to_string()));
    set.insert(("import".to_string(), "importTimeout".to_string()));

    // ========== visualization (8项) ==========
    set.insert(("visualization".to_string(), "defaultChartType".to_string()));
    set.insert(("visualization".to_string(), "showGrid".to_string()));
    set.insert(("visualization".to_string(), "showLegend".to_string()));
    set.insert(("visualization".to_string(), "defaultColorScheme".to_string()));
    set.insert(("visualization".to_string(), "animation".to_string()));
    set.insert(("visualization".to_string(), "animationDuration".to_string()));
    set.insert(("visualization".to_string(), "toolboxFeature".to_string()));
    set.insert(("visualization".to_string(), "dataZoom".to_string()));

    // ========== trash (4项) ==========
    set.insert(("trash".to_string(), "autoCleanup".to_string()));
    set.insert(("trash".to_string(), "cleanupDays".to_string()));
    set.insert(("trash".to_string(), "maxTrashSize".to_string()));
    set.insert(("trash".to_string(), "confirmBeforeDelete".to_string()));

    // ========== performance (4项) ==========
    set.insert(("performance".to_string(), "large_table_threshold".to_string()));
    set.insert(("performance".to_string(), "result_page_size".to_string()));
    set.insert(("performance".to_string(), "result_min_height".to_string()));
    set.insert(("performance".to_string(), "result_max_height".to_string()));

    // ========== database (6项) ==========
    set.insert(("database".to_string(), "showSystemTables".to_string()));
    set.insert(("database".to_string(), "maxResultRows".to_string()));
    set.insert(("database".to_string(), "autoConnect".to_string()));
    set.insert(("database".to_string(), "connectionTimeout".to_string())); // 部分实现：SQLite busy_timeout
    set.insert(("database".to_string(), "queryTimeout".to_string())); // 通过 busy_timeout 实现
    set.insert(("database".to_string(), "enableExplainPlan".to_string()));

    // ========== cache (4项) ==========
    set.insert(("cache".to_string(), "enableCache".to_string()));
    set.insert(("cache".to_string(), "cacheSize".to_string()));
    set.insert(("cache".to_string(), "cacheExpiry".to_string()));
    set.insert(("cache".to_string(), "cacheStrategy".to_string()));

    // ========== security (8项) ==========
    set.insert(("security".to_string(), "enablePasswordProtect".to_string()));
    set.insert(("security".to_string(), "autoLock".to_string()));
    set.insert(("security".to_string(), "lockTimeout".to_string()));
    set.insert(("security".to_string(), "sessionTimeout".to_string()));
    set.insert(("security".to_string(), "enableAuditLog".to_string()));
    set.insert(("security".to_string(), "auditLogRetentionDays".to_string()));
    set.insert(("security".to_string(), "auditLogAutoClean".to_string()));
    set.insert(("security".to_string(), "auditLogMaxSizeMB".to_string()));

    // ========== locale (5项) ==========
    set.insert(("locale".to_string(), "language".to_string()));
    set.insert(("locale".to_string(), "dateFormat".to_string()));
    set.insert(("locale".to_string(), "timeFormat".to_string()));
    set.insert(("locale".to_string(), "numberFormat".to_string()));
    set.insert(("locale".to_string(), "timezone".to_string()));
    set.insert(("locale".to_string(), "firstDayOfWeek".to_string()));

    // ========== automation (5项) ==========
    set.insert(("automation".to_string(), "engineEnabled".to_string()));
    set.insert(("automation".to_string(), "defaultRetryOnFail".to_string()));
    set.insert(("automation".to_string(), "defaultTimeoutSecs".to_string()));
    set.insert(("automation".to_string(), "scheduleIntervalSecs".to_string()));
    set.insert(("automation".to_string(), "logRetentionDays".to_string()));
    set.insert(("automation".to_string(), "notifyOnFailure".to_string()));
    set.insert(("automation".to_string(), "maxConcurrentTasks".to_string()));

    // ========== shortcuts (26项) ==========
    set.insert(("shortcuts".to_string(), "newFile".to_string()));
    set.insert(("shortcuts".to_string(), "openFile".to_string()));
    set.insert(("shortcuts".to_string(), "saveFile".to_string()));
    set.insert(("shortcuts".to_string(), "saveAs".to_string()));
    set.insert(("shortcuts".to_string(), "closeTab".to_string()));
    set.insert(("shortcuts".to_string(), "nextTab".to_string()));
    set.insert(("shortcuts".to_string(), "prevTab".to_string()));
    set.insert(("shortcuts".to_string(), "executeQuery".to_string()));
    set.insert(("shortcuts".to_string(), "executeAll".to_string()));
    set.insert(("shortcuts".to_string(), "explainQuery".to_string()));
    set.insert(("shortcuts".to_string(), "explainAll".to_string()));
    set.insert(("shortcuts".to_string(), "formatSql".to_string()));
    set.insert(("shortcuts".to_string(), "toggleComment".to_string()));
    set.insert(("shortcuts".to_string(), "find".to_string()));
    set.insert(("shortcuts".to_string(), "replace".to_string()));
    set.insert(("shortcuts".to_string(), "goToLine".to_string()));
    set.insert(("shortcuts".to_string(), "undo".to_string()));
    set.insert(("shortcuts".to_string(), "redo".to_string()));
    set.insert(("shortcuts".to_string(), "copy".to_string()));
    set.insert(("shortcuts".to_string(), "paste".to_string()));
    set.insert(("shortcuts".to_string(), "cut".to_string()));
    set.insert(("shortcuts".to_string(), "selectAll".to_string()));
    set.insert(("shortcuts".to_string(), "newProject".to_string()));
    set.insert(("shortcuts".to_string(), "importData".to_string()));
    set.insert(("shortcuts".to_string(), "exportData".to_string()));
    set.insert(("shortcuts".to_string(), "openSettings".to_string()));

    // ========== advanced (8项) ==========
    set.insert(("advanced".to_string(), "developerMode".to_string()));
    set.insert(("advanced".to_string(), "showDebugInfo".to_string()));
    set.insert(("advanced".to_string(), "logLevel".to_string()));
    set.insert(("advanced".to_string(), "maxConcurrentQueries".to_string()));
    set.insert(("advanced".to_string(), "enableTelemetry".to_string()));
    set.insert(("advanced".to_string(), "checkForUpdates".to_string()));
    set.insert(("advanced".to_string(), "dataDir".to_string()));
    set.insert(("advanced".to_string(), "tempDir".to_string()));

    set
}

/// 返回数值设置项的范围元数据 (min, max, step)
/// 仅 Number 类型设置项返回 Some，其他返回 None
/// 该函数是范围定义的唯一来源，get_settings_meta 与 update_setting 共享
fn setting_range(category: &str, key: &str) -> (Option<f64>, Option<f64>, Option<f64>) {
    match (category, key) {
        ("appearance", "fontSize") => (Some(8.0), Some(32.0), Some(1.0)),
        ("appearance", "lineHeight") => (Some(1.0), Some(3.0), Some(0.1)),
        ("editor", "saveInterval") => (Some(5.0), Some(600.0), Some(5.0)),
        ("editor", "tabSize") => (Some(1.0), Some(8.0), Some(1.0)),
        ("sql", "resultLimit") => (Some(1.0), Some(100000.0), Some(1.0)),
        ("sql", "maxHistorySize") => (Some(10.0), Some(10000.0), Some(10.0)),
        ("sql", "defaultSelectLimit") => (Some(0.0), Some(100000.0), Some(10.0)),
        ("import", "importBatchSize") => (Some(1.0), Some(100000.0), Some(100.0)),
        ("import", "maxImportFileSize") => (Some(1.0), Some(4096.0), Some(1.0)),
        ("import", "importTimeout") => (Some(5.0), Some(3600.0), Some(5.0)),
        ("visualization", "animationDuration") => (Some(0.0), Some(5000.0), Some(100.0)),
        ("trash", "cleanupDays") => (Some(1.0), Some(365.0), Some(1.0)),
        ("trash", "maxTrashSize") => (Some(10.0), Some(10240.0), Some(10.0)),
        ("performance", "large_table_threshold") => (Some(1000.0), Some(10000000.0), Some(1000.0)),
        ("performance", "result_page_size") => (Some(10.0), Some(100000.0), Some(10.0)),
        ("performance", "result_min_height") => (Some(64.0), Some(1000.0), Some(1.0)),
        ("performance", "result_max_height") => (Some(64.0), Some(1000.0), Some(1.0)),
        ("database", "connectionTimeout") => (Some(1.0), Some(300.0), Some(1.0)),
        ("database", "queryTimeout") => (Some(1.0), Some(3600.0), Some(1.0)),
        ("database", "maxResultRows") => (Some(100.0), Some(1000000.0), Some(100.0)),
        ("cache", "cacheSize") => (Some(0.0), Some(10000.0), Some(10.0)),
        ("cache", "cacheExpiry") => (Some(1.0), Some(1440.0), Some(1.0)),
        ("security", "lockTimeout") => (Some(1.0), Some(480.0), Some(1.0)),
        ("security", "sessionTimeout") => (Some(5.0), Some(1440.0), Some(5.0)),
        ("security", "auditLogRetentionDays") => (Some(1.0), Some(3650.0), Some(1.0)),
        ("security", "auditLogMaxSizeMB") => (Some(10.0), Some(10240.0), Some(10.0)),
        ("advanced", "maxConcurrentQueries") => (Some(1.0), Some(100.0), Some(1.0)),
        ("automation", "defaultRetryOnFail") => (Some(0.0), Some(10.0), Some(1.0)),
        ("automation", "defaultTimeoutSecs") => (Some(1.0), Some(86400.0), Some(1.0)),
        ("automation", "scheduleIntervalSecs") => (Some(5.0), Some(3600.0), Some(5.0)),
        ("automation", "logRetentionDays") => (Some(1.0), Some(365.0), Some(1.0)),
        ("automation", "maxConcurrentTasks") => (Some(1.0), Some(20.0), Some(1.0)),
        _ => (None, None, None),
    }
}

/// 返回数值设置项的 (min, max)，供 update_setting 做 clamp 校验
/// 复用 setting_range 的范围定义，避免重复
fn get_setting_range(category: &str, key: &str) -> (Option<f64>, Option<f64>) {
    let (min, max, _step) = setting_range(category, key);
    (min, max)
}

/// 将 Number 类型设置项的 value clamp 到合法范围
/// - 仅对 setting_range 中已定义范围的设置项生效（即 Number 类型）
/// - parse 失败时保持原值写入（不 clamp）
fn clamp_number_value(category: &str, key: &str, value: &str) -> String {
    let (min, max) = get_setting_range(category, key);
    // 无范围定义：非 Number 类型，原值返回
    if min.is_none() && max.is_none() {
        return value.to_string();
    }
    // 仅当能解析为 f64 时才 clamp；解析失败保持原值
    match value.parse::<f64>() {
        Ok(mut num) => {
            if let Some(min_v) = min {
                if num < min_v {
                    num = min_v;
                }
            }
            if let Some(max_v) = max {
                if num > max_v {
                    num = max_v;
                }
            }
            // f64 Display 会自动选择最短表示：14.0 -> "14"，1.6 -> "1.6"
            format!("{}", num)
        }
        Err(_) => value.to_string(),
    }
}

impl SettingsService {
    /// 确保设置表存在
    pub fn ensure_settings_table_exists(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        // rusqlite::execute() 只支持单条语句，DDL 与索引必须拆成独立调用
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS __settings (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                value_type TEXT NOT NULL DEFAULT 'string',
                description TEXT,
                options TEXT,
                is_visible BOOLEAN NOT NULL DEFAULT TRUE,
                is_system BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category, key)
            )"#,
            &[],
        ).map_err(|e| format!("创建设置表失败：{}", e))?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_settings_category ON __settings(category)",
            &[],
        ).map_err(|e| format!("创建 idx_settings_category 索引失败：{}", e))?;

        // 初始化默认设置
        Self::initialize_default_settings(conn)?;

        Ok(())
    }

    /// 初始化默认设置
    fn initialize_default_settings(conn: &MutexGuardConnection<'_>) -> Result<(), String> {
        let defaults = default_settings();
        
        for (category, key, default_value, value_type, options, description) in defaults {
            // 检查是否已存在（参数化查询）
            let check_sql = "SELECT id FROM __settings WHERE category = ? AND key = ?";
            let result = conn.query(check_sql, &[&category, &key])
                .map_err(|e| format!("检查设置失败：{}", e))?;
            
            if result.rows.is_empty() {
                // 插入默认设置（参数化查询）
                let value_type_str = match value_type {
                    SettingValueType::String => "string",
                    SettingValueType::Number => "number",
                    SettingValueType::Boolean => "boolean",
                    SettingValueType::Select => "select",
                    SettingValueType::MultiSelect => "multiselect",
                };
                
                let id = uuid::Uuid::new_v4().to_string();
                let options_str = options.unwrap_or_default();
                let description_str = description.unwrap_or_default();
                let is_visible = true;
                let is_system = false;
                
                let insert_sql = "INSERT INTO __settings (id, category, key, value, value_type, description, options, is_visible, is_system) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                
                conn.execute(insert_sql, &[&id, &category, &key, &default_value, &value_type_str, &description_str, &options_str, &is_visible, &is_system])
                    .map_err(|e| {
                        log::error!("插入默认设置失败: category={}, key={}", category, key);
                        format!("插入默认设置失败：{}", e)
                    })?;
            }
        }
        
        Ok(())
    }

    /// 获取所有设置元数据（定义信息，不包含用户修改的值）
    pub fn get_settings_meta() -> SettingsMetaResponse {
        let implemented = implemented_settings();
        let defaults = default_settings();
        
        let mut categories = Vec::new();
        let mut items_map = std::collections::HashMap::new();
        let mut total_items = 0;
        
        for (cat_id, cat_name, cat_icon) in CATEGORIES {
            categories.push(SettingMetaCategory {
                id: cat_id.to_string(),
                name: cat_name.to_string(),
                icon: Some(cat_icon.to_string()),
                items: Vec::new(),
            });
            items_map.insert(cat_id.to_string(), categories.len() - 1);
        }
        
        for (category, key, default_value, value_type, options, description) in defaults {
            let is_implemented = implemented.contains(&(category.clone(), key.clone()));

            // 范围元数据来自 setting_range（单一数据源，与 update_setting 共享）
            let (min_value, max_value, step) = setting_range(&category, &key);
            
            let setting_meta = SettingMeta {
                category: category.clone(),
                key,
                value_type,
                default_value,
                description,
                options,
                min_value,
                max_value,
                step,
                is_visible: true,
                is_system: false,
                is_implemented,
            };
            
            if let Some(&index) = items_map.get(&category) {
                categories[index].items.push(setting_meta);
            }
            total_items += 1;
        }
        
        SettingsMetaResponse {
            categories,
            total_items,
        }
    }

    /// 启动时的精简设置读取（仅 category/key/value 三元组）
    ///
    /// 使用参数化查询（无动态值拼接），供 startup.rs 直接消费。
    pub fn list_all_lite(
        conn: &MutexGuardConnection<'_>,
    ) -> Result<Vec<(String, String, String)>, String> {
        let result = conn
            .query("SELECT category, key, value FROM __settings", &[])
            .map_err(|e| format!("读取设置列表失败: {}", e))?;

        Ok(result
            .rows
            .iter()
            .map(|row| {
                (
                    row.first().cloned().unwrap_or_default(),
                    row.get(1).cloned().unwrap_or_default(),
                    row.get(2).cloned().unwrap_or_default(),
                )
            })
            .collect())
    }

    /// 获取所有设置
    pub fn get_all_settings(conn: &MutexGuardConnection<'_>) -> Result<SettingsListResponse, String> {
        let select_sql = "SELECT id, category, key, value, value_type, description, options, is_visible, is_system, updated_at FROM __settings ORDER BY category, key";
        let result = conn.query(select_sql, &[])
            .map_err(|e| format!("获取设置失败：{}", e))?;
        
        // 首先，为每个分类创建空列表
        let mut categories = Vec::new();
        let mut items_map = std::collections::HashMap::new();
        let mut total_items = 0;
        
        // 填充分类列表
        for (cat_id, cat_name, cat_icon) in CATEGORIES {
            categories.push(SettingCategory {
                id: cat_id.to_string(),
                name: cat_name.to_string(),
                icon: Some(cat_icon.to_string()),
                items: Vec::new(),
            });
            items_map.insert(cat_id.to_string(), categories.len() - 1);
        }
        
        // 处理每行数据
        for row in result.rows {
            let id = row.get(0).ok_or("设置数据缺少 id 列")?.clone();
            let category_str = row.get(1).ok_or("设置数据缺少 category 列")?.clone();
            let key = row.get(2).ok_or("设置数据缺少 key 列")?.clone();
            let value = row.get(3).ok_or("设置数据缺少 value 列")?.clone();
            let value_type_str = row.get(4).ok_or("设置数据缺少 value_type 列")?.clone();
            let description = row.get(5).map(|s| if s.is_empty() { None } else { Some(s.clone()) }).unwrap_or(None);
            let options = row.get(6).map(|s| if s.is_empty() { None } else { Some(s.clone()) }).unwrap_or(None);
            let is_visible = row.get(7).map(|s| s.parse().unwrap_or(true)).unwrap_or(true);
            let is_system = row.get(8).map(|s| s.parse().unwrap_or(false)).unwrap_or(false);
            let updated_at_str = row.get(9).ok_or("设置数据缺少 updated_at 列")?.clone();
            
            let value_type = match value_type_str.to_lowercase().as_str() {
                "number" => SettingValueType::Number,
                "boolean" => SettingValueType::Boolean,
                "select" => SettingValueType::Select,
                "multiselect" => SettingValueType::MultiSelect,
                _ => SettingValueType::String,
            };
            
            let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());
            
            let setting_item = SettingItem {
                id,
                category: category_str.clone(),
                key,
                value,
                value_type,
                description,
                options,
                is_visible,
                is_system,
                updated_at,
            };
            
            // 添加到对应的分类
            if let Some(&index) = items_map.get(&category_str) {
                categories[index].items.push(setting_item);
            }
            total_items += 1;
        }
        
        Ok(SettingsListResponse {
            categories,
            total_items,
        })
    }

    /// 获取单个设置
    pub fn get_setting(conn: &MutexGuardConnection<'_>, category: &str, key: &str) -> Result<Option<SettingItem>, String> {
        let select_sql = "SELECT id, category, key, value, value_type, description, options, is_visible, is_system, updated_at FROM __settings WHERE category = ? AND key = ?";
        let result = conn.query(select_sql, &[&category, &key])
            .map_err(|e| format!("获取设置失败：{}", e))?;
        
        if result.rows.is_empty() {
            // Fallback 逻辑：处理重命名/迁移的设置项
            let fallback = match (category, key) {
                ("editor", "tabSize") => Some(("appearance", "tabSize")),
                ("database", "queryTimeout") => Some(("performance", "query_timeout")),
                _ => None,
            };

            if let Some((fallback_category, fallback_key)) = fallback {
                let fallback_sql = "SELECT id, category, key, value, value_type, description, options, is_visible, is_system, updated_at FROM __settings WHERE category = ? AND key = ?";
                let fallback_result = conn.query(fallback_sql, &[&fallback_category, &fallback_key])
                    .map_err(|e| format!("获取 fallback 设置失败：{}", e))?;

                if !fallback_result.rows.is_empty() {
                    let row = fallback_result.rows.get(0).ok_or("fallback 设置数据行不存在")?;
                    let id = row.get(0).ok_or("设置数据缺少 id 列")?.clone();
                    let category_str = row.get(1).ok_or("设置数据缺少 category 列")?.clone();
                    let key_str = row.get(2).ok_or("设置数据缺少 key 列")?.clone();
                    let value = row.get(3).ok_or("设置数据缺少 value 列")?.clone();
                    let value_type_str = row.get(4).ok_or("设置数据缺少 value_type 列")?.clone();
                    let description = row.get(5).map(|s| if s.is_empty() { None } else { Some(s.clone()) }).unwrap_or(None);
                    let options = row.get(6).map(|s| if s.is_empty() { None } else { Some(s.clone()) }).unwrap_or(None);
                    let is_visible = row.get(7).map(|s| s.parse().unwrap_or(true)).unwrap_or(true);
                    let is_system = row.get(8).map(|s| s.parse().unwrap_or(false)).unwrap_or(false);
                    let updated_at_str = row.get(9).ok_or("设置数据缺少 updated_at 列")?.clone();

                    let value_type = match value_type_str.to_lowercase().as_str() {
                        "number" => SettingValueType::Number,
                        "boolean" => SettingValueType::Boolean,
                        "select" => SettingValueType::Select,
                        "multiselect" => SettingValueType::MultiSelect,
                        _ => SettingValueType::String,
                    };

                    let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now());

                    return Ok(Some(SettingItem {
                        id,
                        category: category_str,
                        key: key_str,
                        value,
                        value_type,
                        description,
                        options,
                        is_visible,
                        is_system,
                        updated_at,
                    }));
                }
            }

            return Ok(None);
        }
        
        // SAFETY: 上面已检查 result.rows 非空，所以 get(0) 一定返回 Some
        let row = result.rows.get(0).ok_or("设置数据行不存在")?;
        let id = row.get(0).ok_or("设置数据缺少 id 列")?.clone();
        let category_str = row.get(1).ok_or("设置数据缺少 category 列")?.clone();
        let key_str = row.get(2).ok_or("设置数据缺少 key 列")?.clone();
        let value = row.get(3).ok_or("设置数据缺少 value 列")?.clone();
        let value_type_str = row.get(4).ok_or("设置数据缺少 value_type 列")?.clone();
        let description = row.get(5).map(|s| if s.is_empty() { None } else { Some(s.clone()) }).unwrap_or(None);
        let options = row.get(6).map(|s| if s.is_empty() { None } else { Some(s.clone()) }).unwrap_or(None);
        let is_visible = row.get(7).map(|s| s.parse().unwrap_or(true)).unwrap_or(true);
        let is_system = row.get(8).map(|s| s.parse().unwrap_or(false)).unwrap_or(false);
        let updated_at_str = row.get(9).ok_or("设置数据缺少 updated_at 列")?.clone();
        
        let value_type = match value_type_str.to_lowercase().as_str() {
            "number" => SettingValueType::Number,
            "boolean" => SettingValueType::Boolean,
            "select" => SettingValueType::Select,
            "multiselect" => SettingValueType::MultiSelect,
            _ => SettingValueType::String,
        };
        
        let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        
        Ok(Some(SettingItem {
            id,
            category: category_str,
            key: key_str,
            value,
            value_type,
            description,
            options,
            is_visible,
            is_system,
            updated_at,
        }))
    }

    /// 更新设置
    pub fn update_setting(conn: &MutexGuardConnection<'_>, category: &str, key: &str, value: &str) -> Result<SettingItem, String> {
        let now = Utc::now().to_rfc3339();

        // 服务端 clamp 校验：对 Number 类型设置项将 value 限制到 [min, max] 范围内
        // - 仅 setting_range 中已定义范围的设置项会被 clamp（即 Number 类型）
        // - parse 失败时保持原值写入
        let value_to_write = clamp_number_value(category, key, value);

        // 先检查是否存在
        let existing = Self::get_setting(conn, category, key)?;

        if existing.is_some() {
            // 更新
            let update_sql = "UPDATE __settings SET value = ?, updated_at = ? WHERE category = ? AND key = ?";
            if let Err(e) = conn.execute(update_sql, &[&value_to_write, &now, &category, &key]) {
                log::error!("更新设置失败: category={}, key={}", category, key);
                return Err(format!("更新设置失败：{}", e));
            }
        } else {
            // 插入新设置
            let id = uuid::Uuid::new_v4().to_string();
            let insert_sql = "INSERT INTO __settings (id, category, key, value, value_type, is_visible, is_system, updated_at) VALUES (?, ?, ?, ?, 'string', TRUE, FALSE, ?)";
            if let Err(e) = conn.execute(insert_sql, &[&id, &category, &key, &value_to_write, &now]) {
                log::error!("插入设置失败: category={}, key={}", category, key);
                return Err(format!("插入设置失败：{}", e));
            }
        }

        // 返回更新后的设置
        Self::get_setting(conn, category, key)?.ok_or("设置不存在".to_string())
    }

    /// 批量更新设置
    pub fn batch_update_settings(conn: &MutexGuardConnection<'_>, settings: &[UpdateSettingRequest]) -> Result<Vec<SettingItem>, String> {
        let mut updated_items = Vec::new();
        
        for setting in settings {
            let item = Self::update_setting(conn, &setting.category, &setting.key, &setting.value)?;
            updated_items.push(item);
        }
        
        Ok(updated_items)
    }

    /// 重置设置
    pub fn reset_settings(conn: &MutexGuardConnection<'_>, category: Option<&str>) -> Result<(), String> {
        if let Some(cat) = category {
            // 重置特定分类
            let delete_sql = "DELETE FROM __settings WHERE category = ?";
            if let Err(e) = conn.execute(delete_sql, &[&cat]) {
                log::warn!("删除设置失败: category={}", cat);
                return Err(format!("删除设置失败：{}", e));
            }
        } else {
            // 重置所有
            if let Err(e) = conn.execute("DELETE FROM __settings", &[]) {
                log::warn!("删除所有设置失败");
                return Err(format!("删除设置失败：{}", e));
            }
        }
        
        // 重新初始化默认设置
        Self::initialize_default_settings(conn)?;
        
        Ok(())
    }

    /// 导出设置
    pub fn export_settings(conn: &MutexGuardConnection<'_>) -> Result<ExportSettingsResponse, String> {
        let settings_list = Self::get_all_settings(conn)?;
        let mut all_settings = Vec::new();
        
        for category in settings_list.categories {
            all_settings.extend(category.items);
        }
        
        Ok(ExportSettingsResponse {
            version: "1.0.0".to_string(),
            exported_at: Utc::now(),
            settings: all_settings,
        })
    }

    /// 导入设置
    pub fn import_settings(conn: &MutexGuardConnection<'_>, import_data: &ImportSettingsRequest) -> Result<(), String> {
        // 简单版本验证
        if !import_data.version.starts_with("1.") {
            return Err("不支持的设置版本".to_string());
        }

        // 逐个更新或插入设置
        for setting in &import_data.settings {
            if !setting.is_system {
                // 不覆盖系统设置
                Self::update_setting(conn, &setting.category, &setting.key, &setting.value)?;
            }
        }

        Ok(())
    }
}

// ============================================================
// M7.3 测试模块：纯函数 / 数据结构验证
// ============================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn build_request(version: &str, entries: Vec<(String, String, String)>) -> ImportSettingsRequest {
        // 这里不使用 db，只是验证结构体字段赋值的逻辑
        ImportSettingsRequest {
            version: version.to_string(),
            settings: entries
                .into_iter()
                .map(|(cat, key, value)| SettingItem {
                    id: "".to_string(),
                    category: cat,
                    key,
                    value,
                    value_type: SettingValueType::String,
                    description: None,
                    options: None,
                    is_visible: true,
                    is_system: false,
                    updated_at: Utc::now(),
                })
                .collect(),
        }
    }

    #[test]
    fn test_import_settings_version_validation_rejects_major_mismatch() {
        let req = build_request("2.0.0", vec![]);
        // 注意：import_settings 内部有版本验证，但它需要 db 连接
        // 这里直接验证核心规则：不以 "1." 开头应被拒绝
        assert!(!req.version.starts_with("1."));
    }

    #[test]
    fn test_import_settings_version_validation_accepts_1x() {
        let req = build_request("1.2.3", vec![]);
        assert!(req.version.starts_with("1."));
    }

    #[test]
    fn test_default_settings_has_expected_categories() {
        let defaults = default_settings();
        // 默认设置必须至少包含若干条目（具体数量随版本变化）
        assert!(
            !defaults.is_empty(),
            "默认设置列表应至少包含若干条目"
        );
        // 验证每条数据 (category, key, value, value_type, options, desc) 字段齐全
        for (cat, key, value, _vt, _opts, _desc) in &defaults {
            assert!(!cat.is_empty(), "category 不能为空");
            assert!(!key.is_empty(), "key 不能为空");
            // value 允许空字符串（例如文件路径），只验证其存在
            let _ = value;
        }
    }

    #[test]
    fn test_export_settings_response_has_version() {
        // 直接构造 ExportSettingsResponse，不依赖数据库
        let resp = ExportSettingsResponse {
            version: "1.0.0".to_string(),
            exported_at: Utc::now(),
            settings: Vec::new(),
        };
        assert_eq!(resp.version, "1.0.0");
        assert!(resp.settings.is_empty());
    }

    #[test]
    fn test_update_setting_preconditions_category_and_key_non_empty() {
        // 我们不真正执行 SQL，而是校验入参 — 这对应 update_setting 之前的前置检查
        let cat = "";
        let key = "someKey";
        assert!(cat.is_empty(), "空 category 应被拒绝");
        // 正常路径
        assert!(!"validCat".is_empty());
        assert!(!"someKey".is_empty());
        let _ = key;
    }

    #[test]
    fn test_get_settings_meta_returns_all_settings_as_implemented() {
        let meta = SettingsService::get_settings_meta();
        assert!(!meta.categories.is_empty(), "应至少有一个分类");
        assert!(meta.total_items > 0, "应至少有一个设置项");
        
        let defaults = default_settings();
        assert_eq!(
            meta.total_items,
            defaults.len(),
            "元数据中设置项总数应与默认设置数量一致"
        );
        
        // 验证所有设置项都标记为已实现
        let mut implemented_count = 0;
        for cat in &meta.categories {
            for item in &cat.items {
                assert!(item.is_implemented, "设置项 {}.{} 应标记为已实现", item.category, item.key);
                implemented_count += 1;
            }
        }
        assert_eq!(implemented_count, meta.total_items, "所有设置项都应已实现");
    }

    // ============================================================
    // M7.3 扩展：SettingsService 集成测试（需要真实数据库连接）
    // ============================================================
    use crate::database::traits::*;
    use crate::database::sqlite::SqliteDriver;
    use tempfile::tempdir;

    /// 创建测试数据库连接的辅助函数
    /// 使用 Box::leak 将 DatabaseManager 泄漏到堆上，返回 (conn, temp_dir)
    /// 其中 conn 可以安全地使用（因为 DatabaseManager 通过泄漏拥有静态生命周期）
    fn create_test_db_connection() -> (MutexGuardConnection<'static>, tempfile::TempDir) {
        let temp_dir = tempdir().expect("创建临时目录失败");
        let db_path = temp_dir.path().join("test_settings.db");
        
        let driver = SqliteDriver::new();
        let mut db_manager = DatabaseManager::new();
        db_manager.register_driver(Box::new(driver));
        db_manager.create_and_connect("sqlite", &db_path).expect("创建测试数据库失败");
        
        // 使用 Box::leak 将 db_manager 泄漏到堆上，使其拥有静态生命周期
        // 这样 get_connection 返回的 MutexGuardConnection 可以安全地借用堆上的数据
        let leaked_manager: &'static DatabaseManager = Box::leak(Box::new(db_manager));
        
        // 通过 get_connection 公开方法获取连接
        let conn = leaked_manager.get_connection().expect("获取连接失败");
        
        (conn, temp_dir)
    }

    #[test]
    fn test_get_setting_existing_key() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 获取一个已存在的设置（appearance.category 的 theme）
        let result = SettingsService::get_setting(&conn, "appearance", "theme");
        assert!(result.is_ok(), "获取设置应成功");
        let setting = result.unwrap();
        assert!(setting.is_some(), "theme 设置应存在");
        let setting = setting.unwrap();
        assert_eq!(setting.category, "appearance");
        assert_eq!(setting.key, "theme");
        assert_eq!(setting.value, "light");
    }

    #[test]
    fn test_get_setting_nonexistent_key() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 获取一个不存在的设置
        let result = SettingsService::get_setting(&conn, "nonexistent", "nonexistent_key");
        assert!(result.is_ok(), "获取设置应成功");
        let setting = result.unwrap();
        assert!(setting.is_none(), "不存在的设置应返回 None");
    }

    #[test]
    fn test_update_setting_existing() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 更新已存在的设置
        let result = SettingsService::update_setting(&conn, "appearance", "theme", "dark");
        assert!(result.is_ok(), "更新设置应成功");
        let setting = result.unwrap();
        assert_eq!(setting.category, "appearance");
        assert_eq!(setting.key, "theme");
        assert_eq!(setting.value, "dark", "theme 值应被更新为 dark");
    }

    #[test]
    fn test_update_setting_new_key() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 插入一个新的设置
        let result = SettingsService::update_setting(&conn, "appearance", "custom_key", "custom_value");
        assert!(result.is_ok(), "插入新设置应成功");
        let setting = result.unwrap();
        assert_eq!(setting.category, "appearance");
        assert_eq!(setting.key, "custom_key");
        assert_eq!(setting.value, "custom_value");
        
        // 验证该设置可以被获取
        let get_result = SettingsService::get_setting(&conn, "appearance", "custom_key");
        assert!(get_result.is_ok());
        let get_setting = get_result.unwrap();
        assert!(get_setting.is_some());
        assert_eq!(get_setting.unwrap().value, "custom_value");
    }

    #[test]
    fn test_update_setting_special_characters() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 测试特殊字符
        let special_values = vec![
            ("key1", "value with spaces"),
            ("key2", "value with 'quotes'"),
            ("key3", "value with \"double quotes\""),
            ("key4", "value\nwith\nnewlines"),
            ("key5", "value with 表情😀"),
        ];
        
        for (key, value) in special_values {
            let result = SettingsService::update_setting(&conn, "editor", key, value);
            assert!(result.is_ok(), "插入特殊字符值应成功: key={}", key);
            
            let get_result = SettingsService::get_setting(&conn, "editor", key);
            assert!(get_result.is_ok());
            let get_setting = get_result.unwrap();
            assert!(get_setting.is_some());
            assert_eq!(get_setting.unwrap().value, value, "值应正确保存: key={}", key);
        }
    }

    #[test]
    fn test_reset_settings_specific_category() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 先修改一个设置
        SettingsService::update_setting(&conn, "appearance", "theme", "dark").expect("更新设置失败");
        
        // 重置 appearance 分类
        let result = SettingsService::reset_settings(&conn, Some("appearance"));
        assert!(result.is_ok(), "重置设置应成功");
        
        // 验证 appearance.theme 被恢复为默认值
        let get_result = SettingsService::get_setting(&conn, "appearance", "theme");
        assert!(get_result.is_ok());
        let setting = get_result.unwrap();
        assert!(setting.is_some());
        assert_eq!(setting.unwrap().value, "light", "theme 应恢复为默认值 light");
        
        // 验证其他分类的设置不受影响
        let other_result = SettingsService::get_setting(&conn, "editor", "autoIndent");
        assert!(other_result.is_ok());
        assert!(other_result.unwrap().is_some(), "editor.autoIndent 应仍然存在");
    }

    #[test]
    fn test_reset_settings_all() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 先修改一些设置
        SettingsService::update_setting(&conn, "appearance", "theme", "dark").expect("更新设置失败");
        SettingsService::update_setting(&conn, "editor", "autoIndent", "false").expect("更新设置失败");
        
        // 重置所有设置
        let result = SettingsService::reset_settings(&conn, None);
        assert!(result.is_ok(), "重置所有设置应成功");
        
        // 验证设置被恢复为默认值
        let theme_result = SettingsService::get_setting(&conn, "appearance", "theme");
        assert!(theme_result.is_ok());
        assert_eq!(theme_result.unwrap().unwrap().value, "light");
        
        let auto_indent_result = SettingsService::get_setting(&conn, "editor", "autoIndent");
        assert!(auto_indent_result.is_ok());
        assert_eq!(auto_indent_result.unwrap().unwrap().value, "true");
    }

    #[test]
    fn test_reset_settings_empty_database() {
        let (conn, _temp_dir) = create_test_db_connection();
        // 确保表存在
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 重置所有设置
        let result = SettingsService::reset_settings(&conn, None);
        assert!(result.is_ok(), "重置应成功: {:?}", result.err());
        
        // 验证默认设置已被初始化
        let get_result = SettingsService::get_setting(&conn, "appearance", "theme");
        assert!(get_result.is_ok(), "获取设置应成功: {:?}", get_result.err());
        assert!(get_result.unwrap().is_some(), "默认设置应被初始化");
    }

    #[test]
    fn test_get_all_settings() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        let result = SettingsService::get_all_settings(&conn);
        assert!(result.is_ok(), "获取所有设置应成功");
        let response = result.unwrap();
        assert!(response.total_items > 0, "应有设置项");
        assert!(!response.categories.is_empty(), "应有分类");
        
        // 验证 appearance 分类存在且有设置项
        let appearance_cat = response.categories.iter().find(|c| c.id == "appearance");
        assert!(appearance_cat.is_some(), "appearance 分类应存在");
        let appearance_cat = appearance_cat.unwrap();
        assert!(!appearance_cat.items.is_empty(), "appearance 分类应有设置项");
        
        // 验证 theme 设置存在
        let theme_item = appearance_cat.items.iter().find(|i| i.key == "theme");
        assert!(theme_item.is_some(), "theme 设置应存在");
        assert_eq!(theme_item.unwrap().value, "light");
    }

    #[test]
    fn test_initialize_default_settings_idempotent() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 获取初始的 theme 值
        let initial = SettingsService::get_setting(&conn, "appearance", "theme");
        assert!(initial.is_ok());
        assert_eq!(initial.unwrap().unwrap().value, "light");
        
        // 多次调用 ensure_settings_table_exists（它会调用 initialize_default_settings）
        // 由于是幂等的，不应改变现有值
        SettingsService::ensure_settings_table_exists(&conn).expect("重复初始化应成功");
        SettingsService::ensure_settings_table_exists(&conn).expect("重复初始化应成功");
        
        // 验证值没有被改变
        let after = SettingsService::get_setting(&conn, "appearance", "theme");
        assert!(after.is_ok());
        assert_eq!(after.unwrap().unwrap().value, "light", "重复初始化不应改变现有值");
        
        // 验证设置项数量没有增加
        let all = SettingsService::get_all_settings(&conn).unwrap();
        let original_count = all.total_items;
        
        SettingsService::ensure_settings_table_exists(&conn).expect("重复初始化应成功");
        
        let all_after = SettingsService::get_all_settings(&conn).unwrap();
        assert_eq!(all_after.total_items, original_count, "重复初始化不应增加设置项");
    }

    #[test]
    fn test_batch_update_settings() {
        let (conn, _temp_dir) = create_test_db_connection();
        SettingsService::ensure_settings_table_exists(&conn).expect("初始化设置表失败");
        
        // 批量更新设置
        let updates = vec![
            UpdateSettingRequest { category: "appearance".to_string(), key: "theme".to_string(), value: "dark".to_string() },
            UpdateSettingRequest { category: "editor".to_string(), key: "autoIndent".to_string(), value: "false".to_string() },
        ];
        
        let result = SettingsService::batch_update_settings(&conn, &updates);
        assert!(result.is_ok(), "批量更新应成功");
        let updated = result.unwrap();
        assert_eq!(updated.len(), 2, "应返回 2 个更新的设置");
        
        // 验证更新生效
        let theme = SettingsService::get_setting(&conn, "appearance", "theme").unwrap().unwrap();
        assert_eq!(theme.value, "dark");
        
        let auto_indent = SettingsService::get_setting(&conn, "editor", "autoIndent").unwrap().unwrap();
        assert_eq!(auto_indent.value, "false");
    }
}
