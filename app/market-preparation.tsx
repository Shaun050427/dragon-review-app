"use client";
import { Card,CardHeader,CardTitle,CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { marketContext,themeLeads,permissionLabel } from "@/lib/market-preparation";
import type { Fields,FunnelDay } from "@/lib/low-absorption";
export function MarketPreparation({date,sourceDate,fields:f,onChange,days,complete,locked}:{date:string;sourceDate:string;fields:Fields;onChange:(k:string,v:string)=>void;days:FunnelDay[];complete:boolean;locked:boolean}) {
 const c=marketContext(f,date,sourceDate),leads=themeLeads(days,sourceDate);
 const select=(key:string,label:string,value:string,options:string[][])=><label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(key,e.target.value)}>{options.map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label>;
 return <Card className="market-preparation"><CardHeader><CardTitle>市场环境 → 题材 → 候选</CardTitle><p>执行日 {date} · 收盘事实截至 {sourceDate||"待核"} · 新增权限：{permissionLabel(c.permission)}</p></CardHeader><CardContent className="space-y-4"><fieldset disabled={locked}><div className="market-context-grid">
 {select("marketTemperature","市场温度",c.temperature,["待核","冰点/退潮","震荡/分歧","修复","主升"].map(v=>[v,v]))}
 {select("capitalStyle","资金风格",c.capitalStyle,["待核","趋势核心","连板接力","低位新题材","防守/轮动","混合"].map(v=>[v,v]))}
 {select("marketPermission","新增交易权限",c.permission,[["pending","待确认"],["observe","只观察 / 处理持仓"],["paper","模拟验证"],["evaluate","允许进入人工判断"]])}</div><div className="form-grid two">
 {([["marketContextEvidence","涨跌停、核心与同伴的收盘证据",c.evidence],["marketPermissionReason","权限调整依据（观察状态不等于漏填）",c.reason],["marketCatalysts","政策 / 季节 / 海外催化及来源，仅作为线索",c.catalysts],["strongDivergencePlan","强分歧 · 再探底预案",c.strongPlan],["weakDivergencePlan","弱分歧 · 企稳预案",c.weakPlan]]).map(([k,label,value])=><label className="field" key={k}><span>{label}</span><Textarea value={value} onChange={e=>onChange(k,e.target.value)}/></label>)}
 <label className="field"><span>暂不参与的旧题材（用顿号或逗号分隔）</span><Input value={c.excludedThemes} onChange={e=>onChange("excludedThemes",e.target.value)}/></label></div></fieldset>
 <p className="premium-source">11月2—3日默认只观察新开仓机会、处理持仓；可在冻结前根据证据修改。9:25后读取冻结环境。MA5 / MA10触线只进入观察，需低点确认、VWAP、量能和同伴反馈。</p>
 <details open><summary>首板 / 二板题材线索 · {sourceDate||"待核"}</summary><p className="premium-source">仅按归档行业聚合，概念归属与题材新旧需人工核实。{complete?"“窗口未见”只表示此前4个归档未出现该行业。":"归档不完整，不能判断是否窗口新出现。"}</p><div className="theme-leads table-wrap"><table><thead><tr><th>行业线索</th><th>首板 / 二板</th><th>股票</th><th>窗口记录</th></tr></thead><tbody>{leads.map(g=><tr key={g.industry}><td>{g.industry}</td><td>{g.first} / {g.second}</td><td>{g.stocks.join("、")}</td><td>{complete?(g.unseen?"此前4日未见":"窗口内出现过"):"待核"}</td></tr>)}</tbody></table>{!leads.length&&<p>准备日首板 / 二板归档尚不可用。</p>}</div></details>
 </CardContent></Card>;
}
