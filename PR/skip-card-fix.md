# PR: 修复跳过卡片时下一张卡片直接显示答案的问题

## 问题描述

在复习会话中，当用户点击"跳过"按钮跳过当前卡片时，下一张卡片会直接显示答案内容，而不是显示问题面。这违反了复习卡片的基本交互逻辑——用户应该先看到问题，思考后再选择显示答案。

### 问题原因

1. **状态重置逻辑不完整**：原有代码仅依赖 `blockId` 来检测卡片切换并重置 `showAnswer` 状态，但对于以下情况会失效：
   - Cloze 填空卡：同一个 `blockId` 可能有多个不同的 `clozeNumber`（如 c1, c2, c3）
   - Direction 方向卡：同一个 `blockId` 可能有不同的 `directionType`（forward/backward）
   
2. **部分渲染器缺少重置逻辑**：`ClozeCardReviewRenderer`、`DirectionCardReviewRenderer`、`ChoiceCardReviewRenderer` 组件完全没有在卡片切换时重置状态的逻辑。

3. **跳过按钮位置不合理**：原来跳过按钮只在答案显示后才出现，用户无法在看到答案前跳过卡片。

## 修改内容

### 1. SrsCardDemo.tsx

**改动**：改进卡片切换检测逻辑

```tsx
// 修改前：仅依赖 blockId
const prevBlockIdRef = useRef<DbId | undefined>(blockId)
useEffect(() => {
  if (prevBlockIdRef.current !== blockId) {
    setShowAnswer(false)
    // ...
  }
}, [blockId])

// 修改后：使用完整的卡片唯一标识
const prevCardKeyRef = useRef<string>("")
const currentCardKey = `${blockId}-${clozeNumber ?? 0}-${directionType ?? "basic"}`
useEffect(() => {
  if (prevCardKeyRef.current !== currentCardKey) {
    setShowAnswer(false)
    setShowCardInfo(false)
    prevCardKeyRef.current = currentCardKey
  }
}, [currentCardKey])
```

**改动**：在"显示答案"按钮旁边添加跳过按钮

```tsx
// 修改前：只有显示答案按钮
<div style={{ textAlign: "center", marginBottom: "12px" }}>
  <Button variant="solid" onClick={() => setShowAnswer(true)}>
    显示答案
  </Button>
</div>

// 修改后：跳过按钮 + 显示答案按钮
<div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "12px" }}>
  {onSkip && (
    <Button variant="outline" onClick={onSkip} title="跳过当前卡片，不评分">
      跳过
    </Button>
  )}
  <Button variant="solid" onClick={() => setShowAnswer(true)}>
    显示答案
  </Button>
</div>
```

### 2. ClozeCardReviewRenderer.tsx

**改动**：添加 `useRef` 和 `useEffect` 导入

```tsx
// 修改前
const { useState, useMemo } = window.React

// 修改后
const { useState, useMemo, useRef, useEffect } = window.React
```

**改动**：添加卡片切换时的状态重置逻辑

```tsx
// 新增代码
const prevCardKeyRef = useRef<string>("")
const currentCardKey = `${blockId}-${clozeNumber ?? 0}`

useEffect(() => {
  if (prevCardKeyRef.current !== currentCardKey) {
    setShowAnswer(false)
    setShowCardInfo(false)
    prevCardKeyRef.current = currentCardKey
  }
}, [currentCardKey])
```

**改动**：在"显示答案"按钮旁边添加跳过按钮（同 SrsCardDemo.tsx）

### 3. DirectionCardReviewRenderer.tsx

**改动**：添加 `useRef` 和 `useEffect` 导入

```tsx
// 修改前
const { useState, useMemo } = window.React

// 修改后
const { useState, useMemo, useRef, useEffect } = window.React
```

**改动**：添加卡片切换时的状态重置逻辑

```tsx
// 新增代码
const prevCardKeyRef = useRef<string>("")
const currentCardKey = `${blockId}-${reviewDirection}`

useEffect(() => {
  if (prevCardKeyRef.current !== currentCardKey) {
    setShowAnswer(false)
    setShowCardInfo(false)
    prevCardKeyRef.current = currentCardKey
  }
}, [currentCardKey])
```

**改动**：在"显示答案"按钮旁边添加跳过按钮（同 SrsCardDemo.tsx）

### 4. ChoiceCardReviewRenderer.tsx

**改动**：添加 `useRef` 和 `useEffect` 导入

```tsx
// 修改前
const { useState, useMemo, useCallback } = window.React

// 修改后
const { useState, useMemo, useCallback, useRef, useEffect } = window.React
```

**改动**：添加卡片切换时的状态重置逻辑（选择题需要重置更多状态）

```tsx
// 新增代码
const prevCardKeyRef = useRef<string>("")
const currentCardKey = `${blockId}`

useEffect(() => {
  if (prevCardKeyRef.current !== currentCardKey) {
    setSelectedIds(new Set())        // 重置选中的选项
    setIsAnswerRevealed(false)       // 重置答案揭晓状态
    setShowCardInfo(false)           // 重置卡片信息显示
    setCurrentSuggestedGrade(null)   // 重置建议评分
    prevCardKeyRef.current = currentCardKey
  }
}, [currentCardKey])
```

**改动**：在答案未揭晓时添加跳过按钮

- 多选模式：在"提交答案"按钮旁边添加跳过按钮
- 单选模式：添加独立的跳过按钮区域

```tsx
{/* 多选模式 */}
{mode === "multiple" && !isAnswerRevealed && (
  <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
    {onSkip && <button onClick={onSkip}>跳过</button>}
    <button onClick={handleSubmit}>提交答案</button>
  </div>
)}

{/* 单选模式 */}
{mode !== "multiple" && !isAnswerRevealed && onSkip && (
  <div style={{ display: "flex", justifyContent: "center" }}>
    <button onClick={onSkip}>跳过</button>
  </div>
)}
```

## 影响范围

- Basic 卡片（问答卡）
- Cloze 卡片（填空卡）
- Direction 卡片（方向卡）
- Choice 卡片（选择题卡）
- Excerpt 卡片（摘录卡）- 无影响，摘录卡没有"显示答案"的概念

## 测试建议

1. **Basic 卡片测试**
   - 开始复习 → 点击跳过 → 验证下一张卡片显示问题面而非答案面
   - 开始复习 → 显示答案 → 评分 → 验证下一张卡片显示问题面

2. **Cloze 卡片测试**
   - 复习同一块的多个填空（c1, c2, c3）→ 跳过 c1 → 验证 c2 显示问题面
   - 复习不同块的填空 → 跳过 → 验证下一张显示问题面

3. **Direction 卡片测试**
   - 复习同一块的正向和反向 → 跳过正向 → 验证反向显示问题面
   - 复习不同块的方向卡 → 跳过 → 验证下一张显示问题面

4. **Choice 卡片测试**
   - 单选模式：不选择任何选项 → 点击跳过 → 验证下一张卡片状态正常
   - 多选模式：选择部分选项 → 点击跳过 → 验证下一张卡片选项未被选中

## 相关文件

- `src/components/SrsCardDemo.tsx`
- `src/components/ClozeCardReviewRenderer.tsx`
- `src/components/DirectionCardReviewRenderer.tsx`
- `src/components/ChoiceCardReviewRenderer.tsx`
