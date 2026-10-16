export const researchMechanisms = ["恐慌均线低吸", "断板修复低吸", "小碎步潜伏", "分歧接力", "反包接力", "趋势突破", "其他"];
export const catalystOptions = ["待归因", "无新增消息", "入场前已知催化", "入场后新增利好", "入场后新增利空", "无法区分"];
export const sampleKeys = ["id", "stock", "mechanism", "catalyst", "state", "result", "pnl", "mae", "days", "before", "after"] as const;
export type ResearchSample = Record<typeof sampleKeys[number], string>;
export type ResearchDay = { date: string; fields: Record<string, string> };

export function readResearchSamples(raw: string | undefined): ResearchSample[] {
  try {
    const rows: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)).map((row) =>
      Object.fromEntries(sampleKeys.map((key) => [key, typeof row[key] === "string" ? row[key] : ""])) as ResearchSample);
  } catch { return []; }
}

export function finiteInput(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// A sample copied to another day remains one sample; latest dated version wins.
export function researchSummary(days: ResearchDay[]) {
  const unique = new Map<string, ResearchSample>();
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    readResearchSamples(day.fields.researchSamples).forEach((row, index) => unique.set(row.id || `${day.date}:${index}`, row));
  }
  return researchMechanisms.map((mechanism) => {
    const rows = [...unique.values()].filter((row) => row.stock.trim() && row.mechanism === mechanism);
    const closed = rows.filter((row) => row.state === "已结束");
    const known = closed.filter((row) => finiteInput(row.pnl) !== null);
    const net = known.reduce((sum, row) => sum + finiteInput(row.pnl)!, 0);
    const eventRows = known.filter((row) => row.catalyst === "入场后新增利好");
    const adverse = closed.map((row) => finiteInput(row.mae)).filter((value): value is number => value !== null && value >= 0);
    const durations = closed.map((row) => finiteInput(row.days)).filter((value): value is number => value !== null && value >= 0 && Number.isInteger(value));
    return { mechanism, total: rows.length, closed: closed.length, known: known.length, net,
      positive: known.filter((row) => finiteInput(row.pnl)! > 0).length,
      eventCount: eventRows.length, eventNet: eventRows.reduce((sum, row) => sum + finiteInput(row.pnl)!, 0),
      worstMae: adverse.length ? Math.max(...adverse) : null, maeCount: adverse.length,
      averageDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null, daysCount: durations.length };
  }).filter((row) => row.total);
}

export function accountRisk(fields: Record<string, string>) {
  const equity = finiteInput(fields.currentEquity);
  const peak = finiteInput(fields.peakEquity);
  const limit = finiteInput(fields.drawdownStopPct);
  const dailyR = finiteInput(fields.dailyStopR ?? "2");
  const realized = finiteInput(fields.realizedR ?? "0");
  const riskPct = finiteInput(fields.riskPerTradePct ?? "0.5");
  const issues: string[] = [];
  if (equity === null || equity <= 0 || peak === null || peak <= 0 || equity > peak) issues.push("核对当前净值与峰值，峰值不得低于当前净值");
  if (limit === null || limit <= 0 || limit > 100) issues.push("设置有效的峰值回撤暂停阈值（0—100%）");
  if (riskPct === null || riskPct <= 0 || riskPct > 100) issues.push("设置有效单笔风险比例");
  if (dailyR === null || dailyR <= 0 || realized === null) issues.push("核对日内停止交易R与今日已实现R");
  const drawdown = equity !== null && equity > 0 && peak !== null && peak >= equity ? (peak - equity) / peak * 100 : null;
  const drawdownStopped = drawdown !== null && limit !== null && limit > 0 && limit <= 100 && drawdown >= limit - 1e-9;
  const dailyStopped = realized !== null && dailyR !== null && dailyR > 0 && realized <= -dailyR;
  if (drawdownStopped) issues.push("账户回撤达到暂停阈值，停止新增交易并复盘");
  if (dailyStopped) issues.push("日内亏损达到停止交易R，停止新增交易");
  return { issues, drawdown, drawdownStopped, dailyStopped,
    remaining: equity !== null && peak !== null && peak >= equity && limit !== null && limit > 0 && limit <= 100 ? Math.max(0, equity - peak * (1 - limit / 100)) : null };
}
