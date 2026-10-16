"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type BehaviorSample = {
  stock: string;
  behavior: string;
  evidence: string;
  nextReturn: string;
};

export const BEHAVIORS = ["连板晋级", "打100%", "绕100%", "打200%", "绕200%", "出监管", "龙回头", "恐慌均线低吸", "断板修复低吸", "小碎步潜伏", "N/U右侧"];
const STAGES = ["待观察", "首次破局", "出现模仿", "广泛共识", "买点前置", "负反馈扩散"];

export function parseSamples(raw: string | undefined): BehaviorSample[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5).map((item): BehaviorSample => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        stock: typeof row.stock === "string" ? row.stock : "",
        behavior: typeof row.behavior === "string" ? row.behavior : "",
        evidence: typeof row.evidence === "string" ? row.evidence : "",
        nextReturn: typeof row.nextReturn === "string" ? row.nextReturn : "",
      };
    });
  } catch { return []; }
}

type Props = {
  fields: Record<string, string>;
  onChange: (key: string, value: string) => void;
  recent: { date: string; fields: Record<string, string> }[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function EffectObserver({ fields: f, onChange, recent }: Props) {
  const samples = parseSamples(f.effectSamples);
  const updateSample = (index: number, key: keyof BehaviorSample, value: string) => {
    const next = Array.from({ length: 5 }, (_, i) => samples[i] ?? { stock: "", behavior: "", evidence: "", nextReturn: "" });
    next[index] = { ...next[index], [key]: value };
    onChange("effectSamples", JSON.stringify(next));
  };
  const summary = useMemo(() => {
    const rows = recent.flatMap(({ date, fields }) => parseSamples(fields.effectSamples).map((sample) => ({ ...sample, date })));
    return BEHAVIORS.map((behavior) => {
      const matched = rows.filter((row) => row.behavior === behavior && row.stock.trim());
      const outcomes = matched.map((row) => row.nextReturn.trim() === "" ? NaN : Number(row.nextReturn)).filter(Number.isFinite).sort((a, b) => a - b);
      const count = outcomes.length;
      return {
        behavior, total: matched.length, count,
        median: count ? ((outcomes[Math.floor((count - 1) / 2)] + outcomes[Math.floor(count / 2)]) / 2).toFixed(2) : "—",
        green: count ? `${outcomes.filter((n) => n > 0).length}/${count}` : "—",
        worst: count ? outcomes[0].toFixed(2) : "—",
      };
    }).filter((row) => row.total);
  }, [recent]);

  return <div className="panel-grid effect-observer">
    <Card className="span-12"><CardHeader><CardTitle>赚钱效应迁移 · 四要素之外的观察维度</CardTitle><p className="liquidity-note">最高标强势不等于中位接力好做；高位分歧不自动利好低吸。先比较同一观察时点的不同玩法，再写迁移假设。单只观察标只能提供线索。</p></CardHeader><CardContent className="form-grid two">
      <Field label="观察时间 / 行情来源 / 盘中或收盘"><Input value={f.migrationSource || ""} onChange={(e) => onChange("migrationSource", e.target.value)} placeholder="盘中快照不能充当收盘统计" /></Field>
      <Field label="迁移假设状态"><Select value={f.migrationState || "待观察"} onValueChange={(v) => onChange("migrationState", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["待观察", "出现线索", "跨样本支持", "证据冲突", "已证伪"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="最高标 / 中位梯队 / 市场广度"><Textarea value={f.migrationStructure || ""} onChange={(e) => onChange("migrationStructure", e.target.value)} placeholder="分别记封板或换手承接、中位晋级 / 炸板、上涨家数与指数；每项带时间和来源" /></Field>
      <Field label="接力与低吸的同口径对照"><Textarea value={f.migrationComparison || ""} onChange={(e) => onChange("migrationComparison", e.target.value)} placeholder="事前候选名单与数量、同一持有窗口、次日溢价、失败 / 回撤；不拿自己的盈利替代市场证据" /></Field>
      <Field label="独立强势还是普涨跟随"><Textarea value={f.migrationRelative || ""} onChange={(e) => onChange("migrationRelative", e.target.value)} placeholder="高位分歧时低吸标的是否仍有承接？同伴与独立模仿是否响应？指数普涨是替代解释" /></Field>
      <Field label="迁移的反证 / 暂缓条件"><Textarea value={f.migrationCounter || ""} onChange={(e) => onChange("migrationCounter", e.target.value)} placeholder="高低位同跌、低吸隔日无溢价、只有单个成功、样本不足；出现后如何撤销假设" /></Field>
      <Field label="观察标 / 自身事件"><Input value={f.migrationAnchor || ""} onChange={(e) => onChange("migrationAnchor", e.target.value)} placeholder="例如高位辨识度股；记录自身消息，避免把个股兑现解释成全市场变化" /></Field>
      <Field label="当前动作"><Select value={f.migrationAction || "空仓等待条件"} onValueChange={(v) => onChange("migrationAction", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["空仓等待条件", "优先管理已有持仓", "继续观察，不切换模式", "条件满足后按独立交易票评估"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
      {[["migrationLocked", "保持封板", "筹码锁定；记录同伴扩散，中位接力仍须单独检查"], ["migrationReseal", "开板换手后回封", "检验实际承接、回封质量和其他高标响应"], ["migrationHighLow", "高位走弱、低位独立转强", "有独立样本、相对强度与隔日溢价才支持迁移"], ["migrationBothWeak", "高低位同步走弱", "低吸假设受损；先管理持仓、暂停新增，写重新评估条件"]].map(([key, label, placeholder]) => <Field label={`情景预案：${label}`} key={key}><Textarea value={f[key] || ""} onChange={(e) => onChange(key, e.target.value)} placeholder={placeholder} /></Field>)}
    </CardContent></Card>
    <Card className="span-12"><CardHeader><CardTitle>赚钱效应迁移 · 今天市场奖励什么行为</CardTitle></CardHeader><CardContent className="form-grid two">
      <Field label="当前主导行为"><Select value={f.effectDominant || "待观察"} onValueChange={(v) => onChange("effectDominant", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="待观察">待观察</SelectItem>{BEHAVIORS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="扩散阶段"><Select value={f.effectStage || "待观察"} onValueChange={(v) => onChange("effectStage", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="最早破局样本 / 日期"><Input value={f.effectFirst || ""} onChange={(e) => onChange("effectFirst", e.target.value)} placeholder="代码、日期、具体行为" /></Field>
      <Field label="独立模仿样本 / 日期"><Input value={f.effectMimic || ""} onChange={(e) => onChange("effectMimic", e.target.value)} placeholder="第二只股票和次日反馈；未出现留空" /></Field>
      <Field label="旧玩法首次明显负反馈"><Input value={f.effectFailure || ""} onChange={(e) => onChange("effectFailure", e.target.value)} placeholder="股票、日期、隔日结果" /></Field>
      <Field label="下一个待验证样本"><Input value={f.effectWatch || ""} onChange={(e) => onChange("effectWatch", e.target.value)} placeholder="待验证的行为及其证伪事实" /></Field>
      <Field label="切换策略的可见条件"><Textarea value={f.effectSwitch || ""} onChange={(e) => onChange("effectSwitch", e.target.value)} placeholder="例如：破线后持续有溢价，且出现独立模仿；写观察条件，不写必胜判断" /></Field>
      <Field label="今天仍未确认的解释"><Textarea value={f.effectUnknown || ""} onChange={(e) => onChange("effectUnknown", e.target.value)} placeholder="将盘面事实和对资金动机的猜测分开" /></Field>
    </CardContent></Card>

    <Card className="span-12"><CardHeader><CardTitle>今天的代表样本 · 最多五只</CardTitle><p className="text-sm text-muted-foreground">行为按实际收盘结果归类；明日补填次日收盘涨跌幅。未出结果留空，不参与统计。</p></CardHeader><CardContent><div className="table-wrap"><table className="effect-table"><thead><tr><th>股票 / 代码</th><th>实际行为</th><th>证据 / 红线来源</th><th>次日收盘涨跌幅 %</th></tr></thead><tbody>{Array.from({ length: 5 }, (_, i) => { const row = samples[i] ?? { stock: "", behavior: "", evidence: "", nextReturn: "" }; return <tr key={i}><td><Input aria-label={`样本${i + 1}股票`} value={row.stock} onChange={(e) => updateSample(i, "stock", e.target.value)} placeholder="代码 + 名称" /></td><td><Select value={row.behavior || "none"} onValueChange={(v) => updateSample(i, "behavior", v === "none" ? "" : v)}><SelectTrigger aria-label={`样本${i + 1}行为`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择</SelectItem>{BEHAVIORS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></td><td><Input aria-label={`样本${i + 1}证据`} value={row.evidence} onChange={(e) => updateSample(i, "evidence", e.target.value)} placeholder="收盘偏离值 / 公告 / 交易所来源" /></td><td><Input aria-label={`样本${i + 1}次日涨跌幅`} type="number" step="0.01" value={row.nextReturn} onChange={(e) => updateSample(i, "nextReturn", e.target.value)} placeholder="待次日补填" /></td></tr>; })}</tbody></table></div></CardContent></Card>

    <Card className="span-12"><CardHeader><CardTitle>最近五个已记录交易日 · 行为反馈</CardTitle><p className="text-sm text-muted-foreground">手工录入样本的描述性统计；样本数与已填结果数分列。红盘为严格大于 0%，极值是最差次日涨跌幅。</p></CardHeader><CardContent><div className="table-wrap"><table className="effect-table"><thead><tr><th>行为</th><th>样本</th><th>已填次日结果</th><th>次日中位数</th><th>红盘数</th><th>最差结果</th></tr></thead><tbody>{summary.map((row) => <tr key={row.behavior}><td>{row.behavior}</td><td>{row.total}</td><td>{row.count}</td><td>{row.median}{row.count ? "%" : ""}</td><td>{row.green}</td><td>{row.worst}{row.count ? "%" : ""}</td></tr>)}</tbody></table>{!summary.length && <p className="empty">先录入今天的代表样本；此处不会凭空生成胜率。</p>}</div><p className="text-sm text-muted-foreground">仅是你挑选的观察样本，不能代表全市场胜率。打/绕异动以对应市场、观察窗口和官方披露规则核对；不要用“差一分钱”替代偏离值计算。</p></CardContent></Card>
  </div>;
}

