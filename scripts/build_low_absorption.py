"""Build dated, end-of-day radar facts. No orders, minute signals or private notes."""
import argparse
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from low_absorption_research import archive_identity, research_facts
from market_history import load_sessions, load_stock


def finite(value, positive=False):
    result = float(value)
    if not math.isfinite(result) or (positive and result <= 0):
        raise ValueError("非有限或无效行情价格")
    return result


def normalize_bars(frame, through):
    needed = {"日期", "开盘", "收盘", "最高", "最低", "成交量", "换手率"}
    if frame.empty or not needed.issubset(frame.columns):
        raise ValueError("日线为空或字段缺失")
    result = []
    for raw in frame.to_dict("records"):
        day = str(raw["日期"])[:10]
        date.fromisoformat(day)
        if day > through:
            continue  # Never leak a future day into a dated snapshot.
        row = {"date": day, **{key: finite(raw[label], positive=True) for key, label in [("open", "开盘"), ("close", "收盘"), ("high", "最高"), ("low", "最低")]}, "volume": finite(raw["成交量"]), "turnoverRate": finite(raw["换手率"])}
        if row["volume"] < 0 or row["turnoverRate"] < 0 or row["low"] > min(row["open"], row["close"]) or row["high"] < max(row["open"], row["close"]) or row["low"] > row["high"]:
            raise ValueError("日线OHLC/量能不合法")
        result.append(row)
    result.sort(key=lambda r: r["date"])
    if not result or len({r["date"] for r in result}) != len(result):
        raise ValueError("日线日期重复或没有截至日期的数据")
    return result


def volume_ratio(bars, i):
    if i < 5:
        return None
    baseline = sum(b["volume"] for b in bars[i - 5:i]) / 5
    return round(bars[i]["volume"] / baseline, 4) if baseline > 0 else None


def metrics(code, bars, last_board, through, downs):
    if not bars or bars[-1]["date"] != through:
        raise ValueError("所选交易日无日线（停牌/接口滞后），不复用旧价")
    if last_board not in {r["date"] for r in bars}:
        raise ValueError("缺最后涨停日的日线，无法计算本轮首次触线")
    close = bars[-1]["close"]
    averages = []
    for period in [5, 10, 20, 30]:
        average = sum(r["close"] for r in bars[-period:]) / period if len(bars) >= period else None
        first = None
        for i in range(period - 1, len(bars)):
            row = bars[i]
            if row["date"] <= last_board:
                continue
            ma = sum(r["close"] for r in bars[i - period + 1:i + 1]) / period
            if row["low"] <= ma * 1.01 and row["high"] >= ma * 0.99:
                first = row["date"]
                break
        averages.append({"period": period, "value": round(average, 4) if average else None, "distancePct": round((close / average - 1) * 100, 4) if average else None, "firstTouchDate": first})
    highs = [r["high"] for r in bars if r["date"] >= last_board]
    falling = 0
    for i in range(len(bars) - 1, 0, -1):
        if bars[i]["close"] >= bars[i - 1]["close"]:
            break
        falling += 1
    return {"code": code, "dataDate": through, "close": close, "drawdownPct": round((close / max(highs) - 1) * 100, 4), "fallingDays": falling, "volumeRatio": volume_ratio(bars, len(bars) - 1), "turnoverRate": bars[-1]["turnoverRate"], "averages": averages,
            "recent": [{**{k: row[k] for k in ["date", "close", "volume", "turnoverRate"]}, "limitDown": code in downs.get(row["date"], set()), "volumeRatio": volume_ratio(bars, i)} for i, row in enumerate(bars) if i >= len(bars) - 3],
            "bars": bars}  # Freeze underlying qfq history with each snapshot for audit.


def load_archives(root, sessions, today):
    days = {}
    for day in sessions:
        path = root / "daily" / day[:4] / day[5:7] / f"{day}.json"
        try:
            raw = today if today.get("tradeDate") == day else json.loads(path.read_text(encoding="utf-8"))
            if raw.get("schemaVersion") != 1 or raw.get("tradeDate") != day or not isinstance(raw.get("stocks"), list):
                continue
            if any(not isinstance(s.get("boards"), int) or s["boards"] < 1 or not isinstance(s.get("code"), str) or len(s["code"]) != 6 or not s["code"].isdigit() or not s.get("name") for s in raw["stocks"]):
                continue
            days[day] = raw
        except (OSError, ValueError, TypeError, AttributeError):
            continue
    return days


def candidates(days, sessions):
    # Keep expired/failed names for research; memory affects priority, not survival.
    codes = {s["code"]: s["name"] for d in days.values() for s in d["stocks"]}
    result = []
    for code, name in codes.items():
        identity = archive_identity(code, days, sessions, sessions[-1])
        if identity["maxBoards"] >= 2 or identity["limitCount10"] >= 6:
            result.append({"code": code, "name": name, **identity})
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-dir", type=Path, required=True)
    parser.add_argument("--today", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--trade-date", help="明确指定历史交易日用于补采；默认北京时间当天")
    args = parser.parse_args()
    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    through = args.trade_date or now.date().isoformat()
    as_of = date.fromisoformat(through)
    if as_of > now.date():
        raise ValueError("禁止生成未来日线快照")
    if as_of == now.date() and now.hour < 15:
        raise RuntimeError("仅收盘后生成，不把盘中日线当收盘数据")
    today = json.loads(args.today.read_text(encoding="utf-8"))
    if today.get("tradeDate") != through:
        raise ValueError("当日涨停归档日期不匹配")
    start = (as_of - timedelta(days=210)).isoformat()
    sessions, calendar_source = load_sessions(start, through)
    calendar = {"schemaVersion": 1, "source": calendar_source, "coveredFrom": sessions[0], "coveredThrough": through, "sessions": sessions}
    scan = sessions[-45:]
    archives = load_archives(args.archive_dir, sessions[-65:], today)  # 45-day identity warmup + 20-day study.
    missing = [d for d in scan if d not in archives]
    pool = candidates(archives, scan)
    downs = {day: {s["code"] for s in data.get("down", [])} for day, data in archives.items()}
    # Bound the expanded retained universe so failures do not consume the entire
    # six-minute workflow and discard all completed stock snapshots.
    deadline = time.monotonic() + 260
    def collect(candidate):
        code = candidate["code"]
        try:
            if time.monotonic() >= deadline:
                raise TimeoutError("本批采集预算用尽；候选保留，下次补齐")
            bars, provenance = load_stock(code, start, through)
            # An internal omission must not shift MAs or count a false 'first' touch.
            expected = {d for d in sessions if bars[0]["date"] <= d <= through}
            if expected != {r["date"] for r in bars}:
                raise ValueError("日线存在缺口/停牌；均线与首次触线待人工核对")
            facts = metrics(code, bars, candidate["lastBoard"], through, downs)
            return {**candidate, **facts, **provenance, "research": research_facts(code, bars, archives, sessions, through)}
        except Exception as exc:
            print(f"{code} 日线缺失：{type(exc).__name__}")
            return {**candidate, "error": str(exc)[:250]}
    with ThreadPoolExecutor(max_workers=4) as executor:
        stocks = list(executor.map(collect, pool))
    snapshot = {"schemaVersion": 1, "tradeDate": through, "observedAt": now.isoformat(timespec="seconds"), "source": "同股整段同源日线；逐股priceSource标注；涨跌停池为现有归档", "adjustment": "前复权qfq；采集时口径；成交量详见逐股volumeUnit；仅收盘事实", "calendar": calendar, "missingArchives": missing, "stocks": stocks}
    output = args.out / "radar" / through[:4] / through[5:7]
    output.mkdir(parents=True, exist_ok=True)
    (output / f"{through}.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    (args.out / "trading-calendar.json").write_text(json.dumps(calendar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    from backtest_low_absorption import study
    try:
        report = study(snapshot, archives)
        research_output = args.out / "research" / through[:4] / through[5:7]
        research_output.mkdir(parents=True, exist_ok=True)
        (research_output / f"{through}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    except Exception as exc:
        print(f"研究报告未生成（不影响日线快照）：{type(exc).__name__}: {str(exc)[:200]}")
    print(f"低吸日线快照：{len(stocks)}候选 / {sum('error' in s for s in stocks)}缺失 / {len(missing)}日涨停归档缺失")


if __name__ == "__main__":
    main()
