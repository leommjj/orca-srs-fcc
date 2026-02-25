# SRS 数据存储模块

## 概述

本模块负责 SRS 卡片状态的持久化读写，通过 Orca 的块属性系统将卡片的复习状态存储到块中。

### 核心价值

- 将 SRS 状态与 Orca 块系统无缝集成
- 支持读取、保存和更新卡片状态
- 自动初始化新卡片的状态

## 技术实现

### 核心文件

- [storage.ts](file:///d:/orca插件/虎鲸标记%20内置闪卡/src/srs/storage.ts)

### 存储机制

SRS 状态通过 Orca 的块属性（`block.properties`）存储。

#### 普通卡片属性

| 属性名             | 类型     | 说明                  |
| ------------------ | -------- | --------------------- |
| `srs.isCard`       | Boolean  | 标记块是否为 SRS 卡片 |
| `srs.stability`    | Number   | 记忆稳定度            |
| `srs.difficulty`   | Number   | 记忆难度              |
| `srs.interval`     | Number   | 间隔天数              |
| `srs.due`          | DateTime | 下次复习时间          |
| `srs.lastReviewed` | DateTime | 上次复习时间          |
| `srs.reps`         | Number   | 复习次数              |
| `srs.lapses`       | Number   | 遗忘次数              |

#### Cloze 卡片属性

Cloze 卡片的每个填空有独立的 SRS 状态，属性名包含填空编号：

| 属性名（示例 c1）     | 类型     | 说明              |
| --------------------- | -------- | ----------------- |
| `srs.c1.stability`    | Number   | c1 的记忆稳定度   |
| `srs.c1.difficulty`   | Number   | c1 的记忆难度     |
| `srs.c1.interval`     | Number   | c1 的间隔天数     |
| `srs.c1.due`          | DateTime | c1 的下次复习时间 |
| `srs.c1.lastReviewed` | DateTime | c1 的上次复习时间 |
| `srs.c1.reps`         | Number   | c1 的复习次数     |
| `srs.c1.lapses`       | Number   | c1 的遗忘次数     |

### 内部函数

模块内部使用统一的函数处理普通卡片和 Cloze 卡片：

#### `buildPropertyName(base, clozeNumber?): string`

构建属性名称。普通卡片返回 `srs.{base}`，Cloze 卡片返回 `srs.c{N}.{base}`。

#### `loadSrsStateInternal(blockId, clozeNumber?): Promise<SrsState>`

内部加载函数，统一处理普通卡片和 Cloze 卡片的状态加载。

#### `saveSrsStateInternal(blockId, newState, clozeNumber?): Promise<void>`

内部保存函数，统一处理普通卡片和 Cloze 卡片的状态保存。

#### `invalidateBlockCache(blockId): void`（导出）

清除指定块的内部缓存。当外部模块（如 `cardStatusUtils.ts`）直接修改块属性后调用，确保下次 `collectReviewCards` 读取最新数据。

```typescript
import { invalidateBlockCache } from "./storage"

// 修改属性后清除缓存
await orca.commands.invokeEditorCommand("core.editor.setProperties", ...)
invalidateBlockCache(blockId)
```

### 公开 API - 普通卡片

#### `loadCardSrsState(blockId): Promise<SrsState>`

从块属性中读取 SRS 状态。

```typescript
const state = await loadCardSrsState(blockId);
console.log(`下次复习：${state.due}`);
```

#### `saveCardSrsState(blockId, newState): Promise<void>`

将 SRS 状态保存到块属性。

```typescript
await saveCardSrsState(blockId, newState);
```

#### `writeInitialSrsState(blockId, now?): Promise<SrsState>`

为新卡片写入初始状态。

```typescript
const initial = await writeInitialSrsState(blockId);
```

#### `updateSrsState(blockId, grade): Promise<{state, log}>`

一步完成：读取状态 → 计算新状态 → 保存。

```typescript
const result = await updateSrsState(blockId, "good");
console.log(`新间隔：${result.state.interval} 天`);
```

### 公开 API - Cloze 卡片

#### `loadClozeSrsState(blockId, clozeNumber): Promise<SrsState>`

加载 Cloze 卡片某个填空的 SRS 状态。

```typescript
const state = await loadClozeSrsState(blockId, 1); // 加载 c1 的状态
```

#### `saveClozeSrsState(blockId, clozeNumber, newState): Promise<void>`

保存 Cloze 卡片某个填空的 SRS 状态。

```typescript
await saveClozeSrsState(blockId, 1, newState);
```

#### `writeInitialClozeSrsState(blockId, clozeNumber, daysOffset?): Promise<SrsState>`

为 Cloze 卡片的某个填空写入初始状态，支持设置到期时间偏移。

```typescript
// c1 今天到期，c2 明天到期，c3 后天到期
await writeInitialClozeSrsState(blockId, 1, 0);
await writeInitialClozeSrsState(blockId, 2, 1);
await writeInitialClozeSrsState(blockId, 3, 2);
```

#### `updateClozeSrsState(blockId, clozeNumber, grade): Promise<{state, log}>`

更新 Cloze 卡片某个填空的 SRS 状态。

```typescript
const result = await updateClozeSrsState(blockId, 1, "good");
```

### 属性类型映射

使用 Orca 编辑器命令保存属性时的类型编码：

| 类型值 | 类型名称 | 用途     |
| ------ | -------- | -------- |
| 2      | String   | 文本值   |
| 3      | Number   | 数值     |
| 4      | Boolean  | 布尔值   |
| 5      | DateTime | 日期时间 |

## 使用场景

### 1. 评分后更新状态

```typescript
// 用户点击 "Good" 按钮
const result = await updateSrsState(blockId, "good");
orca.notify("success", `下次复习：${result.state.due}`);
```

### 2. 检查卡片是否需要复习

```typescript
const state = await loadCardSrsState(blockId);
const now = new Date();
if (state.due <= now) {
  console.log("卡片已到期，需要复习");
}
```

## 扩展点

1. **批量操作**：可扩展批量读写多张卡片
2. **导出备份**：可扩展将状态导出为 JSON
3. **状态重置**：可扩展重置卡片进度

## 相关文件

| 文件                                                                         | 说明         |
| ---------------------------------------------------------------------------- | ------------ |
| [storage.ts](file:///d:/orca插件/虎鲸标记%20内置闪卡/src/srs/storage.ts)     | 存储核心实现 |
| [algorithm.ts](file:///d:/orca插件/虎鲸标记%20内置闪卡/src/srs/algorithm.ts) | 算法调用     |
| [types.ts](file:///d:/orca插件/虎鲸标记%20内置闪卡/src/srs/types.ts)         | 类型定义     |
