# SRS 方向卡（Direction Card）实现计划

> **创建日期**：2025-12-11
> **状态**：✅ 已实现

---

## 📋 功能概述

方向卡是一种双向问答卡片，允许用户通过插入方向标记（箭头）将文本分割为"问题"和"答案"两部分，支持正向、反向和双向三种复习模式。

### 用户操作示例

```
1. 用户输入：中国首都北京
2. 光标放在"都"和"北"之间，按 Ctrl+Alt+.
3. 结果：中国首都 → 北京

4. 复习正向卡：中国首都 → ❓  →  答案：北京
5. 复习反向卡：❓ ← 北京  →  答案：中国首都
```

---

## 🎯 设计决策

### 1. 箭头类型与卡片生成

| 快捷键       | 渲染图标               | 方向类型              | 生成卡片数       |
| ------------ | ---------------------- | --------------------- | ---------------- |
| `Ctrl+Alt+.` | `ti-arrow-right` →     | forward（正向）       | 1 张（左问右答） |
| `Ctrl+Alt+,` | `ti-arrow-left` ←      | backward（反向）      | 1 张（右问左答） |
| 点击切换到 ↔ | `ti-arrows-exchange` ↔ | bidirectional（双向） | 2 张             |

### 2. 图标选择

使用 Tabler Icons（`ti-*`）而非 emoji：

- 正向：`ti-arrow-right` →
- 反向：`ti-arrow-left` ←
- 双向：`ti-arrows-exchange` ↔

### 3. 分天推送策略

双向卡（↔）采用与 Cloze 相同的分天推送机制：

- **正向卡**：今天到期（offset = 0）
- **反向卡**：明天到期（offset = 1）

---

## 📐 数据结构设计

### 1. ContentFragment 类型

```typescript
// 新增 direction inline 类型
interface DirectionFragment extends ContentFragment {
  t: `${pluginName}.direction`; // 例如 "orca-srs.direction"
  v: "→" | "←" | "↔"; // 显示符号（实际用图标渲染）
  direction: "forward" | "backward" | "bidirectional";
}
```

### 2. 块内容示例

```typescript
// "中国首都 → 北京" 的 content 数组
[
  { t: "t", v: "中国首都 " },
  { t: "orca-srs.direction", v: "→", direction: "forward" },
  { t: "t", v: " 北京" },
];
```

### 3. SRS 属性（块属性）

方向卡使用独立的 SRS 状态前缀：

| 属性名                     | 类型     | 说明           |
| -------------------------- | -------- | -------------- |
| `srs.forward.stability`    | Number   | 正向卡稳定度   |
| `srs.forward.difficulty`   | Number   | 正向卡难度     |
| `srs.forward.interval`     | Number   | 正向卡间隔     |
| `srs.forward.due`          | DateTime | 正向卡到期时间 |
| `srs.forward.lastReviewed` | DateTime | 正向卡上次复习 |
| `srs.forward.reps`         | Number   | 正向卡复习次数 |
| `srs.forward.lapses`       | Number   | 正向卡遗忘次数 |
| `srs.backward.*`           | ...      | 反向卡（同上） |

### 4. \_repr 类型

新增 `srs.direction-card` 类型：

```typescript
block._repr = {
  type: "srs.direction-card",
  front: "中国首都", // 箭头左边
  back: "北京", // 箭头右边
  direction: "forward" | "backward" | "bidirectional",
};
```

### 5. ReviewCard 扩展

```typescript
export type ReviewCard = {
  id: DbId;
  front: string;
  back: string;
  srs: SrsState;
  isNew: boolean;
  deck: string;
  clozeNumber?: number; // 填空编号（Cloze 卡）
  directionType?: "forward" | "backward"; // 方向类型（Direction 卡）
};
```

---

## 🔧 实现模块

### 新增文件

| 文件                                             | 职责             | 预计行数 |
| ------------------------------------------------ | ---------------- | -------- |
| `src/srs/directionUtils.ts`                      | 方向卡工具函数   | ~150     |
| `src/components/DirectionInlineRenderer.tsx`     | 编辑器内箭头渲染 | ~80      |
| `src/components/DirectionCardReviewRenderer.tsx` | 复习界面渲染     | ~200     |

### 修改文件

| 文件                             | 变更内容                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `src/srs/registry/commands.ts`   | 注册 `createDirectionForward` 和 `createDirectionBackward` 命令 |
| `src/srs/registry/shortcuts.ts`  | 绑定 `Ctrl+Alt+.` 和 `Ctrl+Alt+,` 快捷键                        |
| `src/srs/registry/renderers.ts`  | 注册 `direction` inline 渲染器                                  |
| `src/srs/registry/converters.ts` | 注册 direction plain 转换器（导出为 `左边 -> 右边`）            |
| `src/srs/cardCollector.ts`       | `collectReviewCards` 支持方向卡收集                             |
| `src/srs/storage.ts`             | 添加 `loadDirectionSrsState` / `saveDirectionSrsState`          |
| `src/srs/types.ts`               | 添加 `DirectionType` 类型定义                                   |
| `src/components/SrsCardDemo.tsx` | 路由到 `DirectionCardReviewRenderer`                            |
| `src/srs/deckUtils.ts`           | `extractCardType` 支持识别 `direction` 类型                     |

---

## 📝 核心代码设计

### 1. directionUtils.ts

```typescript
/**
 * 方向卡工具模块
 *
 * 职责：
 * - 插入方向标记
 * - 切换方向
 * - 解析方向卡内容
 */

import type { CursorData, Block, ContentFragment } from "../orca.d.ts";
import { BlockWithRepr } from "./blockUtils";
import { writeInitialDirectionSrsState } from "./storage";

export type DirectionType = "forward" | "backward" | "bidirectional";

const DIRECTION_SYMBOLS: Record<DirectionType, string> = {
  forward: "→",
  backward: "←",
  bidirectional: "↔",
};

/**
 * 在光标位置插入方向标记
 *
 * @param cursor - 当前光标位置
 * @param direction - 方向类型
 * @param pluginName - 插件名称
 */
export async function insertDirection(
  cursor: CursorData,
  direction: DirectionType,
  pluginName: string
): Promise<{
  blockId: number;
  originalContent?: ContentFragment[];
} | null> {
  if (!cursor?.anchor?.blockId) {
    orca.notify("error", "无法获取光标位置");
    return null;
  }

  const blockId = cursor.anchor.blockId;
  const block = orca.state.blocks[blockId] as Block;

  if (!block) {
    orca.notify("error", "未找到当前块");
    return null;
  }

  // 检查是否已有方向标记
  const hasDirection = block.content?.some(
    (f) => f.t === `${pluginName}.direction`
  );
  if (hasDirection) {
    orca.notify("warn", "当前块已有方向标记，请点击箭头切换方向");
    return null;
  }

  // 检查是否有 Cloze（暂不支持混用）
  const hasCloze = block.content?.some((f) => f.t === `${pluginName}.cloze`);
  if (hasCloze) {
    orca.notify("warn", "方向卡暂不支持与填空卡混用");
    return null;
  }

  const offset = cursor.anchor.offset;
  const blockText = block.text || "";

  // 验证左右内容不为空
  const leftPart = blockText.substring(0, offset).trim();
  const rightPart = blockText.substring(offset).trim();

  if (!leftPart) {
    orca.notify("warn", "方向标记左侧需要有内容");
    return null;
  }

  if (!rightPart) {
    orca.notify("warn", "方向标记右侧需要有内容");
    return null;
  }

  // 构建新的 content 数组
  const symbol = DIRECTION_SYMBOLS[direction];
  const newContent: ContentFragment[] = [
    { t: "t", v: leftPart + " " },
    {
      t: `${pluginName}.direction`,
      v: symbol,
      direction: direction,
    } as ContentFragment,
    { t: "t", v: " " + rightPart },
  ];

  // 保存原始内容供撤销使用
  const originalContent = block.content ? [...block.content] : undefined;

  try {
    // 更新块内容
    await orca.commands.invokeEditorCommand(
      "core.editor.setBlocksContent",
      cursor,
      [{ id: blockId, content: newContent }],
      false
    );

    // 添加 #card 标签，type=direction
    const hasCardTag = block.refs?.some(
      (ref) => ref.type === 2 && ref.alias === "card"
    );

    if (!hasCardTag) {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        cursor,
        blockId,
        "card",
        [{ name: "type", value: "direction" }]
      );
    } else {
      // 更新已有标签的 type 属性
      const cardRef = block.refs?.find(
        (ref) => ref.type === 2 && ref.alias === "card"
      );
      if (cardRef) {
        await orca.commands.invokeEditorCommand(
          "core.editor.setRefData",
          null,
          cardRef,
          [{ name: "type", value: "direction" }]
        );
      }
    }

    // 设置 _repr
    const finalBlock = orca.state.blocks[blockId] as BlockWithRepr;
    finalBlock._repr = {
      type: "srs.direction-card",
      front: leftPart,
      back: rightPart,
      direction: direction,
    };

    // 设置 srs.isCard 属性
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [blockId],
      [{ name: "srs.isCard", value: true, type: 4 }]
    );

    // 初始化 SRS 状态（分天推送）
    if (direction === "bidirectional") {
      await writeInitialDirectionSrsState(blockId, "forward", 0); // 今天
      await writeInitialDirectionSrsState(blockId, "backward", 1); // 明天
    } else {
      await writeInitialDirectionSrsState(blockId, direction, 0);
    }

    const dirLabel =
      direction === "forward"
        ? "正向"
        : direction === "backward"
        ? "反向"
        : "双向";
    orca.notify("success", `已创建${dirLabel}卡片`, { title: "方向卡" });

    return { blockId, originalContent };
  } catch (error) {
    console.error(`[${pluginName}] 创建方向卡失败:`, error);
    orca.notify("error", `创建方向卡失败: ${error}`);
    return null;
  }
}

/**
 * 切换方向标记（循环：forward → backward → bidirectional → forward）
 */
export function cycleDirection(current: DirectionType): DirectionType {
  const cycle: DirectionType[] = ["forward", "backward", "bidirectional"];
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1) % cycle.length];
}

/**
 * 更新块中的方向标记
 */
export async function updateBlockDirection(
  blockId: number,
  newDirection: DirectionType,
  pluginName: string
): Promise<void> {
  const block = orca.state.blocks[blockId] as Block;
  if (!block?.content) return;

  const newContent = block.content.map((fragment) => {
    if (fragment.t === `${pluginName}.direction`) {
      return {
        ...fragment,
        v: DIRECTION_SYMBOLS[newDirection],
        direction: newDirection,
      };
    }
    return fragment;
  });

  await orca.commands.invokeEditorCommand(
    "core.editor.setBlocksContent",
    null,
    [{ id: blockId, content: newContent }],
    false
  );

  // 如果切换到双向，需要初始化反向卡的 SRS 状态
  if (newDirection === "bidirectional") {
    const hasBackward = block.properties?.some((p) =>
      p.name.startsWith("srs.backward.")
    );
    if (!hasBackward) {
      await writeInitialDirectionSrsState(blockId, "backward", 1);
    }
  }
}

/**
 * 从 content 中提取方向标记信息
 */
export function extractDirectionInfo(
  content: ContentFragment[] | undefined,
  pluginName: string
): {
  direction: DirectionType;
  leftText: string;
  rightText: string;
} | null {
  if (!content || content.length === 0) return null;

  const dirIdx = content.findIndex((f) => f.t === `${pluginName}.direction`);
  if (dirIdx === -1) return null;

  const dirFragment = content[dirIdx] as any;
  const leftParts = content.slice(0, dirIdx);
  const rightParts = content.slice(dirIdx + 1);

  const leftText = leftParts
    .map((f) => f.v || "")
    .join("")
    .trim();
  const rightText = rightParts
    .map((f) => f.v || "")
    .join("")
    .trim();

  return {
    direction: dirFragment.direction || "forward",
    leftText,
    rightText,
  };
}

/**
 * 获取块中的方向类型列表
 *
 * forward/backward 返回 [自身]
 * bidirectional 返回 ["forward", "backward"]
 */
export function getDirectionList(
  direction: DirectionType
): ("forward" | "backward")[] {
  if (direction === "bidirectional") {
    return ["forward", "backward"];
  }
  return [direction as "forward" | "backward"];
}
```

### 2. DirectionInlineRenderer.tsx

```tsx
/**
 * 方向标记 Inline 渲染器
 *
 * 功能：
 * - 显示方向箭头图标
 * - 支持点击切换方向
 */

import type { ContentFragment } from "../orca.d.ts";
import {
  cycleDirection,
  updateBlockDirection,
  DirectionType,
} from "../srs/directionUtils";

const { useRef, useState, useCallback } = window.React;

// 图标类名映射
const DIRECTION_ICONS: Record<DirectionType, string> = {
  forward: "ti ti-arrow-right",
  backward: "ti ti-arrow-left",
  bidirectional: "ti ti-arrows-exchange",
};

// 颜色映射
const DIRECTION_COLORS: Record<DirectionType, string> = {
  forward: "var(--orca-color-primary-5)",
  backward: "var(--orca-color-warning-5)",
  bidirectional: "var(--orca-color-success-5)",
};

interface DirectionInlineRendererProps {
  blockId: string;
  data: ContentFragment;
  index: number;
}

export default function DirectionInlineRenderer({
  blockId,
  data,
  index,
}: DirectionInlineRendererProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const direction = ((data as any).direction || "forward") as DirectionType;
  const [currentDir, setCurrentDir] = useState<DirectionType>(direction);
  const [isUpdating, setIsUpdating] = useState(false);

  // 获取插件名称（从 data.t 中提取）
  const pluginName = (data.t || "").replace(".direction", "");

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isUpdating) return;

      setIsUpdating(true);
      try {
        const newDir = cycleDirection(currentDir);
        setCurrentDir(newDir);

        // 更新块内容
        await updateBlockDirection(Number(blockId), newDir, pluginName);

        const label =
          newDir === "forward"
            ? "正向"
            : newDir === "backward"
            ? "反向"
            : "双向";
        orca.notify("info", `已切换为${label}卡片`);
      } catch (error) {
        console.error("切换方向失败:", error);
        setCurrentDir(direction); // 恢复原状态
      } finally {
        setIsUpdating(false);
      }
    },
    [blockId, currentDir, direction, isUpdating, pluginName]
  );

  return (
    <span
      ref={ref}
      className="orca-inline srs-direction-inline"
      onClick={handleClick}
      style={{
        cursor: isUpdating ? "wait" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        fontSize: "16px",
        margin: "0 4px",
        borderRadius: "4px",
        backgroundColor: "var(--orca-color-bg-2)",
        color: DIRECTION_COLORS[currentDir],
        transition: "all 0.2s ease",
        opacity: isUpdating ? 0.5 : 1,
      }}
      title={`方向卡 (${currentDir}) - 点击切换`}
    >
      <i className={DIRECTION_ICONS[currentDir]} />
    </span>
  );
}
```

### 3. DirectionCardReviewRenderer.tsx

```tsx
/**
 * 方向卡复习渲染器
 *
 * 功能：
 * - 根据复习方向显示问题和答案
 * - 正向：左边是问题，右边是答案
 * - 反向：右边是问题，左边是答案
 */

const { useState, useMemo } = window.React;
const { useSnapshot } = window.Valtio;
const { Button } = orca.components;

import type { DbId } from "../orca.d.ts";
import type { Grade, SrsState } from "../srs/types";
import { extractDirectionInfo } from "../srs/directionUtils";
import { useReviewShortcuts } from "../hooks/useReviewShortcuts";
import { previewIntervals, formatInterval } from "../srs/algorithm";

interface DirectionCardReviewRendererProps {
  blockId: DbId;
  onGrade: (grade: Grade) => Promise<void> | void;
  onClose?: () => void;
  srsInfo?: Partial<SrsState>;
  isGrading?: boolean;
  onJumpToCard?: (blockId: DbId) => void;
  inSidePanel?: boolean;
  panelId?: string;
  pluginName: string;
  reviewDirection: "forward" | "backward"; // 当前复习的方向
}

export default function DirectionCardReviewRenderer({
  blockId,
  onGrade,
  onClose,
  srsInfo,
  isGrading = false,
  onJumpToCard,
  inSidePanel = false,
  panelId,
  pluginName,
  reviewDirection,
}: DirectionCardReviewRendererProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  const snapshot = useSnapshot(orca.state);
  const block = useMemo(() => {
    return snapshot?.blocks?.[blockId];
  }, [snapshot?.blocks, blockId]);

  // 解析方向卡内容
  const dirInfo = useMemo(() => {
    return extractDirectionInfo(block?.content, pluginName);
  }, [block?.content, pluginName]);

  // 处理评分
  const handleGrade = async (grade: Grade) => {
    if (isGrading) return;
    await onGrade(grade);
    setShowAnswer(false);
  };

  // 快捷键支持
  useReviewShortcuts({
    showAnswer,
    isGrading,
    onShowAnswer: () => setShowAnswer(true),
    onGrade: handleGrade,
  });

  // 预览间隔
  const intervals = useMemo(() => {
    const fullState: SrsState | null = srsInfo
      ? {
          stability: srsInfo.stability ?? 0,
          difficulty: srsInfo.difficulty ?? 0,
          interval: srsInfo.interval ?? 0,
          due: srsInfo.due ?? new Date(),
          lastReviewed: srsInfo.lastReviewed ?? null,
          reps: srsInfo.reps ?? 0,
          lapses: srsInfo.lapses ?? 0,
          state: srsInfo.state,
        }
      : null;
    return previewIntervals(fullState);
  }, [srsInfo]);

  if (!dirInfo) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        无法解析方向卡内容
      </div>
    );
  }

  // 根据复习方向决定问题和答案
  const question =
    reviewDirection === "forward" ? dirInfo.leftText : dirInfo.rightText;
  const answer =
    reviewDirection === "forward" ? dirInfo.rightText : dirInfo.leftText;

  const arrowIcon =
    reviewDirection === "forward" ? "ti-arrow-right" : "ti-arrow-left";
  const dirLabel = reviewDirection === "forward" ? "正向" : "反向";

  return (
    <div
      className="srs-direction-card-container"
      style={{
        backgroundColor: "var(--orca-color-bg-1)",
        borderRadius: "12px",
        padding: "16px",
        width: inSidePanel ? "100%" : "90%",
        minWidth: inSidePanel ? "0" : "600px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}
    >
      {/* 卡片类型标识 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: "500",
            color:
              reviewDirection === "forward"
                ? "var(--orca-color-primary-5)"
                : "var(--orca-color-warning-5)",
            backgroundColor:
              reviewDirection === "forward"
                ? "var(--orca-color-primary-1)"
                : "var(--orca-color-warning-1)",
            padding: "4px 10px",
            borderRadius: "6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <i className={`ti ${arrowIcon}`} />
          方向卡 ({dirLabel})
        </div>

        {blockId && onJumpToCard && (
          <Button
            variant="soft"
            onClick={() => onJumpToCard(blockId)}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <i className="ti ti-arrow-right" />
            跳转到卡片
          </Button>
        )}
      </div>

      {/* 题目区域 */}
      <div
        className="srs-direction-question"
        style={{
          marginBottom: "16px",
          padding: "20px",
          backgroundColor: "var(--orca-color-bg-2)",
          borderRadius: "8px",
          minHeight: "100px",
          fontSize: "18px",
          lineHeight: "1.8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
        }}
      >
        {reviewDirection === "forward" ? (
          <>
            <span style={{ fontWeight: 500 }}>{question}</span>
            <i
              className={`ti ${arrowIcon}`}
              style={{
                fontSize: "20px",
                color: "var(--orca-color-primary-5)",
              }}
            />
            {showAnswer ? (
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--orca-color-primary-5)",
                  backgroundColor: "var(--orca-color-primary-1)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                }}
              >
                {answer}
              </span>
            ) : (
              <span
                style={{
                  color: "var(--orca-color-text-2)",
                  backgroundColor: "var(--orca-color-bg-3)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  border: "1px dashed var(--orca-color-border-1)",
                }}
              >
                ❓
              </span>
            )}
          </>
        ) : (
          <>
            {showAnswer ? (
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--orca-color-warning-5)",
                  backgroundColor: "var(--orca-color-warning-1)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                }}
              >
                {answer}
              </span>
            ) : (
              <span
                style={{
                  color: "var(--orca-color-text-2)",
                  backgroundColor: "var(--orca-color-bg-3)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  border: "1px dashed var(--orca-color-border-1)",
                }}
              >
                ❓
              </span>
            )}
            <i
              className={`ti ${arrowIcon}`}
              style={{
                fontSize: "20px",
                color: "var(--orca-color-warning-5)",
              }}
            />
            <span style={{ fontWeight: 500 }}>{question}</span>
          </>
        )}
      </div>

      {/* 显示答案 / 评分按钮 */}
      {!showAnswer ? (
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <Button
            variant="solid"
            onClick={() => setShowAnswer(true)}
            style={{
              padding: "12px 32px",
              fontSize: "16px",
            }}
          >
            显示答案
          </Button>
        </div>
      ) : (
        <div
          className="srs-card-grade-buttons"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginTop: "16px",
          }}
        >
          <Button
            variant="dangerous"
            onClick={() => handleGrade("again")}
            style={{
              padding: "12px 8px",
              fontSize: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {formatInterval(intervals.again)}
            </span>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>忘记</span>
          </Button>

          <Button
            variant="soft"
            onClick={() => handleGrade("hard")}
            style={{
              padding: "12px 8px",
              fontSize: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {formatInterval(intervals.hard)}
            </span>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>困难</span>
          </Button>

          <Button
            variant="solid"
            onClick={() => handleGrade("good")}
            style={{
              padding: "12px 8px",
              fontSize: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {formatInterval(intervals.good)}
            </span>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>良好</span>
          </Button>

          <Button
            variant="solid"
            onClick={() => handleGrade("easy")}
            style={{
              padding: "12px 8px",
              fontSize: "14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "var(--orca-color-primary-5)",
              opacity: 0.9,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {formatInterval(intervals.easy)}
            </span>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>简单</span>
          </Button>
        </div>
      )}

      {/* 提示文本 */}
      <div
        style={{
          marginTop: "16px",
          textAlign: "center",
          fontSize: "12px",
          color: "var(--orca-color-text-2)",
          opacity: 0.7,
        }}
      >
        {!showAnswer ? '点击"显示答案"查看内容' : "根据记忆程度选择评分"}
      </div>
    </div>
  );
}
```

---

## ⚠️ 边界情况处理

| 场景              | 处理方式                                             |
| ----------------- | ---------------------------------------------------- |
| **多个箭头**      | 禁止插入第二个，提示"当前块已有方向标记"             |
| **箭头左侧为空**  | 创建时验证，提示"方向标记左侧需要有内容"             |
| **箭头右侧为空**  | 创建时验证，提示"方向标记右侧需要有内容"             |
| **与 Cloze 混用** | 禁止插入，提示"方向卡暂不支持与填空卡混用"           |
| **删除箭头**      | Backspace 键可删除 inline 元素，需要同时清理标签属性 |
| **切换到双向**    | 自动初始化反向卡的 SRS 状态（明天到期）              |

---

## 📊 storage.ts 扩展

```typescript
// 方向卡 SRS 状态操作

/**
 * 构建方向卡属性名
 */
function buildDirectionPropertyName(
  base: string,
  directionType: "forward" | "backward"
): string {
  return `srs.${directionType}.${base}`;
}

/**
 * 加载方向卡某个方向的 SRS 状态
 */
export async function loadDirectionSrsState(
  blockId: DbId,
  directionType: "forward" | "backward"
): Promise<SrsState> {
  const block = orca.state.blocks[blockId];
  if (!block) {
    return createInitialSrsState();
  }

  const props = block.properties || [];
  const prefix = `srs.${directionType}.`;

  const get = (name: string, defaultVal: any) => {
    const prop = props.find((p) => p.name === prefix + name);
    return prop?.value ?? defaultVal;
  };

  return {
    stability: get("stability", 0),
    difficulty: get("difficulty", 0),
    interval: get("interval", 0),
    due: new Date(get("due", new Date().toISOString())),
    lastReviewed: get("lastReviewed")
      ? new Date(get("lastReviewed", null))
      : null,
    reps: get("reps", 0),
    lapses: get("lapses", 0),
  };
}

/**
 * 保存方向卡某个方向的 SRS 状态
 */
export async function saveDirectionSrsState(
  blockId: DbId,
  directionType: "forward" | "backward",
  state: SrsState
): Promise<void> {
  const prefix = `srs.${directionType}.`;

  const props = [
    { name: prefix + "stability", value: state.stability, type: 3 },
    { name: prefix + "difficulty", value: state.difficulty, type: 3 },
    { name: prefix + "interval", value: state.interval, type: 3 },
    { name: prefix + "due", value: state.due.toISOString(), type: 5 },
    {
      name: prefix + "lastReviewed",
      value: state.lastReviewed?.toISOString() || null,
      type: 5,
    },
    { name: prefix + "reps", value: state.reps, type: 3 },
    { name: prefix + "lapses", value: state.lapses, type: 3 },
  ];

  await orca.commands.invokeEditorCommand(
    "core.editor.setProperties",
    null,
    [blockId],
    props
  );
}

/**
 * 为方向卡写入初始 SRS 状态
 */
export async function writeInitialDirectionSrsState(
  blockId: DbId,
  directionType: "forward" | "backward",
  daysOffset: number = 0
): Promise<SrsState> {
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + daysOffset);
  dueDate.setHours(0, 0, 0, 0);

  const initialState = createInitialSrsState(now);
  initialState.due = dueDate;

  await saveDirectionSrsState(blockId, directionType, initialState);
  return initialState;
}

/**
 * 更新方向卡某个方向的 SRS 状态
 */
export async function updateDirectionSrsState(
  blockId: DbId,
  directionType: "forward" | "backward",
  grade: Grade
): Promise<{ state: SrsState; log: any }> {
  const prevState = await loadDirectionSrsState(blockId, directionType);
  const { state, log } = nextReviewState(prevState, grade);
  await saveDirectionSrsState(blockId, directionType, state);
  return { state, log };
}
```

---

## 📋 cardCollector.ts 扩展

```typescript
// collectReviewCards 中添加 direction 卡处理

if (cardType === "direction") {
  const dirInfo = extractDirectionInfo(block.content, pluginName);
  if (!dirInfo) continue;

  // 获取需要生成卡片的方向列表
  const directions = getDirectionList(dirInfo.direction);

  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i];

    // 检查是否已有该方向的 SRS 属性
    const hasDirectionSrsProps = block.properties?.some((prop) =>
      prop.name.startsWith(`srs.${dir}.`)
    );

    const srsState = hasDirectionSrsProps
      ? await loadDirectionSrsState(block.id, dir)
      : await writeInitialDirectionSrsState(block.id, dir, i); // 分天推送

    // 根据方向决定问题和答案
    const front = dir === "forward" ? dirInfo.leftText : dirInfo.rightText;
    const back = dir === "forward" ? dirInfo.rightText : dirInfo.leftText;

    cards.push({
      id: block.id,
      front,
      back,
      srs: srsState,
      isNew: !srsState.lastReviewed || srsState.reps === 0,
      deck: deckName,
      directionType: dir,
    });
  }
}
```

---

## 🗂️ 完整文件变更清单

### 新增文件（4 个）

| 文件                                             | 说明           |
| ------------------------------------------------ | -------------- |
| `src/srs/directionUtils.ts`                      | 方向卡核心逻辑 |
| `src/components/DirectionInlineRenderer.tsx`     | 编辑器内渲染   |
| `src/components/DirectionCardReviewRenderer.tsx` | 复习界面渲染   |
| `模块文档/SRS_方向卡.md`                         | 本文档         |

### 修改文件（9 个）

| 文件                             | 变更内容                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `src/srs/registry/commands.ts`   | 添加 `createDirectionForward` 和 `createDirectionBackward` 命令 |
| `src/srs/registry/shortcuts.ts`  | 绑定 `Ctrl+Alt+.` 和 `Ctrl+Alt+,`                               |
| `src/srs/registry/renderers.ts`  | 注册 `direction` inline 渲染器                                  |
| `src/srs/registry/converters.ts` | 注册 direction plain 转换器                                     |
| `src/srs/cardCollector.ts`       | 支持收集方向卡                                                  |
| `src/srs/storage.ts`             | 添加方向卡 SRS 状态管理函数                                     |
| `src/srs/types.ts`               | 添加 `DirectionType` 和 `directionType` 字段                    |
| `src/srs/deckUtils.ts`           | `extractCardType` 支持识别 `direction`                          |
| `src/components/SrsCardDemo.tsx` | 路由到 `DirectionCardReviewRenderer`                            |

---

## 📅 实施步骤建议

### Phase 1：基础功能 ✅

1. [x] 创建 `directionUtils.ts` 工具模块
2. [x] 创建 `DirectionInlineRenderer.tsx` 编辑器渲染
3. [x] 注册 inline 渲染器和 plain 转换器
4. [x] 注册工具栏按钮和斜杠命令（注：Orca 暂不支持自定义快捷键）
5. [ ] 测试：创建方向卡、保存、重新加载

### Phase 2：复习功能 ✅

1. [x] 创建 `DirectionCardReviewRenderer.tsx`
2. [x] 修改 `storage.ts` 添加方向卡 SRS 函数
3. [x] 修改 `cardCollector.ts` 支持收集方向卡
4. [x] 修改 `SrsCardDemo.tsx` 路由到方向卡渲染器
5. [ ] 测试：正向/反向卡复习流程

### Phase 3：完善功能 ✅

1. [x] 实现点击切换方向功能
2. [x] 实现双向卡分天推送
3. [x] 添加边界情况处理
4. [x] 更新模块文档

---

**最后更新**：2025-12-11
**当前阶段**：✅ 开发完成，待测试
