"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { readStudyReport } from "@/lib/low-absorption-report";
import type { StudyReport } from "@/lib/low-absorption-report";
const stat = (n: number | null, suffix = "") => n === null ? "—" : n.toFixed(2) + suffix;
export function LowAbsorptionResearch({ date }: { date: string }) {
  const [state, setState] = useState<{ date: string; report: StudyReport | null; message: string }>({ date: "", report: null, message: "" });
  const [leader, setLeader] = useState("all");
  const [mode, setMode] = useState("descriptive");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`https://raw.githubusercontent.com/Shaun050427/dragon-review-app/market-data/research/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.json`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!response.ok) throw new Error("missing");
        const raw = readStudyReport(await response.json(), date);
        if (!raw) throw new Error("invalid");
        if (!controller.signal.aborted) setState({ date, report: raw, message: "" });
      } catch { if (!controller.signal.aborted) setState({ date, report: null, message: "所选日期暂无可用研究报告。收盘采集生成后才展示统计；当前不能判断哪条均线更优。" }); }
    })();
    return () => controller.abort();
  }, [date]);
  const report = state.date === date ? state.report : null;
  const statsKey = mode === "executable" ? "executable" : "descriptive";
  const groups = report?.groups.filter((g) => leader === "all" || g.leaderClass === leader) ?? [];
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `low-absorption-research-${date}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <Card><CardHeader><CardTitle>MA10 / MA20 / MA30 · 分层检验</CardTitle><p>先比较样本，再决定是否保留模式。首次与重复触线、放量与缩量跌停分组展示。</p></CardHeader><CardContent className="space-y-4">
    {!report ? <p role="status" className="premium-source">{state.date === date ? state.message : "读取所选日期研究报告…"}</p> : <>
      <p className="premium-source">{report.tradeDate} · {report.kind} · 往返成本假设 {report.costPct}% · 提名股票 {report.universeStocks} 只，缺日线 {report.missingStocks.length} 只。收盘触线后，次日开盘参考入场、再下一交易日收盘参考退出。</p>
      <div className="form-grid two"><label className="field"><span>研究龙头分层</span><select aria-label="研究龙头分层" value={leader} onChange={(e) => setLeader(e.target.value)}><option value="all">全部</option><option value="C1">C1 普通连板龙候选</option><option value="C2">C2 长生命周期核心候选</option></select></label><label className="field"><span>统计口径</span><select aria-label="统计口径" value={mode} onChange={(e) => setMode(e.target.value)}><option value="descriptive">日线参考价差（不代表可成交）</option><option value="executable">已核验定时成交（非分钟策略）</option></select></label></div>
      <p className="premium-source">当前口径：成熟 {report[statsKey].completed}/{report[statsKey].samples} 个事件，涉及 {report[statsKey].stockClusters} 只股票；同股跨均线与多次触线具有相关性。{report[statsKey].warning}。</p>
      <div className="table-wrap"><table><thead><tr><th>分层 / 模式</th><th>均线 / 次数</th><th>涨停 / 活跃时钟</th><th>恐慌成交</th><th>成熟 / 全部（股票数）</th><th>胜率</th><th>平均净价差</th><th>盈利/亏损均幅</th><th>期望R</th></tr></thead><tbody>{groups.map((g, i) => <tr key={i}><td>{g.leaderClass} / {g.strategy}</td><td>MA{g.period} / {g.touch}</td><td>{g.boardClock} / {g.activeClock}</td><td>{g.panicVolume}</td><td>{g[statsKey].completed}/{g[statsKey].samples}（{g[statsKey].stockClusters}）</td><td>{stat(g[statsKey].winRatePct, "%")}</td><td>{stat(g[statsKey].meanReturnPct, "%")}</td><td>{stat(g[statsKey].payoffRatio)}</td><td>{stat(g[statsKey].expectedR)}</td></tr>)}</tbody></table>{!groups.length && <p className="premium-source">此分层没有事件；不等于没有机会。</p>}</div>
      <details><summary>研究边界、缺失样本与完整结果</summary><ul>{report.limitations.map((s) => <li key={s}>{s}</li>)}</ul>{report.missingStocks.map((s) => <p key={s.code}>{s.code}：{s.reason}</p>)}<p className="premium-source">导出包括每个事件的状态、MFE、MAE、隔夜缺口、计划赔率及失败样本，供进一步核对。</p><Button variant="outline" onClick={download}>导出完整研究样本</Button></details>
    </>}
  </CardContent></Card>;
}
