# Design: add-incremental-reading-manager

## 架构概览

渐进阅读管理面板采用分层架构：

```
UI Layer (React Components)
    ↓
Data Layer (incrementalReadingCollector + incrementalReadingStorage)
    ↓
Orca API (Block Properties, Commands, Renderers)
```

## 关键设计决策

### 0. UI 直观性设计（用户核心需求）

**决策**：到期和即将到期的卡片必须直观明显

**理由**：
- 用户打开管理面板的主要目的是查看需要处理的卡片
- 到期卡片需要立即处理，即将到期卡片需要提前规划
- 视觉层级应突出这两类卡片

**实现**：
```typescript
// 分组顺序（视觉优先级从高到低）
const groupOrder = [
  "已逾期",    // 红色高亮，最优先
  "今天",      // 橙色提示，次优先
  "明天",      // 黄色提示
  "未来7天",   // 正常显示
  "新卡",      // 正常显示
  "7天后"      // 灰色弱化
]

// 视觉样式建议
- 已逾期：红色边框 + 红色标签，展开显示
- 今天：橙色边框 + 橙色标签，展开显示
- 明天：黄色高亮
- 未来7天：正常显示
- 新卡：蓝色标签
- 7天后：灰色文字，默认折叠
```

**统计面板重点突出**：
- 到期卡数（已逾期+今天）：大字号 + 红色/橙色
- 未来7天到期：中等字号 + 黄色
- 总数/新卡数：正常字号 + 灰色

### 1. 数据收集策略

**决策**：新增 `collectAllIRCards()` 而不是扩展现有 `collectIRCards()`

**理由**：
- 现有 `collectIRCards()` 专门为阅读会话设计，只返回到期卡
- 管理面板需要全量数据以计算统计和排期
- 分离职责，避免在现有函数中添加复杂的参数控制

**实现**：
```typescript
export async function collectAllIRCards(pluginName: string = "srs-plugin"): Promise<IRCard[]> {
  const taggedBlocks = await collectTaggedBlocks(pluginName)
  const results: IRCard[] = []

  for (const block of taggedBlocks) {
    const cardType = extractCardType(block)
    if (cardType !== "渐进阅读" && cardType !== "extracts") continue

    await ensureIRState(block.id) // 确保状态初始化
    const state = await loadIRState(block.id)

    results.push({
      id: block.id,
      cardType,
      priority: state.priority,
      due: state.due,
      lastRead: state.lastRead,
      readCount: state.readCount,
      isNew: !state.lastRead
    })
  }

  return results
}
```

**性能考虑**：
- `ensureIRState` 会写入缺失的属性，首次扫描可能较慢
- 建议用户在小批量卡片（<100）时使用管理面板
- 后续可优化为按需加载或缓存

### 2. 批量操作的事务性

**决策**：使用 `Promise.allSettled` 而非 `Promise.all`

**理由**：
- `Promise.all` 遇到第一个失败就中断，无法知道其他卡片的处理结果
- `Promise.allSettled` 等待所有操作完成，返回每个操作的成功/失败状态
- 用户需要知道哪些卡片更新成功、哪些失败，以便重试

**实现**：
```typescript
export async function bulkUpdatePriority(
  blockIds: DbId[],
  newPriority: number
): Promise<{ success: DbId[], failed: Array<{ id: DbId, error: string }> }> {
  const results = await Promise.allSettled(
    blockIds.map(id => updatePriority(id, newPriority))
  )

  const success: DbId[] = []
  const failed: Array<{ id: DbId, error: string }> = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success.push(blockIds[index])
    } else {
      failed.push({
        id: blockIds[index],
        error: result.reason?.message || '未知错误'
      })
    }
  })

  return { success, failed }
}
```

**UI 处理**：
- 全部成功：显示成功提示，刷新列表
- 部分失败：显示详细错误信息（"3/10 张卡片更新失败"），提供重试选项
- 全部失败：显示错误提示，不刷新列表

### 3. 日期分组逻辑

**决策**：使用自然日 00:00 作为分组边界

**理由**：
- 更符合用户认知（"今天"指自然日，而非"未来 24 小时"）
- 与大多数日历应用行为一致
- 实现简单，无需处理时区问题（假设用户在单一时区使用）

**分组规则**：
```typescript
function getDateGroup(due: Date, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.floor((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return '已逾期'
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays <= 7) return '未来7天'
  return '7天后'
}
```

**特殊处理**：
- 新卡（`isNew === true`）单独一组，显示在最前面
- 已逾期卡片（`due < today 00:00`）单独一组，显示在新卡之后

**最终顺序**：新卡 → 已逾期 → 今天 → 明天 → 未来7天 → 7天后

### 4. 侧面板跳转策略

**决策**：点击卡片后始终在侧面板中打开

**理由**：
- 用户需求明确：管理面板用于浏览和管理，不应占用主面板
- 侧面板打开允许用户在主面板继续工作，同时查看卡片详情
- 符合"管理面板 → 侧面板预览"的常见 UX 模式

**实现**：
```typescript
// 在组件中
const handleCardClick = async (cardId: DbId) => {
  // 始终在侧面板打开
  await orca.commands.invokeEditorCommand(
    "core.panel.openInSidePanel", // 或类似的侧面板命令
    null,
    cardId
  )
}
```

**备选方案**（如果没有直接的侧面板命令）：
```typescript
const handleCardClick = async (cardId: DbId) => {
  // 使用 Shift+Click 的逻辑强制在侧面板打开
  const block = await orca.invokeBackend("get-block", cardId)
  if (block) {
    await orca.panel.openBlockInPanel(block, "side") // 具体 API 需确认
  }
}
```

### 5. 组件拆分策略

**决策**：按功能域拆分为 4 个独立组件

**理由**：
- **可测试性**：每个组件职责单一，易于单元测试
- **可复用性**：统计、列表、操作栏可能在其他场景复用
- **可维护性**：修改某个子功能不影响其他部分
- **性能优化**：每个组件可独立优化（如列表虚拟滚动）

**组件职责**：
- `IRStatistics`：纯展示组件，接收 `cards` 计算统计
- `IRCardList`：列表渲染 + 交互（选择、展开、点击）
- `IRBulkActionBar`：批量操作 UI，接收 `selectedIds` 和回调
- `IncrementalReadingManagerPanel`：状态管理 + 数据加载 + 组件组合

**数据流**：
```
IncrementalReadingManagerPanel (state owner)
  ├─ IRStatistics (readonly)
  ├─ IRCardList (controlled component)
  └─ IRBulkActionBar (controlled component)
```

### 6. 错误处理策略

**原则**：渐进式降级，不阻塞用户操作

**场景与处理**：
- **数据加载失败**：显示错误提示 + 重试按钮，不阻塞界面
- **批量操作部分失败**：显示成功数量和失败列表，允许重试失败项
- **单个卡片跳转失败**：toast 提示，不影响其他卡片
- **状态初始化失败**：跳过该卡片，记录错误日志

**实现**：
```typescript
const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
const [errorMessage, setErrorMessage] = useState<string | null>(null)

const loadCards = async () => {
  setLoadingState('loading')
  try {
    const cards = await collectAllIRCards(pluginName)
    setAllCards(cards)
    setLoadingState('success')
  } catch (error) {
    setLoadingState('error')
    setErrorMessage(error.message)
  }
}
```

## 技术约束

### React 版本
- 使用 React 18.2+（虎鲸笔记提供）
- Hooks：`useState`, `useEffect`, `useRef`, `useMemo`
- 不使用 Context API（避免过度抽象）

### Orca API 限制
- 使用 `orca.components.Button` 等原生组件保持风格一致
- 跳转使用 `core.panel.focusBlock` 命令
- 避免直接操作 DOM（通过 Orca API 操作）

### 性能目标
- 100 张卡片时列表渲染 <100ms（主观评估）
- 批量操作 100 张卡片 <2s（网络操作）
- 初次加载 <500ms（假设无缓存）

## 测试策略

### 单元测试
- `collectAllIRCards.test.ts`：测试全量收集逻辑
  - 空列表、单卡、多卡、混合类型
  - 缺失状态自动初始化
- `bulkUpdatePriority.test.ts`：测试批量操作
  - 全部成功、部分失败、全部失败
  - 返回结果结构正确

### 集成测试
- 打开管理面板流程
- 批量操作端到端测试
- 日期分组逻辑验证

### 手动测试场景
- 创建 50 张渐进阅读卡片，验证统计和分组正确
- 多选 20 张卡片批量调整优先级，验证刷新正确
- 在侧边栏打开管理面板，点击卡片验证跳转到侧边栏（而非主面板）

## 未来优化方向

### 性能优化（P2）
- 虚拟滚动（react-window）支持 1000+ 卡片
- 按需加载：初次只显示到期卡，"显示全部"按钮触发全量加载
- 状态缓存：避免重复调用 `ensureIRState`

### 功能扩展（P3）
- 批量删除（带确认）
- 批量标记已读
- 筛选和排序（按优先级、类型、到期日期）
- 导出统计报告（CSV/Markdown）

### UI 增强（P3）
- 优先级分布可视化（柱状图）
- 到期日期时间线视图
- 卡片预览（Hover 显示完整内容）

---

**设计评审状态**：待审批
**最后更新**：2026-01-19
