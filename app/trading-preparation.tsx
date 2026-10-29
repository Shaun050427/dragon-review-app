"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readArchive, readCalendar, readRadar, type Fields, type FunnelDay, type RadarSnapshot, type TradingCalendar } from "@/lib/low-absorption";
import { buildPool, freezePlan, jsonList, pickFrom, planIssues, preparationSessions, readPlan, readPicks, readCores, type CandidatePick, type Queue } from "@/lib/candidate-workflow";
const ROOT="https://raw.githubusercontent.com/Shaun050427/dragon-review-app/market-data/";
const path=(date:string)=>`${date.slice(0,4)}/${date.slice(5,7)}/${date}.json`;
async function get(uri:string,signal:AbortSignal) { const r=await fetch(ROOT+uri,{cache:"no-store",signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!r.ok)throw new Error(String(r.status));return r.json(); }
export function TradingPreparation({date,fields:f,onChange,onCalendar}:{date:string;fields:Fields;onChange:(k:string,v:string)=>void;onCalendar:(v:TradingCalendar|null)=>void}) {
  const [state,setState]=useState<{date:string;calendar:TradingCalendar|null;days:FunnelDay[];radar:RadarSnapshot|null;sessions:string[];error:string}>({date:"",calendar:null,days:[],radar:null,sessions:[],error:""});
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id);},[]);
  const [loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0),[filter,setFilter]=useState("A");
  const [manual,setManual]=useState({code:"",name:"",industry:"",date:"",evidence:""}),[message,setMessage]=useState("");
  useEffect(()=>{const c=new AbortController(); const run=async()=>{setLoading(true);try {
    const calendar=readCalendar(await get("trading-calendar.json",c.signal));if(!calendar)throw new Error("交易日历格式无效");
    const sessions=preparationSessions(date,calendar,f.preparationAsOf||undefined),last=sessions.at(-1);if(!last)throw new Error("没有执行日前的已知交易日");
    const [archives,radar]=await Promise.all([Promise.all(sessions.map(async d=>{try{return readArchive(await get("daily/"+path(d),c.signal),d);}catch{return null;}})),get("radar/"+path(last),c.signal).then(v=>readRadar(v,last)).catch(()=>null)]);
    if(!c.signal.aborted){setState({date,calendar,days:archives.filter((v):v is FunnelDay=>v!==null),radar,sessions,error:""});onCalendar(calendar);}
  }catch(e){if(!c.signal.aborted){setState({date,calendar:null,days:[],radar:null,sessions:[],error:e instanceof Error?e.message:"采集失败"});onCalendar(null);}}finally{if(!c.signal.aborted)setLoading(false);}};void run();return()=>c.abort();},[date,f.preparationAsOf,refresh,onCalendar]);
  const active=state.date===date, sessions=active?state.sessions:[],days=active?state.days:[],radar=active?state.radar:null,last=sessions.at(-1)||"", missing=sessions.filter(d=>!days.some(x=>x.date===d));
  const cores=readCores(f.manualCores);
  const threshold=Number(f.poolLiquidityWan||10000)*10000;
  const pool=buildPool(sessions,days,radar,Number.isFinite(threshold)&&threshold>=0?threshold:1e8,cores);
  const picks=readPicks(f.candidateDraft);
  const plan=readPlan(f.candidatePlan), validPlan=plan?.executionDate===date?plan:null;
  const locked=Boolean(validPlan?.kind==="premarket" && now>=Date.parse(`${date}T09:25:00+08:00`));
  const setPicks=(v:CandidatePick[])=>onChange("candidateDraft",JSON.stringify(v));
  const patch=(code:string,v:Partial<CandidatePick>)=>setPicks(picks.map(p=>p.code===code?{...p,...v}:p));
  const calendarConfirmed=Boolean(state.calendar?.sessions.includes(date) || f.preparationSessionConfirmed==="yes");
  const issues=planIssues(picks,f.preparationFlat==="yes",sessions,missing);
  const shown=pool.filter(s=>filter==="all"||filter==="C"?(filter==="all"||!s.queue):s.queue===filter);
  function freeze() {
    if(validPlan?.kind==="premarket" && new Date().getTime()>=Date.parse(`${date}T09:25:00+08:00`)){setMessage("9:25后盘前名单锁定，不能改写。");return;}
    if(!calendarConfirmed){setMessage("请先核对执行日与准备日的交易日历。");return;}
    if(last!==preparationSessions(date,state.calendar).at(-1)){setMessage("截止日早于最近已知交易日；请刷新完整窗口后准备。");return;}
    if(picks.some(p=>!pool.some(s=>s.code===p.code&&s.liquidity!=="excluded"))){setMessage("名单含池外股票或流动性低于筛选阈值，请重新筛选。");return;}
    try{const next=freezePlan(date,sessions,missing,picks,f.preparationFlat==="yes"); if(validPlan)onChange("candidatePlanHistory",JSON.stringify([...jsonList(f.candidatePlanHistory),validPlan]));onChange("candidatePlan",JSON.stringify(next));
      for(let i=0;i<3;i++){const s=picks[i];onChange(["candidate","candidate2","candidate3"][i],s?.name||"");onChange(["allowedSetup","allowedSetup2","allowedSetup3"][i],s?`${s.strategy} ${s.trigger}`:"");onChange(["invalidations","invalidations2","invalidations3"][i],s?.abandon||"");}
      setMessage(next.kind==="premarket"?"盘前名单已冻结；请提交保存。":"已记录为盘后补录，仅供复盘，不能授权当前实盘。");
    }catch(e){setMessage(e instanceof Error?e.message:"冻结失败");}
  }
  return <div className="workflow space-y-4"><Card><CardHeader className="history-head"><div><CardTitle>盘前有限观察池 · A / B / C</CardTitle><p>执行日 {date} · 准备日 {last||"待核"}。前一晚确定2—3只；9:25核预期差；9:30后只验证预定买点。先把顶部交易日切到要执行的那一天。</p></div><Button variant="outline" onClick={()=>setRefresh(v=>v+1)} disabled={loading}>刷新候选池</Button></CardHeader><CardContent className="space-y-4">
    <div className="workflow-queues"><div><b>A · 2进3分歧池</b><p>准备日所有2板股。流动性过滤后制定深水反核预案。</p><strong>{pool.filter(s=>s.queue==="A").length} 只</strong></div><div><b>B · MA5首次分歧池</b><p>近期3板以上或活跃核心，首次回踩MA5。未知事实保留待核。</p><strong>{pool.filter(s=>s.queue==="B").length} 只</strong></div><div><b>C · 跨题材轮动池</b><p>独立涨停与活跃行业仅作线索。弱势背景、相对强度及接替主线需要人工验证。</p><strong>{new Set(pool.map(s=>s.industry).filter(Boolean)).size} 个行业线索</strong></div></div>
    {loading&&<p role="status">读取执行日前5个真实交易日归档…</p>}{active&&state.error&&<p role="alert">{state.error}</p>}
    <p className="premium-source">窗口：{sessions.join("、")||"日历待核"}。涨停/炸板归档 {days.length}/5。{missing.length?`缺少 ${missing.join("、")}；不能冻结可执行名单。`:""}日线快照：{radar?last:"缺失，MA5首次触线待核"}。不以自然日、文件个数或未来行情代替交易日。</p>
    <div className="form-grid two"><label className="field"><span>准备截止日（可留空取执行日前最近交易日）</span><Input type="date" value={f.preparationAsOf||""} onChange={e=>onChange("preparationAsOf",e.target.value)}/></label><label className="field"><span>A池成交额下限 · 万元（可调整）</span><Input type="number" min="0" value={f.poolLiquidityWan||"10000"} onChange={e=>onChange("poolLiquidityWan",e.target.value)}/></label></div>
    {!state.calendar?.sessions.includes(date)&&<label><input type="checkbox" checked={f.preparationSessionConfirmed==="yes"} onChange={e=>onChange("preparationSessionConfirmed",e.target.checked?"yes":"no")}/> 已在交易所日历核对：{date} 是交易日，{last||"所选准备日"} 是其上一交易日</label>}
    <div className="workflow-actions">{[["A","A · 二板"],["B","B · 首次MA5"],["C","C · 轮动线索"],["all","完整有限池"]].map(([v,t])=><Button key={v} size="sm" variant={filter===v?"default":"outline"} onClick={()=>setFilter(v)}>{t}</Button>)}</div>
    {filter==="C"&&<p className="premium-source">{[...new Set(pool.map(s=>s.industry).filter(Boolean))].join("、")||"暂无行业线索"}。行业字段不是题材强度评分，选择后须补充轮动证据。</p>}
    <div className="table-wrap"><table><thead><tr><th>股票</th><th>入池事实</th><th>队列 / 流动性</th><th>操作</th></tr></thead><tbody>{shown.map(s=><tr key={s.code}><td>{s.name}<small>{s.code} · {s.industry}</small></td><td>{s.reasons.join("；")}</td><td>{s.queue||"C线索/待核"}<small>{s.queue==="A"?s.liquidity==="pass"?"成交额达阈值":s.liquidity==="excluded"?"成交额不足·排除":"成交额未知·人工核查":"流动性人工核查"}</small></td><td><Button size="sm" variant="outline" disabled={locked||picks.length>=3||picks.some(p=>p.code===s.code)||s.liquidity==="excluded"} onClick={()=>setPicks([...picks,pickFrom(s)])}>加入最终候选</Button></td></tr>)}</tbody></table>{!shown.length&&!loading&&<p>当前队列暂无可确认候选。数据不足不能解释为市场没有机会。</p>}</div>
    <details><summary>补充最近5交易日内有证据的活跃核心</summary><div className="form-grid two">{([["code","六位代码"],["name","名称"],["industry","行业/题材"],["date","活跃日期"],["evidence","当时核心地位与来源证据"]] as const).map(([k,label])=><label className="field" key={k}><span>{label}</span><Input type={k==="date"?"date":"text"} value={manual[k]} onChange={e=>setManual({...manual,[k]:e.target.value})}/></label>)}</div><Button variant="outline" disabled={locked} onClick={()=>{if(!/^\d{6}$/.test(manual.code)||!manual.name.trim()||!manual.evidence.trim()||!sessions.includes(manual.date)){setMessage("补充核心须有六位代码、名称、窗口内活跃日期及证据。");return;}onChange("manualCores",JSON.stringify([...cores.filter(c=>c.code!==manual.code),manual]));setMessage("已补充有证据的观察核心，尚未进入最终名单。");}}>补充到有限池</Button></details>
  </CardContent></Card>
  <Card><CardHeader><CardTitle>前一晚 · 最终2—3只与观察区</CardTitle><p>S0：当前主升核心首次MA5分歧。S1：近期连板核心日内强分歧反核。S2仅观察与回测。队列与策略分别记录，不因入池自动买入。</p></CardHeader><CardContent className="space-y-4">
    {validPlan&&<div className="notice-row"><div><strong>{validPlan.kind==="premarket"?"已冻结盘前名单":"盘后补录 · 仅供研究"}</strong><p>{validPlan.picks.map(p=>`${p.name} ${p.strategy} ${p.low}—${p.high}`).join("；")||"明确空仓"} · 冻结 {new Date(validPlan.capturedAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})}</p><p>冻结名单是执行依据。自由文字补充不会新增执行候选。{locked?"9:25后不能改写盘前名单。":"修改草稿后需重新冻结，旧版本保留。"}</p></div></div>}
    <label><input type="checkbox" disabled={locked} checked={f.preparationFlat==="yes"} onChange={e=>{onChange("preparationFlat",e.target.checked?"yes":"no");if(e.target.checked)setPicks([]);}}/> 明确选择空仓（不勉强凑满候选）</label>
    {picks.map(p=><article className="discipline-rule" key={p.code}><div className="workflow-actions"><b>{p.name} {p.code}</b><Button variant="ghost" disabled={locked} onClick={()=>setPicks(picks.filter(x=>x.code!==p.code))}>移出候选</Button></div><fieldset disabled={locked}><div className="form-grid two"><label className="field"><span>候选队列</span><select value={p.queue} onChange={e=>patch(p.code,{queue:e.target.value as Queue})}>{["A","B","C"].map(v=><option key={v}>{v}</option>)}</select></label><label className="field"><span>策略</span><select value={p.strategy} onChange={e=>patch(p.code,{strategy:e.target.value as CandidatePick["strategy"]})}><option value="S0">S0 · 首次MA5</option><option value="S1">S1 · 日内反核</option><option value="S2">S2 · 仅观察回测</option></select></label>{([["low","观察区下沿"],["high","观察区上沿"]] as const).map(([k,label])=><label className="field" key={k}><span>{label}</span><Input type="number" step="any" value={p[k]} onChange={e=>patch(p.code,{[k]:e.target.value})}/></label>)}{([["trigger","预先定义的触发条件"],["abandon","放弃条件与赔率边界"],["coreEvidence","主升/连板核心地位与来源证据"]] as const).map(([k,label])=><label className="field" key={k}><span>{label}</span><Textarea value={p[k]} onChange={e=>patch(p.code,{[k]:e.target.value})}/></label>)}{p.queue==="C"&&<label className="field"><span>弱势背景 / 独立强度 / 接替主线验证</span><Textarea value={p.rotationEvidence} onChange={e=>patch(p.code,{rotationEvidence:e.target.value})}/></label>}</div><div className="workflow-actions"><label><input type="checkbox" checked={p.liquidityConfirmed} onChange={e=>patch(p.code,{liquidityConfirmed:e.target.checked})}/> 流动性已核查</label>{p.strategy==="S0"&&<label><input type="checkbox" checked={p.ma5Confirmed} onChange={e=>patch(p.code,{ma5Confirmed:e.target.checked})}/> 已核实主升后首次MA5分歧（记录来源）</label>}</div></fieldset></article>)}
    <p className="premium-source">{issues.join("；")||"候选预案字段完整，仍须竞价、盘中资金与风险核验。"}</p><Button disabled={locked||loading||issues.length>0||!calendarConfirmed} onClick={freeze}>冻结盘前名单</Button>{message&&<p role="status">{message}</p>}
    {f.candidatePlanHistory&&<details><summary>此前冻结版本（保留审计）</summary><pre className="workflow-json">{f.candidatePlanHistory}</pre></details>}
  </CardContent></Card></div>;
}
