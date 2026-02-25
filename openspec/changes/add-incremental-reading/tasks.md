## 1. Implementation
- [ ] 1.1 新增渐进阅读存储模块（`ir.priority/lastRead/readCount/due`）
- [ ] 1.2 新增调度算法模块（优先级 → 间隔映射）
- [ ] 1.3 新增渐进阅读收集器与队列构建（独立于 SRS）
- [ ] 1.4 新增阅读面板渲染器与会话 UI（原生块编辑、面包屑、操作区）
- [ ] 1.5 新增面包屑组件（向上查找 Topic，限制深度）
- [ ] 1.6 注册渲染器、命令与 UI 入口
- [ ] 1.7 autoMark 增强：初始化 `ir.*` 状态
- [ ] 1.8 文档更新（模块文档、README、CHANGELOG）

## 2. Tests
- [ ] 2.1 调度映射与 `calculateNextDue` 单元测试
- [ ] 2.2 `collectIRCards` 过滤与到期判定测试
- [ ] 2.3 `buildIRQueue` 2:1 混合策略测试

## 3. Validation
- [ ] 3.1 手动验证阅读面板与操作流程
- [ ] 3.2 对照验收标准完成自检记录
