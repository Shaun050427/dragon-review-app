export type Fields = Record<string, string>;
export type FunnelStock = { code: string; name: string; industry: string; boards: number };
export type FunnelDay = { date: string; stocks: FunnelStock[] };
export type TradingCalendar = { schemaVersion: 1; source: string; coveredFrom: string; coveredThrough: string; sessions: string[] };
export type FunnelCandidate = { code: string; name: string; industry: string; maxBoards: number; lastBoard: string; age: number | null; missingAfter: number; limitCount10: number; leaderClass: LeaderClass };
export type DailyMetric = {
  code: string; dataDate?: string; error?: string; close?: number; drawdownPct?: number; fallingDays?: number;
  volumeRatio?: number | null; turnoverRate?: number | null; research?: ResearchFacts;
  averages?: { period: number; value: number | null; distancePct: number | null; firstTouchDate: string | null }[];
  recent?: { date: string; close: number; volume: number; turnoverRate: number | null; limitDown: boolean; volumeRatio: number | null }[];
};
export type RadarSnapshot = { schemaVersion: 1; tradeDate: string; observedAt: string; source: string; adjustment: string; calendar: TradingCalendar; missingArchives: string[]; stocks: DailyMetric[] };
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export function validDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z")) && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
}
export function readCalendar(value: unknown): TradingCalendar | null {
  if (!record(value) || value.schemaVersion !== 1 || !validDate(value.coveredFrom) || !validDate(value.coveredThrough) || value.coveredFrom > value.coveredThrough || typeof value.source !== "string" || !Array.isArray(value.sessions) || !value.sessions.length) return null;
  const sessions = value.sessions;
  if (!sessions.every((d, i) => validDate(d) && d >= String(value.coveredFrom) && d <= String(value.coveredThrough) && (!i || d > sessions[i - 1]))) return null;
  return value as TradingCalendar;
}
export function tradingAge(lastBoard: string, date: string, calendar: TradingCalendar | null): number | null {
  if (!calendar || !validDate(date) || !calendar.sessions.includes(lastBoard) || date < lastBoard || date > calendar.coveredThrough || lastBoard < calendar.coveredFrom) return null;
  return calendar.sessions.filter((d) => d > lastBoard && d <= date).length;
}
export function scanDates(date: string, calendar: TradingCalendar | null): string[] {
  if (!validDate(date)) return [];
  if (calendar && date <= calendar.coveredThrough && date >= calendar.coveredFrom) return calendar.sessions.filter((d) => d <= date).slice(-45).reverse();
  // Discovery fallback only: missing weekdays must never be counted as sessions.
  const start = Date.parse(date + "T12:00:00Z");
  return Array.from({ length: 90 }, (_, n) => new Date(start - n * 86400000)).filter((d) => ![0, 6].includes(d.getUTCDay())).map((d) => d.toISOString().slice(0, 10));
}
export function readArchive(value: unknown, date: string): FunnelDay | null {
  if (!validDate(date) || !record(value) || value.schemaVersion !== 1 || value.tradeDate !== date || !Array.isArray(value.stocks)) return null;
  if (!value.stocks.every((s) => record(s) && typeof s.code === "string" && /^\d{6}$/.test(s.code) && typeof s.name === "string" && s.name.trim() && Number.isInteger(s.boards) && Number(s.boards) >= 1)) return null;
  if (new Set(value.stocks.map((s) => s.code)).size !== value.stocks.length) return null;
  return { date, stocks: value.stocks as FunnelStock[] };
}
export function discoverCandidates(days: FunnelDay[], date: string, calendar: TradingCalendar | null): FunnelCandidate[] {
  const history = new Map<string, FunnelCandidate>();
  const present = new Set(days.map((d) => d.date));
  for (const day of [...days].filter((d) => d.date <= date).sort((a, b) => a.date.localeCompare(b.date))) for (const s of day.stocks) {
    const previous = history.get(s.code);
    history.set(s.code, { code: s.code, name: s.name, industry: s.industry || "", maxBoards: Math.max(previous?.maxBoards ?? 0, s.boards), lastBoard: day.date, age: tradingAge(day.date, date, calendar), missingAfter: 0, limitCount10: 0, leaderClass: "unclassified" });
  }
  const sessions = calendar?.sessions.filter((d) => d <= date).slice(-45) ?? [];
  return [...history.values()].map((s) => {
    const events = days.filter((d) => d.date <= date && d.stocks.some((v) => v.code === s.code)).map((d) => d.date);
    const limitCount10 = sessions.length ? Math.max(0, ...sessions.map((_, i) => events.filter((d) => sessions.slice(Math.max(0, i - 9), i + 1).includes(d)).length)) : 0;
    return { ...s, limitCount10, leaderClass: nominateLeader(s.maxBoards, limitCount10), missingAfter: calendar ? calendar.sessions.filter((d) => d > s.lastBoard && d <= date && !present.has(d)).length : 0 };
  }).filter((s) => s.maxBoards >= 3 || s.limitCount10 >= 6).sort((a, b) => (a.age ?? 99) - (b.age ?? 99) || b.maxBoards - a.maxBoards || a.code.localeCompare(b.code));
}
export function memoryWindow(age: number | null): string {
  return age === null ? "待核交易日" : age === 0 ? "预备池：当日涨停" : age <= 5 ? "一级：1—5日" : age <= 10 ? "二级：6—10日" : age <= 15 ? "衰减：11—15日" : age <= 20 ? "扩展：16—20日（C2待核）" : "降级保留";
}
export function numeric(v: string | undefined): number | null {
  if (!v?.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function entrySignal(f: Fields): { triggered: boolean; message: string } {
  const l = numeric(f.low), h = numeric(f.high), close = numeric(f.minuteClose), ratio = numeric(f.volumeRatio);
  const no = (message: string) => ({ triggered: false, message });
  if (l === null || h === null || close === null || ratio === null || l <= 0 || h <= l || close <= 0 || ratio < 0) return no("待填写有效L、H、已完成分钟收盘与量比。");
  if (close <= l || f.retest === "failed") return no("低点/回踩失守，本次结构失效；需重新识别L、H。");
  if (f.stopped !== "yes" || f.firstTouch !== "yes") return no("先核实连续3根1分钟未破L（或一根5分钟止跌）及首次触线。");
  if (!["S1", "S2", "trend"].includes(strategyOf(f)) || !f.identity?.trim() || f.peers !== "yes") return no("补齐模型、核心地位证据与同伴/行业反馈。");
  if (f.strategy && researchQualification(f) !== "身份人工核验已记录") return no(researchQualification(f));
  if (f.strategy && (f.strategy === "S1" && !["5", "10"].includes(f.averagePeriod) || f.strategy === "S2" && !["20", "30"].includes(f.averagePeriod))) return no("请核对模式与均线：S1研究MA5/10，S2研究MA20/30。");
  if (close <= h || ratio < 1.5) return no("待一分钟收盘突破H且本分钟量/此前5根均量≥1.5。");
  if (f.buyMethod === "A") {
    if (f.nextHeld !== "yes") return no("A：突破后仍需核对下一分钟维持H上方；无需强求二次测试L。");
    return { triggered: true, message: "A形态条件满足：止跌→放量突破H→下一分钟维持H。继续核对退出预案、赔率与T+1限制。" };
  }
  if (f.buyMethod === "B") {
    const low = numeric(f.pullbackLow), rebound = numeric(f.reboundHigh);
    if (f.retest !== "passed" || f.pullbackHeld !== "yes" || f.pullbackVolume !== "yes" || low === null || rebound === null || low <= l || low < h * 0.995 - 1e-8 || low > h * 1.005 + 1e-8 || rebound < low || close <= rebound) return no("B：等待突破后首次缩量回踩H±0.5%守住，再突破回踩局部高点；L二测也需记录通过。");
    return { triggered: true, message: "B形态条件满足：突破→首次缩量回踩H附近守住→再突破回踩高点。继续检查赔率和风险预算。" };
  }
  return no("选择A快速突破或B首次回踩，两种买点分别核验。");
}
export function riskPlan(f: Fields) {
  const equity = numeric(f.equity), pct = numeric(f.riskPct), entry = numeric(f.entry), stop = numeric(f.stop), target = numeric(f.target), cap = numeric(f.positionCap), cost = numeric(f.costPct);
  if (equity === null || equity <= 0 || pct === null || pct <= 0 || pct > 100 || entry === null || entry <= 0 || stop === null || stop <= 0 || stop >= entry || target === null || target <= entry || cap === null || cap <= 0 || cap > 100 || cost === null || cost < 0 || cost > 100) return null;
  const perShare = entry - stop + entry * cost / 100;
  const budget = equity * pct / 100;
  const shares = Math.floor(Math.min(budget / perShare, equity * cap / 100 / entry) / 100) * 100;
  return { budget, shares, amount: shares * entry, plannedLoss: shares * perShare, rewardRisk: (target - entry - entry * cost / 100) / perShare };
}
export function readWatchlist(raw: string | undefined): { code: string; name: string }[] {
  try {
    const data: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data.filter((v): v is { code: string; name: string } => record(v) && typeof v.code === "string" && /^\d{6}$/.test(v.code) && typeof v.name === "string" && Boolean(v.name.trim()) && !seen.has(v.code) && Boolean(seen.add(v.code)));
  } catch { return []; }
}
export function stockFields(fields: Fields, code: string): Fields {
  const prefix = `funnel_${code}_`;
  return Object.fromEntries(Object.entries(fields).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
}

export function readRadar(v: unknown, date: string): RadarSnapshot | null {
  if (!record(v) || v.schemaVersion !== 1 || v.tradeDate !== date || typeof v.source !== "string" || typeof v.adjustment !== "string" || typeof v.observedAt !== "string" || Number.isNaN(Date.parse(v.observedAt)) || !readCalendar(v.calendar) || !Array.isArray(v.stocks)) return null;
  const numberOrNull = (n: unknown) => n === null || typeof n === "number" && Number.isFinite(n);
  for (const s of v.stocks) {
    if (!record(s) || typeof s.code !== "string" || !/^\d{6}$/.test(s.code)) return null;
    if (typeof s.error === "string") continue;
    if (s.research !== undefined && !readResearchFacts(s.research, date)) return null;
    if (s.dataDate !== date || typeof s.close !== "number" || !Number.isFinite(s.close) || s.close <= 0 || !numberOrNull(s.drawdownPct) || !numberOrNull(s.volumeRatio) || !Array.isArray(s.averages) || !Array.isArray(s.recent)) return null;
    if (!s.averages.every((a) => record(a) && [5, 10, 20, 30].includes(Number(a.period)) && numberOrNull(a.value) && numberOrNull(a.distancePct) && (a.firstTouchDate === null || validDate(a.firstTouchDate) && a.firstTouchDate <= date))) return null;
    if (!s.recent.every((r) => record(r) && validDate(r.date) && r.date <= date && numberOrNull(r.close) && numberOrNull(r.volume) && numberOrNull(r.turnoverRate) && numberOrNull(r.volumeRatio) && typeof r.limitDown === "boolean")) return null;
  }
  return v as RadarSnapshot;
}

export type LeaderClass = "C1" | "C2" | "C3" | "unclassified";
export type ResearchFacts = {
  ruleVersion: string; leaderClass: LeaderClass; identityStatus: string; limitCount10: number;
  lastBoard: string | null; lastActive: string | null; boardAge: number | null; activeAge: number | null;
  priority: string; missingIdentitySessions: string[];
  touches: { period: number; touchCount: number; firstTouchDate: string | null; touching: boolean; stage: string }[];
};
export const leaderLabels: Record<LeaderClass, string> = { C1: "C1 普通连板龙候选", C2: "C2 长生命周期核心候选", C3: "C3 非连板趋势核心", unclassified: "身份待核" };
export function nominateLeader(maxBoards: number, limitCount10: number): LeaderClass {
  return maxBoards >= 5 || limitCount10 >= 6 ? "C2" : maxBoards >= 3 ? "C1" : "unclassified";
}
export function strategyOf(f: Fields): string {
  return f.strategy || (f.model === "A1" ? "S1" : f.model === "A2" ? "S2" : f.model === "B" ? "trend" : "");
}
export function researchQualification(f: Fields, facts?: ResearchFacts) {
  const kind = f.leaderClass || facts?.leaderClass || "unclassified";
  if (!f.identity?.trim() || f.identityConfirmed !== "yes") return "待核核心地位，连板门槛仅作提名";
  if (kind === "C2" && (!f.lifecycleEvidence?.trim() || f.lifecycleConfirmed !== "yes")) return "C2待核多轮进攻、换手与持续共识";
  if (kind === "C3" && strategyOf(f) !== "trend") return "C3单独研究，不能沿用连板龙S1/S2";
  if (kind === "unclassified" || !["C1", "C2", "C3"].includes(kind)) return "请选择龙头身份";
  return "身份人工核验已记录";
}

export function readResearchFacts(v: unknown, date: string): v is ResearchFacts {
  if (!record(v) || v.ruleVersion !== "2.0" || !["C1", "C2", "C3", "unclassified"].includes(String(v.leaderClass)) || typeof v.identityStatus !== "string" || typeof v.priority !== "string" || !Number.isInteger(v.limitCount10) || Number(v.limitCount10) < 0 || !Array.isArray(v.missingIdentitySessions) || !v.missingIdentitySessions.every((d) => validDate(d) && d <= date) || !Array.isArray(v.touches)) return false;
  for (const k of ["lastBoard", "lastActive"]) if (v[k] !== null && !(validDate(v[k]) && String(v[k]) <= date)) return false;
  for (const k of ["boardAge", "activeAge"]) if (v[k] !== null && !(Number.isInteger(v[k]) && Number(v[k]) >= 0)) return false;
  return v.touches.length === 4 && new Set(v.touches.map((t) => record(t) ? t.period : null)).size === 4 && v.touches.every((t) => record(t) && [5, 10, 20, 30].includes(Number(t.period)) && Number.isInteger(t.touchCount) && Number(t.touchCount) >= 0 && typeof t.touching === "boolean" && typeof t.stage === "string" && (t.firstTouchDate === null || validDate(t.firstTouchDate) && t.firstTouchDate <= date));
}
