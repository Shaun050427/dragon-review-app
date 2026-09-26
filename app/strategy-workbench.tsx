"use client";

import { AlertTriangle, ArrowRight, Ban, Crosshair, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  fields: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

type Strategy = {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  accent: string;
  environments: string;
  buy: string;
  sell: string;
  warning: string;
};

const strategies: Strategy[] = [
  {
    id: "redline",
    code: "RA-1",
    name: "绕严重异动",
    subtitle: "红线套利 · 主升",
    accent: "cyan",
    environments: "主升 / 成型 / 首次分歧",
    buy: "T-1 健康分歧，0轴或合理水下，次日仍有红线空间",
    sell: "动态红线前留 0.2%—0.5% 安全垫；弱于预期提前兑现",
    warning: "T-1 买点 = 合理价格 + 赚钱效应仍在。空间不是买盘；同题材核心集体负反馈、交易过度拥挤、节前隔夜风险任一失控，只能小仓试错或放弃，禁止因价格到位直接满仓",
  },
  {
    id: "release",
    code: "RA-2",
    name: "博弈出监管",
    subtitle: "弹性恢复 · 主升/二波",
    accent: "violet",
    environments: "主升 / 二波预备",
    buy: "监管结束前一日，缩量不跌且解除预期未被提前交易",
    sell: "解除日第一次明显加速；事件仓兑现，趋势仓另行判断",
    warning: "盘后必须确认是否续杯；到期日不等于自动解除",
  },
  {
    id: "return",
    code: "LM-1",
    name: "龙回头",
    subtitle: "龙头记忆 · 反抽/二波",
    accent: "amber",
    environments: "冰点修复 / 修复转上升",
    buy: "缩量止跌、关键位守住后首次主动转强；不接第一次暴跌",
    sell: "反抽卖压力位；只有重新带动板块，才升级为二波",
    warning: "区分反抽与二波；强势反抽次日竞价明显低于预期，开盘不能修复则原理由失效。-3%只作观察阈值，不作自动卖点。",
  },
  {
    id: "shape",
    code: "CS-1",
    name: "N字 / U型",
    subtitle: "筹码结构 · 右侧确认",
    accent: "green",
    environments: "混沌转强 / 趋势行情",
    buy: "N字二腿小仓、三腿突破加仓；U型只做右侧颈线突破",
    sell: "突破后不能快速扩张或重新跌回平台，按假突破退出",
    warning: "形态只是辅助，必须叠加龙头记忆、题材或催化",
  },
];

const statusOptions = ["关闭", "观察", "T-2", "T-1", "触发", "持仓", "兑现", "证伪"];

function number(value: string | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function StrategyWorkbench({ fields: f, onChange }: Props) {
  const equity = number(f.currentEquity, 100000);
  const riskPct = number(f.riskPerTradePct, 0.5);
  const dailyR = number(f.dailyStopR, 2);
  const riskCny = equity * riskPct / 100;
  const dailyLossLimit = riskCny * dailyR;
  const activeStrategies = strategies.filter((item) => !["", "关闭", "兑现", "证伪"].includes(f[`${item.id}Status`] ?? "关闭")).length;
  const originalReason = f.ticketStrategy ?? "未选择";

  return <div className="strategy-workbench">
    <section className="command-strip">
      <div className="command-title">
        <p>今日决策顺序</p>
        <strong>环境 <ArrowRight /> 身份 <ArrowRight /> 模式 <ArrowRight /> 触发 <ArrowRight /> 风险</strong>
      </div>
      <div className="command-facts">
        <div><span>允许环境</span><b>{f.cyclePhase || "未判断"}</b></div>
        <div><span>激活模式</span><b>{activeStrategies} / 4</b></div>
        <div><span>单笔 1R</span><b>¥{riskCny.toFixed(0)}</b></div>
        <div><span>日内熔断</span><b>¥{dailyLossLimit.toFixed(0)}</b></div>
      </div>
    </section>

    <section className="strategy-grid">
      {strategies.map((item) => {
        const status = f[`${item.id}Status`] ?? "关闭";
        const candidate = f[`${item.id}Candidate`] ?? "";
        return <Card key={item.id} className={`strategy-card strategy-${item.accent} ${status === "触发" || status === "持仓" ? "is-active" : ""}`}>
          <CardHeader>
            <div className="strategy-heading">
              <div><span className="strategy-code">{item.code}</span><CardTitle>{item.name}</CardTitle><p>{item.subtitle}</p></div>
              <Select value={status} onValueChange={(v) => onChange(`${item.id}Status`, v)}><SelectTrigger className="strategy-status"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent className="strategy-body">
            <div className="strategy-rule"><span>适用</span><p>{item.environments}</p></div>
            <div className="strategy-rule"><span>买点</span><p>{item.buy}</p></div>
            <div className="strategy-rule"><span>卖点</span><p>{item.sell}</p></div>
            <div className="strategy-rule danger"><span>否决</span><p>{item.warning}</p></div>
            <div className="strategy-inputs">
              <Field label="唯一候选"><Input value={candidate} onChange={(e) => onChange(`${item.id}Candidate`, e.target.value)} placeholder="股票 + 代码" /></Field>
              <Field label="身份"><Select value={f[`${item.id}Role`] ?? "未确认"} onValueChange={(v) => onChange(`${item.id}Role`, v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["未确认","核心龙头","分支核心","容量中军","次龙","后排否决"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="触发条件"><Textarea value={f[`${item.id}Trigger`] ?? ""} onChange={(e) => onChange(`${item.id}Trigger`, e.target.value)} placeholder="价格、量能、板块与时间条件" /></Field>
              <Field label="证伪条件"><Textarea value={f[`${item.id}Invalidation`] ?? ""} onChange={(e) => onChange(`${item.id}Invalidation`, e.target.value)} placeholder="出现即结束，不得改叙事" /></Field>
            </div>
          </CardContent>
        </Card>;
      })}
    </section>

    <section className="risk-ticket-grid">
      <Card className="risk-card">
        <CardHeader><CardTitle><ShieldCheck />账户风险闸门</CardTitle></CardHeader>
        <CardContent className="risk-content">
          <div className="risk-numbers">
            <Field label="单笔最大风险（账户 %）"><Input type="number" step="0.1" min="0.1" max="2" value={f.riskPerTradePct ?? "0.5"} onChange={(e) => onChange("riskPerTradePct", e.target.value)} /></Field>
            <Field label="单日停止交易（R）"><Input type="number" step="0.5" min="1" max="4" value={f.dailyStopR ?? "2"} onChange={(e) => onChange("dailyStopR", e.target.value)} /></Field>
            <Field label="连续失败降仓（笔）"><Input type="number" min="2" max="5" value={f.lossStreakLimit ?? "3"} onChange={(e) => onChange("lossStreakLimit", e.target.value)} /></Field>
            <Field label="今日已实现 R"><Input type="number" step="0.1" value={f.realizedR ?? "0"} onChange={(e) => onChange("realizedR", e.target.value)} /></Field>
          </div>
          <div className={`risk-banner ${number(f.realizedR) <= -dailyR ? "stopped" : ""}`}>
            {number(f.realizedR) <= -dailyR ? <Ban /> : <ShieldCheck />}
            <div><strong>{number(f.realizedR) <= -dailyR ? "已触发熔断：停止新增交易" : "风险预算正常"}</strong><p>1R = ¥{riskCny.toFixed(0)}；单日最大计划损失 = ¥{dailyLossLimit.toFixed(0)}。仓位必须由证伪距离反推。</p></div>
          </div>
          <Field label="隔夜 / 节假日 / T+1 最坏情景"><Textarea value={f.gapRisk ?? ""} onChange={(e) => onChange("gapRisk", e.target.value)} placeholder="若次日直接低开或监管突发，账户最多损失多少？" /></Field>
        </CardContent>
      </Card>

      <Card className="ticket-card">
        <CardHeader><CardTitle><Crosshair />唯一交易票</CardTitle></CardHeader>
        <CardContent className="ticket-content">
          <div className="ticket-lock"><span>原始理由</span><strong>{originalReason}</strong><small>建仓后不得改成另一套战法续命</small></div>
          <div className="form-grid two">
            <Field label="执行标的"><Input value={f.ticketStock ?? ""} onChange={(e) => onChange("ticketStock", e.target.value)} placeholder="股票 + 代码" /></Field>
            <Field label="唯一模式"><Select value={f.ticketStrategy ?? "未选择"} onValueChange={(v) => onChange("ticketStrategy", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="未选择">未选择</SelectItem>{strategies.map((item) => <SelectItem key={item.code} value={`${item.code} ${item.name}`}>{item.code} {item.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="入场触发"><Input value={f.ticketEntry ?? ""} onChange={(e) => onChange("ticketEntry", e.target.value)} placeholder="满足才下单" /></Field>
            <Field label="计划仓位 %"><Input type="number" min="0" max="100" value={f.ticketPosition ?? ""} onChange={(e) => onChange("ticketPosition", e.target.value)} /></Field>
            <Field label="预期兑现"><Textarea value={f.ticketExit ?? ""} onChange={(e) => onChange("ticketExit", e.target.value)} placeholder="价格 / 事件 / 盘面触发" /></Field>
            <Field label="唯一证伪"><Textarea value={f.ticketInvalidation ?? ""} onChange={(e) => onChange("ticketInvalidation", e.target.value)} placeholder="触发即结束本笔交易" /></Field>
          </div>
          <div className="ticket-warning"><AlertTriangle /><span>若原始理由失效，本笔交易结束。之后即使出现另一模式，也必须重新建立独立交易票。</span></div>
        </CardContent>
      </Card>
    </section>

  </div>;
}
