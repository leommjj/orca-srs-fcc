# Tasks: add-incremental-reading-manager

## Phase 1: 数据层扩展

- [ ] 在 `src/srs/incrementalReadingCollector.ts` 新增 `collectAllIRCards()` 函数
  - 收集所有渐进阅读卡片（不限到期状态）
  - 复用 `collectTaggedBlocks`，但移除到期过滤
  - 调用 `ensureIRState` 确保状态初始化
  - 返回 `IRCard[]`，包含所有状态字段

- [ ] 在 `src/srs/incrementalReadingStorage.ts` 新增 `bulkUpdatePriority()` 函数
  - 接受参数：`blockIds: DbId[]`, `newPriority: number`
  - 使用 `Promise.allSettled` 批量更新
  - 返回结果：`{ success: DbId[], failed: Array<{ id: DbId, error: string }> }`
  - 每个失败项包含详细错误信息

- [ ] 新增单元测试
  - `collectAllIRCards.test.ts`：测试全量收集逻辑
  - `incrementalReadingStorage.test.ts`：扩展测试批量操作

## Phase 2: UI 组件开发

- [ ] 创建 `src/components/IRStatistics.tsx`
  - Props: `cards: IRCard[]`
  - 计算并显示：总数、新卡数、到期卡数、未来7天到期数
  - 使用简单的卡片布局，参考 `FlashcardDashboard` 风格

- [ ] 创建 `src/components/IRCardList.tsx`
  - Props: `cards: IRCard[]`, `selectedIds: Set<DbId>`, `onSelectionChange`, `onCardClick`, `panelId`
  - 按日期分组：新卡/今天/明天/未来7天/7天后
  - 每组可展开/折叠
  - 单个卡片项显示：标题（前50字）、类型、优先级、到期日期、阅读次数
  - 支持 checkbox 多选
  - 点击卡片标题跳转到对应块

- [ ] 创建 `src/components/IRBulkActionBar.tsx`
  - Props: `selectedIds: Set<DbId>`, `onPriorityChange`, `onClearSelection`
  - 显示选中数量
  - 提供优先级滑块（1-10）
  - 提供"应用"和"清除选择"按钮
  - 未选中卡片时禁用操作按钮

- [ ] 创建 `src/components/IncrementalReadingManagerPanel.tsx`
  - 主容器，组合以上三个子组件
  - 管理状态：`allCards`, `selectedIds`, `expandedGroups`
  - 实现数据加载与刷新逻辑
  - 处理批量操作回调
  - 显示加载/错误状态

## Phase 3: 系统集成

- [ ] 创建 `src/srs/incrementalReadingManagerUtils.ts`
  - 实现管理面板块管理器（类似 `flashcardHomeManager.ts`）
  - 实现 `openIRManager()` 函数
  - 实现 `getIRManagerPanelId()` 函数

- [ ] 在 `src/srs/registry/renderers.ts` 注册渲染器
  - 注册 `srs.ir-manager` 渲染器
  - 渲染器组件指向 `IncrementalReadingManagerPanel`

- [ ] 在 `src/srs/registry/commands.ts` 注册命令
  - 注册 `orca-srs.openIRManager` 命令
  - 命令标签：`"SRS: 渐进阅读管理面板"`
  - 调用 `openIRManager()` 打开面板

- [ ] 在 `src/main.ts` 集成管理器
  - 导入管理器相关函数
  - 在 `unload()` 时清理管理器状态

## Phase 4: 测试与文档

- [ ] 编写集成测试
  - 测试完整的打开管理面板流程
  - 测试批量操作的成功与失败场景
  - 测试日期分组逻辑

- [ ] 更新 `模块文档/渐进阅读.md`
  - 新增"管理面板"章节
  - 描述功能、使用方法、数据流
  - 添加组件架构图（文字描述）

- [ ] 更新 `CHANGELOG.md`
  - 记录新功能：渐进阅读管理面板
  - 列出主要能力：统计、排期视图、批量操作

## Phase 5: 验收

- [ ] 功能验收
  - 运行命令 `orca-srs.openIRManager` 能打开管理面板
  - 统计面板显示正确的数字
  - 卡片列表正确分组
  - 点击卡片能跳转
  - 多选卡片后批量调整优先级功能正常
  - 批量操作后界面自动刷新

- [ ] 质量验收
  - 所有测试通过
  - 测试覆盖率 ≥ 90%
  - TypeScript 编译无错误
  - 无 console 错误或警告

---

**总任务数**：18
**预计完成时间**：2-3 天
