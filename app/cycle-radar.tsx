"use client";

import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  fields: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Choice({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>;
}

const opportunityRows = [
  ["冰点后的第一笔", "老龙反核", "极端负反馈被主动修复", "只有情绪冲动，没有承接"],
  ["修复后的第一笔", "核心穿越 / 老龙二波", "突破前高且原属性响应", "只反抽、不带板块"],
  ["同身位淘汰", "新龙卡位", "竞争者掉队，胜者获得唯一性", "仍是多龙混战"],
  ["扩张后的第一笔", "新龙首次真分歧", "加速后放量承接、梯队未崩", "亏钱效应扩散到核心"],
  ["龙头确认以后", "属性补涨 / 20cm弹性", "龙头创造题材并向低位扩散", "高潮日才追后排"],
  ["高潮以后", "空仓等待淘汰", "只观察分歧后谁活下来", "把普涨当成新周期确立"],
];

export function CycleRadar({ fields: f, onChange }: Props) {
  const set = (key: string) => (value: string) => onChange(key, value);

  return <>
    <Card className="span-12 cycle-summary"><CardHeader><CardTitle>新旧周期判定 · 先定性质，再选模式</CardTitle></CardHeader><CardContent className="form-grid two">
      <Field label="当前周期性质"><Choice value={f.cycleNature || "新旧过渡"} onChange={set("cycleNature")} options={["旧周期退潮","冰点修复","旧龙修复","新旧过渡","新周期启动试错","新周期确认","情绪扩张","高潮一致","首次大分歧"]} /></Field>
      <Field label="今日第一机会"><Choice value={f.primaryOpportunity || "空仓等待"} onChange={set("primaryOpportunity")} options={["空仓等待","老龙反核","老龙反抽","老龙二波","新龙卡位","新龙首次真分歧","龙头属性补涨","20cm弹性","容量中军趋势"]} /></Field>
      <Field label="老龙所处状态"><Choice value={f.oldLeaderState || "观察"} onChange={set("oldLeaderState")} options={["观察","A杀","反核","反抽","二波尝试","二波确认","二波失败"]} /></Field>
      <Field label="新龙所处状态"><Choice value={f.newLeaderState || "观察"} onChange={set("newLeaderState")} options={["观察","同身位竞争","卡位胜出","连续加速","等待首次真分歧","首次分歧承接","首次分歧失败","绕异动"]} /></Field>
      <Field label="周期成立证据"><Textarea value={f.cycleEvidence || ""} onChange={(e) => onChange("cycleEvidence", e.target.value)} placeholder="高度、涨停家数、昨日涨停溢价、反核反馈、梯队、主线/中军、亏钱效应。必须写事实。" /></Field>
      <Field label="模式证据与证伪"><Textarea value={f.opportunityEvidence || ""} onChange={(e) => onChange("opportunityEvidence", e.target.value)} placeholder="为什么今天最该做这个模式？" /><Textarea value={f.opportunityInvalidation || ""} onChange={(e) => onChange("opportunityInvalidation", e.target.value)} placeholder="出现什么事实，立即降级为空仓？" /></Field>
      <div className="decision-banner span-12"><ArrowRight /><strong>判断口径</strong><span>情绪上升段启动，不等于新主周期已经确立。新周期必须经过第一次大分歧，分歧后活下来的核心才有资格定性。</span></div>
    </CardContent></Card>

    <Card className="span-6"><CardHeader><CardTitle>同身位卡位淘汰赛</CardTitle></CardHeader><CardContent className="form-grid two">
      <Field label="竞争者 A"><Input value={f.rivalA || ""} onChange={(e) => onChange("rivalA", e.target.value)} placeholder="股票 / 身位 / 题材" /></Field>
      <Field label="竞争者 B"><Input value={f.rivalB || ""} onChange={(e) => onChange("rivalB", e.target.value)} placeholder="股票 / 身位 / 题材" /></Field>
      <Field label="胜者与胜出时点"><Textarea value={f.rivalWinner || ""} onChange={(e) => onChange("rivalWinner", e.target.value)} placeholder="竞价、开盘、回封还是尾盘？" /></Field>
      <Field label="失败者负反馈"><Textarea value={f.rivalLoserFeedback || ""} onChange={(e) => onChange("rivalLoserFeedback", e.target.value)} placeholder="掉队、炸板、大面；是否强化胜者唯一性？" /></Field>
      <Field label="唯一性证据"><Textarea value={f.uniquenessEvidence || ""} onChange={(e) => onChange("uniquenessEvidence", e.target.value)} placeholder="不是因为它涨停，而是竞争者死后它是否成为唯一。" /></Field>
      <Field label="龙头是否创造题材"><Textarea value={f.attributeSpread || ""} onChange={(e) => onChange("attributeSpread", e.target.value)} placeholder="龙头属性向低位复制，还是原题材先强、个股跟随？" /></Field>
    </CardContent></Card>

    <Card className="span-6"><CardHeader><CardTitle>新龙首次真分歧</CardTitle></CardHeader><CardContent className="form-grid two">
      <Field label="观察标的"><Input value={f.divergenceLeader || ""} onChange={(e) => onChange("divergenceLeader", e.target.value)} /></Field>
      <Field label="结果"><Choice value={f.divergenceResult || "未发生"} onChange={set("divergenceResult")} options={["未发生","承接成功","弱修复","分歧失败"]} /></Field>
      <Field label="前置加速 / 缩量条件"><Textarea value={f.divergencePrerequisite || ""} onChange={(e) => onChange("divergencePrerequisite", e.target.value)} placeholder="前一日是否加速？这是第几次加速？" /></Field>
      <Field label="竞价是否被核"><Textarea value={f.divergenceAuction || ""} onChange={(e) => onChange("divergenceAuction", e.target.value)} /></Field>
      <Field label="下杀承接 / 回封主动性"><Textarea value={f.divergenceSupport || ""} onChange={(e) => onChange("divergenceSupport", e.target.value)} placeholder="承接来自龙头主动，还是被板块硬推？" /></Field>
      <Field label="梯队与后排反馈"><Textarea value={f.divergenceBackRow || ""} onChange={(e) => onChange("divergenceBackRow", e.target.value)} placeholder="同梯队是否先死，后排是否批量负反馈？" /></Field>
      <div className="decision-banner span-12"><strong>优先级</strong><span>首次真分歧是市场选择，通常比“绕异动”更重要；连续缩量加速不是舒服的新买点。</span></div>
    </CardContent></Card>

    <Card className="span-7 risk-card"><CardHeader><CardTitle>重点监控与“续杯”检查</CardTitle></CardHeader><CardContent className="form-grid two">
      <Field label="标的"><Input value={f.monitorStock || ""} onChange={(e) => onChange("monitorStock", e.target.value)} /></Field>
      <Field label="当前状态"><Choice value={f.monitorStatus || "不涉及"} onChange={set("monitorStatus")} options={["不涉及","监控中","到期日待盘后确认","已解除","无缝续杯","重新纳入"]} /></Field>
      <Field label="监控窗口"><Input value={f.monitorWindow || ""} onChange={(e) => onChange("monitorWindow", e.target.value)} placeholder="开始日—到期日" /></Field>
      <Field label="历史续杯 / 重纳次数"><Input type="number" min="0" value={f.monitorRenewals || "0"} onChange={(e) => onChange("monitorRenewals", e.target.value)} /></Field>
      <Field label="到期日"><Input type="date" value={f.monitorExpiry || ""} onChange={(e) => onChange("monitorExpiry", e.target.value)} /></Field>
      <Field label="盘后新名单确认"><Input value={f.monitorAfterClose || ""} onChange={(e) => onChange("monitorAfterClose", e.target.value)} placeholder="来源 / 时间 / 新窗口；未确认写‘待查’" /></Field>
      <Field label="交易逻辑"><Textarea value={f.monitorThesis || ""} onChange={(e) => onChange("monitorThesis", e.target.value)} placeholder="是监管节点套利，还是市场自身选择的核心？" /></Field>
      <Field label="逻辑失效与卖出"><Textarea value={f.monitorExit || ""} onChange={(e) => onChange("monitorExit", e.target.value)} placeholder="续杯、该强不强、冲高回落等触发动作。" /></Field>
      <div className="risk-warning span-12"><ShieldAlert /><div><strong>硬规则</strong><p>“到期”不等于自动解除。若交易逻辑依赖监管解除，盘后未确认新名单前，不得把次日解除当作确定事实；到期日疯狂加速还要警惕预期透支和再次续杯。</p></div></div>
    </CardContent></Card>

    <Card className="span-5 risk-card"><CardHeader><CardTitle>严重异常波动余量</CardTitle></CardHeader><CardContent className="form-grid two">
      <Field label="标的"><Input value={f.abnormalStock || ""} onChange={(e) => onChange("abnormalStock", e.target.value)} /></Field>
      <Field label="观察窗口"><Input value={f.abnormalWindow || ""} onChange={(e) => onChange("abnormalWindow", e.target.value)} placeholder="起止日 / 规则窗口" /></Field>
      <Field label="当前累计偏离值 %"><Input type="number" step="0.01" value={f.abnormalDeviation || ""} onChange={(e) => onChange("abnormalDeviation", e.target.value)} /></Field>
      <Field label="距阈值百分点"><Input type="number" step="0.01" value={f.abnormalGap || ""} onChange={(e) => onChange("abnormalGap", e.target.value)} /></Field>
      <Field label="同向异常次数"><Input type="number" min="0" value={f.abnormalCount || ""} onChange={(e) => onChange("abnormalCount", e.target.value)} /></Field>
      <Field label="对应指数区间变化 %"><Input type="number" step="0.01" value={f.abnormalIndex || ""} onChange={(e) => onChange("abnormalIndex", e.target.value)} /></Field>
      <Field label="估算可用价格空间"><Input value={f.abnormalRoom || ""} onChange={(e) => onChange("abnormalRoom", e.target.value)} placeholder="写区间、假设与数据时点" /></Field>
      <Field label="结论 / 次日限制"><Textarea value={f.abnormalConclusion || ""} onChange={(e) => onChange("abnormalConclusion", e.target.value)} /></Field>
      <div className="risk-warning span-12"><AlertTriangle /><div><strong>禁止简算</strong><p>偏离值按个股区间收益减对应指数区间收益计算，不能把“距100还差几点”直接当成股价还能涨几点；同向异常次数必须并行检查。</p></div></div>
    </CardContent></Card>

    <Card className="span-12"><CardHeader><CardTitle>阶段机会地图</CardTitle></CardHeader><CardContent><div className="table-wrap"><table className="opportunity-table"><thead><tr><th>盘面节点</th><th>优先模式</th><th>必须看到</th><th>一票否决</th></tr></thead><tbody>{opportunityRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div><p className="system-formula">冰点做反核 → 修复做核心穿越 → 同身位做唯一卡位 → 扩张做新龙首分 → 高潮不追后排，等待淘汰。</p></CardContent></Card>
  </>;
}
