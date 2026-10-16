"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { catalystOptions, readResearchSamples, researchMechanisms, researchSummary, type ResearchDay, type ResearchSample } from "@/lib/strategy-research";

type Props = { fields: Record<string, string>; onChange: (key: string, value: string) => void; days: ResearchDay[] };
const states = ["观察中", "持仓", "已结束", "放弃"];
const results = ["待观察", "未启动 / 超时", "修复兑现", "突破延续", "假突破", "均线失守 / 再跌", "其他"];

export function StrategyResearch({ fields, onChange, days }: Props) {
  const rows = readResearchSamples(fields.researchSamples);
  const summary = researchSummary(days);
  const save = (next: ResearchSample[]) => onChange("researchSamples", JSON.stringify(next));
  const update = (index: number, key: keyof ResearchSample, value: string) => save(rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const add = () => save([...rows, { id: crypto.randomUUID(), stock: "", mechanism: "", catalyst: "待归因", state: "观察中", result: "待观察", pnl: "", mae: "", days: "", before: "", after: "" }]);
  const choice = (index: number, key: keyof ResearchSample, label: string, options: string[]) => <label className="field"><span>{label}</span><Select value={rows[index][key] || "未选择"} onValueChange={(v) => update(index, key, v === "未选择" ? "" : v)}><SelectTrigger aria-label={`研究样本${index + 1}${label}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="未选择">未选择</SelectItem>{options.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></label>;
  return <Card className="span-12"><CardHeader><CardTitle>策略收益归因 · 低吸赚的是什么</CardTitle><p className="liquidity-note">主机制在入场前确定，消息催化单独标记。一个交易闭环一条记录，分批交易合计；只观察的成功、失败和迟迟未启动也保留。金额和持仓信息随每日复盘保存。</p></CardHeader><CardContent className="liquidity-content">
    <Button variant="outline" onClick={add}>添加研究 / 交易样本</Button>
    {rows.map((row, index) => <details key={row.id || index} open className="certainty-panic"><summary>样本 {index + 1} · {row.stock || "待填标的"} · {row.state || "待观察"}</summary><div className="form-grid two">
      <label className="field"><span>股票 / 代码 / 入场日期</span><Input aria-label={`研究样本${index + 1}股票`} value={row.stock} onChange={(e) => update(index, "stock", e.target.value)} /></label>
      {choice(index, "mechanism", "入场主机制", researchMechanisms)}
      {choice(index, "catalyst", "消息催化归因", catalystOptions)}
      {choice(index, "state", "记录状态", states)}
      {choice(index, "result", "结构结果（包括失败）", results)}
      {([ ["pnl", "已结束交易净盈亏 ¥（扣费）"], ["mae", "最大不利波动 %（非负）"], ["days", "持有 / 观察交易日数（整数）"]] as const).map(([key, label]) => <label className="field" key={key}><span>{label}</span><Input aria-label={`研究样本${index + 1}${label}`} type="number" step={key === "days" ? "1" : "any"} min={key === "pnl" ? undefined : "0"} value={row[key]} onChange={(e) => update(index, key, e.target.value)} placeholder="未知留空；0为有效结果" /></label>)}
      <label className="field"><span>入场前可知证据与等待期限</span><Textarea value={row.before} onChange={(e) => update(index, "before", e.target.value)} placeholder="周期、同伴、量价、首次均线、截止日期；小碎步须写前序上涨 / 换手及超时退出条件" /></label>
      <label className="field"><span>事后结果与反例</span><Textarea value={row.after} onChange={(e) => update(index, "after", e.target.value)} placeholder="实际离场、计划偏差；新增消息发生时间，不倒填为事前优势" /></label>
    </div><p className="liquidity-note">仅“已结束”且填写净盈亏的交易纳入金额统计；未成交观察样本结束时选“放弃”，保留结构结果。</p><Button variant="ghost" size="sm" onClick={() => save(rows.filter((_, i) => i !== index))}>移除此日样本</Button></details>)}
    <div className="table-wrap"><table className="effect-table"><thead><tr><th>主机制</th><th>样本 / 已结束 / 有金额</th><th>净盈亏 ¥</th><th>盈利笔数</th><th>事后新增利好子集</th><th>最大不利波动</th><th>平均持有日数</th></tr></thead><tbody>{summary.map((row) => <tr key={row.mechanism}><td>{row.mechanism}</td><td>{row.total} / {row.closed} / {row.known}</td><td>{row.known ? row.net.toFixed(2) : "—"}</td><td>{row.known ? `${row.positive}/${row.known}` : "—"}</td><td>{row.eventCount ? `${row.eventCount}笔 / ¥${row.eventNet.toFixed(2)}` : "—"}</td><td>{row.worstMae === null ? "—" : `${row.worstMae.toFixed(2)}%（${row.maeCount}笔）`}</td><td>{row.averageDays === null ? "—" : `${row.averageDays.toFixed(1)}（${row.daysCount}笔）`}</td></tr>)}</tbody></table>{!summary.length && <p className="empty">尚无已分类样本。不会根据月收益反推策略胜率。</p>}</div>
    <p className="liquidity-note">范围为截至当前复盘日期的已加载记录；同一样本跨日期保留相同ID时按最新日期去重。新增利好子集金额已包含在净盈亏中，不可重复相加；它只标记消息伴随，不能分离消息造成的收益。手选样本、缺失结果和未成交观察不能当成回测。</p>
    <label className="field"><span>本周模型审查：继续、收缩还是暂停</span><Textarea value={fields.strategyWeeklyReview || ""} onChange={(e) => onChange("strategyWeeklyReview", e.target.value)} placeholder="哪类收益重复出现？哪些依赖新增消息？列失败与未启动样本；下周只研究哪一个缺口、何时复查" /></label>
  </CardContent></Card>;
}
