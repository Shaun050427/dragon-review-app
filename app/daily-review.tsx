"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { REVIEW_FIELDS, dailyReview, dailyReviewIssues, recoveryIssues, DAILY_REVIEW_VERSION } from "@/lib/daily-review";
import type { Fields } from "@/lib/low-absorption";

export function DailyReviewForm({ date, sourceDate, fields: f, onChange, locked }: { date: string; sourceDate: string; fields: Fields; onChange: (key: string, value: string) => void; locked: boolean }) {
  const issues = dailyReviewIssues(dailyReview(f), date, sourceDate);
  const edit = (key: string, value: string) => { onChange(key, value); onChange("reviewCompletedAt", ""); };
  const complete = f.reviewSourceDate === sourceDate && sourceDate && REVIEW_FIELDS.every(([k]) => f[k]?.trim());
  return <fieldset disabled={locked} className="space-y-4"><legend>每日复盘 → 次日预案</legend><p>先复盘，再筛选2—3只观察标的。四项各写结论与来源；未核实的数据明确写待核。提交冻结时保留复盘快照。</p><label className="field"><span>复盘数据日期（应为 {sourceDate || "待核"}）</span><Input aria-label="复盘数据日期" type="date" value={f.reviewSourceDate || ""} onChange={e => edit("reviewSourceDate", e.target.value)} /></label><div className="form-grid two">{REVIEW_FIELDS.map(([key, label, placeholder]) => <label className="field" key={key}><span>{label}</span><Textarea aria-label={label} value={f[key] || ""} placeholder={placeholder} onChange={e => edit(key, e.target.value)} /></label>)}</div><Button variant="outline" disabled={!complete} onClick={() => onChange("reviewCompletedAt", new Date().toISOString())}>记录复盘完成时间</Button><p role="status">{issues.join("；") || "复盘已完成，可继续制定预案；仍需冻结名单及盘中确认。"}</p></fieldset>;
}

export function RecoverySettings({ date, fields: f, onChange }: { date: string; fields: Fields; onChange: (key: string, value: string) => void }) {
  if(date < DAILY_REVIEW_VERSION) return null;
  const issues = recoveryIssues(date, f);
  return <div className="space-y-4"><p><b>恢复期：总仓目标10%—20%，允许空仓；单票≤5%，共同题材≤10%，单笔风险≤0.25%，每日新增风险≤0.5%，周回撤警戒2%。</b> 全部账户合并统计，按交易后敞口核查。超限先处理持仓；减仓、退出和违规补录仍可记录。计划风险不能保证实际最大损失。</p><label className="field"><span>恢复期状态</span><select aria-label="恢复期状态" value={f.recoveryMode || "repair"} onChange={e => onChange("recoveryMode", e.target.value)}><option value="repair">恢复期 · 默认只观察</option><option value="normal">结束恢复期 · 需明确依据并重新冻结</option></select></label>{f.recoveryMode === "normal" ? <label className="field"><span>结束恢复期依据</span><Textarea value={f.recoveryReleaseEvidence || ""} onChange={e => onChange("recoveryReleaseEvidence", e.target.value)} placeholder="连续复盘与预案执行、状态恢复及风险敞口；不以某天盈利为唯一依据" /></label> : <><div className="form-grid two">{[["portfolioTotalPct", "合并账户交易后总仓 %"], ["portfolioNamePct", "合并账户交易后最大单票仓位 %"], ["portfolioThemePct", "合并账户交易后最大共同题材敞口 %"], ["dailyRiskUsedPct", "当日已用新增风险 %（全部账户，不返还）"], ["weekPeakEquity", "本周合并账户净值峰值"]].map(([key, label]) => <label className="field" key={key}><span>{label}</span><Input type="number" step="any" aria-label={label} value={f[key] || ""} onChange={e => onChange(key, e.target.value)} /></label>)}</div><label><input type="checkbox" checked={f.recoveryNoAveraging === "yes"} onChange={e => onChange("recoveryNoAveraging", e.target.checked ? "yes" : "no")} /> 本笔不是浮亏摊薄、跨账户规避或退潮强行开仓</label></>}<p role="status">{issues.join("；") || "合并账户恢复期检查通过；继续核对冻结预案与盘中证据。"}</p><p className="premium-source">数据由你核实填入；系统没有券商持仓接口，不能自动发现跨账户交易。恢复期不随五日实验到期自动解除。</p></div>;
}
