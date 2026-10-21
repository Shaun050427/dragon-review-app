export type StudyStats = { samples: number; completed: number; stockClusters: number; winRatePct: number | null; meanReturnPct: number | null; payoffRatio: number | null; expectedR: number | null; warning: string };
export type StudyGroup = { leaderClass: string; strategy: string; period: number; touch: string; boardClock: string; activeClock: string; panicVolume: string; descriptive: StudyStats; executable: StudyStats };
export type StudyReport = { schemaVersion: 1; ruleVersion: string; tradeDate: string; kind: string; costPct: number; limitations: string[]; universeStocks: number; missingStocks: { code: string; reason: string }[]; rows: unknown[]; descriptive: StudyStats; executable: StudyStats; groups: StudyGroup[] };
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown) => Number.isInteger(v) && Number(v) >= 0;
function stats(v: unknown): v is StudyStats {
  return record(v) && count(v.samples) && count(v.completed) && Number(v.completed) <= Number(v.samples) && count(v.stockClusters) && typeof v.warning === "string" && ["winRatePct", "meanReturnPct", "payoffRatio", "expectedR"].every((k) => v[k] === null || typeof v[k] === "number" && Number.isFinite(v[k]));
}
export function readStudyReport(v: unknown, date: string): StudyReport | null {
  if (!record(v) || v.schemaVersion !== 1 || v.ruleVersion !== "2.0" || v.tradeDate !== date || typeof v.kind !== "string" || typeof v.costPct !== "number" || !Number.isFinite(v.costPct) || v.costPct < 0 || !count(v.universeStocks) || !Array.isArray(v.limitations) || !v.limitations.every((s) => typeof s === "string") || !Array.isArray(v.rows) || !stats(v.descriptive) || !stats(v.executable) || !Array.isArray(v.groups) || !Array.isArray(v.missingStocks)) return null;
  if (!v.missingStocks.every((s) => record(s) && typeof s.code === "string" && /^\d{6}$/.test(s.code) && typeof s.reason === "string")) return null;
  if (!v.groups.every((g) => record(g) && [5, 10, 20, 30].includes(Number(g.period)) && ["leaderClass", "strategy", "touch", "boardClock", "activeClock", "panicVolume"].every((k) => typeof g[k] === "string") && stats(g.descriptive) && stats(g.executable))) return null;
  return v as StudyReport;
}
