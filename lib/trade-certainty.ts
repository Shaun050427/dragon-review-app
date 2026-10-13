export const certaintyFactors = [
  { id: "cycle", name: "周期位置", question: "主升、第一次分歧、修复还是退潮末期？这段行情允许当前交易吗？" },
  { id: "consensus", name: "资金共识", question: "同伴是否响应？竞品是否抢走流动性？区分个股拉升与资金重新形成共识。" },
  { id: "supply", name: "筹码结构", question: "上方套牢区、获利盘与近期换手在哪里？换手充分不等于抛压已消化。" },
  { id: "payoff", name: "盈亏结构", question: "错了在哪里退出？收益空间是否值得承担失败损失和无法及时退出的风险？" },
];

export const entryMechanisms = [
  { name: "极致恐慌低吸", buying: "恐慌释放后的边际改善", risk: "下跌根本没有结束", confirmation: "继续杀跌出现承接、其他老龙同步止跌，修复预期有事实支持" },
  { name: "龙头分歧转一致", buying: "资金重新形成共识", risk: "看似修复，实际是出货反抽", confirmation: "龙头主动转强、同伴响应，竞争方向没有明显夺走接力资金" },
  { name: "断板反包", buying: "资金消化分歧后再次进攻", risk: "反包失败、高位再次杀跌", confirmation: "断板后有承接和有效换手，再次进攻有板块与资金反馈" },
  { name: "二波加速接力", buying: "主升重新确认", risk: "一致性过强，上方筹码兑现", confirmation: "二波前提得到验证；上方抛压、拥挤共识和承接能力一起核对" },
];
export const mechanismOptions = ["未选择", ...entryMechanisms.map((item) => item.name), "其他（说明）"];

export const panicConditions = [
  { id: "decline", name: "第一轮主跌已释放大量亏钱效应", prompt: "主跌阶段、跌停/补跌/隔日负反馈的时间与证据；不是仅跌幅大" },
  { id: "average", name: "龙头首次靠近中期均线", prompt: "均线周期、日期、是否首次、动态均线值与股价距离；触线不是买点" },
  { id: "support", name: "继续杀跌时出现承接", prompt: "低点、主动买盘和回拉证据；区分当时可见与收盘后确认" },
  { id: "peers", name: "其他老龙同步止跌", prompt: "样本名单、止跌时间、相对强弱；单只股票反弹不足以确认" },
  { id: "repair", name: "市场出现修复预期", prompt: "指数/题材/情绪的边际改善；预期不是确定结果" },
];

export function certaintyPlanIssues(fields: Record<string, string>): string[] {
  const issues: string[] = [];
  for (const factor of certaintyFactors) {
    if (fields[`certainty_${factor.id}_status`] !== "支持" || !fields[`certainty_${factor.id}_evidence`]?.trim()) issues.push(`${factor.name}尚无完整支持证据`);
  }
  if (!mechanismOptions.includes(fields.entryMechanism) || fields.entryMechanism === "未选择") issues.push("选择本次入场机制");
  if (fields.entryMechanism === "其他（说明）" && !fields.entryMechanismOther?.trim()) issues.push("写清其他入场机制及其风险");
  if (fields.certaintyExecutable !== "已评估并接受限制" || !fields.certaintyExecutionEvidence?.trim()) issues.push("核对T+1、流动性、滑点与最坏退出情景的可执行性");
  if (fields.entryMechanism === "极致恐慌低吸") {
    for (const condition of panicConditions) {
      if (fields[`panic_${condition.id}_status`] !== "满足" || !fields[`panic_${condition.id}_evidence`]?.trim()) issues.push(`恐慌低吸待核对：${condition.name}`);
    }
    if (!fields.panicAverageBasis?.trim()) issues.push("记录均线复权方式、价格口径与行情来源");
  }
  return issues;
}

function optionalNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

// User-entered assumptions only, never inferred from a chart or curated samples.
export function expectancyScenario(fields: Record<string, string>) {
  const p = optionalNumber(fields.certaintyWinPct);
  const win = optionalNumber(fields.certaintyAverageWinR);
  const loss = optionalNumber(fields.certaintyAverageLossR);
  const cost = optionalNumber(fields.certaintyCostR);
  if (p === null || p < 0 || p > 100 || win === null || win <= 0 || loss === null || loss <= 0) return null;
  const gross = p / 100 * win - (1 - p / 100) * loss;
  return { gross, net: cost !== null && cost >= 0 ? gross - cost : null, breakEvenPct: loss / (win + loss) * 100 };
}

export type CertaintyCase = { stock: string; mechanism: string; before: string; outcome: string; execution: string; lesson: string };
export function readCertaintyCases(raw: string | undefined): CertaintyCase[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5).filter((item) => item && typeof item === "object").map((item) => Object.fromEntries(["stock", "mechanism", "before", "outcome", "execution", "lesson"].map((key) => [key, typeof item[key] === "string" ? item[key] : ""])) as CertaintyCase);
  } catch { return []; }
}
