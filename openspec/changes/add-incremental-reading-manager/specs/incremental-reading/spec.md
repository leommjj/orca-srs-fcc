## ADDED Requirements

### Requirement: 全量卡片收集
系统 SHALL 提供 `collectAllIRCards()` 函数，收集所有渐进阅读卡片（不限到期状态），用于管理面板统计与排期展示。

#### Scenario: 收集所有渐进阅读卡片
- **GIVEN** 系统中存在 10 张渐进阅读卡片（5 张到期、3 张新卡、2 张未到期）
- **WHEN** 调用 `collectAllIRCards()`
- **THEN** 返回所有 10 张卡片的 `IRCard` 数据
- **AND** 每张卡片包含完整的状态信息（priority、due、lastRead、readCount、isNew）

#### Scenario: 自动初始化缺失状态
- **GIVEN** 一个渐进阅读卡片缺少 `ir.due` 属性
- **WHEN** `collectAllIRCards()` 处理该卡片
- **THEN** 自动调用 `ensureIRState()` 初始化缺失属性
- **AND** 该卡片被包含在返回结果中

### Requirement: 批量更新优先级
系统 SHALL 提供 `bulkUpdatePriority()` 函数，批量更新多张卡片的优先级，并返回成功/失败详情。

#### Scenario: 批量更新全部成功
- **GIVEN** 用户选中 5 张卡片
- **WHEN** 调用 `bulkUpdatePriority([id1, id2, id3, id4, id5], 8)`
- **THEN** 所有 5 张卡片的 `ir.priority` 更新为 8
- **AND** 所有 5 张卡片的 `ir.due` 基于当前时间重新计算
- **AND** 返回 `{ success: [id1, id2, id3, id4, id5], failed: [] }`

#### Scenario: 批量更新部分失败
- **GIVEN** 用户选中 5 张卡片，其中 1 张卡片已被删除
- **WHEN** 调用 `bulkUpdatePriority([id1, id2, id3, id4, id5], 8)`
- **THEN** 4 张存在的卡片成功更新
- **AND** 返回 `{ success: [id1, id2, id3, id4], failed: [{ id: id5, error: "块不存在" }] }`

### Requirement: 管理面板统计展示
系统 SHALL 在管理面板中显示渐进阅读卡片统计，包括总数、新卡数、到期卡数、未来 7 天到期数。

#### Scenario: 计算并显示统计信息
- **GIVEN** 系统中有 20 张渐进阅读卡片（5 张新卡、3 张今天到期、4 张未来 7 天到期、8 张 7 天后到期）
- **WHEN** 用户打开管理面板
- **THEN** 统计面板显示：
  - 总卡片数：20
  - 新卡数：5
  - 到期卡数：3
  - 未来 7 天到期：4

### Requirement: 按日期分组展示（直观突出）
系统 SHALL 按到期日期对卡片进行分组（已逾期/今天/明天/未来7天/新卡/7天后），使用自然日 00:00 作为分组边界，并通过视觉样式突出到期和即将到期的卡片。

#### Scenario: 日期分组逻辑与视觉优先级
- **GIVEN** 当前时间为 2026-01-19 14:30
- **AND** 存在以下卡片：
  - Card A: `due = 2026-01-18 08:00`（昨天，已逾期）
  - Card B: `due = 2026-01-19 08:00`（今天早上）
  - Card C: `due = 2026-01-20 10:00`（明天）
  - Card D: `due = 2026-01-25 15:00`（6 天后）
  - Card E: `lastRead = null`（新卡）
  - Card F: `due = 2026-02-01 12:00`（13 天后）
- **WHEN** 管理面板构建分组
- **THEN** 分组顺序如下（视觉优先级从高到低）：
  - "已逾期"：[Card A]（红色高亮，默认展开）
  - "今天"：[Card B]（橙色高亮，默认展开）
  - "明天"：[Card C]（黄色高亮）
  - "未来7天"：[Card D]（正常显示）
  - "新卡"：[Card E]（蓝色标签）
  - "7天后"：[Card F]（灰色弱化，默认折叠）

### Requirement: 卡片列表多选
系统 SHALL 支持用户在管理面板中多选卡片，通过 checkbox 控制选择状态。

#### Scenario: 多选卡片进行批量操作
- **GIVEN** 管理面板显示 10 张卡片
- **WHEN** 用户勾选 3 张卡片的 checkbox
- **THEN** 批量操作栏显示"已选中 3 张卡片"
- **AND** 批量操作按钮变为可用状态

### Requirement: 卡片跳转到侧面板
系统 SHALL 支持用户点击卡片标题跳转到对应块，始终在侧面板中打开。

#### Scenario: 点击卡片在侧面板打开
- **GIVEN** 用户在管理面板中查看卡片列表
- **WHEN** 用户点击某张卡片的标题
- **THEN** 系统在侧面板中打开该卡片对应的块
- **AND** 主面板保持不变
- **AND** 用户可以在侧面板中查看和编辑卡片内容

### Requirement: 批量操作后自动刷新
系统 SHALL 在批量操作完成后自动刷新管理面板数据，反映最新状态。

#### Scenario: 批量调整优先级后刷新
- **GIVEN** 用户在管理面板中选中 5 张卡片
- **WHEN** 用户批量将优先级调整为 10
- **AND** 操作成功完成
- **THEN** 管理面板自动重新加载卡片数据
- **AND** 卡片列表显示更新后的优先级和到期日期

### Requirement: 批量操作失败提示
系统 SHALL 在批量操作部分失败时显示详细错误信息，包括失败的卡片数量和原因。

#### Scenario: 部分失败显示错误详情
- **GIVEN** 用户批量更新 10 张卡片，其中 2 张失败
- **WHEN** 操作完成
- **THEN** 系统显示通知："8/10 张卡片更新成功，2 张失败"
- **AND** 提供查看失败详情的选项
- **AND** 失败详情包含卡片 ID 和错误原因

### Requirement: 管理面板命令注册
系统 SHALL 注册 `orca-srs.openIRManager` 命令，允许用户打开渐进阅读管理面板。

#### Scenario: 通过命令打开管理面板
- **WHEN** 用户执行命令 `orca-srs.openIRManager`
- **THEN** 系统创建管理面板块（`_repr.type = "srs.ir-manager"`）
- **AND** 在当前面板中渲染管理面板 UI

### Requirement: 管理面板渲染器注册
系统 SHALL 注册 `srs.ir-manager` 渲染器，用于渲染管理面板 UI。

#### Scenario: 渲染管理面板块
- **GIVEN** 存在一个 `_repr.type = "srs.ir-manager"` 的块
- **WHEN** 系统渲染该块
- **THEN** 使用 `IncrementalReadingManagerPanel` 组件渲染
- **AND** 组件接收当前面板 ID 作为 props
