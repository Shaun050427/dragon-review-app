export const liquidityEnvironments = ["未判断", "正常 / 放量", "缩量但承接稳定", "缩量且资金集中", "缩量且负反馈扩大"];
export const thesisOptions = ["未选择", "超跌反抽", "断板反包", "二波延续", "主升接力", "趋势突破", "事件套利"];

export function sameTimeVolumeRatio(fields: Record<string, string>): number | null {
  if (!fields.liquidityTime || fields.liquidityTime !== fields.liquidityReferenceTime) return null;
  const current = Number(fields.liquidityAmount);
  const reference = Number(fields.liquidityReferenceAmount);
  return Number.isFinite(current) && current > 0 && Number.isFinite(reference) && reference > 0 ? current / reference : null;
}

// Manual planning checks only. No automatic market classification or orders.
export function liquidityPlanIssues(fields: Record<string, string>): string[] {
  const issues: string[] = [];
  if (!liquidityEnvironments.includes(fields.liquidityEnvironment) || fields.liquidityEnvironment === "未判断") issues.push("先判断量能与承接环境");
  if (sameTimeVolumeRatio(fields) === null) issues.push("填写同一时间、同一市场范围的有效成交额对照");
  if (!fields.liquiditySource?.trim() || !fields.liquidityBasis?.trim() || !fields.liquidityEvidence?.trim() || !fields.liquidityBuyPlan?.trim()) issues.push("补齐数据来源、比较基准、承接证据和买入许可 / 否决条件");
  if (!thesisOptions.includes(fields.exitThesis) || fields.exitThesis === "未选择") issues.push("明确本笔交易类型");
  if (!fields.ticketStock?.trim() || !fields.ticketEntry?.trim() || !fields.ticketStrategy || fields.ticketStrategy === "未选择") issues.push("补齐唯一交易票的标的、模式与入场触发");
  if (!fields.ticketExit?.trim() || !fields.ticketInvalidation?.trim() || !fields.exitRiskLimit?.trim() || !fields.exitRemainder?.trim() || !fields.holdingConditions?.trim()) issues.push("补齐兑现、证伪、风险上限、剩余仓位退出与持有条件");
  const reducePct = Number(fields.exitReducePct);
  if (!fields.exitReducePct?.trim() || !Number.isFinite(reducePct) || reducePct <= 0 || reducePct > 100) issues.push("写明首次减仓占当时持仓的比例（大于0且不超过100%）");
  if (fields.liquidityEnvironment === "缩量且负反馈扩大" && ["超跌反抽", "断板反包", "二波延续", "主升接力"].includes(fields.exitThesis)) issues.push("该环境下暂停依赖情绪接力的新增交易，继续管理已有持仓");
  if (["原理由失效", "风险上限触发"].includes(fields.holdingStage)) issues.push("当前交易票已记录失效 / 风险触发，不允许继续新增仓位");
  return issues;
}
