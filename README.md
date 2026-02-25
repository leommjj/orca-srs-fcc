# Orca SRS 插件魔改日志

日期：2024年

## 一、递归遍历块树实现

### 核心功能
- 使用递归函数遍历块树，收集所有子块
- 支持任意深度的块树结构

### 实现原理（基于 blockCardCollector.ts:106-133）
```typescript
export async function getAllDescendantIds(blockId: DbId): Promise<DbId[]> {
  const result: DbId[] = []
  const visited = new Set<DbId>()
  
  async function traverse(id: DbId): Promise<void> {
    if (visited.has(id)) return
    visited.add(id)
    
    // 获取块数据
    let block = orca.state.blocks?.[id] as Block | undefined
    if (!block) {
      block = await orca.invokeBackend("get-block", id) as Block | undefined
    }
    
    if (!block?.children || block.children.length === 0) {
      return
    }
    
    // 遍历所有子块
    for (const childId of block.children) {
      result.push(childId)
      await traverse(childId)
    }
  }
  
  await traverse(blockId)
  return result
}
```

### 遍历步骤
1. **初始化**：创建结果数组和已访问集合，避免循环引用
2. **递归函数**：定义内部 `traverse` 函数处理单个块
3. **块数据获取**：优先从缓存 `orca.state.blocks` 获取，不存在则调用后端 API
4. **子块检查**：检查当前块是否有子块
5. **递归遍历**：遍历每个子块，将其 ID 添加到结果数组，然后递归处理该子块
6. **完成返回**：返回所有子块 ID 数组

### 技术特点
- **异步处理**：使用 `async/await` 处理后端 API 调用
- **循环检测**：使用 `Set` 记录已访问块，防止循环引用导致无限递归
- **缓存优先**：优先使用内存中的块数据，减少后端请求
- **任意深度**：递归实现支持任意层级的块树结构

## 二、读取 deck 标签的牌组属性值

### 核心功能
- 从块的标签属性系统中提取牌组名称
- 支持层级牌组结构（aa::BB 格式）
- 自动向上遍历父块链寻找牌组设置

### 实现原理（基于 deckUtils.ts）

#### 1. 主提取函数（extractDeckName:135-159）
```typescript
export async function extractDeckName(block: Block): Promise<string> {
  // 1. 优先检查当前块是否有 #card 标签
  const cardRef = block.refs?.find(ref =>
    ref.type === 2 &&      // RefType.Property（标签引用）
    isCardTag(ref.alias)   // 标签名称为 "card"（大小写不敏感）
  );

  // 2. 如果找到 #card 标签，尝试提取牌组属性
  if (cardRef && cardRef.data && cardRef.data.length > 0) {
    const deckProperty = cardRef.data.find(d => d.name === DECK_PROPERTY_NAME);
    if (deckProperty) {
      const deckValue = deckProperty.value;
      if (deckValue !== undefined && deckValue !== null) {
        const trimmedValue = String(deckValue).trim();
        if (trimmedValue) {
          return trimmedValue;
        }
      }
    }
  }

  // 3. 如果当前块没有有效牌组属性，递归向上遍历父块链检查 #deck 标签
  return await findDeckFromParentChain(block.id)
}
```

#### 2. 父块链遍历（findDeckFromParentChain:168-216）
```typescript
async function findDeckFromParentChain(blockId: DbId, depth: number = 0): Promise<string> {
  const MAX_DEPTH = 20; // 最大递归深度，避免死循环
  if (depth > MAX_DEPTH) {
    return DEFAULT_DECK_NAME;
  }

  try {
    // 1. 获取当前块信息
    let currentBlock = orca.state.blocks?.[blockId];
    if (!currentBlock) {
      currentBlock = await orca.invokeBackend("get-block", blockId) as Block | undefined;
    }
    if (!currentBlock) {
      return DEFAULT_DECK_NAME;
    }

    // 2. 检查当前块是否有父块
    if (!currentBlock.parent) {
      return DEFAULT_DECK_NAME;
    }

    // 3. 获取父块信息
    let parentBlock = orca.state.blocks?.[currentBlock.parent];
    if (!parentBlock) {
      parentBlock = await orca.invokeBackend("get-block", currentBlock.parent) as Block | undefined;
    }
    if (!parentBlock) {
      return DEFAULT_DECK_NAME;
    }

    // 4. 尝试从父块中提取牌组名称
    const deckName = await extractDeckNameFromBlock(parentBlock);
    if (deckName !== DEFAULT_DECK_NAME) {
      return deckName;
    }

    // 5. 如果父块没有有效牌组属性，递归查询父块的父块
    return await findDeckFromParentChain(parentBlock.id, depth + 1);
  } catch (error) {
    return DEFAULT_DECK_NAME;
  }
}
```

#### 3. 单个块牌组提取（extractDeckNameFromBlock:224-273）
```typescript
async function extractDeckNameFromBlock(block: Block): Promise<string> {
  // 边界情况：块没有引用
  if (!block.refs || block.refs.length === 0) {
    return DEFAULT_DECK_NAME;
  }

  // 找到 #deck 标签引用
  const deckRef = block.refs.find(ref =>
    ref.type === 2 &&      // RefType.Property（标签引用）
    isDeckTag(ref.alias)   // 标签名称为 "deck"（大小写不敏感）
  );

  // 边界情况：没有找到 #deck 标签引用
  if (!deckRef) {
    return DEFAULT_DECK_NAME;
  }

  // 边界情况：标签引用没有关联数据
  if (!deckRef.data || deckRef.data.length === 0) {
    return DEFAULT_DECK_NAME;
  }

  // 从标签关联数据中读取"牌组"属性
  const deckProperty = deckRef.data.find(d => d.name === DECK_PROPERTY_NAME);

  // 边界情况：没有设置"牌组"属性
  if (!deckProperty) {
    return DEFAULT_DECK_NAME;
  }

  // 读取属性值作为牌组名称
  const deckValue = deckProperty.value;
  
  // 处理文本值
  if (deckValue !== undefined && deckValue !== null) {
    const trimmedValue = String(deckValue).trim();
    if (trimmedValue) {
      return trimmedValue;
    }
  }

  // 其他情况：返回默认牌组
  return DEFAULT_DECK_NAME;
}
```

### 提取流程
1. **当前块检查**：首先检查当前块是否有 #card 标签及其「牌组」属性
2. **父块链遍历**：如果当前块没有设置牌组属性，自动向上遍历父块链
3. **#deck 标签检查**：在父块链中检查每个父块是否有 #deck 标签的「牌组」属性
4. **属性提取**：从标签的 data 数组中找到 name="牌组" 的属性，读取其 value 值
5. **默认处理**：如果遍历到顶层仍未找到，返回 "Default"

### 技术特点
- **优先级机制**：当前块的 #card 标签属性优先于父块的 #deck 标签
- **递归遍历**：自动向上遍历父块链，简化用户操作
- **错误处理**：包含完善的边界情况处理和错误捕获
- **层级支持**：支持 aa::BB 格式的层级牌组结构
- **缓存优化**：使用 deckNameCache 缓存牌组名称，减少重复请求

## 三、主要修改内容

### 1. Cloze 卡片复习界面优化
- **修改文件**：ClozeCardReviewRenderer.tsx
- **核心修改**：使用 Block 组件替代 renderFragments，实现原生块显示
- **技术要点**：
  - 使用 `<Block>` 组件渲染卡片内容，保留原生块样式和功能
  - 添加遮罩逻辑，只隐藏当前编号的挖空部分
  - 点击显示答案后，挖空文本显示为蓝色
  - 移除样式应用延迟，确保即时显示

### 2. 递归遍历功能增强
- **修改文件**：blockCardCollector.ts
- **核心修改**：实现 getAllDescendantIds 函数，支持任意深度的块树遍历
- **技术要点**：
  - 异步递归函数设计
  - 循环检测机制
  - 缓存优先的数据获取策略

### 3. 牌组提取逻辑重构
- **修改文件**：deckUtils.ts
- **核心修改**：重新设计牌组提取逻辑，支持标签属性系统
- **技术要点**：
  - 基于 #card 标签的「牌组」属性
  - 自动向上遍历父块链寻找 #deck 标签设置
  - 支持层级牌组结构
  - 完善的边界情况处理

### 4. 卡片类型提取优化
- **修改文件**：deckUtils.ts
- **核心修改**：优化 extractCardType 函数，支持多种卡片类型
- **技术要点**：
  - 支持 basic、cloze、direction、excerpt、choice、list 等多种卡片类型
  - 基于标签属性系统的类型识别
  - 选择题卡片优先处理

### 5. 性能优化
- **缓存机制**：添加 deckNameCache 缓存牌组名称
- **异步处理**：优化异步操作，减少后端请求
- **错误处理**：增强错误捕获和边界情况处理

## 四、用户操作流程

### 牌组设置流程
1. **方式一：直接设置（推荐）**
   - 在块上添加 #card 标签
   - 在标签属性中设置「牌组」字段值
   - 支持输入 aa::BB 格式创建层级牌组

2. **方式二：继承设置**
   - 在父块上添加 #deck 标签
   - 在标签属性中设置「牌组」字段值
   - 子块会自动继承父块的牌组设置

### 卡片类型设置
1. **Cloze 卡片**：使用 cloze 按钮创建，自动设置类型为 "cloze"
2. **Direction 卡片**：使用 direction 按钮创建，自动设置类型为 "direction"
3. **Basic 卡片**：默认类型，可在 #card 标签属性中手动设置
4. **Excerpt 卡片**：在 #card 标签属性中设置类型为 "excerpt"
5. **List 卡片**：在 #card 标签属性中设置类型为 "list"
6. **Choice 卡片**：添加 #choice 标签自动创建

## 五、技术架构

### 核心模块
- **blockCardCollector.ts**：块卡片收集，包含递归遍历实现
- **deckUtils.ts**：牌组管理，包含牌组提取逻辑
- **ClozeCardReviewRenderer.tsx**：Cloze 卡片复习渲染
- **blockUtils.ts**：块操作工具函数
- **cardStatusUtils.ts**：卡片状态管理
- **clozeUtils.ts**：Cloze 卡片工具函数
- **directionUtils.ts**：Direction 卡片工具函数
- **tagUtils.ts**：标签处理工具函数

### 数据流
1. **块数据获取**：从 orca.state.blocks 或后端 API 获取
2. **卡片识别**：检测 #card 标签和卡片类型
3. **牌组提取**：从标签属性或父块链提取牌组信息
4. **卡片转换**：将块转换为 ReviewCard 对象
5. **复习渲染**：使用对应的渲染器显示卡片

## 六、总结

本次魔改实现了以下核心功能：

1. **递归遍历块树**：支持任意深度的块树结构遍历，为卡片收集提供基础
2. **智能牌组提取**：基于标签属性系统的牌组提取，支持层级结构和继承机制
3. **原生块显示**：Cloze 卡片使用 Block 组件原生渲染，保留完整的块功能
4. **优化的复习体验**：即时的答案显示和蓝色高亮效果
5. **完善的错误处理**：包含多种边界情况的处理和错误捕获

这些修改显著提升了 Orca SRS 插件的用户体验和功能完整性，使其更加符合用户的使用习惯和需求。

## 七、Cloze 填空双击编辑功能（2026-02-24）

### 核心功能
- **双击编辑**：在编辑器中双击 `{cN::}` 格式的填空内容，弹出修改弹窗
- **序号修改**：支持修改填空编号（N）
- **内容修改**：支持修改填空内容文本
- **实时更新**：保存后即时更新编辑器中的显示

### 实现原理（基于 ClozeInlineRenderer.tsx）

#### 1. 状态管理（ClozeInlineRenderer:36-38）
```typescript
const [showModal, setShowModal] = useState(false)
const [editNumber, setEditNumber] = useState<number>((data as any).clozeNumber || 1)
const [editText, setEditText] = useState<string>(data.v || "")
```

#### 2. 双击事件处理（ClozeInlineRenderer:44-49）
```typescript
const handleDoubleClick = () => {
  setEditNumber(clozeNumber)
  setEditText(clozeText)
  setShowModal(true)
}
```

#### 3. 模态弹窗组件（ClozeInlineRenderer:67-173）
- **序号输入**：数字输入框，最小值为 1
- **内容输入**：文本输入框，用于修改填空内容
- **保存按钮**：应用修改并关闭弹窗
- **取消按钮**：放弃修改并关闭弹窗

#### 4. 保存功能实现（ClozeInlineRenderer:120-175）
```typescript
onClick={async () => {
  try {
    // 获取当前块
    const block = (window as any).orca?.state?.blocks?.[blockId]
    if (!block || !block.content) {
      console.error('无法获取块信息')
      return
    }

    // 构建新的内容数组，更新指定索引的 cloze fragment
    const newContent = [...block.content]
    const fragment = newContent[index]
    
    if (fragment && fragment.t.includes('.cloze')) {
      // 更新 clozeNumber 和内容
      (fragment as any).clozeNumber = editNumber
      fragment.v = editText

      // 使用 setBlocksContent 更新块内容
      await (window as any).orca?.commands?.invokeEditorCommand(
        "core.editor.setBlocksContent",
        null, // cursor 参数可以为 null
        [
          {
            id: blockId,
            content: newContent
          }
        ],
        false
      )

      console.log('填空已更新:', { number: editNumber, text: editText })
    }
  } catch (error) {
    console.error('更新填空失败:', error)
  } finally {
    setShowModal(false)
  }
}}
```

### 使用方式
1. **触发编辑**：在编辑器中双击 `{cN::内容}` 格式的填空
2. **修改内容**：
   - 在「序号」输入框中修改填空编号
   - 在「填空内容」输入框中修改填空文本
3. **保存修改**：点击「保存」按钮应用修改
4. **放弃修改**：点击「取消」按钮或关闭弹窗

### 技术特点
- **用户友好**：双击操作符合直觉，弹窗界面简洁清晰
- **实时反馈**：保存后即时更新编辑器显示，无需刷新
- **错误处理**：包含完善的错误捕获和边界情况处理
- **模态设计**：使用模态弹窗确保操作的专注性
- **响应式布局**：弹窗自适应不同屏幕尺寸

### 显示效果
- **编辑前**：显示为 `{c1::填空内容}` 格式
- **编辑中**：弹出包含序号和内容输入框的模态窗口
- **编辑后**：即时更新为修改后的 `{cN::新内容}` 格式

此功能极大提升了 Cloze 填空卡片的编辑体验，用户可以直接在编辑器中修改填空内容和编号，而无需删除重建。

## 八、显示优化与修复（2026-02-24）

### 核心修改
- **编辑器内显示优化**：修改 `ClozeInlineRenderer.tsx`，只显示填空内容本身，不再显示 `{cN::}` 格式
- **复习界面元素显示修复**：在 `ClozeCardReviewRenderer.tsx` 中添加样式移除代码，解决 `.orca-repr-main-none-editable` 和 `.orca-block-handle` 元素被隐藏的问题
- **布局限制移除**：移除 `ClozeCardReviewRenderer.tsx` 中的 `overflow: hidden` 样式，允许内容自由显示

### 实现原理

#### 1. 编辑器内显示优化（ClozeInlineRenderer:66）
```typescript
// 修改前
{`{c${clozeNumber}::${clozeText}}`}

// 修改后  
{clozeText}
```

#### 2. 复习界面元素显示修复（ClozeCardReviewRenderer:180-230）
- 添加专用 `useEffect` 钩子，在组件挂载时移除 `display: none` 样式
- 同时移除 `visibility` 和 `opacity` 相关的隐藏样式
- 使用多重执行保障（立即执行 + requestAnimationFrame + setTimeout）确保样式移除生效

#### 3. 布局限制移除（ClozeCardReviewRenderer:612-615）
```typescript
// 修改前
style={{
  border: "1px solid var(--orca-color-border-1)",
  borderRadius: "8px",
  overflow: "hidden"
}}

// 修改后
style={{
  border: "1px solid var(--orca-color-border-1)",
  borderRadius: "8px"
}}
```

### 显示效果对比

#### 编辑器内显示
- **修改前**：`{c1::北京}`
- **修改后**：`北京`（仅显示填空内容，保持浅灰色 + 蓝色下划线样式）

#### 复习界面
- **修复前**：块折叠手柄和操作按钮被隐藏
- **修复后**：块折叠手柄和操作按钮正常显示
- **布局优化**：内容不再被 `overflow: hidden` 限制，显示更加自然

### 技术特点
- **简洁显示**：编辑器内只显示填空内容，减少视觉干扰
- **完整功能**：保持双击修改功能的同时优化显示效果
- **兼容性**：修复不影响其他功能的正常使用
- **用户体验**：复习界面元素完整显示，提升操作便利性

这些修改使 Cloze 填空卡片的显示效果更加简洁美观，同时确保了复习界面的完整功能。

## 九、清除挖空格式功能（2026-02-24）

### 核心功能
- **添加清除挖空格式命令**：将 `{cN::}` 格式的挖空转换回普通文本
- **工具栏按钮**：添加 "清除挖空格式" 按钮，使用橡皮擦图标
- **智能检测**：自动检测是否有需要清除的挖空格式
- **用户反馈**：操作成功或失败时显示相应的通知

### 实现原理

#### 1. 核心功能实现（clozeUtils.ts:356-442）
```typescript
export async function clearClozeFormat(
  cursor: CursorData,
  pluginName: string
): Promise<{ 
  blockId: number
} | null> {
  // 验证光标数据
  if (!cursor || !cursor.anchor || !cursor.anchor.blockId) {
    orca.notify("error", "无法获取光标位置")
    return null
  }

  const blockId = cursor.anchor.blockId
  const block = orca.state.blocks[blockId] as Block

  // 构建新的 content 数组，将 cloze fragment 转换为普通文本
  const newContent: ContentFragment[] = []
  
  block.content.forEach((fragment, index) => {
    // 检查是否是 cloze fragment
    if (fragment.t === `${pluginName}.cloze` || (typeof fragment.t === "string" && fragment.t.endsWith(".cloze"))) {
      // 转换为普通文本 fragment
      newContent.push({
        t: "t",
        v: fragment.v || ""
      })
    } else {
      // 保持原有 fragment
      newContent.push(fragment)
    }
  })

  // 使用 setBlocksContent 更新块内容
  await orca.commands.invokeEditorCommand(
    "core.editor.setBlocksContent",
    cursor,
    [
      {
        id: blockId,
        content: newContent
      }
    ],
    false
  )

  return { blockId }
}
```

#### 2. 命令注册（commands.ts:96-117）
- 命令 ID: `${pluginName}.clearClozeFormat`
- 支持 do/undo 操作
- 智能检测是否有需要清除的挖空格式

#### 3. 工具栏按钮注册（uiComponents.tsx:67-72）
```typescript
orca.toolbar.registerToolbarButton(`${pluginName}.clearClozeButton`, {
  icon: "ti ti-eraser",
  tooltip: "清除挖空格式",
  command: `${pluginName}.clearClozeFormat`
})
```

### 使用方式
1. 在编辑器中点击工具栏上的橡皮擦图标按钮
2. 插件会自动将当前块中的所有 `{cN::}` 格式的挖空转换为普通文本
3. 操作完成后会显示成功通知

### 技术特点
- **完整功能**：支持 do/undo 操作，确保操作的可逆性
- **智能检测**：自动检测是否有需要清除的挖空格式，避免无效操作
- **用户友好**：操作简单直观，通过工具栏按钮一键完成
- **兼容性**：与现有 Cloze 填空功能完美集成

### 显示效果
- **操作前**：`北京`（浅灰色 + 蓝色下划线，实际为 `{c1::北京}` 格式）
- **操作后**：`北京`（普通文本，无特殊样式）

此功能为用户提供了便捷的挖空格式清除方式，使填空卡的编辑更加灵活。

## 十、创建同序 Cloze 填空功能（2026-02-24）

### 核心功能
- **添加创建同序挖空命令**：使用当前最大的序号，添加同序挖空，不递增序号
- **工具栏按钮**：添加 "创建同序 Cloze 填空" 按钮，使用代码点图标
- **智能序号检测**：自动检测当前块中的最大 cloze 编号
- **用户反馈**：操作成功或失败时显示相应的通知

### 实现原理

#### 1. 核心功能实现（clozeUtils.ts:363-552）
```typescript
export async function createClozeSameNumber(
  cursor: CursorData,
  pluginName: string
): Promise<{ 
  blockId: number
  clozeNumber: number
} | null> {
  // 验证光标数据和选区
  // ... 验证代码 ...

  // 从 block.content 中获取当前最大的 cloze 编号，如果没有则使用 1
  const maxClozeNumber = getMaxClozeNumberFromContent(block.content, pluginName)
  const clozeNumber = maxClozeNumber > 0 ? maxClozeNumber : 1

  // 构建新的 content 数组，插入 cloze fragment
  const newContent = buildNewContent(
    block.content,
    cursor,
    selectedText,
    clozeNumber,
    pluginName
  )

  // 使用 setBlocksContent 更新块内容
  // ... 更新代码 ...

  // 处理 #card 标签和复习队列
  // ... 处理代码 ...

  return { blockId, clozeNumber }
}
```

#### 2. 命令注册（commands.ts:119-141）
- 命令 ID: `${pluginName}.createClozeSameNumber`
- 支持 do/undo 操作
- 智能序号检测和处理

#### 3. 工具栏按钮注册（uiComponents.tsx:61-66）
```typescript
// 创建同序挖空按钮
orca.toolbar.registerToolbarButton(`${pluginName}.clozeSameNumberButton`, {
  icon: "ti ti-code-dots",
  tooltip: "创建同序 Cloze 填空",
  command: `${pluginName}.createClozeSameNumber`
})

// 创建异序挖空按钮
orca.toolbar.registerToolbarButton(`${pluginName}.clozeButton`, {
  icon: "ti ti-code-plus",
  tooltip: "创建 Cloze 填空",
  command: `${pluginName}.createCloze`
})
```

### 使用方式
1. 在编辑器中选择要作为填空的文本
2. 点击工具栏上的代码点图标按钮（创建同序挖空）
3. 插件会自动使用当前最大的序号创建挖空，不递增序号
4. 操作完成后会显示成功通知

### 技术特点
- **完整功能**：支持 do/undo 操作，确保操作的可逆性
- **智能序号检测**：自动检测当前块中的最大 cloze 编号，无需用户手动指定
- **用户友好**：操作简单直观，通过工具栏按钮一键完成
- **兼容性**：与现有 Cloze 填空功能完美集成

### 图标设置
- **同序挖空按钮**：`ti ti-code-dots`（代码点图标）
- **异序挖空按钮**：`ti ti-code-plus`（代码加号图标）
- **清除挖空按钮**：`ti ti-eraser`（橡皮擦图标）

### 功能对比

| 功能 | 图标 | 序号处理 | 适用场景 |
|------|------|----------|----------|
| 创建同序挖空 | `ti ti-code-dots` | 使用当前最大序号，不递增 | 需要多个挖空使用相同序号的场景 |
| 创建异序挖空 | `ti ti-code-plus` | 自动递增序号 | 常规挖空创建，序号依次递增 |
| 清除挖空格式 | `ti ti-eraser` | - | 将挖空转换回普通文本 |

此功能为用户提供了创建同序挖空的便捷方式，适用于需要多个挖空使用相同序号的场景，如多选题、同义词替换等。

## 十一、BASIC 卡片样式修复（2026-02-24）

### 核心功能
- **修复 BASIC 卡片隐藏元素**：解决 BASIC 卡片中 `.orca-repr-main-none-editable` 和 `.orca-block-handle` 元素被隐藏的问题
- **保持元素可见**：确保块折叠手柄和操作按钮正常显示
- **实时样式移除**：使用 MutationObserver 监听 DOM 变化，自动移除隐藏样式

### 实现原理（基于 SrsCardDemo.tsx）

#### 1. 样式移除函数（QuestionBlock 组件）
```typescript
const removeDisplayNoneStyles = () => {
  // 移除 .orca-repr-main-none-editable 的 display: none 样式
  const noneEditableElements = container.querySelectorAll('.orca-repr-main-none-editable');
  noneEditableElements.forEach((element: Element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.display = '';
    // 同时移除可能的其他隐藏样式
    htmlElement.style.visibility = '';
    htmlElement.style.opacity = '';
  });

  // 移除 .orca-block-handle 的 display: none 样式
  const blockHandles = container.querySelectorAll('.orca-block-handle');
  blockHandles.forEach((element: Element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.display = '';
    // 同时移除可能的其他隐藏样式
    htmlElement.style.visibility = '';
    htmlElement.style.opacity = '';
  });

  // 移除 .orca-block-folding-handle 的 display: none 样式
  const foldingHandles = container.querySelectorAll('.orca-block-folding-handle');
  foldingHandles.forEach((element: Element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.style.display = '';
    // 同时移除可能的其他隐藏样式
    htmlElement.style.visibility = '';
    htmlElement.style.opacity = '';
  });
};
```

#### 2. MutationObserver 监听（QuestionBlock 组件）
- **初始执行**：组件挂载时立即执行样式移除
- **DOM 变化监听**：当有新节点添加时，检查并移除隐藏样式
- **多重执行保障**：使用 `requestAnimationFrame` 和 `setTimeout` 确保样式移除生效

### 技术特点
- **全面覆盖**：同时处理 `.orca-repr-main-none-editable`、`.orca-block-handle` 和 `.orca-block-folding-handle` 元素
- **实时响应**：使用 MutationObserver 确保 DOM 变化时及时处理
- **多重保障**：通过多种方式确保样式移除代码能够执行
- **兼容性**：不影响其他功能的正常使用

### 显示效果
- **修复前**：BASIC 卡片中的块折叠手柄和操作按钮被隐藏
- **修复后**：BASIC 卡片中的所有元素正常显示，包括块折叠手柄和操作按钮

此修复确保了 BASIC 卡片在复习界面中的元素完整性，提升了用户体验。

## 十二、卡片样式统一（2026-02-25）

### 核心功能
- **样式统一**：统一 BASIC 卡片和 Cloze 卡片的视觉样式
- **面包屑导航位置调整**：将面包屑导航从题目区域内部移到卡片容器内部、题目区域外部
- **重复导航移除**：移除 QuestionBlock 组件内部的面包屑导航，避免重复显示
- **保持类名独立**：Cloze 卡片使用 `srs-cloze-card-container` 类名，BASIC 卡片使用 `srs-card-container` 类名

### 实现原理

#### 1. Cloze 卡片样式调整（ClozeCardReviewRenderer.tsx）
- 恢复类名为 `srs-cloze-card-container`
- 应用与 BASIC 卡片相同的题目区域样式：
  - `marginBottom: "16px"`
  - `padding: "20px"`
  - `backgroundColor: "var(--orca-color-bg-2)"`
  - `borderRadius: "8px"`
  - `minHeight: "80px"`

#### 2. BASIC 卡片面包屑导航调整（SrsCardDemo.tsx）
- 在卡片容器内部、题目区域外部添加面包屑导航
- 移除 QuestionBlock 组件内部的面包屑导航
- 移除摘录卡内部的面包屑导航，避免重复显示

#### 3. 样式统一
- 卡片容器样式：边框、阴影、内边距等保持一致
- 题目区域样式：背景色、内边距、圆角等保持一致
- 工具栏和操作按钮样式保持一致
- 面包屑导航位置和样式保持一致

### 技术特点
- **保持类名独立**：保留了各自的类名，便于后续维护
- **视觉统一**：提供了一致的用户体验
- **避免重复**：移除了重复的面包屑导航显示
- **兼容性**：修改不影响其他功能的正常使用

### 显示效果
- **BASIC 卡片**：面包屑导航位于卡片容器内部、题目区域外部
- **Cloze 卡片**：面包屑导航位置与 BASIC 卡片保持一致，样式统一
- **整体效果**：两种卡片类型在视觉上完全统一，提供了一致的用户体验

此修改确保了 BASIC 卡片和 Cloze 卡片在样式和布局上的一致性，提升了用户体验的连贯性。