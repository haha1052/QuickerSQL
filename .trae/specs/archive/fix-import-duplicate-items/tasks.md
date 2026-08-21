# 数据导入重复项问题修复 — The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修复 StrictMode 下异步事件监听器重复注册问题
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 修改 `src/components/import/DataImport.tsx` 中的拖拽事件监听器注册逻辑
  - 使用 `cancelled` 标志跟踪 effect 是否已清理
  - 如果 Promise 在 effect 清理后才 resolve，立即调用取消函数，避免监听器泄漏
  - 核心改动：在 useEffect 中增加 cancelled 标志，在 .then() 中检查该标志
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `human-judgement` TR-1.1: 开发模式下拖拽单个文件，导入队列中只出现一个导入项
  - `human-judgement` TR-1.2: 组件卸载后，拖拽文件不再触发导入（监听器已清理）
  - `programmatic` TR-1.3: `npx tsc --noEmit --pretty` 无类型错误 ✅
- **Notes**: 改动需最小化，仅修复监听器清理逻辑

## [x] Task 2: 在 importStore.addImportItems 中增加去重逻辑
- **Priority**: medium
- **Depends On**: None
- **Description**: 
  - 修改 `src/store/importStore.ts` 中的 `addImportItems` 方法
  - 基于 `filePath + sheetName` 组合进行去重（Excel 多 sheet 场景下各 sheet 独立）
  - 新 items 中已存在于队列中的会被过滤掉
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-2.1: `npx tsc --noEmit --pretty` 无类型错误 ✅
  - `human-judgement` TR-2.2: 手动验证重复添加相同路径的文件不会出现重复项
- **Notes**: 作为防御性措施，即使前端重复调用也不会出现重复项

## [/] Task 3: 验证各文件格式导入功能正常
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 验证 CSV、Excel、JSON、Parquet、TXT 五种格式的导入功能均正常
  - 确认修复后没有引入新的问题
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `human-judgement` TR-3.1: CSV 文件导入正常
  - `human-judgement` TR-3.2: Excel 文件导入正常（多 sheet 也正常）
  - `human-judgement` TR-3.3: JSON 文件导入正常
  - `human-judgement` TR-3.4: Parquet 文件导入正常
  - `human-judgement` TR-3.5: TXT 文件导入正常
  - `programmatic` TR-3.6: `npx tsc --noEmit --pretty` 通过 ✅
  - `programmatic` TR-3.7: `cd src-tauri; cargo check --quiet` 通过 ✅
- **Notes**: 后端代码未修改，主要验证前端功能完整性
