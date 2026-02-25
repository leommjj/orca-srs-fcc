## ADDED Requirements

### Requirement: 渐进阅读状态存储
系统 SHALL 使用 Block Properties 存储渐进阅读状态，包括 `ir.priority`（1-10）、`ir.lastRead`（日期或空）、`ir.readCount`（次数）与 `ir.due`（日期）。

#### Scenario: 初始化默认状态
- **GIVEN** 一个 `#card(type=extracts)` 块没有 `ir.*` 属性
- **WHEN** 系统调用渐进阅读状态初始化逻辑
- **THEN** `ir.priority` 应被写入为 5
- **AND** `ir.lastRead` 为空
- **AND** `ir.readCount` 为 0
- **AND** `ir.due` 应被设置为基于优先级的到期时间

### Requirement: 优先级调度映射
系统 SHALL 按固定映射将优先级转换为间隔天数，并据此计算下次到期时间。

#### Scenario: 优先级 8 计算到期
- **GIVEN** 一个块的 `ir.priority` 为 8
- **WHEN** 系统计算下次到期时间
- **THEN** 间隔天数为 2 天

### Requirement: 标记已读更新状态
系统 SHALL 在“标记已读”时更新 `ir.lastRead`、`ir.readCount` 并根据当前优先级写入新的 `ir.due`。

#### Scenario: 标记已读后更新到期
- **GIVEN** 一个块 `ir.priority` 为 8 且 `ir.readCount` 为 0
- **WHEN** 用户执行“标记已读”
- **THEN** `ir.lastRead` 更新为当前时间
- **AND** `ir.readCount` 增加 1
- **AND** `ir.due` 设置为 2 天后

### Requirement: 调整优先级立即生效
系统 SHALL 在更新优先级时立即重算 `ir.due`，并基于当前时间写入。

#### Scenario: 更新优先级后重算到期
- **GIVEN** 一个块当前 `ir.priority` 为 5
- **WHEN** 用户将优先级更新为 10
- **THEN** `ir.priority` 更新为 10
- **AND** `ir.due` 基于当前时间设置为 1 天后

### Requirement: 渐进阅读收集过滤
系统 SHALL 仅收集 `cardType` 为 `渐进阅读` 或 `extracts` 的块进入渐进阅读队列。

#### Scenario: 过滤非渐进阅读卡片
- **GIVEN** 系统扫描到多种 `#card` 块
- **WHEN** 渐进阅读收集器执行
- **THEN** 仅保留 `渐进阅读` 与 `extracts` 类型

### Requirement: 到期与新卡入队
系统 SHALL 将到期（`ir.due <= now`）或未读（`ir.lastRead` 为空）的卡片纳入渐进阅读队列。

#### Scenario: 新卡与到期卡入队
- **GIVEN** 一个块无 `ir.lastRead`
- **AND** 另一个块 `ir.due` 小于等于当前时间
- **WHEN** 渐进阅读收集器执行
- **THEN** 两个块均进入队列

### Requirement: 2:1 混合策略
系统 SHALL 使用 2:1 策略混合到期卡片与新卡片，形成渐进阅读队列。

#### Scenario: 队列 2:1 混合
- **GIVEN** 到期卡片数量为 4，新卡片数量为 2
- **WHEN** 系统构建队列
- **THEN** 队列按“到期到期新卡”循环混合

### Requirement: 独立阅读面板
系统 SHALL 提供独立于 SRS 的渐进阅读面板，用于展示与操作 Topic/Extract。

#### Scenario: 启动渐进阅读面板
- **WHEN** 用户执行“渐进阅读”入口命令
- **THEN** 系统打开独立阅读面板
- **AND** 面板不影响 SRS 复习队列

### Requirement: 原生编辑器支持
系统 SHALL 在阅读面板中使用原生块编辑器展示 Extract 内容，允许直接编辑。

#### Scenario: 面板内编辑 Extract
- **GIVEN** 阅读面板展示某 Extract
- **WHEN** 用户编辑块内容
- **THEN** 内容在原块上被更新

### Requirement: 面包屑导航到 Topic
系统 SHALL 显示当前 Extract 所属 Topic 的面包屑路径，仅追溯到最近的 Topic。

#### Scenario: 面包屑显示 Topic
- **GIVEN** 一个 Extract 位于某 Topic 的子层级
- **WHEN** 面板渲染面包屑
- **THEN** 显示 “Topic Title > Extract Title”

### Requirement: 完整操作支持
系统 SHALL 提供以下操作：标记已读、跳过、调整优先级、生成卡片、删除。

#### Scenario: 跳过不更新状态
- **GIVEN** 当前 Extract 已在队列中
- **WHEN** 用户点击“跳过”
- **THEN** 该卡片从当前队列移除
- **AND** 不更新任何 `ir.*` 状态

#### Scenario: 生成卡片创建子卡
- **GIVEN** 当前 Extract
- **WHEN** 用户点击“生成卡片”
- **THEN** 系统在该 Extract 下创建一个 basic 子卡片
- **AND** 子卡片自动添加 `#card` 标签

#### Scenario: 删除 Extract
- **GIVEN** 当前 Extract
- **WHEN** 用户点击“删除”
- **THEN** 系统删除该块

### Requirement: 自动标记初始化优先级
系统 SHALL 在自动标记 Extract 时初始化 `ir.priority`（默认 5）并确保 `ir.*` 状态可用。

#### Scenario: 自动标记初始化
- **GIVEN** Topic 的直接子块被自动标记为 Extract
- **WHEN** 自动标记流程完成
- **THEN** 该子块包含 `ir.priority=5` 与完整 `ir.*` 状态
