"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { certaintyFactors, certaintyPlanIssues, entryMechanisms, expectancyScenario, mechanismOptions, panicConditions, readCertaintyCases, type CertaintyCase } from "@/lib/trade-certainty";

type Props = { fields: Record<string, string>; onChange: (key: string, value: string) => void };

function Choice({ fields, onChange, name, label, options }: Props & { name: string; label: string; options: string[] }) {
  return <label className="field"><span>{label}</span><Select value={fields[name] || options[0]} onValueChange={(value) => onChange(name, value)}><SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></label>;
}

function Note({ fields, onChange, name, label, placeholder }: Props & { name: string; label: string; placeholder: string }) {
  return <label className="field"><span>{label}</span><Textarea aria-label={label} value={fields[name] || ""} onChange={(e) => onChange(name, e.target.value)} placeholder={placeholder} /></label>;
}

export function TradeCertainty(props: Props) {
  const { fields: f } = props;
  const issues = certaintyPlanIssues(f);
  const scenario = expectancyScenario(f);
  const selected = entryMechanisms.find((item) => item.name === f.entryMechanism);
  return <Card className="span-12 certainty-card"><CardHeader><CardTitle>龙空龙：交易确定性四要素</CardTitle><p className="liquidity-note">确定性是特定条件下，成功概率、平均收益、失败损失和可执行性共同构成的优势。证据审查不等于成功概率，也不是形态评分。</p></CardHeader><CardContent className="liquidity-content">
    <p className="liquidity-summary">对应交易票：{f.ticketStock || "尚未填写标的"} · 当前周期：{f.cyclePhase || "未判断"}。所有战法共用审查；原入场、兑现与证伪沿用交易票。</p>
    <div className="certainty-factor-grid">{certaintyFactors.map((factor) => <div className="certainty-factor" key={factor.id}><strong>{factor.name}</strong><p className="liquidity-note">{factor.question}</p><Choice {...props} name={`certainty_${factor.id}_status`} label={`${factor.name}判断`} options={["待核对", "支持", "证据冲突", "否决"]} /><Note {...props} name={`certainty_${factor.id}_evidence`} label={`${factor.name}证据`} placeholder="来源、观察时间、支持与不利事实；未知如实记录" /></div>)}</div>
    <div className="form-grid two"><Choice {...props} name="entryMechanism" label="本次入场机制" options={mechanismOptions} /><Choice {...props} name="certaintyExecutable" label="可执行性核对" options={["待核对", "已评估并接受限制", "不可执行"]} /></div>
    {f.entryMechanism === "其他（说明）" && <Note {...props} name="entryMechanismOther" label="其他机制与主要风险" placeholder="兼容绕异动、出监管等原模式；写清买的是什么和失败风险" />}
    {selected && <p className="liquidity-summary">买的是：{selected.buying}。主要风险：{selected.risk}。确认重点：{selected.confirmation}。</p>}
    <Note {...props} name="certaintyExecutionEvidence" label="可执行性与尾部损失证据" placeholder="能否成交、当天是否能退出、隔夜跳空/无承接、仓位与账户损失、费用和滑点；计划止损不是保证成交" />
    <details><summary>低吸与接力：四类交易各在买什么</summary><div className="table-wrap"><table className="liquidity-rules"><thead><tr><th>入场机制</th><th>主要买什么</th><th>最大风险</th></tr></thead><tbody>{entryMechanisms.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.buying}</td><td>{item.risk}</td></tr>)}</tbody></table></div><p className="liquidity-note">四类机制不替代原四大战法：同一龙回头可能采用低吸或确认后接力，必须在入场前区分，不能被套后更换叙事。</p></details>
    {f.entryMechanism === "极致恐慌低吸" && <section className="certainty-panic"><strong>恐慌低吸候选条件链 · 待验证</strong><p className="liquidity-note">主跌释放 → 首次靠近中期均线 → 杀跌有承接 → 其他老龙止跌 → 修复预期。单纯到20/30日线不构成买点，均线止跌失败也必须记录。</p>{panicConditions.map((condition) => <div key={condition.id} className="form-grid two"><Choice {...props} name={`panic_${condition.id}_status`} label={condition.name} options={["待核对", "满足", "不满足"]} /><Note {...props} name={`panic_${condition.id}_evidence`} label={`${condition.name}证据`} placeholder={condition.prompt} /></div>)}<Note {...props} name="panicAverageBasis" label="均线与行情口径" placeholder="20/30日或其他中期均线、前复权/不复权、动态/静态、来源与日期；所有样本口径一致" /></section>}
    <details><summary>优势测算：未知胜率保持未知</summary><p className="liquidity-note">以下为可选假设测算，不能从漂亮形态或少数成功样本推算胜率。1R指本笔交易的统一风险单位；若收益已经扣费，成本另填0，避免重复扣除。</p><div className="form-grid two">{[["certaintyWinPct", "假设成功概率 %"], ["certaintyAverageWinR", "成功时平均收益 R"], ["certaintyAverageLossR", "失败时平均损失 R（正数）"], ["certaintyCostR", "平均费用与滑点 R（可留空）"]].map(([name, label]) => <label className="field" key={name}><span>{label}</span><Input aria-label={label} type="number" step="any" value={f[name] || ""} onChange={(e) => props.onChange(name, e.target.value)} placeholder="未知留空" /></label>)}</div><Note {...props} name="certaintyEstimateBasis" label="估计依据与成功定义" placeholder="假设还是历史估计？成功定义、样本范围/数量/时间、失败样本和是否扣费；不足则写未知" /><p className="liquidity-summary">{scenario ? `假设毛期望：${scenario.gross.toFixed(2)}R；${scenario.net === null ? "费用未知，净期望未计算" : `假设净期望：${scenario.net.toFixed(2)}R`}；毛盈亏平衡概率：${scenario.breakEvenPct.toFixed(1)}%。输入假设不是实测胜率；正期望也不保证盈利。` : "没有有效完整假设，暂不计算期望。成功概率0—100%，平均收益与失败损失须大于0。"}</p><p className="liquidity-note">高胜率也可能被一次大损失吞掉利润；平均损失还不能代替最坏损失、回撤及退出约束。最终风险预算沿用原退出卡。</p></details>
    <div className={`risk-banner ${issues.length ? "stopped" : ""}`}><div><strong>{issues.length ? "四要素审查尚未通过" : "四要素证据已填写 · 继续核对交易闸门"}</strong><p>{issues.length ? issues.join("；") : "这只是人工预案审查，不能称为确定盈利或已验证策略。"}</p></div></div>
  </CardContent></Card>;
}

const caseLabels: Record<keyof CertaintyCase, string> = { stock: "股票与日期", mechanism: "入场机制", before: "入场前证据", outcome: "结果与依据", execution: "损失与执行限制", lesson: "反例与均线口径" };

export function CertaintyReview(props: Props) {
  const cases = readCertaintyCases(props.fields.certaintyCases);
  function update(index: number, key: keyof CertaintyCase, value: string) {
    const next = Array.from({ length: 5 }, (_, i) => cases[i] ? { ...cases[i] } : { stock: "", mechanism: "", before: "", outcome: "", execution: "", lesson: "" });
    next[index][key] = value;
    props.onChange("certaintyCases", JSON.stringify(next));
  }
  return <Card className="span-12 certainty-card"><CardHeader><CardTitle>确定性研究 · 成功与失败样本一起记录</CardTitle><p className="liquidity-note">9月30日金健、闽东等是用户提出的待核样本线索，尚未预填为验证结果。必须同时观察未能在均线止跌、假修复后再跌等反例。</p></CardHeader><CardContent className="liquidity-content">
    <Note {...props} name="certaintyReviewMismatch" label="四要素的盘前判断与实际偏差" placeholder="哪个要素判断错了？是证据不足、规则缺口、执行偏差还是成交限制？只用当时可知信息" />
    <details><summary>登记最多五个对照样本（成功、失败、待观察）</summary><div className="table-wrap"><table className="certainty-case-table"><thead><tr><th>股票 / 日期</th><th>入场机制</th><th>入场前可见证据</th><th>结果与判定依据</th><th>损失 / 执行限制</th><th>反例与均线口径</th></tr></thead><tbody>{Array.from({ length: 5 }, (_, index) => <tr key={index}>{(["stock", "mechanism", "before", "outcome", "execution", "lesson"] as const).map((key) => <td key={key}>{key === "mechanism" ? <Select value={cases[index]?.mechanism || "未选择"} onValueChange={(value) => update(index, key, value)}><SelectTrigger aria-label={`确定性样本${index + 1}入场机制`}><SelectValue /></SelectTrigger><SelectContent>{mechanismOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> : <Textarea aria-label={`确定性样本${index + 1}${caseLabels[key]}`} value={cases[index]?.[key] || ""} onChange={(e) => update(index, key, e.target.value)} placeholder={key === "outcome" ? "成功/失败/待观察，及依据" : "未确认留空"} />}</td>)}</tr>)}</tbody></table></div></details>
    <p className="liquidity-note">样本未完成时不算失败或成功；手选样本存在选择偏差，不自动生成全市场胜率。确认“首次”、复权与动态均线口径，保留盘前证据与事后结果的边界。一次修复不能证明30日线有效。</p>
  </CardContent></Card>;
}
