"use client";
import { useEffect,useState } from "react";
import { Card,CardHeader,CardTitle,CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { readCrossSignals,signalFreshness,type CrossSignal } from "@/lib/review-insights";
import { newId } from "@/lib/trading-discipline";
import type { Fields } from "@/lib/low-absorption";
export function CrossMarketObservation({date,fields,onChange}:{date:string;fields:Fields;onChange:(k:string,v:string)=>void}){
 const rows=readCrossSignals(fields.crossMarketSignals),[now,setNow]=useState(()=>new Date());
 useEffect(()=>{const id=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(id);},[]);
 const save=(items:CrossSignal[])=>onChange("crossMarketSignals",JSON.stringify(items));
 const patch=(id:string,p:Partial<CrossSignal>)=>save(rows.map(s=>s.id===id?{...s,...p}:s));
 return <Card className="cross-market"><CardHeader className="history-head"><div><CardTitle>跨市场传导观察 · {date}</CardTitle><p>人工记录 / 可信快照；尚未接入实时订阅。只记录事实、映射和时间有效性，不输出买入推荐。所有时间为北京时间。有效期是自定义复核窗口，不代表行情实时或内容已验证。</p></div><Button variant="outline" onClick={()=>save([...rows,{id:newId(),instrument:"新观察对象",observedAt:"",source:"",method:"manual",strength:"pending",facts:"",mapping:"",relative:"",price:"",maxAgeMinutes:"30"}])}>增加跨市场观察</Button></CardHeader><CardContent><div className="knowledge-grid">{rows.map(s=><article className="knowledge-item" key={s.id}><strong>{s.instrument}</strong><p className="premium-source">{({pending:"强弱待核",weak:"弱线索",medium:"中等线索",strong:"强线索"})[s.strength]} · {signalFreshness(s,now).label}</p><p>{s.mapping||"A股映射待核"}</p><details><summary>编辑观察与证据</summary><div className="space-y-3">{([["instrument","观察对象","text"],["observedAt","信号发生时间（北京时间）","datetime-local"],["source","信息来源 / 快照链接","text"],["maxAgeMinutes","有效期（分钟，可调整）","number"],["price","当时可执行价格 / 工具限制","text"]] as const).map(([k,label,type])=><label className="field" key={k}><span>{label}</span><Input type={type} value={s[k]} onChange={e=>patch(s.id,{[k]:e.target.value})}/></label>)}<label className="field"><span>记录方式</span><select value={s.method} onChange={e=>patch(s.id,{method:e.target.value as CrossSignal["method"]})}><option value="manual">人工观察</option><option value="snapshot">带时间戳的可信快照</option></select></label><label className="field"><span>信号强弱（人工判断）</span><select value={s.strength} onChange={e=>patch(s.id,{strength:e.target.value as CrossSignal["strength"]})}>{[["pending","待核"],["weak","弱"],["medium","中"],["strong","强"]].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>{([["facts","已发生的事实（与预判分开）"],["mapping","可能传导的A股方向 / 标的，仅作映射"],["relative","时间先后 / 相对强弱 / 反证"]] as const).map(([k,label])=><label className="field" key={k}><span>{label}</span><Textarea value={s[k]} onChange={e=>patch(s.id,{[k]:e.target.value})}/></label>)}<Button variant="ghost" onClick={()=>save(rows.filter(x=>x.id!==s.id))}>删除观察</Button></div></details></article>)}</div></CardContent></Card>;
}
