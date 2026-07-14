# 数据导入重复项问题修复 — Product Requirement Document

## Overview
- **Summary**：修复拖拽文件导入时出现两个重复导入项的问题。根因是 React StrictMode 下异步注册的 Tauri 原生拖拽事件监听器在 effect 清理时未能正确取消，导致同一事件触发两次回调。
- **Purpose**：确保一个文件拖拽后只产生一个导入任务，提升用户体验，避免重复导入造成的混淆和性能浪费。
- **Target Users**：所有使用数据导入功能的用户

## Goals
- G1：拖拽单个文件导入时，导入队列中只出现一个导入项
- G2：开发环境（StrictMode）和生产环境行为一致
- G3：修复后不影响现有的导入功能（各文件格式均能正常导入）

## Non-Goals (Out of Scope)
- ❌ 不修改后端导入逻辑（后端本身无重复数据问题）
- ❌ 不重构整个导入流程
- ❌ 不添加新的导入功能
- ❌ 不移除 React StrictMode（开发工具）

## Background & Context
- 项目启用了 React StrictMode（`src/main.tsx`），开发模式下 useEffect 会执行两次以发现副作用问题
- `DataImport.tsx` 中使用 `tauriService.onDragDropEvent()` 注册原生拖拽事件监听器，该函数返回 `Promise<() => void>`（异步返回取消函数）
- 由于异步特性，StrictMode 第一次 effect 清理时，取消函数尚未赋值，导致第一个监听器泄漏
- 第二次 effect 挂载时又注册了一个新的监听器，最终有两个监听器同时响应拖拽事件
- `importStore.addImportItems` 缺乏去重机制，使得重复调用直接反映为 UI 重复项

## Functional Requirements
- **FR-1**：修复异步事件监听器的重复注册问题，确保 StrictMode 下也只注册一个监听器
- **FR-2**：在 `importStore.addImportItems` 中增加基于 `filePath` 的去重逻辑，作为防御性措施
- **FR-3**：保持现有导入功能的完整性（CSV/Excel/JSON/Parquet/TXT 均正常工作）

## Non-Functional Requirements
- **NFR-1**：修复后不引入新的内存泄漏
- **NFR-2**：不影响导入性能
- **NFR-3**：代码改动最小化，聚焦问题根因

## Constraints
- **Technical**：React 18 + Tauri v2 + Zustand
- **Business**：不改变用户操作习惯，不修改导入流程
- **Dependencies**：依赖现有 `tauriService.onDragDropEvent` API

## Assumptions
- 生产环境下 React StrictMode 不生效，因此生产环境可能无此问题
- 重复导入仅出现在开发环境（StrictMode 双重 effect）
- 后端 `import_data_v2` 本身无重复数据问题（先 DROP 再 CREATE）

## Acceptance Criteria

### AC-1: 拖拽单个文件只产生一个导入项
- **Given**：用户打开数据导入页面
- **When**：用户拖拽单个支持的文件（CSV/Excel/JSON/Parquet/TXT）到导入区域
- **Then**：导入队列中只出现一个对应的导入项
- **Verification**: `human-judgment`
- **Notes**：需在开发模式下验证（StrictMode 生效时）

### AC-2: 异步事件监听器正确清理
- **Given**：DataImport 组件挂载和卸载
- **When**：组件因 StrictMode 双重执行 effect 或正常卸载
- **Then**：所有已注册的拖拽事件监听器都被正确取消，无泄漏
- **Verification**: `human-judgment`
- **Notes**：可通过在回调中添加 console.log 验证调用次数

### AC-3: addImportItems 去重生效
- **Given**：importStore 中已有某个 filePath 的导入项
- **When**：再次调用 addImportItems 添加相同 filePath 的导入项
- **Then**：新的导入项被过滤掉，队列中不出现重复项
- **Verification**: `programmatic`
- **Notes**：基于 filePath 去重

### AC-4: 各文件格式导入功能正常
- **Given**：数据导入页面
- **When**：用户分别导入 CSV、Excel、JSON、Parquet、TXT 格式的文件
- **Then**：各格式均能正常预览和导入，数据正确
- **Verification**: `human-judgment`

### AC-5: 编译通过
- **Given**：修复代码后
- **When**：执行 TypeScript 类型检查
- **Then**：无类型错误
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要同时修复其他组件中类似的异步事件监听器注册模式？（本次仅修复 DataImport）
- [ ] 是否需要在其他 store 的添加方法中也增加去重逻辑？（本次仅修复 importStore）
