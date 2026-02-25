# Change: add-incremental-reading（新增“渐进阅读”功能）

## Why（为什么要做）

当前插件已具备 SRS 复习能力，但缺少独立的渐进阅读流程，导致 Topic/Extract 的阅读节奏无法独立调度，也无法支持阅读面板的专用操作（标记已读、优先级调整、生成卡片等）。需要在不影响现有 SRS 的前提下，提供完整的渐进阅读体验。

## What Changes（要改什么）

- 新增渐进阅读数据层：使用 Block Properties 存储 `ir.priority`、`ir.lastRead`、`ir.readCount`、`ir.due`
- 新增调度算法：根据优先级映射间隔天数，计算下一次到期时间
- 新增渐进阅读卡片收集器与队列构建（独立于 SRS）
- 新增独立阅读面板（渲染器 + 会话 UI），支持原生块编辑与面包屑导航
- 新增操作能力：标记已读、跳过、调整优先级、生成卡片、删除
- 自动标记 Extract 时初始化 `ir.priority`（默认 5）并确保 `ir.*` 状态
- 注册命令与 UI 入口（插件菜单/斜杠/顶部按钮按现有模式）
- 更新文档：`模块文档/渐进阅读.md`、`README.md`、`CHANGELOG.md`

## Non-Goals（不做什么）

- 不修改现有 SRS 复习核心逻辑
- 不引入新的数据库或外部存储
- 不实现统计面板
- 不实现 PDF 解析能力（依赖 Orca 现有能力）

## Assumptions（关键假设）

- 渐进阅读使用现有 `#card(type=渐进阅读 | extracts)` 标记
- 仅处理 Topic 的直接子块为 Extract（不递归处理）
- 原生块编辑可通过 `orca.components.Block` 实现

## Impact（影响范围）

- 新增模块：
  - `src/srs/incrementalReadingStorage.ts`
  - `src/srs/incrementalReadingScheduler.ts`
  - `src/srs/incrementalReadingCollector.ts`
  - `src/components/IncrementalReadingSessionRenderer.tsx`
  - `src/components/IncrementalReadingSessionDemo.tsx`
  - `src/components/IncrementalReadingBreadcrumb.tsx`
- 修改模块：
  - `src/srs/registry/commands.ts`
  - `src/srs/registry/uiComponents.tsx`
  - `src/srs/registry/renderers.ts`
  - `src/srs/incrementalReadingAutoMark.ts`
  - `src/main.ts`
  - `README.md`
  - `CHANGELOG.md`
  - `模块文档/渐进阅读.md`

## Risks（风险）

- 优先级间隔映射可能不符合所有用户的节奏需求（后续可设置化）
- 原生编辑器在特定场景的兼容性问题（可降级为只读 + 跳转）
- 面包屑递归查找在深层结构下存在性能风险（需限制深度）

## Open Questions（待确认）

- 无（按需求已确认：跳过不更新状态、生成子卡片、面包屑到 Topic 即止）
