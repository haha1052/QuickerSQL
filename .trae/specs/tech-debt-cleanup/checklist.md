# 技术债清理验收清单

## 国际化系统

- [x] QueryResultItem.tsx 的 AgGridReact 组件添加了 key={locale}
- [x] DataPreview.tsx 的 AgGridReact 组件添加了 key={locale}
- [x] SqlQueryPage.tsx 的 AgGridReact 组件添加了 key={locale}
- [x] DatabaseExplorer 组件所有硬编码文本使用 t() 函数
- [x] ProjectManager 组件所有硬编码文本使用 t() 函数
- [x] QueryHistory 组件所有硬编码文本使用 t() 函数
- [x] 设置分类名称通过前端映射表实现国际化
- [x] 语言切换后 Header 文本立即更新
- [x] 语言切换后 Toolbar 文本立即更新
- [x] 语言切换后 Settings 文本立即更新
- [x] 语言切换后 ag-grid 表格语言同步更新

## 架构合规

- [x] services/tauri.ts 包含 windowService 对象
- [x] windowService.minimize() 方法可用
- [x] windowService.toggleMaximize() 方法可用
- [x] windowService.close() 方法可用
- [x] Header.tsx 不再直接调用 getCurrentWindow()
- [x] Header.tsx 通过 windowService 调用窗口操作

## 代码质量

- [x] 项目中不存在 console.log 调试代码（除必要的错误日志外）
- [x] 项目中不存在 *.backup 文件
- [x] 项目中不存在 *.bak 文件
- [x] 项目中不存在 *_phase*.bak 文件

## TypeScript 编译

- [x] src/context/LocaleContext.tsx 编译通过
- [x] src/components/common/Header.tsx 编译通过
- [x] src/components/common/Toolbar.tsx 编译通过
- [x] src/pages/Settings.tsx 编译通过
- [x] src/components/sql/QueryResultItem.tsx 编译通过
- [x] src/components/sql/SqlQueryPage.tsx 编译通过
- [x] src/components/import/DataPreview.tsx 编译通过
- [x] src/services/tauri.ts 编译通过

## 完成时间

- 完成日期：2026-06-10
- TypeScript 编译：✅ 通过
