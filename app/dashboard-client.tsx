"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, Check, CloudOff, Download, GitBranch, History, LogOut, RefreshCw, RotateCcw, Save, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { listRevisions, pullDocument, pushDocument, verifyRepository, type GitHubConfig, type GitHubRevision, type ReviewDocument } from "@/lib/github-store";
import { YesterdayPremium } from "@/app/yesterday-premium";
import { LimitReview } from "@/app/limit-review";
import { CycleRadar } from "@/app/cycle-radar";
import { StrategyWorkbench } from "@/app/strategy-workbench";

type Payload = { fields: Record<string, string>; checks: Record<string, boolean> };
type CloudRecord = { date: string; payload: Payload; revision: string; updatedAt: string; device?: string };

const GITHUB_CONFIG_STORAGE = "ashare_github_config_v1";
const GITHUB_TOKEN_STORAGE = "ashare_github_token_v1";
const LEGACY_STORAGE = "ashare_dragon_review_v3";
const LEGACY_MIGRATED = "ashare_legacy_github_migrated_v1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const defaultPayload = (): Payload => ({
  fields: {
    startEquity: "100000", currentEquity: "100000", peakEquity: "100000", dailyPnl: "0",
    cyclePhase: "混沌", tradeMode: "空仓观察", marketFacts: "", sentimentFacts: "", ladder: "",
    rivalSectors: "", regulatoryFacts: "", candidate: "", candidate2: "", candidate3: "", executionCandidate: "", candidateRole: "未确定", allowedSetup: "", allowedSetup2: "", allowedSetup3: "", invalidations2: "", invalidations3: "",
    maxPosition: "0", leaderEvidence: "", invalidations: "", scenarioA: "", scenarioB: "", scenarioC: "",
    noDoList: "", auction: "", firstFive: "", openingRivals: "", planDelta: "", action: "空仓",
    actualPosition: "0", executionNote: "", tradeReview: "", bestPattern: "", worstPattern: "",
    closingMap: "", historicalAnalogy: "", reviewThemes: "", reviewRoles: "", oneChange: "", errorTag: "无", correction: "",
    cycleNature: "新旧过渡", cycleEvidence: "", oldLeaderState: "观察", newLeaderState: "观察", primaryOpportunity: "空仓等待", opportunityEvidence: "", opportunityInvalidation: "",
    rivalA: "", rivalB: "", rivalWinner: "", rivalLoserFeedback: "", uniquenessEvidence: "", attributeSpread: "",
    divergenceLeader: "", divergencePrerequisite: "", divergenceAuction: "", divergenceSupport: "", divergenceBackRow: "", divergenceResult: "未发生",
    monitorStock: "", monitorWindow: "", monitorExpiry: "", monitorRenewals: "0", monitorStatus: "不涉及", monitorAfterClose: "", monitorThesis: "", monitorExit: "",
    abnormalStock: "", abnormalWindow: "", abnormalDeviation: "", abnormalGap: "", abnormalCount: "", abnormalIndex: "", abnormalRoom: "", abnormalConclusion: "",
    riskPerTradePct: "0.5", dailyStopR: "2", lossStreakLimit: "3", realizedR: "0", gapRisk: "",
    ticketStock: "", ticketStrategy: "未选择", ticketEntry: "", ticketPosition: "", ticketExit: "", ticketInvalidation: "",
    redlineStatus: "关闭", redlineCandidate: "", redlineRole: "未确认", redlineTrigger: "", redlineInvalidation: "", redlineRewardPct: "", redlineRiskR: "1",
    releaseStatus: "关闭", releaseCandidate: "", releaseRole: "未确认", releaseTrigger: "", releaseInvalidation: "", releaseRewardPct: "", releaseRiskR: "1",
    returnStatus: "关闭", returnCandidate: "", returnRole: "未确认", returnTrigger: "", returnInvalidation: "", returnRewardPct: "", returnRiskR: "1",
    shapeStatus: "关闭", shapeCandidate: "", shapeRole: "未确认", shapeTrigger: "", shapeInvalidation: "", shapeRewardPct: "", shapeRiskR: "0.5",
  },
  checks: {},
});

const preChecks = [
  ["pre_unique", "唯一辨识度明确，不是“也可能是龙头”"],
  ["pre_phase", "周期允许：发育、成型或首次健康分歧"],
  ["pre_ladder", "梯队完整，后排没有批量负反馈"],
  ["pre_rival", "竞争板块未明显抢走增量资金"],
  ["pre_plan", "买点、仓位和三条证伪昨晚已写清"],
  ["pre_window", "信号能在10:00前确认"],
];

const gateChecks = [
  ["gate_planned", "所选股票是昨晚写下的三个候选之一，且买点已写清"],
  ["gate_phase", "周期阶段仍允许该模式"],
  ["gate_leader", "开盘后地位增强，而非只有个股高开"],
  ["gate_sector", "中军、梯队或新增首板至少一项确认"],
  ["gate_regulatory", "若逻辑依赖监管解除或异动余量，状态与算法已核对，未用主观猜测替代"],
  ["gate_risk", "未触发任何证伪条件"],
  ["gate_size", "仓位不超上限，接受隔夜最坏情景"],
];

const disciplineChecks = [
  ["disc_plan", "昨晚有书面预案"], ["disc_one", "只在三个预设候选里选一只执行"],
  ["disc_wait", "非模式内则空仓"], ["disc_time", "10:00后未开新仓"],
  ["disc_size", "仓位未超上限"], ["disc_noadd", "证伪后未加仓"],
  ["disc_exit", "卖出按预案执行"], ["disc_truth", "只用当时可知信息复盘"],
];

function isoToday() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function money(value: string | number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function CheckItem({ item, checked, onChange }: { item: string[]; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check-item"><Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} /><span>{item[1]}</span></label>;
}

export function DashboardClient() {
  const [setup, setSetup] = useState({ owner: "Shaun050427", repo: "dragon-review-data", branch: "main", path: "data/records.json", token: "", device: "主设备", remember: false });
  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [date, setDate] = useState(isoToday());
  const [payload, setPayload] = useState<Payload>(defaultPayload);
  const [revision, setRevision] = useState("");
  const [records, setRecords] = useState<CloudRecord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("等待连接");
  const [conflict, setConflict] = useState<CloudRecord | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [revisions, setRevisions] = useState<GitHubRevision[]>([]);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const dirtyRef = useRef(false);
  const dateRef = useRef(date);
  const revisionRef = useRef(revision);
  const payloadRef = useRef(payload);
  const configRef = useRef<GitHubConfig | null>(config);
  const basePayloadRef = useRef<Payload>(defaultPayload());

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => { revisionRef.current = revision; }, [revision]);
  useEffect(() => { payloadRef.current = payload; }, [payload]);
  useEffect(() => { configRef.current = config; }, [config]);

  const documentToRecords = useCallback((document: ReviewDocument, sha: string | null) => {
    return Object.entries(document.records).map(([recordDate, item]) => ({
      date: recordDate,
      payload: item.payload,
      updatedAt: item.updatedAt,
      device: item.device,
      revision: sha?.slice(0, 7) ?? "新建",
    })).sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const applyRecord = useCallback((record: CloudRecord | undefined, targetDate: string) => {
    const nextPayload = record?.payload ?? defaultPayload();
    setDate(targetDate);
    setPayload(nextPayload);
    basePayloadRef.current = structuredClone(nextPayload);
    setRevision(record?.revision ?? "");
    setDirty(false);
    setConflict(null);
    setStatus(record ? `已从 GitHub 载入 · ${record.revision}` : "新交易日 · 尚未提交");
  }, []);

  const fetchAll = useCallback(async (activeConfig = configRef.current, initial = false) => {
    if (!activeConfig) return [];
    const latest = await pullDocument(activeConfig);
    const incoming = documentToRecords(latest.document, latest.sha);
    setRecords(incoming);
    const active = incoming.find((item) => item.date === dateRef.current);
    if (initial) applyRecord(active, dateRef.current);
    else if (latest.sha?.slice(0, 7) !== revisionRef.current) {
      const remotePayload = active?.payload ?? defaultPayload();
      const activeChanged = JSON.stringify(remotePayload) !== JSON.stringify(basePayloadRef.current);
      if (dirtyRef.current && activeChanged) setConflict(active ?? { date: dateRef.current, payload: remotePayload, revision: latest.sha?.slice(0, 7) ?? "新建", updatedAt: latest.document.updatedAt });
      else if (!dirtyRef.current && activeChanged) applyRecord(active, dateRef.current);
      else setRevision(latest.sha?.slice(0, 7) ?? "");
    }
    setStatus(`GitHub 已同步 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
    return incoming;
  }, [applyRecord, documentToRecords]);

  const connect = useCallback(async (candidate: typeof setup) => {
    const activeConfig: GitHubConfig = {
      owner: candidate.owner.trim(), repo: candidate.repo.trim(), branch: candidate.branch.trim() || "main",
      path: candidate.path.trim() || "data/records.json", token: candidate.token.trim(), device: candidate.device.trim() || "未命名设备",
    };
    if (!activeConfig.owner || !activeConfig.repo || !activeConfig.token) return;
    setConnecting(true);
    setStatus("正在验证 GitHub 仓库…");
    try {
      const repository = await verifyRepository(activeConfig);
      if (!candidate.branch.trim()) activeConfig.branch = repository.default_branch;
      setConfig(activeConfig); configRef.current = activeConfig;
      await fetchAll(activeConfig, true);
      localStorage.setItem(GITHUB_CONFIG_STORAGE, JSON.stringify({ ...activeConfig, token: undefined }));
      if (candidate.remember) localStorage.setItem(GITHUB_TOKEN_STORAGE, activeConfig.token);
      else localStorage.removeItem(GITHUB_TOKEN_STORAGE);
      setConnected(true);
      const raw = localStorage.getItem(LEGACY_STORAGE);
      if (raw && !localStorage.getItem(LEGACY_MIGRATED)) {
        const legacy = JSON.parse(raw);
        setLegacyCount(Object.keys(legacy.records ?? {}).length);
      }
    } catch (error) {
      setConnected(false); setConfig(null); configRef.current = null;
      setStatus(error instanceof Error ? error.message : "连接失败");
    } finally { setConnecting(false); }
  }, [fetchAll]);

  useEffect(() => {
    const savedConfig = JSON.parse(localStorage.getItem(GITHUB_CONFIG_STORAGE) ?? "{}") as Partial<GitHubConfig>;
    const savedToken = localStorage.getItem(GITHUB_TOKEN_STORAGE) ?? "";
    const candidate = { owner: savedConfig.owner ?? "Shaun050427", repo: savedConfig.repo ?? "dragon-review-data", branch: savedConfig.branch ?? "main", path: savedConfig.path ?? "data/records.json", device: savedConfig.device ?? "主设备", token: savedToken, remember: Boolean(savedToken) };
    queueMicrotask(() => {
      setSetup(candidate);
      if (candidate.owner && candidate.repo && candidate.token) void connect(candidate);
    });
  }, [connect]);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => { void fetchAll().catch(() => setStatus("GitHub 同步暂时中断，正在重试")); }, 30000);
    return () => window.clearInterval(timer);
  }, [connected, fetchAll]);

  const save = useCallback(async (force = false) => {
    const activeConfig = configRef.current;
    if (!connected || !activeConfig || conflict && !force) return;
    setStatus("保存前正在拉取 GitHub 最新版…");
    try {
      const latest = await pullDocument(activeConfig);
      const remote = latest.document.records[dateRef.current];
      const remotePayload = remote?.payload ?? defaultPayload();
      const remoteChanged = JSON.stringify(remotePayload) !== JSON.stringify(basePayloadRef.current);
      if (remoteChanged && !force) {
        setConflict({ date: dateRef.current, payload: remotePayload, revision: latest.sha?.slice(0, 7) ?? "新建", updatedAt: remote?.updatedAt ?? latest.document.updatedAt, device: remote?.device });
        setStatus("保存前发现同一交易日已有新版本");
        return;
      }
      const now = new Date().toISOString();
      const document: ReviewDocument = { ...latest.document, schemaVersion: 7, updatedAt: now, records: { ...latest.document.records, [dateRef.current]: { payload: payloadRef.current, updatedAt: now, device: activeConfig.device } } };
      const result = await pushDocument(activeConfig, document, latest.sha, `data: 更新 ${dateRef.current}（${activeConfig.device}）`);
      const shortSha = result.commit.sha.slice(0, 7);
      const fileRevision = result.content.sha.slice(0, 7);
      setRevision(fileRevision); revisionRef.current = fileRevision;
      basePayloadRef.current = structuredClone(payloadRef.current);
      setDirty(false); dirtyRef.current = false; setConflict(null);
      setRecords(documentToRecords(document, result.content.sha));
      setStatus(`已提交 GitHub · ${shortSha}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "提交失败，页面内修改仍保留"); }
  }, [connected, conflict, documentToRecords]);

  useEffect(() => {
    if (!connected || !dirty || conflict) return;
    const timer = window.setTimeout(() => { void save(); }, 6000);
    return () => window.clearTimeout(timer);
  }, [connected, conflict, dirty, payload, save]);

  const updateField = (key: string, value: string) => {
    setPayload((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
    setDirty(true);
  };
  const updateCheck = (key: string, value: boolean) => {
    setPayload((current) => ({ ...current, checks: { ...current.checks, [key]: value } }));
    setDirty(true);
  };
  const chooseDate = (nextDate: string) => {
    if (dirty && !confirm("本页还有尚未提交的修改，确定切换交易日？")) return;
    const next = records.find((item) => item.date === nextDate);
    applyRecord(next, nextDate);
  };

  const migrateLegacy = async () => {
    const raw = localStorage.getItem(LEGACY_STORAGE); if (!raw) return;
    setMigrating(true);
    try {
      const legacy = JSON.parse(raw).records ?? {};
      const activeConfig = configRef.current;
      if (!activeConfig) return;
      const latest = await pullDocument(activeConfig);
      const document = { ...latest.document, records: { ...latest.document.records } };
      for (const [legacyDate, legacyPayload] of Object.entries(legacy)) {
        if (document.records[legacyDate]) continue;
        const old = legacyPayload as { fields?: Record<string, string>; checks?: Record<string, boolean> };
        document.records[legacyDate] = { payload: { fields: old.fields ?? {}, checks: old.checks ?? {} }, updatedAt: new Date().toISOString(), device: activeConfig.device };
      }
      document.updatedAt = new Date().toISOString();
      await pushDocument(activeConfig, document, latest.sha, `data: 迁移旧版复盘记录（${activeConfig.device}）`);
      localStorage.setItem(LEGACY_MIGRATED, "1"); setLegacyCount(0); await fetchAll(); setStatus("旧版记录已迁移到 GitHub");
    } catch { setStatus("旧版迁移未完成，请稍后重试"); } finally { setMigrating(false); }
  };

  const removeDay = async (target: string) => {
    if (!confirm(`删除 ${target} 的记录？删除也会成为一个 GitHub 提交，因此以后仍可回溯。`)) return;
    const activeConfig = configRef.current;
    if (!activeConfig) return;
    try {
      const latest = await pullDocument(activeConfig);
      delete latest.document.records[target];
      latest.document.updatedAt = new Date().toISOString();
      const result = await pushDocument(activeConfig, latest.document, latest.sha, `data: 删除 ${target}（可回溯）`);
      setRecords(documentToRecords(latest.document, result.content.sha));
      if (target === date) applyRecord(undefined, target);
      setStatus(`删除已提交 · ${result.commit.sha.slice(0, 7)}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "删除提交失败"); }
  };

  const exportCloud = () => {
    const blob = new Blob([JSON.stringify({ version: 7, source: "github", exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `A股龙空龙GitHub复盘_${isoToday()}.json`; anchor.click(); URL.revokeObjectURL(url);
  };

  const loadRevisions = async () => {
    const activeConfig = configRef.current; if (!activeConfig) return;
    setRevisionBusy(true);
    try { setRevisions(await listRevisions(activeConfig, 40)); setStatus("已载入最近 40 个 GitHub 版本"); }
    catch (error) { setStatus(error instanceof Error ? error.message : "版本历史载入失败"); }
    finally { setRevisionBusy(false); }
  };

  const restoreRevision = async (target: GitHubRevision) => {
    const activeConfig = configRef.current; if (!activeConfig || !confirm(`把 ${date} 恢复到版本 ${target.sha.slice(0, 7)}？恢复操作本身也会生成新提交。`)) return;
    setRevisionBusy(true);
    try {
      const [historical, latest] = await Promise.all([pullDocument(activeConfig, target.sha), pullDocument(activeConfig)]);
      const old = historical.document.records[date];
      if (!old) throw new Error(`该版本中没有 ${date} 的记录`);
      const now = new Date().toISOString();
      latest.document.records[date] = { ...old, updatedAt: now, device: activeConfig.device };
      latest.document.updatedAt = now;
      const result = await pushDocument(activeConfig, latest.document, latest.sha, `data: 恢复 ${date} 至 ${target.sha.slice(0, 7)}`);
      const incoming = documentToRecords(latest.document, result.content.sha);
      setRecords(incoming); applyRecord(incoming.find((item) => item.date === date), date);
      setStatus(`已恢复并提交 · ${result.commit.sha.slice(0, 7)}`);
      await loadRevisions();
    } catch (error) { setStatus(error instanceof Error ? error.message : "恢复失败"); }
    finally { setRevisionBusy(false); }
  };

  const stats = useMemo(() => {
    const totalPnl = records.reduce((sum, item) => sum + (Number(item.payload.fields.dailyPnl) || 0), 0);
    const traded = records.filter((item) => (Number(item.payload.fields.dailyPnl) || 0) !== 0 || item.payload.fields.action !== "空仓");
    const wins = traded.filter((item) => Number(item.payload.fields.dailyPnl) > 0).length;
    const totalR = records.reduce((sum, item) => sum + (Number(item.payload.fields.realizedR) || 0), 0);
    const violations = records.filter((item) => item.payload.fields.errorTag && item.payload.fields.errorTag !== "无").length;
    return { totalPnl, winRate: traded.length ? Math.round(wins / traded.length * 100) : 0, totalR, violations };
  }, [records]);

  const f = payload.fields;
  const current = Number(f.currentEquity) || 100000;
  const start = Number(f.startEquity) || 100000;
  const peak = Math.max(Number(f.peakEquity) || start, current);
  const candidates = [...new Set([f.candidate, f.candidate2, f.candidate3].filter(Boolean))];
  const selectedIndex = [f.candidate, f.candidate2, f.candidate3].findIndex((name) => name && name === f.executionCandidate);
  const selectedSetup = [f.allowedSetup, f.allowedSetup2, f.allowedSetup3][selectedIndex];
  const selectedInvalidations = [f.invalidations, f.invalidations2, f.invalidations3][selectedIndex];
  const gatePassed = gateChecks.every(([key]) => payload.checks[key]) && f.tradeMode !== "空仓观察" && selectedIndex >= 0 && Boolean(selectedSetup?.trim()) && Boolean(selectedInvalidations?.trim()) && Number(f.maxPosition) > 0;

  if (!connected) {
    const set = (key: keyof typeof setup, value: string | boolean) => setSetup((current) => ({ ...current, [key]: value }));
    return <main className="login-shell"><Card className="login-card github-login"><CardHeader><div className="brand-mark"><GitBranch /></div><CardTitle className="text-2xl">连接 GitHub 数据仓库</CardTitle><p className="text-muted-foreground">网站直接从你的 GitHub 仓库读取和提交复盘数据，不依赖 GPT 账号或其他服务器。</p></CardHeader><CardContent className="space-y-4"><div className="form-grid two"><Field label="GitHub 用户名"><Input value={setup.owner} onChange={(e) => set("owner", e.target.value)} placeholder="例如 octocat" /></Field><Field label="数据仓库"><Input value={setup.repo} onChange={(e) => set("repo", e.target.value)} placeholder="dragon-review-data" /></Field><Field label="分支"><Input value={setup.branch} onChange={(e) => set("branch", e.target.value)} placeholder="main" /></Field><Field label="本设备名称"><Input value={setup.device} onChange={(e) => set("device", e.target.value)} placeholder="办公室电脑" /></Field></div><Field label="数据文件路径"><Input value={setup.path} onChange={(e) => set("path", e.target.value)} placeholder="data/records.json" /></Field><Field label="Fine-grained personal access token"><Input type="password" value={setup.token} onChange={(e) => set("token", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void connect(setup); }} placeholder="只授予目标仓库 Contents 读写权限" autoComplete="current-password" /></Field><label className="remember-row"><Checkbox checked={setup.remember} onCheckedChange={(v) => set("remember", v === true)} /><span>在本设备记住令牌（仅保存连接凭证，复盘数据始终以 GitHub 为准）</span></label><Button className="w-full" onClick={() => void connect(setup)} disabled={connecting || !setup.owner || !setup.repo || !setup.token}>{connecting ? <RefreshCw className="animate-spin" /> : <GitBranch />}连接并拉取</Button><p className="status-line"><CloudOff />{status}</p><div className="token-note"><strong>令牌要求</strong><span>Fine-grained token，仅选择数据仓库，Repository permissions → Contents 设为 Read and write。不要把令牌提交进任何仓库。</span></div></CardContent></Card></main>;
  }

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">顽主杯 · 10万组 · 龙空龙</p><h1>A股龙空龙 GitHub 复盘</h1></div><div className="top-actions"><Badge variant="outline" className="sync-badge"><GitBranch />{config?.owner}/{config?.repo} · {status}</Badge><Button variant="outline" asChild><a href={`${BASE_PATH}/research.html`}><BookOpen />历史周期库</a></Button><Button variant="ghost" size="icon" title="断开本设备" onClick={() => { localStorage.removeItem(GITHUB_TOKEN_STORAGE); location.reload(); }}><LogOut /></Button></div></header>
    <section className="workspace">
      <div className="daybar"><div><label htmlFor="trade-date">交易日</label><Input id="trade-date" type="date" value={date} onChange={(e) => chooseDate(e.target.value)} /></div><div className="day-actions"><span className={dirty ? "dirty" : "saved"}>{dirty ? "修改将在停止输入6秒后提交" : `GitHub 版本 ${revision || "新建"}`}</span><Button onClick={() => void save()}><Save />立即提交</Button></div></div>
      {legacyCount > 0 && <div className="notice-row"><div><strong>检测到本设备有 {legacyCount} 个旧版记录</strong><p>可以一次迁移到 GitHub；已有同日期记录不会被覆盖。</p></div><Button onClick={() => void migrateLegacy()} disabled={migrating}><Upload />{migrating ? "正在迁移" : "迁移旧记录"}</Button></div>}
      {conflict && <div className="conflict-row"><div><strong>保存前发现另一台设备已更新 {date}</strong><p>系统已经拉取最新版。你可以载入对方版本，或把本页作为一个新提交覆盖该交易日；其他日期不会受影响。</p></div><div><Button variant="outline" onClick={() => applyRecord(conflict, date)}>载入 GitHub 最新版</Button><Button variant="destructive" onClick={() => void save(true)}>提交本页版本</Button></div></div>}
      <div className="metrics"><div><span>当前净值</span><strong>{money(current)}</strong></div><div><span>累计收益</span><strong className={current >= start ? "up" : "down"}>{((current / start - 1) * 100).toFixed(2)}%</strong></div><div><span>距峰值回撤</span><strong className="down">{((current / peak - 1) * 100).toFixed(2)}%</strong></div><div><span>今日模式</span><strong>{f.ticketStrategy || f.tradeMode}</strong></div><div><span>今日已实现 R</span><strong className={Number(f.realizedR) >= 0 ? "up" : "down"}>{Number(f.realizedR || 0).toFixed(1)}R</strong></div></div>
      <Tabs defaultValue="system" className="main-tabs"><TabsList className="tab-list"><TabsTrigger value="system">四大战法</TabsTrigger><TabsTrigger value="plan">今晚计划</TabsTrigger><TabsTrigger value="cycle">周期机会</TabsTrigger><TabsTrigger value="opening">9:30—10:00</TabsTrigger><TabsTrigger value="review">盘后复盘</TabsTrigger><TabsTrigger value="limit">涨停复盘图</TabsTrigger><TabsTrigger value="history">历史统计</TabsTrigger><TabsTrigger value="rules">龙空龙铁律</TabsTrigger></TabsList>
        <TabsContent value="system"><StrategyWorkbench fields={f} onChange={updateField} /></TabsContent>
        <TabsContent value="limit" className="panel-grid"><LimitReview date={date} /><Card className="span-6"><CardHeader><CardTitle>我的题材与竞争关系</CardTitle></CardHeader><CardContent><Textarea value={f.reviewThemes ?? ""} onChange={(e) => updateField("reviewThemes", e.target.value)} placeholder="主线、支线、板块竞争与证据；只存入私人复盘" /></CardContent></Card><Card className="span-6"><CardHeader><CardTitle>我的核心角色判断</CardTitle></CardHeader><CardContent><Textarea value={f.reviewRoles ?? ""} onChange={(e) => updateField("reviewRoles", e.target.value)} placeholder="龙头、中军、补涨、20cm 核心及证伪条件；由我确认" /></CardContent></Card></TabsContent>
        <TabsContent value="plan" className="panel-grid">
          <Card className="span-4"><CardHeader><CardTitle>账户与周期</CardTitle></CardHeader><CardContent className="form-grid two"><Field label="比赛初始资金"><Input type="number" value={f.startEquity} onChange={(e) => updateField("startEquity", e.target.value)} /></Field><Field label="当前净值"><Input type="number" value={f.currentEquity} onChange={(e) => updateField("currentEquity", e.target.value)} /></Field><Field label="历史峰值"><Input type="number" value={f.peakEquity} onChange={(e) => updateField("peakEquity", e.target.value)} /></Field><Field label="当日盈亏额"><Input type="number" value={f.dailyPnl} onChange={(e) => updateField("dailyPnl", e.target.value)} /></Field><Field label="周期阶段"><Select value={f.cyclePhase} onValueChange={(v) => updateField("cyclePhase", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["混沌","启动试错","发育","成型","首次分歧","加速","高位震荡","退潮","冰点修复"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="今日允许模式"><Select value={f.tradeMode} onValueChange={(v) => updateField("tradeMode", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["空仓观察","新龙卡位","新龙首次真分歧","主升龙头","老龙反核","老龙反抽","老龙二波","龙头属性补涨","20cm弹性","容量中军趋势"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field></CardContent></Card>
          <YesterdayPremium />
          <Card className="span-8"><CardHeader><CardTitle>盘面事实</CardTitle></CardHeader><CardContent className="form-grid two"><Field label="指数 / 成交额 / 增减"><Textarea value={f.marketFacts} onChange={(e) => updateField("marketFacts", e.target.value)} /></Field><Field label="涨跌停 / 炸板 / 溢价解读"><Textarea value={f.sentimentFacts} onChange={(e) => updateField("sentimentFacts", e.target.value)} /></Field><Field label="完整梯队"><Textarea value={f.ladder} onChange={(e) => updateField("ladder", e.target.value)} /></Field><Field label="竞争板块与资金流向"><Textarea value={f.rivalSectors} onChange={(e) => updateField("rivalSectors", e.target.value)} /></Field><Field label="监管 / 公告 / 催化事实"><Textarea value={f.regulatoryFacts} onChange={(e) => updateField("regulatoryFacts", e.target.value)} /></Field></CardContent></Card>
          <Card className="span-7"><CardHeader><CardTitle>每日三个预设候选 · 开盘择一执行</CardTitle></CardHeader><CardContent className="form-grid two"><Field label="候选 1 · 股票与代码"><Input value={f.candidate ?? ""} onChange={(e) => updateField("candidate", e.target.value)} /></Field><Field label="候选 2 · 股票与代码"><Input value={f.candidate2 ?? ""} onChange={(e) => updateField("candidate2", e.target.value)} /></Field><Field label="候选 3 · 股票与代码"><Input value={f.candidate3 ?? ""} onChange={(e) => updateField("candidate3", e.target.value)} /></Field><Field label="候选 2 预设买点"><Input value={f.allowedSetup2 ?? ""} onChange={(e) => updateField("allowedSetup2", e.target.value)} /></Field><Field label="候选 3 预设买点"><Input value={f.allowedSetup3 ?? ""} onChange={(e) => updateField("allowedSetup3", e.target.value)} /></Field><Field label="候选 2 证伪条件"><Input value={f.invalidations2 ?? ""} onChange={(e) => updateField("invalidations2", e.target.value)} /></Field><Field label="候选 3 证伪条件"><Input value={f.invalidations3 ?? ""} onChange={(e) => updateField("invalidations3", e.target.value)} /></Field><Field label="候选 1 角色"><Select value={f.candidateRole} onValueChange={(v) => updateField("candidateRole", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["未确定","同身位卡位者","发育期潜在龙","成型总龙","加速龙头","首次真分歧","老龙反核","老龙反抽","老龙二波","属性补涨","20cm弹性核心","容量中军"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="候选 1 明日只允许的买点"><Input value={f.allowedSetup} onChange={(e) => updateField("allowedSetup", e.target.value)} /></Field><Field label="最大仓位 %"><Input type="number" min="0" max="40" value={f.maxPosition} onChange={(e) => updateField("maxPosition", e.target.value)} /></Field><Field label="成为核心的三条证据"><Textarea value={f.leaderEvidence} onChange={(e) => updateField("leaderEvidence", e.target.value)} /></Field><Field label="三条证伪条件"><Textarea value={f.invalidations} onChange={(e) => updateField("invalidations", e.target.value)} /></Field><p className="span-12 text-sm text-muted-foreground">三个候选连同各自买点和证伪条件跨设备同步。开盘只选择一只；同因子候选不算分散，全部证伪则空仓。</p></CardContent></Card>
          <Card className="span-5"><CardHeader><CardTitle>开仓前置条件</CardTitle></CardHeader><CardContent className="check-list">{preChecks.map((item) => <CheckItem key={item[0]} item={item} checked={Boolean(payload.checks[item[0]])} onChange={(v) => updateCheck(item[0], v)} />)}</CardContent></Card>
          <Card className="span-12"><CardHeader><CardTitle>明日三情景</CardTitle></CardHeader><CardContent className="form-grid two"><Field label="A · 超预期：触发 → 动作"><Textarea value={f.scenarioA} onChange={(e) => updateField("scenarioA", e.target.value)} /></Field><Field label="B · 符合预期：触发 → 动作"><Textarea value={f.scenarioB} onChange={(e) => updateField("scenarioB", e.target.value)} /></Field><Field label="C · 低于预期：触发 → 动作"><Textarea value={f.scenarioC} onChange={(e) => updateField("scenarioC", e.target.value)} /></Field><Field label="明日绝对不做"><Textarea value={f.noDoList} onChange={(e) => updateField("noDoList", e.target.value)} /></Field></CardContent></Card>
        </TabsContent>
        <TabsContent value="cycle" className="panel-grid"><CycleRadar fields={f} onChange={updateField} /></TabsContent>
        <TabsContent value="opening" className="panel-grid"><YesterdayPremium /><Card className="span-12"><CardHeader><CardTitle>30分钟时间锁</CardTitle></CardHeader><CardContent className="time-grid"><div><strong>9:30—9:35</strong><span>只观察</span><p>总龙承接、竞价兑现、梯队与竞争板块。非瞬间满足全部预案，不抢第一笔。</p></div><div><strong>9:35—9:50</strong><span>唯一执行窗</span><p>只执行三个预设候选中的一只；全部证伪则空仓。</p></div><div><strong>9:50—10:00</strong><span>锁单与退出</span><p>处理撤单或卖出并记录；10:00后不临时开新仓。</p></div></CardContent></Card>
          <Card className="span-7"><CardHeader><CardTitle>开盘事实与动作</CardTitle></CardHeader><CardContent className="form-grid two"><Field label="9:25竞价"><Textarea value={f.auction} onChange={(e) => updateField("auction", e.target.value)} /></Field><Field label="9:30—9:35总龙承接"><Textarea value={f.firstFive} onChange={(e) => updateField("firstFive", e.target.value)} /></Field><Field label="竞争者实际表现"><Textarea value={f.openingRivals} onChange={(e) => updateField("openingRivals", e.target.value)} /></Field><Field label="与昨晚预案偏差"><Textarea value={f.planDelta} onChange={(e) => updateField("planDelta", e.target.value)} /></Field><Field label="最终动作"><Select value={f.action} onValueChange={(v) => updateField("action", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["空仓","买入","持有","减仓","清仓"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="实际仓位 %"><Input type="number" value={f.actualPosition} onChange={(e) => updateField("actualPosition", e.target.value)} /></Field><Field label="执行价格 / 原因 / 证据"><Textarea value={f.executionNote} onChange={(e) => updateField("executionNote", e.target.value)} /></Field></CardContent></Card>
          <Card className={`span-5 gate-card ${gatePassed ? "pass" : "stop"}`}><CardHeader><CardTitle>下单授权闸门</CardTitle></CardHeader><CardContent className="check-list"><Field label="今日选择执行哪只候选"><Select value={f.executionCandidate || "none"} onValueChange={(v) => updateField("executionCandidate", v === "none" ? "" : v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择 · 空仓</SelectItem>{candidates.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></Field>{gateChecks.map((item) => <CheckItem key={item[0]} item={item} checked={Boolean(payload.checks[item[0]])} onChange={(v) => updateCheck(item[0], v)} />)}<div className="gate-result">{gatePassed ? <><Check />允许执行：仅限 {f.executionCandidate}，仓位≤{f.maxPosition}%</> : <><AlertTriangle />默认不下单：条件尚未全部满足</>}</div></CardContent></Card>
        </TabsContent>
        <TabsContent value="review" className="panel-grid"><Card className="span-6"><CardHeader><CardTitle>盘面与认知</CardTitle></CardHeader><CardContent className="form-grid"><Field label="今日最强结构 / 最赚钱模式"><Textarea value={f.bestPattern} onChange={(e) => updateField("bestPattern", e.target.value)} /></Field><Field label="今日最差结构 / 亏钱扩散"><Textarea value={f.worstPattern} onChange={(e) => updateField("worstPattern", e.target.value)} /></Field><Field label="龙头、梯队、竞争板块收盘定格"><Textarea value={f.closingMap} onChange={(e) => updateField("closingMap", e.target.value)} /></Field><Field label="相似历史周期：相同与不同"><Textarea value={f.historicalAnalogy} onChange={(e) => updateField("historicalAnalogy", e.target.value)} /></Field></CardContent></Card>
          <Card className="span-6"><CardHeader><CardTitle>交易与纠偏</CardTitle></CardHeader><CardContent className="form-grid"><Field label="买卖理由与实际偏差"><Textarea value={f.tradeReview} onChange={(e) => updateField("tradeReview", e.target.value)} /></Field><Field label="如果重来，只改一个动作"><Textarea value={f.oneChange} onChange={(e) => updateField("oneChange", e.target.value)} /></Field><Field label="错误标签"><Select value={f.errorTag} onValueChange={(v) => updateField("errorTag", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["无","计划外交易","非预设候选","追加速","退潮接力","后排套利","仓位超限","证伪后不撤","超时开仓","卖点拖延","结果替代过程评价"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="明日唯一纠偏"><Textarea value={f.correction} onChange={(e) => updateField("correction", e.target.value)} /></Field></CardContent></Card>
          <Card className="span-12"><CardHeader><CardTitle>过程纪律打卡</CardTitle></CardHeader><CardContent className="discipline-grid">{disciplineChecks.map((item) => <CheckItem key={item[0]} item={item} checked={Boolean(payload.checks[item[0]])} onChange={(v) => updateCheck(item[0], v)} />)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="history" className="history-stack"><div className="metrics history-metrics"><div><span>已记录交易日</span><strong>{records.length}</strong></div><div><span>有交易日胜率</span><strong>{stats.winRate}%</strong></div><div><span>累计记录盈亏</span><strong>{money(stats.totalPnl)}</strong></div><div><span>累计实现 R</span><strong>{stats.totalR.toFixed(1)}R</strong></div><div><span>违规标签次数</span><strong>{stats.violations}</strong></div></div><Card><CardHeader className="history-head"><div><CardTitle>GitHub 逐日档案</CardTitle><p>打开页面、提交前和每30秒都会拉取；每次提交都能在 GitHub 中审计和回溯。</p></div><div><Button variant="outline" onClick={() => void fetchAll()}><RefreshCw />拉取最新版</Button><Button variant="outline" onClick={exportCloud}><Download />导出快照</Button></div></CardHeader><CardContent><div className="table-wrap"><Table><TableHeader><TableRow><TableHead>日期</TableHead><TableHead>周期</TableHead><TableHead>模式</TableHead><TableHead>候选</TableHead><TableHead>动作</TableHead><TableHead>盈亏</TableHead><TableHead>实现 R</TableHead><TableHead>设备</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{records.map((item) => <TableRow key={item.date}><TableCell><button className="date-link" onClick={() => chooseDate(item.date)}>{item.date}</button></TableCell><TableCell>{item.payload.fields.cyclePhase}</TableCell><TableCell>{item.payload.fields.ticketStrategy || item.payload.fields.tradeMode}</TableCell><TableCell>{item.payload.fields.ticketStock || item.payload.fields.candidate || "—"}</TableCell><TableCell>{item.payload.fields.action}</TableCell><TableCell>{money(item.payload.fields.dailyPnl)}</TableCell><TableCell>{Number(item.payload.fields.realizedR || 0).toFixed(1)}R</TableCell><TableCell>{item.device || "—"}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => void removeDay(item.date)}>删除</Button></TableCell></TableRow>)}</TableBody></Table>{!records.length && <p className="empty">GitHub 中还没有复盘记录，填写后提交即可创建数据文件。</p>}</div></CardContent></Card><Card><CardHeader className="history-head"><div><CardTitle>提交历史与恢复</CardTitle><p>恢复旧版不会改写历史，而是基于旧数据创建一个新提交。</p></div><Button variant="outline" onClick={() => void loadRevisions()} disabled={revisionBusy}>{revisionBusy ? <RefreshCw className="animate-spin" /> : <History />}读取版本历史</Button></CardHeader><CardContent><div className="revision-list">{revisions.map((item) => <div className="revision-item" key={item.sha}><div><strong>{item.sha.slice(0, 7)}</strong><span>{item.message}</span><small>{new Date(item.authoredAt).toLocaleString("zh-CN")} · {item.author}</small></div><Button variant="outline" size="sm" onClick={() => void restoreRevision(item)} disabled={revisionBusy}><RotateCcw />恢复当前交易日</Button></div>)}{!revisions.length && <p className="empty">点击“读取版本历史”查看最近40次提交。</p>}</div></CardContent></Card></TabsContent>
        <TabsContent value="rules" className="panel-grid"><Card className="span-12"><CardHeader><CardTitle>龙空龙仓位矩阵</CardTitle></CardHeader><CardContent><div className="table-wrap"><Table><TableHeader><TableRow><TableHead>阶段 / 模式</TableHead><TableHead>允许动作</TableHead><TableHead>新开仓上限</TableHead><TableHead>必须看到</TableHead><TableHead>一票否决</TableHead></TableRow></TableHeader><TableBody>{[["启动试错 / 同身位竞争","观察或极小试错","0—10%","竞价卡位、失败者负反馈、胜者唯一性","多龙混战或后排先高潮"],["发育 / 成型","总龙确认","20—30%","唯一性、换手、板块带动","后排批量掉队"],["首次真分歧","核心分歧转强","30—40%","加速后放量承接、梯队未崩","亏钱效应向核心扩散"],["连续加速 / 绕异动","持仓管理","0—20%","异动余量核对、板块确认","第三次加速后被动接盘"],["退潮 / 混沌","空仓","0%","等待冰点后的主动修复","任何手痒理由"],["老龙反核 / 反抽","独立小仓模式","10—20%","恐慌释放后主动修复","把反核或反抽误判二波"],["老龙二波","核心穿越","20—30%","突破前高且原属性响应","只个股新高、板块不跟"],["监管节点套利","确认后参与","0—20%","盘后确认未续杯、预期未透支","把到期日当自动解除"]].map((row) => <TableRow key={row[0]}>{row.map((cell) => <TableCell key={cell}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table></div></CardContent></Card><Card className="span-6"><CardHeader><CardTitle>绝不交易</CardTitle></CardHeader><CardContent><ol className="number-list"><li>不是昨晚三个预设候选之一。</li><li>同一个“监管解除/老抱团回流”因子同时买两只。</li><li>把监控到期日当成次日自动解除，或盘后未查续杯。</li><li>把累计偏离值剩余百分点直接当成股价上涨空间。</li><li>退潮期的中位板、后排和补涨末端。</li><li>高潮日第一次被看懂的后排。</li><li>连续加速后再凭“龙头信仰”追价。</li><li>证伪后临盘改叙事或10:00后开新仓。</li></ol></CardContent></Card><Card className="span-6"><CardHeader><CardTitle>四周盘感训练</CardTitle></CardHeader><CardContent><ol className="number-list"><li><b>周期地图：</b>区分“情绪上升段启动”和“新主周期确认”，必须记录首次大分歧。</li><li><b>同身位竞争：</b>成功龙头配失败者，比较竞价、换手、带动与反馈。</li><li><b>首次真分歧：</b>逐笔记录加速前置、下杀承接、回封主动性、后排负反馈。</li><li><b>老龙分级：</b>反核、反抽、二波分别统计；只有突破前高且带动属性才升级二波。</li><li><b>监管复盘：</b>登记当前窗口、到期日、续杯次数、盘后新名单和异动余量。</li></ol></CardContent></Card></TabsContent>
      </Tabs>
    </section>
  </main>;
}
