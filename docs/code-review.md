# 提交和推送 Review 规范

本仓库使用根 AGENTS.md + pre-commit / pre-push。本地 hooks 可以被恶意绕过，不是服务器强制保护；远程强制需另行配置 CI 和受保护分支。本次不修改远程设置。

## 安装与使用

Node.js >=24。`npm ci` 的 prepare 自动安装，也可运行 `npm run hooks:install`。安装器不会覆盖其他 hooksPath。Node 移动/删除后重新安装 hooks。

1. 审查完整差异，按 AGENTS.md 五类红线处理，运行受影响功能的必要检查。
2. 暂存待提交文件（不包含密钥），确保工作区与暂存区一致。
3. `npm run review:init -- docs/reviews/YYYY-MM-DD-topic.json` 创建 pending 报告，已有文件不覆盖。
4. 填写 reviewer（审查者身份）、featureChanges（是否用户可见功能变化）、checks 四项 status/evidence。status 只接受 pass；不适用也要解释原因和审查范围。redLines 必须为空才可放行，已修复问题和一般建议写入 evidence。
5. `npm run review:verify -- docs/reviews/YYYY-MM-DD-topic.json` 校验报告并实际运行 npm run verify，成功才写入验证记录；失败会清除旧验证状态。必要浏览器检查、图片隐私、内容分类等人工证据写在对应 checks。
6. 暂存报告，`npm run review:check` 后正常 commit / push。hooks 从 Git 暂存/提交对象读取报告，不信任工作区中的另一个版本。

JSON 与 Markdown 报告绑定完整代码树的 SHA-256（包括文件权限、删除、二进制资源）及父提交；仅 docs/reviews 顶层 JSON 与 Markdown 报告从哈希排除，避免自引用。该目录只能存 review 报告，不得存应用代码、资源或秘密。修改代码、amend/rebase 或更换父提交后必须重新审查并创建新报告。纯报告变更也须审查。验证记录是审查记录，不是密码学签名，禁止手工伪造。

## 审查内容及红线

严格按 [AGENTS.md](../AGENTS.md) 执行。隐私审查含文本、配置、截图、图片可见内容与 EXIF；自动扫描仅覆盖常见私钥和 Token 特征，不输出秘密原文。公开姓名、站点联系链接等不能仅因其已在仓库出现就自动豁免，应记录公开意图依据。

功能专区逐项对照代码，不能只判断 JSON 已变化：

功能更新只记录网站功能、修复、优化及功能删除；普通文章和贴图的发布、编辑、迁移不记入更新列表，也不要求补写功能更新记录。清理历史内容发布条目不另增更新条目；内容发布仍须审查隐私、图片、列表入口和构建结果。 纯内容发布及历史内容条目清理可设 featureChanges=false，在 changelog.evidence 说明依据。

| 类型 | 必须章节 |
| --- | --- |
| added | 功能内容、使用方式（可用更新方式）、技术原理 |
| fixed | 原来的问题（可用原来的情况）、处理方式、更新后的效果、技术原理 |
| improved | 原来的情况、优化方式（可用处理方式）、更新后的效果、技术原理 |
| removed | 删除内容、删除原因、对使用的影响（可用使用影响）；适用时技术原理 |

新增及实质修改的记录均检查双语摘要、每节 title/enTitle/text/en。空泛描述、错误译文、与代码不符均属红线，由审查者核实；程序只能验证结构。非用户可见的工具/文档改动可 featureChanges=false，但必须在 changelog.evidence 说明依据。

新文章/贴图检查正式发布状态、首页或后续分页、归档、所属分类和标签列表、详情和图片、搜索；草稿必须不在产物中。新增图片未用于发布时在 content.evidence 解释。构建检查自动核对正式详情是否有首页分页入口及归档入口；分类/标签归属、图片内容仍需核实。

`npm run verify` 覆盖单元测试、Astro 检查、构建与产物检查；影响界面时追加相应 README 浏览器检查，不能将未测记为通过。报告应列明具体命令、结果、覆盖与局限，不能承诺绝对无 Bug。

## 推送边界

pre-push 按 Git 提供的远程旧 SHA 到本地 SHA 逐提交检查（包括 merge 提交），所以“最后一条通过”不能掩盖前面的未审查提交。删除远程分支无需报告。新远程分支检查尚未包含在本地 remote-tracking refs 的提交；首次向空远程推送时旧历史可能缺报告而被阻止，应先制定历史迁移方案，不得自行绕过。远程旧 SHA 本地不存在时拒绝并先 fetch。新克隆必须安装 hooks，其他人的客户端未安装不能由本地机制管控。

无 HEAD 的首次仓库初始化不支持；本仓库已有历史。合并、变基及批量提交建议逐次审查，不自动复用报告。

## 最终校验文档

每次报告同时保存 `docs/reviews/<主题>.json`（门禁数据）与同名 `.md`（最终校验文档）。开头依次列出结论、已 Review 的审查点及状态、需要你重点关注的风险/限制/决策；下面是隐私、功能专区、内容列表、Bug 的具体证据与验证记录。`concerns` 用于填写重点关注事项，不应把未解决红线降级放到这里。

`review:init` 创建两份草稿；`review:verify` 成功或开始新一轮验证时同步生成 Markdown。单独修改 JSON 后可 `npm run review:render -- <JSON路径>` 更新阅读版（此命令不会执行验证或把 pending 变成 pass）。门禁检查 Markdown 必须与 JSON 一致，两份一起暂存。Markdown 和 JSON 报告均从快照排除，其余文件都参与快照。


## 修改上一条提交（amend）

amend 的父提交与普通新提交不同，必须使用专用流程：暂存完整修改，`npm run review:init -- docs/reviews/<新主题>.json --amend`，重新审查并填写报告，然后 `npm run review:verify -- docs/reviews/<新主题>.json --amend`。暂存两份报告后运行 `npm run review:amend -- --no-edit`（或传 `-m` 新消息），该命令将正确的父提交模式传递给 pre-commit。不要直接运行 `git commit --amend`，它无法告诉 pre-commit 预期的父提交模式。暂不支持根提交 amend 或合并进行时 amend；rebase 后必须按实际父提交重新审查，不能复用原报告。
