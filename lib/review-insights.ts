import type { Fields } from "./low-absorption";
export const EVIDENCE_FIELDS = [["authenticity","题材真实性"],["position","板块地位"],["seal","前日封板情况"],["divergence","筹码分歧"],["buyPoint","可执行买点"]] as const;
export type CandidateEvidence = Record<typeof EVIDENCE_FIELDS[number][0],string>;
export const emptyEvidence=():CandidateEvidence=>({authenticity:"",position:"",seal:"",divergence:"",buyPoint:""});
export function validEvidence(v:unknown):v is CandidateEvidence {return Boolean(v&&typeof v==="object"&&EVIDENCE_FIELDS.every(([k])=>typeof (v as CandidateEvidence)[k]==="string"));}
export function candidateEvidence(f:Fields,code:string,fallback?:CandidateEvidence):CandidateEvidence {return Object.fromEntries(EVIDENCE_FIELDS.map(([k])=>[k,f[`comparison_${code}_${k}`]??fallback?.[k]??""])) as CandidateEvidence;}
export type CrossSignal={id:string;instrument:string;observedAt:string;source:string;method:"manual"|"snapshot";strength:"pending"|"weak"|"medium"|"strong";facts:string;mapping:string;relative:string;price:string;maxAgeMinutes:string};
export const CROSS_INSTRUMENTS=["费城半导体指数","纳斯达克指数","AMD等重要财报","韩国半导体","现货黄金","相关ETF"];
export function readCrossSignals(raw:string|undefined):CrossSignal[]{
 if(raw===undefined)return CROSS_INSTRUMENTS.map((instrument,i)=>({id:`cross-${i}`,instrument,observedAt:"",source:"",method:"manual",strength:"pending",facts:"",mapping:"",relative:"",price:"",maxAgeMinutes:i<3?"1440":"30"}));
 try{const a=JSON.parse(raw);return Array.isArray(a)?a.filter(s=>s&&[s.id,s.instrument,s.observedAt,s.source,s.facts,s.mapping,s.relative,s.price,s.maxAgeMinutes].every(x=>typeof x==="string")&&["manual","snapshot"].includes(s.method)&&["pending","weak","medium","strong"].includes(s.strength)):[];}catch{return [];}
}
export function chinaTimestamp(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))return NaN;
 const normalized=value.length===16?value+":00":value,ms=Date.parse(normalized+"+08:00");
 return Number.isFinite(ms)&&new Date(ms+8*3600000).toISOString().slice(0,19)===normalized?ms:NaN;
}
export function signalFreshness(s:CrossSignal,now=new Date()){
 const at=chinaTimestamp(s.observedAt),limit=Number(s.maxAgeMinutes),age=(now.getTime()-at)/60000;
 if(!s.source.trim()||!s.facts.trim()||!Number.isFinite(at)||!(limit>0)||limit>2880)return {status:"pending",label:"待核：补齐来源、事实、时间及有效期"};
 if(age<0)return {status:"future",label:"时间在未来，不能作为已发生信号"};
 return age>limit?{status:"stale",label:`已过期 · ${Math.floor(age)}分钟前`}:{status:"fresh",label:`时间有效 · ${Math.floor(age)}分钟前（内容仍需核实）`};
}
export type StyleReview={id:string;capturedAt:string;observedAt:string;method:"manual"|"snapshot";source:string;facts:string;style:string;code:string;afterExit:boolean;period:string;consensus:string;chips:string;payoff:string;decision:"observe"|"recheck"|"reject";planCapturedAt:string;ruleSummary:string};
export function readStyleReviews(raw:string|undefined):StyleReview[]{try{const a=JSON.parse(raw||"[]");return Array.isArray(a)?a.filter(s=>s&&[s.id,s.capturedAt,s.observedAt,s.source,s.facts,s.style,s.code,s.period,s.consensus,s.chips,s.payoff,s.planCapturedAt,s.ruleSummary].every(x=>typeof x==="string")&&typeof s.afterExit==="boolean"&&["manual","snapshot"].includes(s.method)&&["observe","recheck","reject"].includes(s.decision)):[];}catch{return [];}}
export function styleReviewIssues(s:StyleReview,date:string,now=new Date()){
 const out:string[]=[],time=chinaTimestamp(s.observedAt);
 if(!s.observedAt.startsWith(date+"T")||!Number.isFinite(time)||time>now.getTime())out.push("观察时间须属于本交易日且已经发生");
 if(!s.source.trim()||!s.facts.trim()||!s.style.trim())out.push("补齐来源、资金风格和变化事实");
 if(s.decision==="recheck"&&(!/^\d{6}$/.test(s.code)||![s.period,s.consensus,s.chips,s.payoff].every(x=>x.trim())))out.push("重新评价需明确代码，并独立填写周期位置、资金共识、筹码结构、盈亏结构");
 return out;
}
export const REVIEW_KNOWLEDGE=[
 {id:"cross-market-leading-1104",content:"跨市场领先信号\n费半、AMD业绩、韩国半导体、国际黄金等，可能领先影响A股相关题材。必须同时确认时间顺序、A股映射标的的相对强弱，以及实际可执行价格。研究规则，尚未证明历史优势。"},
 {id:"exit-reentry-independent-1104",content:"退出与再买入相互独立\n原持仓触发卖点，不代表释放的资金必须立即重新投入；新仓位应独立通过市场环境、资金共识、筹码结构与盈亏结构四项判断。不因卖出后上涨改写盘前规则；先作为研究记录。"}
];
