# Checklist

- [x] Checkpoint 1: 拖放单个文件到导入区域只产生一个导入项
- [x] Checkpoint 2: 连续快速拖放同一个文件不会重复添加
- [x] Checkpoint 3: 设置系统的"数据导入"分类中出现"导入超时时间（秒）"
- [x] Checkpoint 4: 修改导入超时设置后，后端日志显示使用新的超时时间
- [x] Checkpoint 5: 大文件导入不再因默认 10 秒超时而失败
- [x] Checkpoint 6: 逗号分隔 TXT 文件导入成功
- [x] Checkpoint 7: TXT 文件导入时字段数与数据列数匹配
- [x] Checkpoint 8: 中英文设置面板正确显示导入超时标签
- [x] Checkpoint 9: `cargo check --quiet` 通过
- [x] Checkpoint 10: `cargo test --lib` 全部通过
- [x] Checkpoint 11: `npx tsc --noEmit --pretty` 通过
- [x] Checkpoint 12: 应用启动后验证拖放去重、超时设置、TXT 导入
