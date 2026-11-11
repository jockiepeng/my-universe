const labels = { privacy: '个人敏感信息与凭证', changelog: '功能专区与说明完整性', content: '文章/贴图、列表与资源', bugs: 'Bug、回归与必要验证' };
export function renderReview(r) {
  const passed = r.redLines?.length === 0 && Object.keys(labels).every(key => r.checks?.[key]?.status === 'pass') && r.verification?.status === 'pass';
  return [
    '# 最终代码校验报告', '',
    `**结论：${passed ? '审查通过，允许提交/推送对应快照' : '未通过，禁止提交和推送'}。**`, '',
    '## 已 Review 的审查点', '',
    ...Object.entries(labels).map(([key, label]) => `- ${label}：${r.checks?.[key]?.status ?? 'pending'}`),
    `- 自动验证：${r.verification?.status ?? 'pending'}`, '',
    '## 你需要重点关注', '',
    ...(r.concerns?.length ? r.concerns.map(item => `- ${item}`) : ['- 未记录额外关注项；详细证据和验证范围见下文。']),
    ...(r.redLines ?? []).map(item => `- **红线（阻止提交）：${item}**`), '',
    '## 具体 Review 内容', '',
    `审查者：${r.reviewer || '未填写'}`, '',
    `代码快照：\`${r.snapshot}\``, '',
    `父提交：${(r.parents ?? []).map(p => `\`${p}\``).join(', ')}`, '',
    `用户可见功能变化：${r.featureChanges === null ? '待确认' : r.featureChanges ? '有' : '无'}`, '',
    ...Object.entries(labels).flatMap(([key, label]) => [`### ${label}`, '', r.checks?.[key]?.evidence || '尚未填写证据。', '']),
    '### 自动验证记录', '',
    `命令：\`${r.verification?.command ?? '未执行'}\`；结果：${r.verification?.status ?? 'pending'}；完成时间：${r.verification?.completedAt ?? '未记录'}`, '',
    '本报告只适用于上述快照；自动检查不能证明不存在所有 Bug，人工检查的范围与局限见各项证据。', '',
  ].join('\n');
}
