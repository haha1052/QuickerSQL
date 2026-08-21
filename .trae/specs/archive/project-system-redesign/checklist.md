# 项目系统重构 — Verification Checklist

- [x] Checkpoint 1: 后端 ProjectInfo 数据模型与注册表表结构定义完成（无 is_deleted / is_favorite）
- [x] Checkpoint 2: 项目 CRUD 服务层实现完整（创建/重命名/复制/删除/列表/切换/导入/导出）
- [x] Checkpoint 3: 命令层适配完成，所有命令在 lib.rs 注册（含 import_project / export_project）
- [x] Checkpoint 4: 旧项目数据迁移逻辑实现，迁移后数据完整
- [x] Checkpoint 5: 前端 tauriService API 与类型定义更新完成（含 importProject / exportProject）
- [x] Checkpoint 6: 项目管理窗口 UI 重构，功能完整（创建/重命名/复制/删除/切换/导入/导出）
- [x] Checkpoint 7: 项目管理弹窗尺寸加大（宽 ≥720px，高 ≥560px）
- [x] Checkpoint 8: 切换项目时所有状态正确刷新（SQL编辑器/表列表/查询历史/仪表盘/任务）
- [x] Checkpoint 9: `cargo check --quiet` 0 errors
- [x] Checkpoint 10: `npx tsc --noEmit` 0 errors
- [x] Checkpoint 11: `cargo test` 全部通过（275 passed）
- [x] Checkpoint 12: 项目重命名 < 500ms，不需要重启应用（新实现只改 SQL，不动文件）
- [x] Checkpoint 13: 项目切换 < 200ms（不含大表行数统计，并行刷新 5 个 Store）
- [x] Checkpoint 14: 复制项目数据完整，两个项目相互独立（文件级复制 + 新 ID）
- [x] Checkpoint 15: 导入项目功能正常，导入后自动切换（可选 confirm 对话框）
- [x] Checkpoint 16: 旧版本项目自动迁移成功（启动时 migrate_legacy_projects 幂等执行）
