# 技术债清理任务清单

## Phase 1: 国际化系统完善 ✅

- [x] Task 1: 验证 ag-grid 组件 key={locale}
  - [x] SubTask 1.1: 检查 QueryResultItem.tsx 的 AgGridReact 添加 key={locale}
  - [x] SubTask 1.2: 检查 DataPreview.tsx 的 AgGridReact 添加 key={locale}
  - [x] SubTask 1.3: 检查 SqlQueryPage.tsx 的 AgGridReact 添加 key={locale}
  - [x] SubTask 1.4: 检查其他使用 ag-grid 的组件

- [x] Task 2: 完成剩余组件 t() 迁移
  - [x] SubTask 2.1: DatabaseExplorer 组件翻译迁移
  - [x] SubTask 2.2: ProjectManager 组件翻译迁移
  - [x] SubTask 2.3: QueryHistory 组件翻译迁移
  - [x] SubTask 2.4: 设置分类名称映射表实现

- [x] Task 3: 验证语言切换完整流程
  - [x] SubTask 3.1: 测试 Header 文本切换
  - [x] SubTask 3.2: 测试 Toolbar 文本切换
  - [x] SubTask 3.3: 测试 Settings 文本切换
  - [x] SubTask 3.4: 测试 ag-grid 表格语言切换

## Phase 2: 窗口控制服务封装 ✅

- [x] Task 4: 窗口控制服务封装
  - [x] SubTask 4.1: 在 services/tauri.ts 添加 windowService 对象
  - [x] SubTask 4.2: 实现 minimize/toggleMaximize/close 方法
  - [x] SubTask 4.3: 更新 Header.tsx 使用 windowService
  - [x] SubTask 4.4: 移除 Header 中的直接 Tauri API 调用

## Phase 3: 代码清理 ✅

- [x] Task 5: 清理 console.log 调试代码
  - [x] SubTask 5.1: 搜索项目中所有 console.log
  - [x] SubTask 5.2: 移除非必要的调试日志
  - [x] SubTask 5.3: 保留有意义的错误日志

- [x] Task 6: 清理备份文件
  - [x] SubTask 6.1: 查找所有 *.backup, *.bak, *_phase*.bak 文件
  - [x] SubTask 6.2: 确认后删除备份文件

## 验证方式

每个 Task 完成后已验证：
1. ✅ TypeScript 编译无错误
2. ✅ 功能测试通过
3. ✅ 符合架构规范

## 完成时间

- 完成日期：2026-06-10
