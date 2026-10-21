"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { discoverCandidates, entrySignal, memoryWindow, readArchive, readCalendar, readRadar, readWatchlist, riskPlan, scanDates, stockFields, validDate } from "@/lib/low-absorption";
import type { Fields, FunnelDay, RadarSnapshot, TradingCalendar } from "@/lib/low-absorption";

type Summary = { days: number; winRate: string; pnl: number };
const ROOT = "https://raw.githubusercontent.com/Shaun050427/dragon-review-app/market-data/";
const money = (n: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(n);
const value = (n: number | null | undefined, suffix = "") => typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) + suffix : "待核";
const path = (d: string) => `${d.slice(0, 4)}/${d.slice(5, 7)}/${d}.json`;
async function getJSON(uri: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(ROOT + uri, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
  if (!response.ok) throw new Error(`${response.status} ${uri}`);
  return response.json();
}

export function LowAbsorptionFunnel({ date, fields, onChange, summary, onExport, onToggleLegacy, legacyVisible }: {
  date: string; fields: Fields; onChange: (key: string, value: string) => void;
  summary: Summary; onExport: () => void; onToggleLegacy: () => void; legacyVisible: boolean;
}) {
  const [result, setResult] = useState<{ date: string; days: FunnelDay[]; calendar: TradingCalendar | null; radar: RadarSnapshot | null; expected: string[]; error: string }>({ date: "", days: [], calendar: null, radar: null, expected: [], error: "" });
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState("all");
  const [manualCode, setManualCode] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualError, setManualError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function refresh() {
      setLoading(true);
      let calendar: TradingCalendar | null = null;
      let radar: RadarSnapshot | null = null;
      let error = "";
      try {
        radar = readRadar(await getJSON("radar/" + path(date), signal), date);
        calendar = radar ? readCalendar(radar.calendar) : null;
      } catch { /* Dated snapshots may not yet exist. Never substitute another date. */ }
      if (!calendar) {
        try { calendar = readCalendar(await getJSON("trading-calendar.json", signal)); } catch { /* Unknown ages remain unknown. */ }
      }
      const dates = scanDates(date, calendar);
      if (!dates.length) error = "日期无效，未扫描。";
      try {
        // Bound concurrent raw requests and cancel old-date scans when the user switches days.
        const days: FunnelDay[] = [];
        for (let i = 0; i < dates.length && !signal.aborted; i += 6) {
          const batch = await Promise.all(dates.slice(i, i + 6).map(async (d) => {
            try { return readArchive(await getJSON("daily/" + path(d), signal), d); } catch { return null; }
          }));
          days.push(...batch.filter((d): d is FunnelDay => d !== null));
        }
        if (!days.length && !error) error = "没有可用涨停归档，请检查行情采集任务。";
        if (!signal.aborted) setResult({ date, days, calendar, radar, expected: dates, error });
      } finally { if (!signal.aborted) setLoading(false); }
    }
    void refresh();
    return () => controller.abort();
  }, [date, revision]);
  const current = result.date === date;
  const days = useMemo(() => current ? result.days : [], [current, result.days]);
  const candidates = useMemo(() => discoverCandidates(days, date, current ? result.calendar : null), [days, date, current, result.calendar]);
  const watchlist = readWatchlist(fields.funnelWatchlist);
  const code = fields.funnelSelectedCode || "";
  const watched = watchlist.find((s) => s.code === code);
  const selected = candidates.find((s) => s.code === code);
  const stock = watched || selected;
  const f = stockFields(fields, code);
  const set = useCallback((key: string, v: string) => onChange(`funnel_${code}_${key}`, v), [code, onChange]);
  const radar = current ? result.radar : null;
  const metric = radar?.stocks.find((s) => s.code === code);
  const missing = current && result.calendar && date <= result.calendar.coveredThrough ? result.expected.filter((d) => !days.some((x) => x.date === d)) : [];
  const shown = candidates.filter((c) => filter === "all" || (filter === "unknown" ? c.age === null : filter === "0" ? c.age === 0 : c.age !== null && c.age >= Number(filter) && c.age <= Number(filter) + 4));
  function observe(s: { code: string; name: string }) {
    if (!watchlist.some((v) => v.code === s.code)) onChange("funnelWatchlist", JSON.stringify([...watchlist, s]));
    onChange("funnelSelectedCode", s.code);
  }
  const input = (key: string, label: string, type = "number", placeholder?: string) => <label className="field" key={key}><span>{label}</span><Input aria-label={label} type={type} step={type === "number" ? "any" : undefined} value={f[key] ?? (key === "equity" ? fields.currentEquity : key === "riskPct" ? fields.riskPerTradePct : "") ?? ""} onChange={(e) => set(key, e.target.value)} placeholder={placeholder}/></label>;
  const choice = (key: string, label: string, options: [string, string][]) => <label className="field" key={key}><span>{label}</span><select aria-label={label} value={f[key] || ""} onChange={(e) => set(key, e.target.value)}><option value="">待核查</option>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
  const text = (key: string, label: string, placeholder?: string) => <label className="field" key={key}><span>{label}</span><Textarea aria-label={label} value={f[key] ?? (key === "equity" ? fields.currentEquity : key === "riskPct" ? fields.riskPerTradePct : "") ?? ""} onChange={(e) => set(key, e.target.value)} placeholder={placeholder}/></label>;
  const yesNo: [string, string][] = [["yes", "是"], ["no", "否"]];
  const signal = entrySignal(f);
  const risk = riskPlan({ ...f, equity: f.equity ?? fields.currentEquity ?? "", riskPct: f.riskPct ?? fields.riskPerTradePct ?? "" });
  return <div className="low-absorption-funnel span-12 space-y-4">
    <Card><CardHeader className="history-head"><div><CardTitle>低吸雷达 · 发现 → 过滤 → 承接 → 退出</CardTitle><p>每天审查少量候选；允许没有交易。所有阈值为V1.2研究参数。</p></div><Button variant="outline" onClick={() => setRevision((v) => v + 1)} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""}/>重新扫描</Button></CardHeader>
      <CardContent className="space-y-4">
        <div className="premium-metrics"><div>涨停归档 <b>{days.length}/{current ? result.expected.length : "—"}</b></div><div>自动提名 <b>{candidates.length}</b></div><div>1—5日候选 <b>{candidates.filter((c) => c.age !== null && c.age >= 1 && c.age <= 5).length}</b></div><div>已纳入观察 <b>{watchlist.length}</b></div></div>
        {loading && <p role="status">正在扫描 {date} 的候选及收盘快照…</p>}
        {current && result.error && <p className="dirty" role="status">{result.error}</p>}
        <p className="premium-source">历史≥3板仅作提名，不等于龙头认证。资金记忆：1—5日优先、6—10日常规、11—15日衰减，超过15日退出旧周期；趋势核心单独研究。放量跌停不剔除，也不自动认定为洗盘或承接。</p>
        <p className="premium-source">{current && result.calendar && date <= result.calendar.coveredThrough ? `交易日来自：${result.calendar.source}；覆盖至${result.calendar.coveredThrough}。` : "交易日历缺失或未覆盖所选日期：候选仍展示，资金记忆标为待核，不用归档天数冒充交易日。"}{missing.length ? ` 缺少${missing.length}个应有归档，最后涨停日可能偏早、连板高度可能漏记。` : ""}</p>
        {missing.length > 0 && <details><summary>查看缺失归档日期</summary><p className="premium-source">{missing.join("、")}</p></details>}
        <label className="field"><span>观察窗口</span><select aria-label="观察窗口" value={filter} onChange={(e) => setFilter(e.target.value)}>{[["all", "全部"], ["0", "预备池：当日涨停"], ["1", "1—5日"], ["6", "6—10日"], ["11", "11—15日"], ["unknown", "天数待核"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <div className="table-wrap premium-table"><table><thead><tr><th>股票</th><th>扫描期最高连板</th><th>距归档末次涨停</th><th>最后归档涨停</th><th>数据完整性</th><th>观察</th></tr></thead><tbody>{shown.map((s) => <tr key={s.code}><td>{s.name} <small>{s.code}</small></td><td>{s.maxBoards}板</td><td>{memoryWindow(s.age)}{s.age !== null ? `（${s.age}日）` : ""}</td><td>{s.lastBoard}</td><td>{s.age === null ? "日历待核" : s.missingAfter ? `此后缺${s.missingAfter}日，末次涨停待核` : "末次涨停后归档齐全"}</td><td><Button size="sm" variant={code === s.code ? "default" : "outline"} onClick={() => observe(s)}>纳入观察</Button></td></tr>)}</tbody></table>{!loading && !shown.length && <p className="premium-source">本窗口暂无候选；归档不足时不能据此判断市场没有机会。</p>}</div>
        <details><summary>补充趋势核心或归档遗漏的候选</summary><div className="form-grid two"><label className="field"><span>六位股票代码</span><Input aria-label="六位股票代码" value={manualCode} onChange={(e) => setManualCode(e.target.value.trim())}/></label><label className="field"><span>股票名称</span><Input aria-label="股票名称" value={manualName} onChange={(e) => setManualName(e.target.value)}/></label></div><Button variant="outline" onClick={() => { if (!/^\d{6}$/.test(manualCode) || !manualName.trim()) { setManualError("请填六位代码和名称。"); return; } observe({ code: manualCode, name: manualName.trim() }); setManualError(""); }}>加入今日观察</Button>{manualError && <p role="alert">{manualError}</p>}</details>
        <div className="flex flex-wrap gap-2">{watchlist.map((s) => <Button key={s.code} variant={code === s.code ? "default" : "outline"} onClick={() => onChange("funnelSelectedCode", s.code)}>{s.name} {s.code}</Button>)}</div>
      </CardContent></Card>
    {stock && <>
      <Card><CardHeader><CardTitle>{stock.name} {stock.code} · 核心资格与日线过滤</CardTitle><p>当前股票的记录独立保存到所选日期 {date}，切换候选不会复用L/H或风险预案。</p></CardHeader><CardContent className="space-y-4">
        {metric && !metric.error && metric.dataDate === date ? <>
          <p className="premium-source">收盘事实：{metric.dataDate} · {radar?.source} · {radar?.adjustment} · 采集 {radar?.observedAt}。均线为收盘均线，不能当作盘中动态均线或实时信号。</p>
          <div className="premium-metrics"><div>收盘 <b>{value(metric.close)}</b></div><div>本轮高点回撤 <b>{value(metric.drawdownPct, "%")}</b></div><div>连续下跌 <b>{metric.fallingDays ?? "待核"}日</b></div><div>量/此前5日均量 <b>{value(metric.volumeRatio, "倍")}</b></div></div>
          <div className="table-wrap"><table><thead><tr><th>收盘均线</th><th>价格</th><th>收盘距离</th><th>本轮首次进入±1%观察带</th></tr></thead><tbody>{metric.averages?.map((a) => <tr key={a.period}><td>MA{a.period}</td><td>{value(a.value)}</td><td>{value(a.distancePct, "%")}</td><td>{a.firstTouchDate || "未触及/样本不足"}</td></tr>)}</tbody></table></div>
          <details><summary>近三日量价与跌停事实</summary><div className="table-wrap"><table><thead><tr><th>日期</th><th>收盘</th><th>成交量（手）</th><th>换手率</th><th>量/此前5日均量</th><th>当日跌停池</th></tr></thead><tbody>{metric.recent?.map((r) => <tr key={r.date}><td>{r.date}</td><td>{value(r.close)}</td><td>{value(r.volume)}</td><td>{value(r.turnoverRate, "%")}</td><td>{value(r.volumeRatio, "倍")}</td><td>{r.limitDown ? "在池内" : "未见（归档缺失需核对）"}</td></tr>)}</tbody></table></div><p className="premium-source">放量只说明成交交换；后续价格收复与同伴反馈才用于检验买方是否占优。</p></details>
        </> : <p className="premium-source">{metric?.error ? `日线采集未完成：${metric.error}` : "此股票/日期暂无日线快照。均线、回撤与首次触线需在终端核对；不使用旧日数据替代。"}</p>}
        <div className="form-grid two">{choice("model", "所属模型", [["A1", "A1 高标首次强分歧 · MA5/10"], ["A2", "A2 老龙深调 · MA20/30"], ["B", "B 趋势核心 · MA10/20/30"]])}{choice("firstTouch", "本轮首次接近所选均线？", yesNo)}{input("averageBasis", "所选均线、复权口径、来源与观察时间", "text", "如：动态MA10；前复权；券商终端；09:40")}{input("identity", "核心地位证据（不是仅填连板数）", "text", "同期最高标/行业主动性/成交辨识度")}{choice("peers", "同周期/行业反馈支持？", yesNo)}{input("peerEvidence", "同伴反馈与新催化证据", "text")}</div>
        <details><summary>重复修复、筹码与失败样本</summary><div className="form-grid two">{input("repairCount", "本轮第几次修复尝试")}{text("supply", "上方套牢筹码与前次修复失败", "记录反复跌破的反例；超过15日需要新催化与新周期证据。")}{text("rejection", "淘汰原因/不交易理由", "即使不买也留下记录，避免只收集成功反包。")}</div></details>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>承接与买点 · A / B分别核验</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="premium-source">L为恐慌低点，H为首次反抽高点。A：突破H后下一分钟仍维持H上方；B：突破后首次缩量回踩H±0.5%守住，再突破回踩高点。分钟数据手动核对，量比基准必须为此前5根已完成分钟线。形态满足后仍需通过“盘中执行”的既有闸门。</p>
        <div className="form-grid two">{choice("buyMethod", "买点方法", [["A", "A 首次主动突破（可无L二次测试）"], ["B", "B 突破后的首次缩量回踩"]])}{choice("stopped", "连续3根1分钟未破L/一根5分钟止跌？", yesNo)}{input("low", "恐慌低点 L")}{input("high", "首次反抽高点 H")}{input("minuteClose", "当前已完成1分钟收盘")}{input("volumeRatio", "本分钟量 / 此前5根均量")}{choice("retest", "L二次卖压测试", [["passed", "守住L/短破后2分钟收回"], ["absent", "尚未出现"], ["failed", "失守且未收回"]])}{input("signalTime", "分钟证据时间（北京时间）", "time")}</div>
        {f.buyMethod === "A" && choice("nextHeld", "突破后的下一分钟维持H上方？", yesNo)}
        {f.buyMethod === "B" && <div className="form-grid two">{input("pullbackLow", "突破后首次回踩低点")}{input("reboundHigh", "回踩后的1分钟局部高点")}{choice("pullbackHeld", "首次回踩H附近未有效跌破？", yesNo)}{choice("pullbackVolume", "此次回踩缩量？", yesNo)}</div>}
        <p className={signal.triggered ? "saved" : "dirty"} role="status">{signal.message}</p>
        {text("conclusion", "今日唯一结论", "只写最重要的事实、是否参与和证伪条件。")}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>风险预算与退出 · 不机械等涨5%</CardTitle></CardHeader><CardContent className="space-y-4"><details><summary>计划交易时填写：预算、退出与事后结果</summary>
        <div className="form-grid two">{input("equity", "账户净值（元）")}{input("riskPct", "单笔计划风险占净值 %")}{input("positionCap", "本笔资金上限占净值 %")}{input("entry", "计划买入价")}{input("stop", "失效退出参考价")}{input("target", "最近压力/计划目标价")}{input("costPct", "往返费用与滑点估计（占买入金额 %）")}{input("timeStop", "无主动修复的审查时限", "text", "如：次日10:00；1—2个交易日参数待验证")}</div>
        <p className="premium-source">{risk ? `计划风险预算 ¥${money(risk.budget)}；按100股一手计算 ${risk.shares} 股 / ¥${money(risk.amount)}；参考价可成交时估计损失 ¥${money(risk.plannedLoss)}；扣估计成本后的收益/风险 ${risk.rewardRisk.toFixed(2)}。${risk.rewardRisk < 1 ? "目标空间小于估计失败成本，需重新评估。" : ""}` : "补齐有效账户金额、风险比例、仓位上限、买入/退出/目标价格及成本后计算。"}</p>
        <p className="premium-source">此计算按普通A股100股买入单位估算；跳空、跌停无流动性、最低佣金或T+1可能使实际损失超过预算。恐慌低点L不是当天新仓可执行的止损保证。</p>
        <div className="form-grid two">{text("exitWeak", "次日冲高失败时怎样退出？", "冲高后跌破分时均价线、首次反抽失败且同伴无响应；按已填预案处理可卖仓位，不必等待+5%。")}{text("exitNone", "次日无修复/到时限怎样处理？", "预期为隔日套利，未修复不临时转为中线；写明审查时刻和动作。")}{text("exitThird", "反抽涨停后第三日怎样处理？", "竞价溢价、同伴、失效价格与减仓比例；继续持有需新证据。")}{text("exitActual", "实际退出、费用与无法成交原因")}</div>
        <Button variant="outline" onClick={() => { onChange("candidate", `${stock.name} ${stock.code}`); onChange("allowedSetup", `${f.model || "待选模型"} / 买点${f.buyMethod || "待选"}；${f.conclusion || "待填写触发"}`); onChange("invalidations", f.exitNone || "待填写证伪"); }}>用于今晚候选1（替换原候选1）</Button>
        <details><summary>入场后1—3日结果 / 未交易反例（可后补，不影响入场信号）</summary><div className="form-grid two">{choice("outcome", "处理结果", [["watch", "继续观察"], ["reject", "过滤淘汰"], ["miss", "有信号未交易"], ["trade", "已交易"]])}{input("actualEntry", "实际买入价")}{input("actualExit", "实际卖出价")}{input("fees", "手续费及滑点金额")}{[1, 2, 3].map((d) => <div key={d}>{input(`mfe${d}`, `${d}日内最高涨幅 %（相对入场价）`)}{input(`mae${d}`, `${d}日内最大回撤 %（相对入场价）`)}</div>)}{text("review", "事后复盘/失败原因")}</div></details>
      </details></CardContent></Card>
    </>}
    <Card><CardHeader><CardTitle>历史与规则 · 按需展开</CardTitle></CardHeader><CardContent className="space-y-3">
      <details><summary>账户参数（统一维护，沿用盘中执行风控）</summary><div className="form-grid two">{[["currentEquity", "账户当前净值（全局）"], ["peakEquity", "账户历史峰值（全局）"], ["drawdownStopPct", "峰值回撤暂停阈值 %"], ["riskPerTradePct", "默认单笔风险占净值 %"], ["dailyStopR", "日内停止交易 R"], ["realizedR", "今日已实现 R"]].map(([key, label]) => <label className="field" key={key}><span>{label}</span><Input aria-label={label} type="number" step="any" value={fields[key] ?? ""} onChange={(e) => onChange(key, e.target.value)}/></label>)}</div><p className="premium-source">账户闸门继续生效；候选的预算计算默认引用净值与单笔风险比例，手动修改后作为该股票的计划快照保存。</p></details>
      <p className="premium-source">原历史记录：{summary.days}日 · 有交易日胜率{summary.winRate}% · 盈亏合计¥{money(summary.pnl)}。这是已录入账户数据，不是低吸策略回测胜率。</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onExport}>导出已有记录（含候选与反例）</Button><Button variant="outline" onClick={onToggleLegacy}>{legacyVisible ? "收起旧版四个栏目" : "临时展开旧版四个栏目"}</Button></div>
      {fields.funnelLow && <details><summary>查看V1未关联股票的承接记录</summary><p>L：{fields.funnelLow}；H：{fields.funnelHigh || "待填"}；分钟收盘：{fields.funnelMinuteClose || "待填"}；量比：{fields.funnelVolumeRatio || "待填"}。{fields.funnelConclusion}</p><p className="premium-source">原记录保留导出；为避免串股，不自动套用到当前股票。</p></details>}
      <p className="premium-source">1—5/6—10/11—15日、3分钟止跌、1.5倍量与±0.5%回踩均为待回测参数，不代表已有统计优势。只有盘后日线事实自动采集，分钟承接仍需核对。</p>
      {!validDate(date) && <p role="alert">请选择有效日期。</p>}
    </CardContent></Card>
  </div>;
}
