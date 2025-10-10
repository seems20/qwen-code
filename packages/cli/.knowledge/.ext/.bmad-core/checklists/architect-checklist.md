<!-- Powered by BMAD™ Core -->

# 架构师解决方案验证 Checklist

这个 checklist 是架构师在开发执行前验证技术设计和架构的完整框架。架构师应该系统性地过每个项目，确保架构健壮、可扩展、安全，并与产品需求保持一致。

[[LLM: 初始化指令 - 必需工件

在用这个 checklist 之前，确保你能访问：

1. architecture.md - 主要架构文档 (检查 docs/architecture.md)
2. prd.md - 产品需求文档，用于需求对齐 (检查 docs/prd.md)
3. frontend-architecture.md 或 fe-architecture.md - 如果这是 UI 项目 (检查 docs/frontend-architecture.md)
4. 架构中引用的任何系统图表
5. API 文档 (如果有)
6. 技术栈详情和版本规范

重要：如果任何必需文档缺失或无法访问，立即问用户它们的位置或内容，然后再继续。

项目类型检测：
先通过检查确定项目类型：

- 架构是否包含前端/UI 组件？
- 是否有 frontend-architecture.md 文档？
- PRD 是否提到用户界面或前端需求？

如果这是纯后端或纯服务项目：

- 跳过标记为 [[FRONTEND ONLY]] 的部分
- 额外关注 API 设计、服务架构和集成模式
- 在最终报告里注明由于项目类型跳过了前端部分

验证方法：
对于每个部分，你必须：

1. 深度分析 - 别只是打勾，要对照提供的文档彻底分析每个项目
2. 基于证据 - 验证时引用文档中的具体部分或引用
3. 批判性思维 - 质疑假设并识别缺口，不只是确认存在的内容
4. 风险评估 - 考虑每个架构决策可能出现的问题

执行模式：
问用户想怎么搞 checklist：

- 逐部分 (交互模式) - 审查每个部分，展示发现，在继续前获得确认
- 一次性 (全面模式) - 完成完整分析并在最后展示综合报告]]

## 1. 需求对齐

[[LLM: 在评估这个部分之前，花点时间从 PRD 中完全理解产品的目的和目标。要解决的核心问题是什么？用户是谁？关键成功因素是什么？在验证对齐时记住这些。对于每个项目，别只是检查是否提到 - 要验证架构提供了具体的技术解决方案。]]

### 1.1 功能需求覆盖

- [ ] 架构支持 PRD 中的所有功能需求
- [ ] 所有 epic 和 story 的技术方法都已解决
- [ ] 考虑了边界情况和性能场景
- [ ] 所有必需的集成都已考虑
- [ ] 用户旅程得到技术架构支持

### 1.2 非功能需求对齐

- [ ] 性能需求有具体解决方案
- [ ] 可扩展性考虑有文档记录和方法
- [ ] 安全需求有相应的技术控制
- [ ] 可靠性和弹性方法已定义
- [ ] 合规需求有技术实现

### 1.3 技术约束遵循

- [ ] PRD 中的所有技术约束都得到满足
- [ ] 遵循平台/语言要求
- [ ] 适应基础设施约束
- [ ] 解决第三方服务约束
- [ ] 遵循组织技术标准

## 2. 架构基础

[[LLM: 架构清晰度对成功实现至关重要。在审查这个部分时，想象你在向新开发者解释系统。是否有任何可能导致误解的歧义？AI 代理能否在没有困惑的情况下实现这个架构？寻找具体的图表、组件定义和清晰的交互模式。]]

### 2.1 架构清晰度

- [ ] 架构用清晰的图表记录
- [ ] 主要组件及其职责已定义
- [ ] 组件交互和依赖关系已映射
- [ ] 数据流清晰说明
- [ ] 每个组件的技术选择已指定

### 2.2 关注点分离

- [ ] UI、业务逻辑和数据层之间有清晰边界
- [ ] 组件间职责清晰划分
- [ ] 组件间接口定义良好
- [ ] 组件遵循单一职责原则
- [ ] 横切关注点 (日志、认证等) 得到适当处理

### 2.3 设计模式和最佳实践

- [ ] 采用适当的设计模式
- [ ] 遵循行业最佳实践
- [ ] 避免反模式
- [ ] 整个架构风格一致
- [ ] 模式使用有文档记录和解释

### 2.4 模块化和可维护性

- [ ] 系统分为内聚、松耦合的模块
- [ ] 组件可以独立开发和测试
- [ ] 变更可以本地化到特定组件
- [ ] 代码组织促进可发现性
- [ ] 架构专门为 AI 代理实现设计

## 3. 技术栈和决策

[[LLM: 技术选择有长期影响。对于每个技术决策，考虑：这是能工作的最简单解决方案吗？我们过度工程了吗？这会扩展吗？维护影响是什么？所选版本有安全漏洞吗？验证具体版本已定义，不是范围。]]

### 3.1 技术选择

- [ ] 所选技术满足所有需求
- [ ] 技术版本具体定义 (不是范围)
- [ ] 技术选择有清晰理由证明
- [ ] 考虑的替代方案有优缺点文档
- [ ] 所选栈组件配合良好

### 3.2 前端架构 [[FRONTEND ONLY]]

[[LLM: 如果这是纯后端或纯服务项目，跳过整个部分。只有在项目包含用户界面时才评估。]]

- [ ] UI 框架和库具体选择
- [ ] 状态管理方法已定义
- [ ] 组件结构和组织已指定
- [ ] 响应式/自适应设计方法已概述
- [ ] 构建和打包策略已确定

### 3.3 后端架构

- [ ] API 设计和标准已定义
- [ ] 服务组织和边界清晰
- [ ] 认证和授权方法已指定
- [ ] 错误处理策略已概述
- [ ] 后端扩展方法已定义

### 3.4 数据架构

- [ ] 数据模型完全定义
- [ ] 数据库技术有理由选择
- [ ] 数据访问模式已文档化
- [ ] 数据迁移/种子方法已指定
- [ ] 数据备份和恢复策略已概述

## 4. 前端设计和实现 [[FRONTEND ONLY]]

[[LLM: 对于纯后端项目，应该跳过整个部分。只有在项目包含用户界面时才评估。评估时，确保主架构文档和前端特定架构文档之间的一致性。]]

### 4.1 前端理念和模式

- [ ] 框架和核心库与主架构文档一致
- [ ] 组件架构 (如原子设计) 清晰描述
- [ ] 状态管理策略适合应用复杂度
- [ ] 数据流模式一致且清晰
- [ ] 样式方法已定义且工具已指定

### 4.2 前端结构和组织

- [ ] 目录结构用 ASCII 图表清晰文档化
- [ ] 组件组织遵循既定模式
- [ ] 文件命名约定明确
- [ ] 结构支持所选框架的最佳实践
- [ ] 新组件放置位置的清晰指导

### 4.3 Component Design

- [ ] Component template/specification format is defined
- [ ] Component props, state, and events are well-documented
- [ ] Shared/foundational components are identified
- [ ] Component reusability patterns are established
- [ ] Accessibility requirements are built into component design

### 4.4 Frontend-Backend Integration

- [ ] API interaction layer is clearly defined
- [ ] HTTP client setup and configuration documented
- [ ] Error handling for API calls is comprehensive
- [ ] Service definitions follow consistent patterns
- [ ] Authentication integration with backend is clear

### 4.5 Routing & Navigation

- [ ] Routing strategy and library are specified
- [ ] Route definitions table is comprehensive
- [ ] Route protection mechanisms are defined
- [ ] Deep linking considerations addressed
- [ ] Navigation patterns are consistent

### 4.6 Frontend Performance

- [ ] Image optimization strategies defined
- [ ] Code splitting approach documented
- [ ] Lazy loading patterns established
- [ ] Re-render optimization techniques specified
- [ ] Performance monitoring approach defined

## 5. RESILIENCE & OPERATIONAL READINESS

[[LLM: Production systems fail in unexpected ways. As you review this section, think about Murphy's Law - what could go wrong? Consider real-world scenarios: What happens during peak load? How does the system behave when a critical service is down? Can the operations team diagnose issues at 3 AM? Look for specific resilience patterns, not just mentions of "error handling".]]

### 5.1 Error Handling & Resilience

- [ ] Error handling strategy is comprehensive
- [ ] Retry policies are defined where appropriate
- [ ] Circuit breakers or fallbacks are specified for critical services
- [ ] Graceful degradation approaches are defined
- [ ] System can recover from partial failures

### 5.2 Monitoring & Observability

- [ ] Logging strategy is defined
- [ ] Monitoring approach is specified
- [ ] Key metrics for system health are identified
- [ ] Alerting thresholds and strategies are outlined
- [ ] Debugging and troubleshooting capabilities are built in

### 5.3 Performance & Scaling

- [ ] Performance bottlenecks are identified and addressed
- [ ] Caching strategy is defined where appropriate
- [ ] Load balancing approach is specified
- [ ] Horizontal and vertical scaling strategies are outlined
- [ ] Resource sizing recommendations are provided

### 5.4 Deployment & DevOps

- [ ] Deployment strategy is defined
- [ ] CI/CD pipeline approach is outlined
- [ ] Environment strategy (dev, staging, prod) is specified
- [ ] Infrastructure as Code approach is defined
- [ ] Rollback and recovery procedures are outlined

## 6. SECURITY & COMPLIANCE

[[LLM: Security is not optional. Review this section with a hacker's mindset - how could someone exploit this system? Also consider compliance: Are there industry-specific regulations that apply? GDPR? HIPAA? PCI? Ensure the architecture addresses these proactively. Look for specific security controls, not just general statements.]]

### 6.1 Authentication & Authorization

- [ ] Authentication mechanism is clearly defined
- [ ] Authorization model is specified
- [ ] Role-based access control is outlined if required
- [ ] Session management approach is defined
- [ ] Credential management is addressed

### 6.2 Data Security

- [ ] Data encryption approach (at rest and in transit) is specified
- [ ] Sensitive data handling procedures are defined
- [ ] Data retention and purging policies are outlined
- [ ] Backup encryption is addressed if required
- [ ] Data access audit trails are specified if required

### 6.3 API & Service Security

- [ ] API security controls are defined
- [ ] Rate limiting and throttling approaches are specified
- [ ] Input validation strategy is outlined
- [ ] CSRF/XSS prevention measures are addressed
- [ ] Secure communication protocols are specified

### 6.4 Infrastructure Security

- [ ] Network security design is outlined
- [ ] Firewall and security group configurations are specified
- [ ] Service isolation approach is defined
- [ ] Least privilege principle is applied
- [ ] Security monitoring strategy is outlined

## 7. IMPLEMENTATION GUIDANCE

[[LLM: Clear implementation guidance prevents costly mistakes. As you review this section, imagine you're a developer starting on day one. Do they have everything they need to be productive? Are coding standards clear enough to maintain consistency across the team? Look for specific examples and patterns.]]

### 7.1 Coding Standards & Practices

- [ ] Coding standards are defined
- [ ] Documentation requirements are specified
- [ ] Testing expectations are outlined
- [ ] Code organization principles are defined
- [ ] Naming conventions are specified

### 7.2 Testing Strategy

- [ ] Unit testing approach is defined
- [ ] Integration testing strategy is outlined
- [ ] E2E testing approach is specified
- [ ] Performance testing requirements are outlined
- [ ] Security testing approach is defined

### 7.3 Frontend Testing [[FRONTEND ONLY]]

[[LLM: Skip this subsection for backend-only projects.]]

- [ ] Component testing scope and tools defined
- [ ] UI integration testing approach specified
- [ ] Visual regression testing considered
- [ ] Accessibility testing tools identified
- [ ] Frontend-specific test data management addressed

### 7.4 Development Environment

- [ ] Local development environment setup is documented
- [ ] Required tools and configurations are specified
- [ ] Development workflows are outlined
- [ ] Source control practices are defined
- [ ] Dependency management approach is specified

### 7.5 Technical Documentation

- [ ] API documentation standards are defined
- [ ] Architecture documentation requirements are specified
- [ ] Code documentation expectations are outlined
- [ ] System diagrams and visualizations are included
- [ ] Decision records for key choices are included

## 8. DEPENDENCY & INTEGRATION MANAGEMENT

[[LLM: Dependencies are often the source of production issues. For each dependency, consider: What happens if it's unavailable? Is there a newer version with security patches? Are we locked into a vendor? What's our contingency plan? Verify specific versions and fallback strategies.]]

### 8.1 External Dependencies

- [ ] All external dependencies are identified
- [ ] Versioning strategy for dependencies is defined
- [ ] Fallback approaches for critical dependencies are specified
- [ ] Licensing implications are addressed
- [ ] Update and patching strategy is outlined

### 8.2 Internal Dependencies

- [ ] Component dependencies are clearly mapped
- [ ] Build order dependencies are addressed
- [ ] Shared services and utilities are identified
- [ ] Circular dependencies are eliminated
- [ ] Versioning strategy for internal components is defined

### 8.3 Third-Party Integrations

- [ ] All third-party integrations are identified
- [ ] Integration approaches are defined
- [ ] Authentication with third parties is addressed
- [ ] Error handling for integration failures is specified
- [ ] Rate limits and quotas are considered

## 9. AI AGENT IMPLEMENTATION SUITABILITY

[[LLM: This architecture may be implemented by AI agents. Review with extreme clarity in mind. Are patterns consistent? Is complexity minimized? Would an AI agent make incorrect assumptions? Remember: explicit is better than implicit. Look for clear file structures, naming conventions, and implementation patterns.]]

### 9.1 Modularity for AI Agents

- [ ] Components are sized appropriately for AI agent implementation
- [ ] Dependencies between components are minimized
- [ ] Clear interfaces between components are defined
- [ ] Components have singular, well-defined responsibilities
- [ ] File and code organization optimized for AI agent understanding

### 9.2 Clarity & Predictability

- [ ] Patterns are consistent and predictable
- [ ] Complex logic is broken down into simpler steps
- [ ] Architecture avoids overly clever or obscure approaches
- [ ] Examples are provided for unfamiliar patterns
- [ ] Component responsibilities are explicit and clear

### 9.3 Implementation Guidance

- [ ] Detailed implementation guidance is provided
- [ ] Code structure templates are defined
- [ ] Specific implementation patterns are documented
- [ ] Common pitfalls are identified with solutions
- [ ] References to similar implementations are provided when helpful

### 9.4 Error Prevention & Handling

- [ ] Design reduces opportunities for implementation errors
- [ ] Validation and error checking approaches are defined
- [ ] Self-healing mechanisms are incorporated where possible
- [ ] Testing patterns are clearly defined
- [ ] Debugging guidance is provided

## 10. ACCESSIBILITY IMPLEMENTATION [[FRONTEND ONLY]]

[[LLM: Skip this section for backend-only projects. Accessibility is a core requirement for any user interface.]]

### 10.1 Accessibility Standards

- [ ] Semantic HTML usage is emphasized
- [ ] ARIA implementation guidelines provided
- [ ] Keyboard navigation requirements defined
- [ ] Focus management approach specified
- [ ] Screen reader compatibility addressed

### 10.2 Accessibility Testing

- [ ] Accessibility testing tools identified
- [ ] Testing process integrated into workflow
- [ ] Compliance targets (WCAG level) specified
- [ ] Manual testing procedures defined
- [ ] Automated testing approach outlined

[[LLM: 最终验证报告生成

现在你已经完成了 checklist，生成一个包含以下内容的综合验证报告：

1. 执行摘要
   - 整体架构就绪度 (高/中/低)
   - 识别的关键风险
   - 架构的关键优势
   - 项目类型 (全栈/前端/后端) 和评估的部分

2. 部分分析
   - 每个主要部分的通过率 (通过项目百分比)
   - 最令人担忧的失败或缺口
   - 需要立即关注的部分
   - 注意由于项目类型跳过的任何部分

3. 风险评估
   - 按严重程度排序的前 5 个风险
   - 每个风险的缓解建议
   - 解决问题的 timeline 影响

4. 建议
   - 开发前必须修复的项目
   - 为更好质量应该修复的项目
   - 锦上添花的改进

5. AI 实现就绪性
   - AI 代理实现的特定关注点
   - 需要额外澄清的领域
   - 需要解决的复杂度热点

6. 前端特定评估 (如果适用)
   - 前端架构完整性
   - 主架构和前端架构文档间的一致性
   - UI/UX 规范覆盖
   - 组件设计清晰度

展示报告后，问用户是否想要任何特定部分的详细分析，特别是有警告或失败的部分。]]
