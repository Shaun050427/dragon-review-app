"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

type Stock = { code: string; name: string; industry: string; boards: number; firstSeal: string; lastSeal: string; limitStats: string; turnover: number; openCount: number };
type Review = {
  schemaVersion: number; tradeDate: string; observedAt: string;
  counts: { limitUp: number; limitDown: number; broken: number; firstBoard: number };
  ladder: Record<string, string[]>;
  industries: { name: string; count: number; codes: string[] }[];
  stocks: Stock[];
  lhb: { code: string; name: string; reason: string; netBuy: number }[];
};
const root = "https://raw.githubusercontent.com/Shaun050427/dragon-review-app/market-data";

export function LimitReview({ date }: { date: string }) {
  const [data, setData] = useState<Review | null>(null);
  const [status, setStatus] = useState("加载中…");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(`${root}/daily/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? "该日没有归档（休市或采集失败）" : `读取失败 (${response.status})`);
      const review = await response.json() as Review;
      if (review.schemaVersion !== 1 || review.tradeDate !== date || !Array.isArray(review.stocks)) throw new Error("归档格式与所选日期不符");
      setData(review); setStatus("");
    } catch (error) { setData(null); setStatus(error instanceof Error ? error.message : "读取失败"); }
    finally { setBusy(false); }
  }, [date]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 60000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);
  const path = `${root}/daily/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}`;
  const downloadHtml = async () => {
    try {
      const response = await fetch(`${path}.html`, { cache: "no-store" });
      if (!response.ok) throw new Error("HTML 下载失败");
      const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `${date}_涨停复盘.html`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setStatus(error instanceof Error ? error.message : "HTML 下载失败"); }
  };
  const names = new Map(data?.stocks.map((stock) => [stock.code, stock.name]));
  return <Card className="span-12"><CardHeader className="history-head"><div><CardTitle>每日涨停复盘图 · {date}</CardTitle><p>行情事实自动归档；个人题材判断和三个候选仍按原有方式保存在私有复盘中。</p></div><Button variant="outline" onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} />刷新</Button></CardHeader><CardContent>
    {status && <p className="premium-source">{status}。归档从本功能启用后的交易日开始，不补造历史数据。</p>}
    {data?.tradeDate === date && <div className="limit-review">
      <div className="premium-meta"><span className="saved">采集 {new Date(data.observedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（北京时间）</span><a href={`${path}.png`} target="_blank" rel="noreferrer">打开高清 PNG</a><Button variant="link" onClick={() => void downloadHtml()}>下载排版 HTML</Button><a href={`${path}.json`} target="_blank" rel="noreferrer">原始 JSON</a></div>
      <div className="limit-facts"><div>涨停<strong>{data.counts.limitUp}</strong></div><div>首板<strong>{data.counts.firstBoard}</strong></div><div>跌停<strong>{data.counts.limitDown}</strong></div><div>炸板<strong>{data.counts.broken}</strong></div></div>
      <h3>连板梯队</h3><div className="limit-ladder">{Object.entries(data.ladder).sort(([a], [b]) => Number(b) - Number(a)).map(([level, codes]) => <div key={level}><b>{level}板 · {codes.length}家</b><span>{codes.map((code) => `${names.get(code) ?? code} ${code}`).join(" / ")}</span></div>)}</div>
      <h3>行业分布</h3><div className="limit-industries">{data.industries.map((item) => <span key={item.name}>{item.name} <b>{item.count}</b></span>)}</div>
      <details><summary>展开全部涨停股与封板时间（{data.stocks.length}）</summary><div className="table-wrap premium-table"><table><thead><tr><th>股票</th><th>连板</th><th>近 N 日涨停</th><th>首次封板</th><th>最后封板</th><th>炸板次数</th><th>成交额</th><th>行业</th></tr></thead><tbody>{data.stocks.map((s) => <tr key={s.code}><td>{s.name} <small>{s.code}</small></td><td>{s.boards}</td><td>{s.limitStats}</td><td>{s.firstSeal}</td><td>{s.lastSeal}</td><td>{s.openCount}</td><td>{(s.turnover / 1e8).toFixed(2)}亿</td><td>{s.industry}</td></tr>)}</tbody></table></div></details>
      <h3>已披露龙虎榜</h3>{data.lhb.length ? <div className="limit-industries">{data.lhb.map((item) => <span key={item.code} title={item.reason}>{item.name} · 净买{(item.netBuy / 1e8).toFixed(2)}亿</span>)}</div> : <p className="premium-source">采集时暂无榜单；暂不推断游资身份。</p>}
      <p className="premium-source">来源：东方财富行情中心、龙虎榜，经 AKShare 采集。行业字段不是题材或概念；“近 N 日涨停”沿用数据源原字段，不等于连板。龙虎榜晚于收盘披露，15:20 与 16:10（北京时间）定时任务尝试刷新；节假日或接口故障时显示无归档。</p>
    </div>}
  </CardContent></Card>;
}
