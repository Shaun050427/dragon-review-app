import type { Fields, FunnelDay } from "./low-absorption";
import {readCrossSignals,type CrossSignal} from "./review-insights.ts";
export const REVIEW_VERSION = "2026-11-02";
export type MarketContext = { asOf:string; temperature:string; capitalStyle:string; permission:"observe"|"paper"|"evaluate"|"pending"; evidence:string; reason:string; catalysts:string; excludedThemes:string; strongPlan:string; weakPlan:string; crossSignals?:CrossSignal[] };
export function marketContext(f:Fields,date:string,sourceDate:string):MarketContext {
  const recent=date>="2026-11-02"&&date<="2026-11-03";
  const permission=f.marketPermission;
  return {crossSignals:readCrossSignals(f.crossMarketSignals),asOf:sourceDate,temperature:f.marketTemperature||"待核",capitalStyle:f.capitalStyle||"待核",permission:["observe","paper","evaluate"].includes(permission)?permission as MarketContext["permission"]:recent?"observe":"pending",evidence:f.marketContextEvidence||"",reason:f.marketPermissionReason||"",catalysts:f.marketCatalysts||"",excludedThemes:f.excludedThemes??(recent?"机器人、羊字辈":""),strongPlan:f.strongDivergencePlan||"强分歧再探底：先处理持仓风险，观察核心止跌与同伴承接；未确认不新增。",weakPlan:f.weakDivergencePlan||"弱分歧企稳：只跟踪盘前候选，确认低点、VWAP、主动突破与板块反馈；仍以当日新增权限为准。"};
}
export function contextIssues(c:MarketContext) {
  const out:string[]=[];
  if(!c.asOf||c.temperature==="待核"||c.capitalStyle==="待核"||!c.evidence.trim())out.push("先补齐市场温度、资金风格及收盘证据");
  if(c.permission==="pending")out.push("明确当日新增交易权限");
  if(["evaluate","paper"].includes(c.permission)&&!c.reason.trim())out.push("补充改变观察状态的依据");
  if(!c.strongPlan.trim()||!c.weakPlan.trim())out.push("补齐强分歧与弱分歧预案");
  return out;
}
export function readContext(v:unknown):MarketContext|null {
  if(!v||typeof v!=="object")return null;
  const c=v as MarketContext;
  if(c.crossSignals!==undefined&&(!Array.isArray(c.crossSignals)||readCrossSignals(JSON.stringify(c.crossSignals)).length!==c.crossSignals.length))return null;
  return [c.asOf,c.temperature,c.capitalStyle,c.evidence,c.reason,c.catalysts,c.excludedThemes,c.strongPlan,c.weakPlan].every(x=>typeof x==="string")&&["observe","paper","evaluate","pending"].includes(c.permission)?c:null;
}
export const permissionLabel=(p:MarketContext["permission"])=>({observe:"只观察 / 处理持仓",paper:"模拟验证",evaluate:"允许进入人工判断",pending:"待确认"}[p]);
export function themeLeads(days:FunnelDay[],sourceDate:string) {
  const prior=new Set(days.filter(d=>d.date<sourceDate).flatMap(d=>d.stocks.map(s=>s.industry)));
  const groups=new Map<string,{industry:string;stocks:string[];first:number;second:number;unseen:boolean}>();
  for(const s of days.find(d=>d.date===sourceDate)?.stocks||[])if(s.boards<=2){const k=s.industry||"行业待核";const g=groups.get(k)||{industry:k,stocks:[],first:0,second:0,unseen:!prior.has(k)};g.stocks.push(`${s.name} ${s.code}`);if(s.boards===1)g.first++;else g.second++;groups.set(k,g);}
  return [...groups.values()].sort((a,b)=>b.stocks.length-a.stocks.length||a.industry.localeCompare(b.industry));
}
