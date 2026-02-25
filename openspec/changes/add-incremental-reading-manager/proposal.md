# Change: add-incremental-reading-manager（渐进阅读管理面板）

## Why（为什么要做）

当前用户可以通过渐进阅读会话界面进行刷卡（`IncrementalReadingSessionDemo`），但缺少全局管理视图，导致：

1. **无法掌握整体进度**：不知道总共有多少卡片、多少新卡、多少到期卡
2. **无法规划学习节奏**：不知道未来几天的排期分布
3. **批量操作困难**：无法批量调整优先级，只能在会话中逐个操作
4. **缺少管理入口**：只有"开始阅读"入口，没有"管理卡片"入口

这使得渐进阅读功能难以用于大规模的知识管理场景。

## What Changes（要改什么）

新增一个独立的**渐进阅读管理面板**，提供：

### 数据层扩展
- 新增 `collectAllIRCards()` 函数：收集所有渐进阅读卡片（不限到期状态）
- 新增 `bulkUpdatePriority(blockIds[], newPriority)` 函数：批量更新优先级

### UI 组件
- `IncrementalReadingManagerPanel.tsx`：主面板容器
- `IRStatistics.tsx`：统计面板（总数/新卡数/到期卡数/未来7天到期数）
- `IRCardList.tsx`：卡片列表（支持多选、按日期分组）
- `IRBulkActionBar.tsx`：批量操作栏（批量调整优先级）

### 系统集成
- 注册渲染器：`srs.ir-manager`
- 注册命令：`orca-srs.openIRManager`
- 新增管理面板管理器（类似 `flashcardHomeManager.ts`）

### 文档更新
- `模块文档/渐进阅读.md`：新增"管理面板"章节
- `CHANGELOG.md`：记录新功能

## Non-Goals（不做什么）

- **不实现批量删除**：P2 功能，暂不实现
- **不实现批量标记已读**：P2 功能，暂不实现
- **不修改现有阅读会话界面**：保持 `IncrementalReadingSessionDemo` 不变
- **不改变数据模型**：复用现有 `IRState` 和存储层
- **不实现可视化图表**：统计仅显示数字，不做复杂可视化

## Assumptions（关键假设）

- 主面板定义：使用命令触发时的当前面板 ID（从 editor 上下文获取）
- 日期分组边界：使用自然日 00:00 作为边界（不是 24 小时滚动窗口）
- 新卡定义：`lastRead === null` 的卡片
- 新卡分组：新卡单独一组，显示在最前面
- 批量操作事务性：使用 `Promise.allSettled`，部分失败时显示详细错误

## Impact（影响范围）

### 新增文件
- `src/srs/incrementalReadingManagerUtils.ts`：管理面板工具函数
- `src/components/IncrementalReadingManagerPanel.tsx`：主面板
- `src/components/IRStatistics.tsx`：统计组件
- `src/components/IRCardList.tsx`：卡片列表组件
- `src/components/IRBulkActionBar.tsx`：批量操作栏

### 修改文件
- `src/srs/incrementalReadingCollector.ts`：新增 `collectAllIRCards()`
- `src/srs/incrementalReadingStorage.ts`：新增 `bulkUpdatePriority()`
- `src/srs/registry/commands.ts`：注册 `openIRManager` 命令
- `src/srs/registry/renderers.ts`：注册 `srs.ir-manager` 渲染器
- `src/main.ts`：新增管理面板管理器
- `模块文档/渐进阅读.md`：新增管理面板章节
- `CHANGELOG.md`：记录变更

## Risks（风险）

### 性能风险
- **问题**：大量卡片（1000+）时列表渲染可能卡顿
- **缓解**：初版不做虚拟滚动，提示用户通过筛选/分组减少显示量；后续可优化

### 数据一致性风险
- **问题**：批量操作部分失败时，可能出现部分卡片状态不一致
- **缓解**：使用 `Promise.allSettled` 返回详细的成功/失败列表，UI 显示失败原因并支持重试

### 用户体验风险
- **问题**：管理面板和阅读会话界面切换可能造成困惑
- **缓解**：在管理面板提供"开始阅读"快捷入口；在阅读会话界面提供"返回管理"入口

## Dependencies（依赖关系）

- **前置依赖**：`add-incremental-reading` 变更必须完成（已有 0/13 tasks）
- **并行依赖**：无
- **后续依赖**：无

## Success Metrics（成功指标）

- 所有验收标准通过
- 测试覆盖率 ≥ 90%
- 100 张卡片时列表渲染流畅（主观评估）
- 批量操作成功率 = 100%（无失败）或显示清晰的失败原因

---

**状态**：待审批
**创建时间**：2026-01-19
**预计工作量**：2-3 天
