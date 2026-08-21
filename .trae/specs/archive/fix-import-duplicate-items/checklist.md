# 数据导入重复项问题修复 — Verification Checklist

## 功能验证
- [ ] 开发模式下拖拽单个 CSV 文件，导入队列中只出现一个导入项
- [ ] 开发模式下拖拽单个 Excel 文件，导入队列中每个 sheet 只出现一个导入项
- [ ] 开发模式下拖拽单个 JSON 文件，导入队列中只出现一个导入项
- [ ] 开发模式下拖拽单个 Parquet 文件，导入队列中只出现一个导入项
- [ ] 开发模式下拖拽单个 TXT 文件，导入队列中只出现一个导入项
- [ ] 组件卸载后，拖拽文件不再触发导入（监听器已正确清理）

## 代码质量
- [x] `npx tsc --noEmit --pretty` 无类型错误
- [x] `cd src-tauri; cargo check --quiet` 无编译错误
- [x] 新增代码符合项目代码风格（命名、注释、错误处理）
- [x] 没有引入新的架构违规（组件层不直接 invoke，通过 tauriService）

## 防御性措施
- [x] `importStore.addImportItems` 中已增加基于 filePath+sheetName 的去重逻辑
- [x] 去重逻辑不会误删不同文件的合法导入项（仅过滤相同 filePath+sheetName 的重复项）
- [x] Excel 多 sheet 的场景下，同一文件的不同 sheet 不会被去重（因为它们是不同的导入项）

## 安全检查
- [x] 前端无 SQL 拼接
- [x] 无敏感字符串硬编码
- [x] 无 `any` 类型
