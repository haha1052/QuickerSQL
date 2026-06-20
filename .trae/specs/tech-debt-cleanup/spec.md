# 技术债清理实施 Spec

## Why

当前项目存在以下影响用户体验和开发效率的问题：
1. 语言切换后界面文本不更新
2. Header 组件违反架构规范直接调用 Tauri API
3. 代码中存在调试代码残留
4. 备份文件干扰目录整洁

## What Changes

### 1. 国际化系统完善
- 完成剩余组件的 `t()` 翻译迁移
- 验证所有 ag-grid 组件添加 `key={locale}` 强制重新挂载
- 设置分类名称使用前端映射表国际化

### 2. 窗口控制服务封装
- 在 `services/tauri.ts` 添加窗口控制封装
- Header 组件通过服务调用窗口操作

### 3. 代码清理
- 移除所有 `console.log` 调试代码
- 清理备份文件残留

## Impact

- Affected specs: 国际化系统、架构规范
- Affected code: 
  - `src/context/LocaleContext.tsx`
  - `src/components/common/Header.tsx`
  - `src/services/tauri.ts`
  - 所有使用 ag-grid 的组件

## ADDED Requirements

### Requirement: 语言切换即时生效
系统 SHALL 在用户修改语言设置后，立即更新所有界面文本，包括：
- Header 导航栏
- Toolbar 工具栏
- Settings 设置页面
- SQL 查询结果表格
- 数据导入预览

#### Scenario: 用户切换语言
- **WHEN** 用户在设置中将语言从中文改为英文
- **THEN** 整个应用的界面文本立即变为英文，无须刷新页面

### Requirement: 窗口操作通过服务层
Header 组件 SHALL 通过 services 层调用窗口操作，禁止直接调用 Tauri API。

#### Scenario: 窗口最小化
- **WHEN** 用户点击最小化按钮
- **THEN** 通过 windowService.minimize() 调用，最终执行窗口最小化

## MODIFIED Requirements

### Requirement: 所有 UI 文本使用翻译函数
所有硬编码的中文文本 SHALL 替换为 `t('key')` 函数调用。

## REMOVED Requirements

### Requirement: console.log 调试代码
项目中 SHALL 不存在任何调试用的 `console.log` 语句。

### Requirement: 备份文件残留
项目目录 SHALL 不存在 `*.backup`、`*.bak`、`*_phase*.bak` 文件。
