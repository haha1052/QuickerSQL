# 设置系统完整文档

## 概述

本设置系统实现了完整的前后端联动、即时保存、实时生效的功能。所有设置修改后都会即时应用到应用中，无需重启。

---

## 设置分类

### 1. 外观设置 (appearance)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| theme | select | light | 界面主题（light/dark/system） | ✅ |
| fontSize | number | 14 | 编辑器字体大小（px） | ✅ |
| fontFamily | select | Consolas | 编辑器字体 | ✅ |
| lineHeight | number | 1.6 | 行高 | ✅ |
| tabSize | number | 2 | Tab宽度 | ✅ |
| wordWrap | boolean | true | 自动换行 | ✅ |
| minimap | boolean | true | 显示代码小地图 | ❌ |
| smoothScrolling | boolean | true | 平滑滚动 | ❌ |

**应用位置：**
- SQL编辑器 ([SQLEditor.tsx](../src/components/sql/SQLEditor.tsx))
- 查询结果表格 ([QueryResultItem.tsx](../src/components/sql/QueryResultItem.tsx))
- 设置预览面板 ([SettingsDemo.tsx](../src/components/SettingsDemo.tsx))

---

### 2. 编辑器设置 (editor)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| autoIndent | boolean | true | 自动缩进 | ✅ |
| highlightLine | boolean | true | 高亮当前行 | ❌ |
| bracketMatching | boolean | true | 括号匹配 | ❌ |
| autoSave | boolean | true | 自动保存 | ✅ |
| saveInterval | number | 30 | 自动保存间隔（秒） | ✅ |

**应用位置：**
- SQL编辑器 ([SQLEditor.tsx](../src/components/sql/SQLEditor.tsx))

---

### 3. SQL查询设置 (sql)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| autoComplete | boolean | true | SQL自动完成 | ❌ |
| formatOnSave | boolean | true | 保存时自动格式化 | ❌ |
| resultLimit | number | 1000 | 查询结果限制行数 | ❌ |
| showExecutionTime | boolean | true | 显示执行时间 | ❌ |

**应用位置：**
- 待实现

---

### 4. 数据导入设置 (import)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| autoDetectEncoding | boolean | true | 自动检测编码 | ✅ |
| defaultEncoding | select | UTF-8 | 默认编码（UTF-8/GBK/GB2312/UTF-16） | ✅ |
| skipEmptyRows | boolean | true | 跳过空行 | ✅ |
| firstRowAsHeader | boolean | true | 首行作为表头 | ✅ |

**应用位置：**
- 数据导入组件 ([DataImport.tsx](../src/components/import/DataImport.tsx))

---

### 5. 可视化设置 (visualization)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| defaultChartType | select | bar | 默认图表类型（bar/line/pie/scatter/area） | ✅ |
| showGrid | boolean | true | 显示网格线 | ✅ |
| showLegend | boolean | true | 显示图例 | ✅ |
| defaultColorScheme | select | default | 默认配色方案（default/dark/light/colorful） | ✅ |

**应用位置：**
- 图表面板 ([ChartPanel.tsx](../src/components/chart/ChartPanel.tsx))

---

### 6. 回收站设置 (trash)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| autoCleanup | boolean | false | 自动清理回收站 | ❌ |
| cleanupDays | number | 30 | 清理天数（超过此天数自动删除） | ❌ |
| maxTrashSize | number | 1024 | 回收站最大占用（MB） | ❌ |
| confirmBeforeDelete | boolean | true | 删除前确认 | ❌ |

**应用位置：**
- 待实现

---

### 7. 数据库设置 (database)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| autoConnect | boolean | true | 启动时自动连接最近使用的数据库 | ❌ |
| connectionTimeout | number | 30 | 连接超时时间（秒） | ❌ |
| showSystemTables | boolean | false | 显示系统表 | ❌ |

**应用位置：**
- 待实现

---

### 8. 缓存设置 (cache)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| enableCache | boolean | true | 启用查询缓存 | ❌ |
| cacheSize | number | 100 | 缓存大小（MB） | ❌ |
| cacheExpiry | number | 30 | 缓存过期时间（分钟） | ❌ |

**应用位置：**
- 待实现

---

### 9. 安全设置 (security)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| enablePasswordProtect | boolean | false | 启用密码保护 | ❌ |
| autoLock | boolean | false | 空闲时自动锁定 | ❌ |
| lockTimeout | number | 5 | 自动锁定时间（分钟） | ❌ |

**应用位置：**
- 待实现

---

### 10. 高级设置 (advanced)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| developerMode | boolean | false | 开发者模式 | ❌ |
| showDebugInfo | boolean | false | 显示调试信息 | ❌ |
| logLevel | select | info | 日志级别（debug/info/warn/error） | ❌ |

**应用位置：**
- 待实现

---

### 11. 语言与区域设置 (locale)

| 设置项 | 类型 | 默认值 | 说明 | 即时生效 |
|--------|------|--------|------|----------|
| language | select | zh-CN | 界面语言（zh-CN/en-US） | ❌ |
| dateFormat | select | YYYY-MM-DD | 日期格式 | ❌ |
| timeFormat | select | 24h | 时间格式（12h/24h） | ❌ |

**应用位置：**
- 待实现

---

## 架构说明

### 1. 数据模型 ([settings.rs](../src-tauri/src/models/settings.rs))

```rust
pub struct SettingItem {
    pub id: String,
    pub category: String,
    pub key: String,
    pub value: String,
    pub value_type: SettingValueType,
    pub description: Option<String>,
    pub options: Option<String>,
    pub is_visible: bool,
    pub is_system: bool,
    pub updated_at: DateTime<Utc>,
}

pub enum SettingValueType {
    String,
    Number,
    Boolean,
    Select,
    MultiSelect,
}
```

### 2. 后端服务 ([settings_service.rs](../src-tauri/src/services/settings_service.rs))

- `ensure_settings_table_exists()` - 确保设置表存在并初始化默认值
- `get_all_settings()` - 获取所有设置（按分类分组）
- `update_setting()` - 更新单个设置
- `reset_settings()` - 重置设置

### 3. Tauri命令 ([settings.rs](../src-tauri/src/commands/settings.rs))

- `get_all_settings_cmd()`
- `update_setting_cmd()`
- `reset_settings_cmd()`
- `export_settings_cmd()`
- `import_settings_cmd()`

### 4. 前端状态管理 ([settingsStore.ts](../src/store/settingsStore.ts))

- 使用Zustand管理设置状态
- 提供`loadSettings()`, `updateSetting()`, `resetSettings()`等方法

### 5. 设置上下文 ([SettingsContext.tsx](../src/context/SettingsContext.tsx))

```tsx
const useSetting = (category: string, key: string): [string | undefined, boolean]
```

提供`useSetting` Hook，让任意组件可以获取设置并在设置变更时自动重新渲染。

---

## 即时生效机制

### 工作流程

```
用户修改设置 
  → SettingsStore.updateSetting() 
  → 调用Tauri命令保存到数据库 
  → SettingsStore状态更新 
  → SettingsContext重新渲染 
  → 使用useSetting的组件自动更新
```

### 关键代码

在`SettingsContext.tsx`中：

```tsx
const [settings, setSettings] = useState<Map<string, SettingItem>>(new Map());

useEffect(() => {
    const settingsMap = new Map<string, SettingItem>();
    categories.forEach(category => {
        category.items.forEach(item => {
            settingsMap.set(`${item.category}-${item.key}`, item);
        });
    });
    setSettings(settingsMap);
}, [categories]); // 当store中的categories变化时更新
```

---

## 如何添加新设置

1. 在`settings_service.rs`的`default_settings()`函数中添加默认值
2. 在前端需要使用该设置的组件中：
   ```tsx
   const [mySetting] = useSetting('category', 'key');
   // 直接使用即可，修改会自动响应
   ```

---

## 数据库表结构

```sql
CREATE TABLE __settings (
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
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON __settings(category);
```

---

## 文件说明

| 文件 | 说明 |
|------|------|
| [settings.rs](../src-tauri/src/models/settings.rs) | 数据模型定义 |
| [settings_service.rs](../src-tauri/src/services/settings_service.rs) | 后端服务实现 |
| [settings.rs](../src-tauri/src/commands/settings.rs) | Tauri命令定义 |
| [settingsStore.ts](../src/store/settingsStore.ts) | 前端状态管理 |
| [SettingsContext.tsx](../src/context/SettingsContext.tsx) | 设置上下文和Hook |
| [Settings.tsx](../src/pages/Settings.tsx) | 设置页面UI |
| [Settings.css](../src/pages/Settings.css) | 设置页面样式 |

---

## 注意事项

1. **即时生效**：所有设置修改后都会即时保存并应用，无需点击确认按钮
2. **关闭预览**：设置预览面板可点击右上角×号关闭
3. **重置设置**：可通过"重置此类"或"重置所有设置"恢复默认值
4. **系统表**：设置存储在`__settings`表中，不要手动修改该表
