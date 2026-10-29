import type { Fields, FunnelDay, RadarSnapshot, TradingCalendar } from "./low-absorption";
import type { DisciplineBook } from "./trading-discipline";
export type Queue = "A" | "B" | "C";
export type PoolStock = { code: string; name: string; industry: string; maxBoards: number; sourceDate: string; reasons: string[]; queue: Queue | ""; liquidity: "pass" | "unknown" | "excluded"; ma5First: boolean };
export type ManualCore = { code: string; name: string; industry: string; date: string; evidence: string };
export type CandidatePick = { code: string; name: string; queue: Queue; strategy: "S0" | "S1" | "S2"; low: string; high: string; trigger: string; abandon: string; coreEvidence: string; liquidityConfirmed: boolean; ma5Confirmed: boolean; rotationEvidence: string };
export type FrozenPlan = { schemaVersion: 1; executionDate: string; sourceDate: string; sessions: string[]; missing: string[]; capturedAt: string; kind: "premarket" | "retrospective"; picks: CandidatePick[]; flat: boolean };
export type ExecutionSample = { id: string; code: string; name: string; strategy: string; capturedAt: string; signalTime: string; signalPrice: string; seenTime: string; seenPrice: string; fillTime: string; fillPrice: string; shares: string; evidence: string; review: string; mode: "paper" | "live"; newPosition: boolean };
export const chinaDate = (now = new Date()) => new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
export function jsonList<T>(raw: string | undefined): T[] { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
export function readPicks(raw: string | undefined): CandidatePick[] { return jsonList<CandidatePick>(raw).filter(p=>p && /^\d{6}$/.test(p.code) && typeof p.name === "string" && ["A","B","C"].includes(p.queue) && ["S0","S1","S2"].includes(p.strategy) && [p.low,p.high,p.trigger,p.abandon,p.coreEvidence,p.rotationEvidence].every(v=>typeof v === "string") && typeof p.liquidityConfirmed === "boolean" && typeof p.ma5Confirmed === "boolean"); }
export function readCores(raw: string | undefined): ManualCore[] { return jsonList<ManualCore>(raw).filter(m=>m && [m.code,m.name,m.industry,m.date,m.evidence].every(v=>typeof v === "string")); }
export function preparationSessions(executionDate: string, calendar: TradingCalendar | null, asOf?: string) { return calendar?.sessions.filter(d => d < executionDate && (!asOf || d <= asOf)).slice(-5) ?? []; }
export function buildPool(sessions: string[], days: FunnelDay[], radar: RadarSnapshot | null, threshold = 1e8, manual: ManualCore[] = []) {
  const last = sessions.at(-1) || "", map = new Map<string, PoolStock>();
  const add = (code: string, name: string, industry: string, date: string, boards: number, reason: string) => {
    const prev = map.get(code);
    map.set(code, { code, name, industry, sourceDate: date, maxBoards: Math.max(prev?.maxBoards || 0, boards), reasons: [...new Set([...(prev?.reasons || []), reason])], queue: prev?.queue || "", liquidity: prev?.liquidity || "unknown", ma5First: prev?.ma5First || false });
  };
  for (const day of [...days].filter(d => sessions.includes(d.date)).sort((a,b)=>a.date.localeCompare(b.date))) {
    for (const s of day.stocks) { add(s.code,s.name,s.industry,day.date,s.boards, `${day.date} ${s.boards}板`);
      if (day.date === last && s.boards === 2) { const p = map.get(s.code)!; p.queue = "A"; p.liquidity = s.turnover == null ? "unknown" : s.turnover < threshold ? "excluded" : "pass"; }
    }
    for (const s of day.broken || []) add(s.code,s.name,s.industry,day.date,0,`${day.date} 炸板（不等于连板断板）`);
    const previous = days.find(d => d.date === sessions[sessions.indexOf(day.date) - 1]);
    for (const s of previous?.stocks || []) if (s.boards >= 2 && !day.stocks.some(x => x.code === s.code)) add(s.code,s.name,s.industry,day.date,s.boards,`${day.date} 连板中断候选，收盘状态待核`);
  }
  if (radar?.tradeDate === last) for (const m of radar.stocks) {
    if (m.error || m.dataDate !== last) continue;
    const active = m.research?.lastActive;
    if (!map.has(m.code) && active && sessions.includes(active)) add(m.code,m.name || m.code,m.industry || "",last,m.maxBoards || 0,`有效进攻 ${active}，核心地位待核`);
    const p = map.get(m.code); if (!p) continue;
    const t = m.research?.touches.find(t => t.period === 5);
    p.ma5First = Boolean(t?.touching && t.touchCount === 1);
    if (p.queue !== "A" && p.ma5First && (p.maxBoards >= 3 || Boolean(active && sessions.includes(active)))) p.queue = "B";
  }
  for (const m of manual) if (/^\d{6}$/.test(m.code) && m.name?.trim() && m.evidence?.trim() && sessions.includes(m.date)) add(m.code,m.name,m.industry,m.date,0,`人工核心：${m.evidence}`);
  return [...map.values()].sort((a,b)=>Number(b.queue === "A")-Number(a.queue === "A") || b.maxBoards-a.maxBoards || a.code.localeCompare(b.code));
}
export function pickFrom(s: PoolStock): CandidatePick { return { code:s.code,name:s.name,queue:s.queue || "C",strategy:s.queue === "B" ? "S0" : "S1",low:"",high:"",trigger:"",abandon:"",coreEvidence:"",liquidityConfirmed:s.liquidity === "pass",ma5Confirmed:s.ma5First,rotationEvidence:"" }; }
export function planIssues(picks: CandidatePick[], flat: boolean, sessions: string[], missing: string[]) {
  const out: string[] = [];
  if (sessions.length !== 5 || new Set(sessions).size !== 5 || missing.length) out.push("需5个真实交易日且归档完整");
  if (flat ? picks.length > 0 : picks.length < 2 || picks.length > 3) out.push("保留2—3只候选，或明确选择空仓");
  if (new Set(picks.map(p=>p.code)).size !== picks.length) out.push("候选不可重复");
  for (const p of picks) {
    if (!(Number(p.low)>0 && Number(p.high)>=Number(p.low)) || !p.trigger.trim() || !p.abandon.trim() || !p.coreEvidence.trim() || !p.liquidityConfirmed) out.push(`${p.name}：补齐观察区、触发、放弃、核心证据和流动性`);
    if (p.strategy === "S2") out.push(`${p.name}：S2仅观察回测`);
    if (p.strategy === "S0" && !p.ma5Confirmed) out.push(`${p.name}：核实主升后首次MA5分歧`);
    if (p.queue === "C" && !p.rotationEvidence.trim()) out.push(`${p.name}：核实弱势背景、相对强度与轮动证据`);
  } return out;
}
export function freezePlan(executionDate: string,sessions: string[],missing: string[],picks: CandidatePick[],flat: boolean,now = new Date()): FrozenPlan {
  const issues = planIssues(picks,flat,sessions,missing); if (issues.length) throw new Error(issues.join("；"));
  const capturedAt = now.toISOString();
  return { schemaVersion:1,executionDate,sourceDate:sessions.at(-1)!,sessions:[...sessions],missing:[...missing],picks:structuredClone(picks),flat,capturedAt,kind:now.getTime() < Date.parse(`${executionDate}T09:25:00+08:00`) ? "premarket" : "retrospective" };
}
export function readPlan(raw: string | undefined): FrozenPlan | null {
  try { const p = JSON.parse(raw || "null") as FrozenPlan;
    if (!p || p.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(p.executionDate) || !Array.isArray(p.sessions) || p.sessions.length !== 5 || !p.sessions.every((d,i)=>typeof d === "string" && d < p.executionDate && (!i || d > p.sessions[i-1])) || p.sourceDate !== p.sessions.at(-1) || !Array.isArray(p.missing) || !Array.isArray(p.picks) || typeof p.flat !== "boolean" || !["premarket","retrospective"].includes(p.kind) || !Number.isFinite(Date.parse(p.capturedAt))) return null;
    if (!p.picks.every(x=>x && /^\d{6}$/.test(x.code) && typeof x.name === "string" && ["A","B","C"].includes(x.queue) && ["S0","S1","S2"].includes(x.strategy) && [x.low,x.high,x.trigger,x.abandon,x.coreEvidence,x.rotationEvidence].every(v=>typeof v === "string"))) return null;
    return p;
  } catch { return null; }
}
export function repairStatus(book: DisciplineBook, date: string, calendar: TradingCalendar | null) {
  const r=book.repair, covered=Boolean(calendar && date<=calendar.coveredThrough && r.startDate>=calendar.coveredFrom);
  const count=covered ? calendar!.sessions.filter(d=>d>=r.startDate && d<=date).length : null;
  return {active:r.enabled && Boolean(r.startDate) && date>=r.startDate && (count === null || count<=5),count,covered};
}
export function executionIssues(date: string, f: Fields, book: DisciplineBook, calendar: TradingCalendar | null, now=new Date()) {
  const issues:string[] = [], p=readPlan(f.candidatePlan);
  if (date!==chinaDate(now)) issues.push("历史或未来日期不能授权当前实盘");
  if (!p || p.executionDate!==date) return [...issues,"尚无本交易日冻结名单"];
  if (p.kind!=="premarket" || Date.parse(p.capturedAt)>=Date.parse(`${date}T09:25:00+08:00`)) issues.push("盘后补录不能成为盘前授权");
  if (calendar && preparationSessions(date,calendar).at(-1)!==p.sourceDate) issues.push("准备日不是执行日前最近已知交易日，需重新准备");
  if (p.flat || planIssues(p.picks,p.flat,p.sessions,p.missing).length) issues.push("候选预案不完整或已选择空仓");
  const pick=p.picks.find(x=>x.code===f.plannedCode); if (!pick) return [...issues,"所选股票不在冻结名单"];
  if (f.executionCandidate !== pick.name) issues.push("执行候选必须与冻结名单所选股票一致");
  const x=(key:string)=>f[`execution_${pick.code}_${key}`] || "";
  if (x("auction")!=="yes" || !x("auctionEvidence").trim()) issues.push("9:25预期差、同伴与赔率待核");
  if (x("sector")!=="yes" || !x("sectorEvidence").trim()) issues.push("板块未系统恶化需有证据");
  const low=Number(x("low")), high=Number(x("high")), price=Number(x("price")), time=x("time");
  if (!(low>=Number(pick.low) && low<=Number(pick.high) && high>low && price>high) || x("stopped")!=="yes" || x("breakout")!=="yes" || !x("evidence").trim()) issues.push("观察区内恐慌低点、止跌与主动突破H待核");
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time) || time<"09:30" || !(time<="11:30:00" || time>="13:00" && time<="15:00:00") || Date.parse(`${date}T${time.length===5?time+":00":time}+08:00`)>now.getTime()) issues.push("信号时间须为已经发生的连续交易时段");
  if (pick.strategy==="S2") issues.push("S2仅观察回测");
  if (repairStatus(book,date,calendar).active) {
    if (!(Number(f.riskPerTradePct)>0 && Number(f.riskPerTradePct)<=Number(book.repair.riskCap)) || !(Number(book.repair.riskCap)>0 && Number(book.repair.riskCap)<=1)) issues.push("修复期单笔计划风险须≤设置上限且不超过1%");
    if (!(Number(book.repair.positionCap)>0 && Number(book.repair.positionCap)<100 && Number(f.maxPosition)>0 && Number(f.maxPosition)<=Number(book.repair.positionCap))) issues.push("修复期需自行设置单票集中度并控制计划仓位");
    const count=readSamples(f.executionSamples).filter(s=>s.mode==="live" && s.newPosition && s.fillTime && Number(s.fillPrice)>0).length;
    const limit=Number(book.repair.maxNewPositions); if (!(limit>=1 && limit<=1) || count>=limit) issues.push("修复期每天最多一笔需盘中判断的新开仓");
  }
  return issues;
}
export function readSamples(raw: string | undefined): ExecutionSample[] { return jsonList<ExecutionSample>(raw).filter(s=>s && typeof s.id==="string" && typeof s.code==="string" && ["paper","live"].includes(s.mode) && [s.name,s.strategy,s.capturedAt,s.signalTime,s.signalPrice,s.seenTime,s.seenPrice,s.fillTime,s.fillPrice,s.shares,s.evidence,s.review].every(x=>typeof x==="string") && typeof s.newPosition==="boolean"); }
function seconds(t:string) { if (!/^\d{2}:\d{2}(:\d{2})?$/.test(t)) return null; const a=t.split(":").map(Number); return a[0]<24 && a[1]<60 && (a[2]||0)<60 ? a[0]*3600+a[1]*60+(a[2]||0) : null; }
export function deviations(s:ExecutionSample) {
  const a=seconds(s.signalTime),b=seconds(s.seenTime),c=seconds(s.fillTime);
  const delta=(t:number|null,u:number|null)=>t!==null && u!==null ? (u-t)/60 : null;
  const price=(v:string)=>Number(s.signalPrice)>0 && Number(v)>0 ? (Number(v)/Number(s.signalPrice)-1)*100 : null;
  return { discoveryMinutes:delta(a,b),fillMinutes:delta(a,c),executionMinutes:delta(b,c),seenPricePct:price(s.seenPrice),fillPricePct:price(s.fillPrice),extraCost:Number(s.fillPrice)>0 && Number(s.signalPrice)>0 && Number(s.shares)>0 ? (Number(s.fillPrice)-Number(s.signalPrice))*Number(s.shares):null };
}
export function deviationSummary(samples:ExecutionSample[],mode:"live"|"paper"="live") { const xs=samples.filter(s=>s.mode===mode && s.evidence.trim()).map(deviations).filter(d=>d.fillMinutes!==null && d.fillMinutes>=0 && d.discoveryMinutes!==null && d.discoveryMinutes>=0 && d.executionMinutes!==null && d.executionMinutes>=0 && d.fillPricePct!==null); return {count:xs.length,minutes:xs.length?xs.reduce((n,d)=>n+d.fillMinutes!,0)/xs.length:null,pricePct:xs.length?xs.reduce((n,d)=>n+d.fillPricePct!,0)/xs.length:null}; }
