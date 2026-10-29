"""Daily touch cohort study + separately verified T+1 execution statistics.

No minute-entry claims. Without explicit entry/exit fill evidence, forward daily
returns remain descriptive and executable returns are null. Every touch episode,
including rejected, missing and unseasoned outcomes, is exported.
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import mean

from low_absorption_research import RULE_VERSION, research_facts


def summarize(rows, executable=False):
    key = "netReturnPct" if executable else "forwardReturnPct"
    completed = [r for r in rows if r.get(key) is not None]
    vals = [r[key] for r in completed]
    wins, losses = [x for x in vals if x > 0], [x for x in vals if x < 0]
    rs = [r["realizedR"] for r in completed if r.get("realizedR") is not None]
    return {"samples": len(rows), "completed": len(completed), "stockClusters": len({r["code"] for r in rows}),
            "winRatePct": 100 * len(wins) / len(vals) if vals else None, "meanReturnPct": mean(vals) if vals else None,
            "payoffRatio": mean(wins) / abs(mean(losses)) if wins and losses else None,
            "expectedR": mean(rs) if rs else None, "rSamples": len(rs),
            "meanMfePct": mean(r["mfePct"] for r in completed) if completed else None,
            "meanMaePct": mean(r["maePct"] for r in completed) if completed else None,
            "worstOvernightGapPct": min(r["overnightGapPct"] for r in completed) if completed else None,
            "worstT1LowPct": min(r["t1LowPct"] for r in completed) if completed else None,
            "warning": "样本不足30或同股相关，不能判定优势" if len(completed) < 30 or len({r["code"] for r in completed}) < 10 else "探索性统计，仍需按股票聚类和跨时期验证"}


def study(snapshot, days, cost_pct=.2):
    if not 0 <= cost_pct <= 10:
        raise ValueError("成本须为0—10%的往返估计")
    sessions = snapshot["calendar"]["sessions"]
    through = snapshot["tradeDate"]
    if not sessions or sessions != sorted(set(sessions)) or through not in sessions:
        raise ValueError("交易日历无效")
    rows, missing = [], []
    sources = snapshot.get("stocks", [])
    # The nominated universe includes expired names; do not filter by later success.
    for stock in sources:
        code = stock["code"]
        bars = stock.get("bars", [])
        if not bars or stock.get("error"):
            missing.append({"code": code, "reason": stock.get("error", "缺历史日线")})
            continue
        bars = [b for b in bars if b["date"] <= through]
        if [b["date"] for b in bars] != sorted({b["date"] for b in bars}):
            raise ValueError("日线日期必须唯一递增")
        for b in bars:
            if b["date"] not in sessions or any(not isinstance(b.get(k), (int, float)) or isinstance(b.get(k), bool) or not math.isfinite(b[k]) or b[k] <= 0 for k in ("open", "high", "low", "close")) or not isinstance(b.get("volume"), (int, float)) or not math.isfinite(b["volume"]) or b["volume"] < 0 or b["low"] > min(b["open"], b["close"]) or b["high"] < max(b["open"], b["close"]):
                raise ValueError("研究日线OHLC/量能/日历不合法")
        by_date = {b["date"]: b for b in bars}
        for d in sessions[-20:]:
            if d > through or d not in by_date:
                continue
            history = [b for b in bars if b["date"] <= d]
            if len(history) < 30:
                continue
            facts = research_facts(code, history, days, sessions, d)
            if facts["leaderClass"] == "unclassified" or not facts["boardAge"]:
                continue
            for touch in facts["touches"]:
                # Sample the beginning of each observation-band episode only.
                if not touch["touching"]:
                    continue
                prior = research_facts(code, history[:-1], days, sessions, history[-2]["date"])
                previous = next(t for t in prior["touches"] if t["period"] == touch["period"])
                if prior["lastBoard"] == facts["lastBoard"] and previous["touching"]:
                    continue
                row = {"code": code, "signalDate": d, "cluster": code, "cycle": facts["lastBoard"], "leaderClass": facts["leaderClass"],
                       "strategy": "S0候选" if touch["period"] == 5 else "S1候选" if touch["period"] == 10 else "S2观察", "period": touch["period"],
                       "attempt": touch["touchCount"], "boardAge": facts["boardAge"], "activeAge": facts["activeAge"],
                       "environment": "未标注", "priority": facts["priority"], "forwardReturnPct": None, "netReturnPct": None,
                       "realizedR": None, "mfePct": None, "maePct": None, "overnightGapPct": None, "t1LowPct": None, "plannedRewardRisk": None,
                       "executionStatus": "缺分钟信号和成交证据", "status": "未成熟", "panicVolume": "非跌停或待核"}
                recent_days = [b["date"] for b in history[-3:]]
                downs = [b for b in history[-3:] if any(s["code"] == code for s in days.get(b["date"], {}).get("down", []))]
                if downs:
                    ratios = []
                    for b in downs:
                        j = history.index(b)
                        baseline = mean(v["volume"] for v in history[j - 5:j]) if j >= 5 else 0
                        if baseline > 0:
                            ratios.append(b["volume"] / baseline)
                    row["panicVolume"] = "放量跌停" if ratios and max(ratios) >= 1.5 else "缩量跌停" if ratios and max(ratios) < 1 else "中性/待核"
                required = sessions[max(0, sessions.index(d) - 29):sessions.index(d) + 1]
                if facts["missingIdentitySessions"] or any(x not in by_date for x in required) or any(x not in days for x in recent_days):
                    row["status"] = "归档或日线缺口"
                    rows.append(row)
                    continue
                i = sessions.index(d)
                # Signal is after close; earliest entry is next open, earliest sale T+1.
                future = sessions[i + 1:i + 3]
                if len(future) < 2 or any(x not in by_date for x in future):
                    rows.append(row)
                    continue
                entry_bar, exit_bar = [by_date[x] for x in future]
                entry, exit_price = entry_bar["open"], exit_bar["close"]
                if min(entry, exit_price) <= 0:
                    raise ValueError("非正价格")
                stop = history[-1]["low"]
                target = max(b["high"] for b in history[-6:-1])
                risk = entry - stop + entry * cost_pct / 100
                row.update({"status": "描述性已成熟", "entryDate": future[0], "exitDate": future[1], "referenceEntry": entry,
                            "referenceExit": exit_price, "forwardReturnPct": (exit_price / entry - 1) * 100 - cost_pct,
                            "mfePct": (max(b["high"] for b in [entry_bar, exit_bar]) / entry - 1) * 100,
                            "maePct": (min(b["low"] for b in [entry_bar, exit_bar]) / entry - 1) * 100,
                            "overnightGapPct": (exit_bar["open"] / entry_bar["close"] - 1) * 100,
                            "t1LowPct": (exit_bar["low"] / entry - 1) * 100,
                            "plannedRewardRisk": (target - entry - entry * cost_pct / 100) / risk if entry > stop and target > entry else None})
                # Daily bars cannot prove fills, especially at limit prices. Require an
                # explicit observed executable price at these exact scheduled instants.
                entry_fill, exit_fill = entry_bar.get("verifiedOpenFill"), exit_bar.get("verifiedCloseFill")
                valid_fill = lambda v, price: isinstance(v, dict) and v.get("price") == price and bool(v.get("source")) and v.get("available") is True
                if valid_fill(entry_fill, entry) and valid_fill(exit_fill, exit_price):
                    row["netReturnPct"] = row["forwardReturnPct"]
                    row["realizedR"] = (exit_price - entry - entry * cost_pct / 100) / risk if entry > stop else None
                    row["executionStatus"] = "已核验日线定时成交；非分钟承接策略"
                rows.append(row)
    groups = defaultdict(list)
    for row in rows:
        # Preserve first/repeated touch and clocks as explicit comparison axes.
        clock = "未知" if row["activeAge"] is None else "0—10日" if row["activeAge"] <= 10 else "11—20日" if row["activeAge"] <= 20 else "20日以上"
        board_clock = "1—5日" if row["boardAge"] <= 5 else "6—10日" if row["boardAge"] <= 10 else "11—20日" if row["boardAge"] <= 20 else "20日以上"
        group = (row["leaderClass"], row["strategy"], row["period"], "首次" if row["attempt"] == 1 else "重复", board_clock, clock, row["panicVolume"])
        groups[group].append(row)
    return {"schemaVersion": 1, "ruleVersion": RULE_VERSION, "tradeDate": through, "source": snapshot.get("source", "未标注"),
            "kind": "日线触线观察研究", "costPct": cost_pct,
            "limitations": ["收盘识别触线，次日开盘作参考入场，再下一交易日收盘作参考退出；持有期受T+1约束", "默认收益仅为日线描述性价差，无法核实涨跌停成交，不是S1/S2分钟策略回测", "身份只为C1/C2自动提名，C3需历史人工身份记录，当前单独排除", "当前45日归档提名范围，非全市场无幸存偏差样本；缺股和失败均保留", "前复权为采集时固定口径；不等于历史时点已知公司行为；同股跨均线和重复触线非独立样本", "未标注市场环境、板块地位和催化；不得据此提高仓位或断言MA排序"],
            "universeStocks": len(sources), "missingStocks": missing, "rows": rows,
            "descriptive": summarize(rows), "executable": summarize(rows, True),
            "groups": [{"leaderClass": k[0], "strategy": k[1], "period": k[2], "touch": k[3], "boardClock": k[4], "activeClock": k[5], "panicVolume": k[6], "descriptive": summarize(v), "executable": summarize(v, True)} for k, v in sorted(groups.items())]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--archive-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cost-pct", type=float, default=.2)
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    days = {}
    for path in (args.archive_dir / "daily").glob("*/*/*.json"):
        raw = json.loads(path.read_text())
        if raw.get("schemaVersion") == 1 and raw.get("tradeDate", "") <= snapshot["tradeDate"]:
            days[raw["tradeDate"]] = raw
    report = study(snapshot, days, args.cost_pct)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    print(f"日线观察：{len(report['rows'])}事件；描述性成熟{report['descriptive']['completed']}；有成交证据{report['executable']['completed']}；缺日线{len(report['missingStocks'])}")


if __name__ == "__main__":
    main()
