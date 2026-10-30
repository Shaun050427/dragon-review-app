"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { liquidityEnvironments, liquidityPlanIssues, sameTimeVolumeRatio, thesisOptions } from "@/lib/liquidity-plan";

type Props = { fields: Record<string, string>; onChange: (key: string, value: string) => void };
type FieldSpec = { key: string; label: string; placeholder?: string; type?: string };

function Fields({ fields, onChange, specs }: Props & { specs: FieldSpec[] }) {
  return <div className="form-grid two">{specs.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}</span>{type ? <Input aria-label={label} type={type} step={type === "number" ? "any" : undefined} value={fields[key] ?? ""} onChange={(e) => onChange(key, e.target.value)} placeholder={placeholder} /> : <Textarea aria-label={label} value={fields[key] ?? ""} onChange={(e) => onChange(key, e.target.value)} placeholder={placeholder} />}</label>)}</div>;
}

function Choice({ fields, onChange, name, label, options }: Props & { name: string; label: string; options: string[] }) {
  return <label className="field"><span>{label}</span><Select value={fields[name] || options[0]} onValueChange={(v) => onChange(name, v)}><SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></label>;
}

const environmentRules = [
  ["缩量但承接稳定", "只研究核心承接后的转强，降低频率", "原逻辑仍在可持有，保留失效条件"],
  ["缩量且资金集中", "提高相对强弱要求，谨慎跟风与弱反抽", "明显落后同伴时降低持有预期"],
  ["缩量且负反馈扩大", "暂停依赖情绪扩张的追涨与老龙接力", "优先风险退出，减少对回封的依赖"],
  ["市场缩量、个股放量下跌", "巨量不能独立证明洗盘或构成抄底理由", "结合破位、反抽及同伴确认承接是否失效"],
];

export function LiquidityEnvironment(props: Props) {
  const ratio = sameTimeVolumeRatio(props.fields);
  return <Card className="liquidity-card span-12"><CardHeader><CardTitle>量能环境与接力条件</CardTitle><p className="liquidity-note">规则草案 · 待历史样本检验。缩量不是自动卖点；环境、相对强弱与承接一起判断。</p></CardHeader><CardContent className="liquidity-content">
    <Choice {...props} name="liquidityEnvironment" label="当前环境（手动判断）" options={liquidityEnvironments} />
    <Fields {...props} specs={[
      { key: "liquidityTime", label: "观察时间（北京时间）", type: "time" },
      { key: "liquidityReferenceTime", label: "基准的对应时间（必须相同）", type: "time" },
      { key: "liquidityAmount", label: "本日累计成交额（亿元）", type: "number" },
      { key: "liquidityReferenceAmount", label: "基准累计成交额（亿元）", type: "number" },
      { key: "liquidityBasis", label: "比较基准与市场范围", placeholder: "例：昨日同时间 / 最近5日同时间中位数；双方均为沪深A股，注明日期" },
      { key: "liquiditySource", label: "来源、行情时间与缺失情况", placeholder: "终端/接口、数据截至时间；只有采集时间时注明行情时间未知" },
      { key: "liquidityEvidence", label: "承接与相对强弱证据", placeholder: "指数、涨跌家数、炸板反馈、题材同伴与个股，分别写事实" },
      { key: "liquidityBuyPlan", label: "买入许可与环境否决", placeholder: "谁会在更高位置接力？何种环境变化会暂停本模式？" },
    ]} />
    <p className="liquidity-summary">{ratio === null ? "同时间量能比：待填写有效对照，不用盘中成交额对比昨日全天。" : `同时间量能比：${ratio.toFixed(2)}倍（${((ratio - 1) * 100).toFixed(1)}%）。仅描述成交额变化，不自动划分市场强弱。`}</p>
    <details><summary>展开缩量环境的买卖原则</summary><div className="table-wrap"><table className="liquidity-rules"><thead><tr><th>环境</th><th>买入</th><th>持有 / 退出</th></tr></thead><tbody>{environmentRules.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div><p className="liquidity-note">缩量＋高开秒板＋前期密集成交区：提高买入门槛，快速涨停不能替代承接验证。市场缩量与个股下跌的相关性，不等于因果关系。</p></details>
  </CardContent></Card>;
}

export function ExitPlan(props: Props) {
  const issues = liquidityPlanIssues(props.fields);
  return <div className="liquidity-content">
    <Choice {...props} name="exitThesis" label="本笔交易类型" options={thesisOptions} />
    <Fields {...props} specs={[
      { key: "exitReducePct", label: "首次触发时减仓（占当时持仓 %）", type: "number" },
      { key: "exitRiskLimit", label: "不可扩大的风险上限", placeholder: "账户金额 / R / 价格条件，注明隔夜或T+1无法卖出的最坏情景" },
      { key: "exitRemainder", label: "剩余仓位失效退出", placeholder: "反抽不收复关键位、低点持续下移等；不把等待反抽设为退出的必要条件" },
      { key: "holdingConditions", label: "允许继续持有的证据", placeholder: "原逻辑、同伴相对强弱、实际承接、环境与风险预算仍成立" },
    ]} />
    <div className={`risk-banner ${issues.length ? "stopped" : ""}`}><div><strong>{issues.length ? "退出卡 / 环境检查尚未完成" : "退出卡 / 环境检查已填写"}</strong><p>{issues.length ? issues.join("；") : "仍需完成盘中授权闸门；填写完整不代表交易一定有效。"}</p></div></div>
    <p className="liquidity-note">兑现与证伪沿用上方交易票。兑现、失效或风险上限任一触发，按预案处理。首次炸板不必机械清仓；加速失败后不能继续按加速成功的目标持有。</p>
  </div>;
}

export function HoldingExecution(props: Props) {
  const stage = props.fields.holdingStage || "未判断";
  const messages: Record<string, string> = {
    "未判断": "先用当时证据区分正常分歧与预期失效；成本价不能替代判断。",
    "正常分歧": "检查同伴、低点和主动承接，保留原有失效条件。",
    "加速失败": "降低持有预期，执行预设减仓；不能继续按加速成功的目标等待。",
    "原理由失效": "按失效预案处理可卖仓位；不能改成长期持有续命。",
    "风险上限触发": "按风险退出预案处理可卖仓位，不以仍可能反弹取消执行。",
  };
  return <Card className="liquidity-card span-12"><CardHeader><CardTitle>全天持仓处理 · 持有需要证据</CardTitle><p className="liquidity-note">新增交易以盘前冻结名单为准；持仓风险处理贯穿交易时段。当天新买普通A股受T+1约束，触发信号不保证能够立即成交。</p></CardHeader><CardContent className="liquidity-content">
    <Fields {...props} specs={[{key:"ticketStock",label:"持仓标的"}]} />
    <Fields {...props} specs={[["ticketExit","预期兑现"],["ticketInvalidation","原理由证伪"],["exitRiskLimit","风险上限"],["exitRemainder","剩余仓位退出"]].map(([key,label])=>({key,label}))} />
    <div className="form-grid two"><Choice {...props} name="holdingStage" label="当前持仓状态（手动评估）" options={Object.keys(messages)} /><Choice {...props} name="holdingAction" label="此次处理记录" options={["未记录", "继续持有", "减仓", "退出可卖仓位", "T+1 / 无承接暂无法退出"]} /></div>
    <p className={`liquidity-summary ${["原理由失效", "风险上限触发"].includes(stage) ? "liquidity-danger" : ""}`} role="status">{messages[stage]}</p>
    {["原理由失效", "风险上限触发"].includes(stage) && props.fields.holdingAction === "继续持有" && <p className="liquidity-summary liquidity-danger">状态与动作冲突：已记录失效 / 风险触发却继续持有，请复盘执行原因；无法卖出应如实记录交易限制。</p>}
    <Fields {...props} specs={[
      { key: "holdingSignalTime", label: "首次可识别信号时间（北京时间）", type: "time" },
      { key: "holdingActionTime", label: "实际处理时间（北京时间）", type: "time" },
      { key: "holdingEvidence", label: "此次持有 / 减仓 / 退出的证据", placeholder: "关键位是否收复、反抽质量、同伴反馈、原逻辑和风险上限；避免只写回本愿望" },
      { key: "holdingPlanChange", label: "变更预案时的新增证据", placeholder: "原条件 → 新条件 → 新增事实。禁止仅因浮亏扩大风险预算" },
      { key: "holdingExecution", label: "实际成交或无法成交的记录", placeholder: "价格、数量、剩余仓位；没有成交注明T+1、跌停无承接等原因" },
    ]} />
    <p className="liquidity-note">“亏很多、快回本、曾经是龙头、卖了可能回封”不能单独支持锁仓。想延后执行，先写新增证据；风险上限不得因浮亏而扩大。本页记录与提醒，不连接券商下单。</p>
  </CardContent></Card>;
}

const reviewEvents = [
  ["touch", "首次触板 / 冲入压力区"], ["break", "首次炸板 / 进攻失败"], ["level", "跌破预定关键位"], ["rebound", "首次反抽失败"], ["exit", "实际卖出 / 未能成交"],
];

export function ExitReview(props: Props) {
  return <Card className="liquidity-card span-12"><CardHeader><CardTitle>退出纪律复盘 · 用当时信息评价</CardTitle><p className="liquidity-note">不是追求卖在最高点，而是找到首次可识别的失效信号。未发生的节点留空，不根据后来的跌停倒推早盘必卖。</p></CardHeader><CardContent className="liquidity-content">
    <details><summary>记录五个关键节点（时间、当时证据与动作）</summary><div className="liquidity-events">{reviewEvents.map(([key, label]) => <div key={key}><strong>{label}</strong><Fields {...props} specs={[{ key: `exitReview_${key}_time`, label: `${label}时间`, type: "time" }, { key: `exitReview_${key}_evidence`, label: `${label}当时证据与动作`, placeholder: "只写此刻可知信息；不确定就注明，不补造价格或时间" }]} /></div>)}</div></details>
    <div className="form-grid two"><Choice {...props} name="exitDelayCause" label="退出延迟的主要原因" options={["待判断", "无延迟", "规则未写清", "信号未识别", "识别但等待回本 / 回封", "无新增证据却改预案", "T+1 / 无承接无法成交"]} /><Choice {...props} name="exitProcessGrade" label="过程评价（与最终盈亏分开）" options={["待评价", "按规则执行", "规则存在缺口", "违反规则", "执行受交易限制"]} /></div>
    <Fields {...props} specs={[
      { key: "exitFirstInvalidation", label: "首次违反交易前提的节点", placeholder: "对应哪个节点？当时已经有什么证据？是否触发盘前条件？" },
      { key: "exitCounterexample", label: "反例与规则检验", placeholder: "缩量仍强、炸板后修复等反例；为何本次能或不能区分？缺少哪些数据？" },
      { key: "exitResearchConclusion", label: "事实 / 假设 / 待检验结论", placeholder: "分别写明。缩量相关性不能证明砸盘原因，单个案例不能证明策略胜率" },
    ]} />
    <p className="liquidity-note">按规则卖出后回封，仍可能是合格执行；违规后侥幸回本，仍须纠正。明日唯一纠偏沿用“交易与纠偏”，避免重复预案。</p>
  </CardContent></Card>;
}
