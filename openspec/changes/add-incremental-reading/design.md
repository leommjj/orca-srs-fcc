## Context

需要在现有 SRS 体系外新增渐进阅读流程，包含独立的调度、队列与 UI 面板，并保证与现有卡片复习互不干扰。所有状态存储必须基于 Block Properties。

## Goals / Non-Goals

- Goals:
  - 基于 `ir.priority` 的静态优先级调度
  - 独立的阅读面板与操作区
  - 原生块可编辑体验
  - 与现有 SRS 系统隔离
- Non-Goals:
  - 不引入外部存储或数据库
  - 不实现统计面板与 PDF 解析

## Decisions

- Decision: 使用 `ir.*` Block Properties 存储渐进阅读状态
  - Why: 与现有存储一致，支持缓存与属性更新
- Decision: 队列与调度算法独立于 SRS
  - Why: 避免与 FSRS 状态结构耦合，减少回归风险
- Decision: UI 使用 `orca.components.Block` 渲染 Extract 内容
  - Why: 该组件支持原生块编辑，避免不存在的 `BlockRenderer`
- Decision: 面包屑通过 `Block.parent` 向上查找最近 Topic，限制深度
  - Why: 避免全量扫描和深层性能问题

## Risks / Trade-offs

- 优先级映射可能需要后续配置化
- 原生 Block 编辑在某些场景可能受限（可降级）

## Migration Plan

- 新增 `ir.*` 属性字段，旧 Extract 自动初始化
- 不移除任何现有字段，保持向后兼容

## Open Questions

- 无
