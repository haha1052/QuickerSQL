# 仪表盘布局架构重构验证清单

## 验证清单

### 布局验证

- [x] DashboardItem.item 不再有 `height: '100%'`
- [x] DashboardItem.itemContainer 不再有 `height: '100%'`
- [x] DashboardItem.item 有 `alignSelf: 'stretch'`
- [x] DashboardCanvas.canvas 有 `alignItems: 'stretch'`
- [x] gridStyle 只设置网格位置，不设置固定高度

### 功能验证

- [ ] 图表正确填充容器（需要测试数据验证）
- [ ] 调整窗口大小时图表自动 resize
- [ ] 编辑模式下拖拽移动图表正常
- [ ] 编辑模式下拖拽缩放图表正常
- [ ] 切换编辑/查看模式图表尺寸一致

### 编译验证

- [x] TypeScript 编译通过
- [x] Rust 编译通过
- [x] 应用正常启动

### 视觉验证

- [ ] 图表文字和图形不重叠
- [ ] 图表标题正确显示
- [ ] 深色/浅色主题下显示正常
