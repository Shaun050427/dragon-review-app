export type ClassicCase = { id: string; title: string; date: string; stock: string; pattern: string; facts: string; planned: string; actual: string; lesson: string; sourceUrl: string; imageUrl: string };
export type Discipline = { id: string; title: string; detail: string; required: boolean; cases: ClassicCase[] };
export type DisciplineBook = { schemaVersion: 1; updatedAt: string; rules: Discipline[]; knowledge?: import("./trading-knowledge").KnowledgeBook; repair: { enabled: boolean; startDate: string; riskCap: string; positionCap: string; maxNewPositions: string } };
export const newId = () => crypto.randomUUID();
export function defaultBook(): DisciplineBook {
  return { schemaVersion: 1, updatedAt: "", rules: [
    ["plan", "前一晚只保留2—3只候选", "从最近5个交易日的有限观察池确定观察区、触发和放弃条件；不临时增加陌生股票。"],
    ["missed", "错过最佳买点，可以不买", "买点已失去优势，不因仍有上涨预期而强行参与；不因买贵的遗憾补仓摊薄成本。"],
    ["phases", "盘中只验证预案", "9:25核对预期差、同伴与赔率；9:30后观察区、恐慌低点、主动突破和板块承接共同满足才进入交易判断。"],
    ["focus", "只重点验证S0和S1", "S0：当前主升核心首次MA5分歧。S1：近期连板核心日内强分歧反核。S2：MA20/30仅观察与回测。"],
    ["risk", "修复期降低交易强度", "轻仓或模拟验证新模式；单笔计划风险0.5%—1%，避免单票近全仓，每天最多一笔需盘中判断的新开仓。计划风险不保证实际最大损失。"],
    ["correlation", "按共同风险来源检查持仓", "同属科技方向的不同题材也可能同步下跌；加仓来自新的资金确认，不来自回本目标。"],
    ["record", "区分策略和执行问题", "记录首次合格信号、实际发现与成交的时间和价格；保留失败与未交易样本，实盘和模拟分开统计。"],
  ].map(([id, title, detail]) => ({ id, title, detail, required: false, cases: [] })), repair: { enabled: true, startDate: "", riskCap: "1", positionCap: "", maxNewPositions: "1" } };
}
export function readBook(v: unknown): DisciplineBook | null {
  if (!v || typeof v !== "object") return null;
  const b = v as DisciplineBook;
  const keys = ["title", "date", "stock", "pattern", "facts", "planned", "actual", "lesson", "sourceUrl", "imageUrl"] as const;
  if (b.schemaVersion !== 1 || typeof b.updatedAt !== "string" || !Array.isArray(b.rules) || !b.repair || typeof b.repair.enabled !== "boolean" || ![b.repair.startDate,b.repair.riskCap,b.repair.positionCap,b.repair.maxNewPositions].every(x => typeof x === "string")) return null;
  if (!b.rules.every(r => r && typeof r.id === "string" && r.id && typeof r.title === "string" && typeof r.detail === "string" && typeof r.required === "boolean" && Array.isArray(r.cases) && r.cases.every(c => c && typeof c.id === "string" && c.id && keys.every(k => typeof c[k] === "string")) && new Set(r.cases.map(c => c.id)).size === r.cases.length) || new Set(b.rules.map(r => r.id)).size !== b.rules.length) return null;
  if (b.knowledge !== undefined && (!b.knowledge || ![b.knowledge.notes,b.knowledge.risks].every(items => Array.isArray(items) && items.every(item => item && typeof item.id === "string" && item.id.trim() && typeof item.content === "string") && new Set(items.map(item => item.id)).size === items.length))) return null;
  return b;
}
export function sameBook(a: DisciplineBook, b: DisciplineBook) { return JSON.stringify({ ...a, updatedAt: "" }) === JSON.stringify({ ...b, updatedAt: "" }); }
export function moveRule(book: DisciplineBook, from: string, to: string) {
  const rules = [...book.rules], a = rules.findIndex(r => r.id === from), b = rules.findIndex(r => r.id === to);
  if (a < 0 || b < 0 || a === b) return book;
  const [rule] = rules.splice(a, 1); rules.splice(b, 0, rule); return { ...book, rules };
}
export function safeCaseUrl(raw: string) { try { const url = new URL(raw); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } }
