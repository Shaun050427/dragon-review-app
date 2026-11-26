import type { Fields } from "./low-absorption";

export const DAILY_REVIEW_VERSION = "2026-11-27";
export const REVIEW_FIELDS = [
  ["reviewProfit", "赚钱效应", "市场奖励什么行为、代表核心和同伴；附日期与来源"],
  ["reviewLoss", "亏钱效应", "失败模式、负反馈及次日撤销交易的条件；附来源"],
  ["reviewFunds", "游资与机构", "榜单日期、席位买卖、单日或多日口径；缺数据写待核，不推断真人持仓"],
  ["reviewHoldings", "持仓审计与退出", "合并全部账户，核对共同题材敞口；逐票写持有依据、减仓和退出条件；空仓也明确记录"],
] as const;
export type DailyReview = { sourceDate: string; completedAt: string; profit: string; loss: string; funds: string; holdings: string };
export function dailyReview(f: Fields): DailyReview {
  return { sourceDate: f.reviewSourceDate || "", completedAt: f.reviewCompletedAt || "", profit: f.reviewProfit || "", loss: f.reviewLoss || "", funds: f.reviewFunds || "", holdings: f.reviewHoldings || "" };
}
export function validDailyReview(v: unknown): v is DailyReview {
  if (!v || typeof v !== "object") return false;
  const r = v as DailyReview;
  return [r.sourceDate, r.completedAt, r.profit, r.loss, r.funds, r.holdings].every(x => typeof x === "string");
}
export function dailyReviewIssues(r: DailyReview | undefined, executionDate: string, sourceDate: string, now = new Date()) {
  if (executionDate < DAILY_REVIEW_VERSION) return [];
  const issues: string[] = [];
  if (!r || !validDailyReview(r)) return ["先完成赚钱效应、亏钱效应、游资和持仓复盘"];
  if (!sourceDate || r.sourceDate !== sourceDate) issues.push("复盘日期必须对应最近准备日，不能沿用旧复盘");
  if (![r.profit, r.loss, r.funds, r.holdings].every(x => x.trim())) issues.push("补齐赚钱效应、亏钱效应、游资和持仓四项复盘");
  const t = Date.parse(r.completedAt);
  if (!Number.isFinite(t) || t < Date.parse(`${sourceDate}T15:00:00+08:00`) || t > now.getTime()) issues.push("复盘完成时间须在准备日收盘后且不能在未来");
  if (Number.isFinite(t) && t >= Date.parse(`${executionDate}T09:25:00+08:00`)) issues.push("9:25后完成的复盘仅供补录，不能授权当日新增交易");
  return issues;
}

// Inputs are manually consolidated across accounts, never inferred from one broker.
export function recoveryIssues(date: string, f: Fields) {
  if (date < DAILY_REVIEW_VERSION) return [];
  if (f.recoveryMode === "normal") return f.recoveryReleaseEvidence?.trim() ? [] : ["结束恢复期前写明复盘、状态与风险恢复依据"];
  const issues: string[] = [];
  const n = (k: string) => f[k]?.trim() && Number.isFinite(Number(f[k])) ? Number(f[k]) : null;
  for (const [k, label, cap] of [["portfolioTotalPct", "合并账户交易后总仓", 20], ["portfolioNamePct", "合并账户交易后最大单票仓位", 5], ["portfolioThemePct", "合并账户交易后最大共同题材敞口", 10]] as const) {
    const v = n(k);
    if (v === null || v < 0 || v > cap) issues.push(`恢复期${label}须填写且≤${cap}%`);
  }
  const total = n("portfolioTotalPct"), name = n("portfolioNamePct"), theme = n("portfolioThemePct");
  if (total !== null && name !== null && theme !== null && (name > theme || theme > total)) issues.push("核对合并仓位：最大单票≤最大共同题材≤总仓");
  const risk = n("riskPerTradePct"), max = n("maxPosition"), used = n("dailyRiskUsedPct");
  if (risk === null || risk <= 0 || risk > 0.25) issues.push("恢复期单笔计划风险须>0且≤总资产0.25%");
  if (max === null || max <= 0 || max > 5) issues.push("恢复期最大单票计划仓位须>0且≤5%");
  if (used === null || used < 0 || risk === null || used + risk > 0.5 + 1e-9) issues.push("恢复期当日已用新增风险加本笔须≤总资产0.5%；盈利或平仓不返还风险预算");
  const equity = n("currentEquity"), peak = n("weekPeakEquity");
  if (equity === null || equity <= 0 || peak === null || peak < equity) issues.push("填写全部账户合计净值和本周峰值，峰值不得低于当前净值");
  else if ((peak - equity) / peak >= 0.02 - 1e-9) issues.push("本周回撤达到2%警戒，暂停新增并复盘");
  if (f.recoveryNoAveraging !== "yes") issues.push("先核实本笔不为浮亏摊薄、不跨账户规避、且不在退潮强行开仓");
  return issues;
}
