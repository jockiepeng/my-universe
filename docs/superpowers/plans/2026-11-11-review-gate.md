# Review Gate Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在提交与推送前阻止未通过审查的代码。
**Architecture:** Node 脚本读取暂存树或推送提交的树，核对同树报告与父提交；验证命令运行后签入结果。Git hooks 调用脚本，人工审查语义。
**Tech Stack:** Node >=24、Git、node:test，无新增依赖。
**Spec:** docs/superpowers/specs/2026-11-11-review-gate-design.md

## Global Constraints
- 不提交或推送本次代码；保留用户工作区。
- 不泄露敏感原文；旧功能记录无需补写。

## Review Focus
- 报告后代码变化：拒绝过期指纹。
- 历史报告复用：绑定父提交。
- 多提交推送：逐提交审查；删除分支不需要报告。
- 工作区和暂存不一致：禁止生成验证通过的报告。
- 功能说明缺字段/类型必要章节：拒绝放行。

### Task 1: 门禁核心与集成
- [x] 添加临时 Git 仓库测试，验证缺报告、过期、红线、详情缺失和推送行为；先运行确认失败。
- [x] 实现快照、报告模板、验证、commit/push 检查与安装器。
- [x] 添加 AGENTS.md、流程文档与 npm 命令；运行测试和 verify。
- [x] 审查最终差异，记录实施报告；安装 hooks，但不自动 commit/push。

Ruling: 使用独立功能分支，原工作区为空；用户要求直接编码，按已批准设计连续执行，不重复设计确认。

Validation: targeted failure-first tests passed; full npm run verify passed before final review. Final current-snapshot verification is recorded in docs/reviews/2026-11-11-review-gate.json and its Markdown document.

Final review: independent reviewer reproduced an amend-parent mismatch. Fixed with explicit --amend report mode and review:amend wrapper; regression test exercises installed hooks and subsequent push validation. Targeted suite: 16 passing tests. No deferred findings. No commit/push performed.
