"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stock = { code: string; name: string; changePct: number; lastPrice: number; yesterdayBoards: number; sector: string; yesterdaySeal: string };
type Snapshot = { schemaVersion: 1; tradeDate: string; observedAt: string; source: string; stocks: Stock[] };

const endpoint = "https://raw.githubusercontent.com/Shaun050427/dragon-review-app/market-data/yesterday-premium.json";
const chinaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : 0; };

export function YesterdayPremium() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`行情快照暂不可用（HTTP ${response.status}）`);
      const result = await response.json() as Snapshot;
      if (result.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(result.tradeDate) || !Array.isArray(result.stocks) || !Number.isFinite(Date.parse(result.observedAt)) || result.stocks.some((s) => !Number.isFinite(s.changePct))) throw new Error("行情快照格式异常");
      setData(result); setError(""); setNow(Date.now());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "行情快照读取失败"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { setNow(Date.now()); void refresh(); }, 60000); return () => window.clearInterval(timer); }, [refresh]);
  const fresh = data && data.tradeDate === chinaDate() && now - Date.parse(data.observedAt) >= 0 && now - Date.parse(data.observedAt) <= 12 * 60_000;
  const changes = data?.stocks.map((s) => s.changePct) ?? [];
  const positives = changes.filter((n) => n > 0).length;
  const board2 = data?.stocks.filter((s) => s.yesterdayBoards >= 2) ?? [];
  return <Card className="span-12"><CardHeader className="history-head"><div><CardTitle>昨日涨停次日溢价 · 行情观察</CardTitle><p>昨日涨停股池的今日现价涨跌幅；同口径的正收益率和中位数。不是开盘价溢价或实际可成交收益。</p></div><Button variant="outline" onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} />刷新</Button></CardHeader><CardContent>
    <div className="premium-meta"><strong className={fresh ? "saved" : "dirty"}>{fresh ? "行情快照有效" : "行情已过期 / 等待今日快照"}</strong><span>交易日：{data?.tradeDate ?? "—"} · 采集：{data ? new Date(data.observedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "—"}（北京时间）</span></div>
    {error && <p className="dirty">{error}；当前数据仅供历史参考。</p>}
    {data && <><div className="premium-metrics"><div>样本数 <b>{changes.length}</b></div><div>正收益占比 <b>{changes.length ? `${(positives / changes.length * 100).toFixed(1)}%` : "—"}</b></div><div>涨跌幅中位数 <b>{changes.length ? pct(median(changes)) : "—"}</b></div><div>昨日 2 板及以上 <b>{board2.length ? pct(median(board2.map((s) => s.changePct))) : "—"}</b></div></div>
      <div className="table-wrap premium-table"><table><thead><tr><th>股票</th><th>板数</th><th>昨日封板</th><th>今日涨跌幅</th><th>行业</th></tr></thead><tbody>{[...data.stocks].sort((a, b) => b.yesterdayBoards - a.yesterdayBoards || b.changePct - a.changePct).map((s) => <tr key={s.code}><td>{s.name} <small>{s.code}</small></td><td>{s.yesterdayBoards}</td><td>{s.yesterdaySeal || "—"}</td><td className={s.changePct >= 0 ? "up" : "down"}>{pct(s.changePct)}</td><td>{s.sector}</td></tr>)}</tbody></table></div></>}
    <p className="premium-source">数据：<a href="https://quote.eastmoney.com/ztb/detail#type=zrzt" target="_blank" rel="noreferrer">东方财富昨日涨停股池</a>，通过 <a href="https://akshare.akfamily.xyz/data/stock/stock.html" target="_blank" rel="noreferrer">AKShare 接口</a>采集，每约 5 分钟尝试更新一次；网站每分钟检查新快照。GitHub 定时任务可能延迟，过期时请以行情终端核对。快照不自动修改私人复盘。</p>
  </CardContent></Card>;
}
