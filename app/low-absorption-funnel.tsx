"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Fields = Record<string, string>;
type Stock = { code: string; name: string; industry: string; boards: number; turnover: number };
type Archive = { schemaVersion: number; tradeDate: string; stocks: Stock[] };
type Day = { date: string; stocks: Stock[] };
type Candidate = {
  code: string; name: string; industry: string; maxBoards: number;
  lastBoard: string; age: number; firstSeen: string;
};
type Summary = { days: number; winRate: string; pnl: number };
const ROOT = "https://raw.githubusercontent.com/Shaun050427/dragon-review-app/market-data/daily/";
const scanDates = (endDate: string) => {
  const start = new Date(endDate + "T12:00:00Z");
  if (Number.isNaN(start.valueOf())) return [];
  const days: string[] = [];
  for (let n = 0; n < 44; n++) {
    const day = new Date(start.getTime() - n * 86400000);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
};
const money = (value: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
const px = (value: string) => Number(value);
const watchField = (f: Fields, name: string) => f[name] ?? "";

export function LowAbsorptionFunnel({
  date, fields, onChange, summary, onExport, onToggleLegacy, legacyVisible,
}: {
  date: string; fields: Fields; onChange: (key: string, value: string) => void;
  summary: Summary; onExport: () => void; onToggleLegacy: () => void; legacyVisible: boolean;
}) {
  const [archive, setArchive] = useState<Day[]>([]);
  const [requested, setRequested] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const refresh = useCallback(async () => {
    const dates = scanDates(date);
    setRequested(dates.length);
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(dates.map(async (day): Promise<Day | null> => {
        const uri = ROOT + day.slice(0, 4) + "/" + day.slice(5, 7) + "/" + day + ".json";
        try {
          const response = await fetch(uri, { cache: "no-store" });
          if (!response.ok) return null;
          const value = await response.json() as Archive;
          if (value.schemaVersion !== 1 || value.tradeDate !== day || !Array.isArray(value.stocks)) return null;
          return { date: day, stocks: value.stocks };
        } catch { return null; }
      }));
      const valid = results.filter((day): day is Day => Boolean(day)).sort((a, b) => b.date.localeCompare(a.date));
      setArchive(valid);
      if (!valid.length) setError("近期没有可用的涨停归档，请检查 market-data 分支采集任务；此处不生成虚假候选。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "涨停归档扫描失败");
      setArchive([]);
    } finally { setLoading(false); }
  }, [date]);
  useEffect(() => { void refresh(); }, [refresh]);
  const candidates = useMemo(() => {
    const history = new Map<string, { name: string; industry: string; code: string; boards: number; latest: string; earliest: string }>();
    for (const day of [...archive].reverse()) for (const stock of day.stocks) {
      if (!stock.code || !stock.name || !Number.isFinite(stock.boards)) continue;
      const item = history.get(stock.code);
      if (!item) history.set(stock.code, { name: stock.name, industry: stock.industry, code: stock.code, boards: stock.boards, latest: day.date, earliest: day.date });
      else {
        item.boards = Math.max(item.boards, stock.boards);
        item.latest = day.date;
        item.name = stock.name; item.industry = stock.industry;
      }
    }
    return [...history.values()].map((item): Candidate => ({
      code: item.code, name: item.name, industry: item.industry, maxBoards: item.boards,
      lastBoard: item.latest, firstSeen: item.earliest, age: archive.findIndex((day) => day.date === item.latest),
    })).filter((item) => item.maxBoards >= 3 && item.age >= 1 && item.age <= 15)
      .sort((a, b) => (a.age <= 5 ? 0 : a.age <= 10 ? 1 : 2) - (b.age <= 5 ? 0 : b.age <= 10 ? 1 : 2) || b.maxBoards - a.maxBoards || a.age - b.age)
      .slice(0, 35);
  }, [archive]);
  const highGrade = candidates.filter((c) => c.maxBoards >= 4 && c.age <= 5).length;
  const l = px(watchField(fields, "funnelLow"));
  const h = px(watchField(fields, "funnelHigh"));
  const last = px(watchField(fields, "funnelMinuteClose"));
  const ratio = px(watchField(fields, "funnelVolumeRatio"));
  const pricesValid = l > 0 && h > l && last > 0 && ratio >= 0 &&
    ["funnelLow", "funnelHigh", "funnelMinuteClose", "funnelVolumeRatio"].every((key) => watchField(fields, key) !== "");
  const priceConfirmed = pricesValid && last > h && ratio >= 1.5;
  const signalConfirmed = priceConfirmed && fields.funnelRetest === "yes" && fields.funnelFirstTouch === "yes";
  const notes = (name: string, value: string) => onChange(name, value);
  const selectedCandidate = candidates.find((c) => c.code === selected);
  return <div className="span-12 space-y-4">
    <Card>
      <CardHeader className="history-head"><div><CardTitle>低吸雷达 · 自动候选漏斗</CardTitle><p>统一替代策略风控、盘后复盘、涨停图与历史统计四个主入口；默认只处理真正接近观察窗口的股票。</p></div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""}/>重新扫描</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="premium-metrics">
          <div>有效涨停归档日 <b>{archive.length}/{requested}</b></div>
          <div>近15个已归档交易日候选 <b>{candidates.length}</b></div>
          <div>核心龙头黄金窗口 <b>{highGrade}</b></div>
          <div>历史记录交易日 <b>{summary.days}</b></div>
        </div>
        {error && <p className="dirty">{error}</p>}
        <p className="premium-source">采集源：原有 market-data 分支的每日涨停JSON。这里只能自动提名近期3板以上的历史强势股，不能自动认定MA触线、放量跌停或分钟级承接；未建立完整OHLCV分钟数据源前，不会伪造实时买点。资金记忆天数仅按已成功归档的交易日近似统计，缺失归档会低估真实间隔。</p>
        <div className="table-wrap premium-table"><table><thead><tr><th>股票</th><th>历史连板</th><th>距上次涨停</th><th>上次封板</th><th>观察窗口</th><th>操作</th></tr></thead><tbody>
          {candidates.map((item) => <tr key={item.code}>
            <td>{item.name} <small>{item.code}</small></td><td>{item.maxBoards}板</td><td>{item.age}个归档交易日</td><td>{item.lastBoard}</td>
            <td>{item.age <= 5 ? "一级：1—5" : item.age <= 10 ? "二级：6—10" : "衰减：11—15"}</td>
            <td><Button size="sm" variant={selected === item.code ? "default" : "outline"} onClick={() => { setSelected(item.code); notes("candidate", item.name + " " + item.code); notes("funnelLastLimit", item.lastBoard); }}>纳入观察</Button></td>
          </tr>)}
        </tbody></table>{!loading && !candidates.length && <p className="premium-source">当前归档中暂无符合连板高度与时间窗口的候选；可以空仓等待，也可检查采集是否齐全。</p>}</div>
        {selectedCandidate && <p className="saved">已选择：{selectedCandidate.name}（{selectedCandidate.code}），同步到“今晚计划”的候选1；请继续检查均线、回撤和分时证据，不要仅凭榜单下单。</p>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>入场承接验证 · 盘中最简版</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="premium-source">先标注恐慌低点L和首次反抽高点H，再从行情终端填入已完成的一分钟K线收盘价与本分钟/前5分钟均量。系统只核算规则，不连接交易所实时委托簿。</p>
        <div className="form-grid two">
          <label className="field"><span>恐慌低点 L</span><Input type="number" step="0.01" value={watchField(fields, "funnelLow")} onChange={(e) => notes("funnelLow", e.target.value)}/></label>
          <label className="field"><span>首次反抽高点 H</span><Input type="number" step="0.01" value={watchField(fields, "funnelHigh")} onChange={(e) => notes("funnelHigh", e.target.value)}/></label>
          <label className="field"><span>当前已完成1分钟收盘</span><Input type="number" step="0.01" value={watchField(fields, "funnelMinuteClose")} onChange={(e) => notes("funnelMinuteClose", e.target.value)}/></label>
          <label className="field"><span>本分钟量 / 前5分钟均量</span><Input type="number" step="0.1" value={watchField(fields, "funnelVolumeRatio")} onChange={(e) => notes("funnelVolumeRatio", e.target.value)}/></label>
          <label className="field"><span>首次触线？</span><select value={watchField(fields, "funnelFirstTouch") || "unknown"} onChange={(e) => notes("funnelFirstTouch", e.target.value)}><option value="unknown">待核查</option><option value="yes">首次</option><option value="no">非首次</option></select></label>
          <label className="field"><span>二次回踩是否守住L？</span><select value={watchField(fields, "funnelRetest") || "unknown"} onChange={(e) => notes("funnelRetest", e.target.value)}><option value="unknown">尚未观察</option><option value="yes">通过</option><option value="no">失败/没有</option></select></label>
        </div>
        <p className={signalConfirmed ? "saved" : "dirty"}>{!pricesValid ? "待录入分钟价格和量能，暂不可判定承接。" : signalConfirmed ? "研究规则已触发：首次触线＋二次回踩守住L＋一分钟收盘突破H且量能≥1.5倍。仍需核对市场情绪、流动性和T+1风险。" : priceConfirmed ? "突破量能条件满足，但首次触线/二次回踩条件尚未核实；可另研究快速V形反转模型。" : "承接尚未确认：需要收盘突破H且量能≥1.5倍，不能因为触线直接买入。"}</p>
        <label className="field"><span>今日唯一结论（不超过两句话即可）</span><Textarea value={watchField(fields, "funnelConclusion")} onChange={(e) => notes("funnelConclusion", e.target.value)} placeholder="如：百洋股份放量跌停后，MA10附近需观察反包；若低点失守或同周期高标集体补跌则放弃。"/></label>
        <p className="premium-source">触发参数为待回测的V1.2实验规则，不是交易建议。回撤买点要另行比较失败成本及历史胜率；极端波动、涨跌停限制可能导致止损无法执行。</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>历史与风控 · 最小保留</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="premium-metrics"><div>已记录交易日 <b>{summary.days}</b></div><div>有交易日胜率 <b>{summary.winRate}%</b></div><div>记录盈亏合计 <b>¥{money(summary.pnl)}</b></div></div>
        <p className="premium-source">原来的四个栏目和所有私人记录没有删除，只从默认导航移出。旧版记录仍可以导出和按需恢复，避免因为界面精简造成历史研究成果丢失。</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExport}>导出已有记录</Button>
          <Button variant="outline" onClick={onToggleLegacy}>{legacyVisible ? "收起旧版四个栏目" : "临时展开旧版四个栏目"}</Button>
        </div>
      </CardContent>
    </Card>
  </div>;
}
