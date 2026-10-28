"""Bounded direct history adapters; never require a whole-market symbol lookup.

EM columns follow AKShare 1.18.96 stock_hist_em.py; Tencent qfq OHLC follows
stock_hist_tx.py. Each stock keeps a complete single-provider history. We do not
infer Tencent turnover/volume units or splice unadjusted bars into qfq prices.
"""
import json
import math
from datetime import date
from urllib.parse import urlencode
from urllib.request import Request, urlopen

EM = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
TX = "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get"


def get_json(url, params):
    request = Request(url + "?" + urlencode(params), headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gu.qq.com/"})
    with urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8-sig"))


def finite(value, positive=False):
    number = float(value)
    if not math.isfinite(number) or (positive and number <= 0):
        raise ValueError("无效行情数字")
    return number


def validate_bars(rows, start, through):
    result = []
    for row in rows:
        day = row["date"]
        date.fromisoformat(day)
        if not start <= day <= through:
            continue
        bar = {"date": day, **{k: finite(row[k], True) for k in ("open", "close", "high", "low")}, "volume": finite(row["volume"]), "turnoverRate": None if row.get("turnoverRate") is None else finite(row["turnoverRate"])}
        if bar["volume"] < 0 or bar["turnoverRate"] is not None and bar["turnoverRate"] < 0 or bar["low"] > min(bar["open"], bar["close"]) or bar["high"] < max(bar["open"], bar["close"]):
            raise ValueError("日线OHLC/量能不合法")
        result.append(bar)
    result.sort(key=lambda b: b["date"])
    if not result or result[-1]["date"] != through:
        raise ValueError("历史未覆盖所选交易日；拒绝用旧价格替代")
    if len({b["date"] for b in result}) != len(result):
        raise ValueError("日线日期重复")
    return result


def em_bars(payload, code, start, through):
    data = payload.get("data") or {}
    if data.get("code") != code:
        raise ValueError("东方财富返回代码不匹配")
    rows = []
    for line in data.get("klines", []):
        values = line.split(",")
        if len(values) < 11:
            raise ValueError("东方财富日线字段不足")
        rows.append({"date": values[0], "open": values[1], "close": values[2], "high": values[3], "low": values[4], "volume": values[5], "turnoverRate": values[10]})
    return validate_bars(rows, start, through)


def tx_bars(payload, symbol, start, through, index=False):
    if payload.get("code") != 0:
        raise ValueError("腾讯行情返回异常")
    data = payload.get("data", {}).get(symbol, {})
    # qfqday is mandatory for stocks. A raw `day` series is only accepted for
    # the index calendar; never silently downgrade a stock to unadjusted data.
    values = data.get("day") if index else data.get("qfqday")
    if not isinstance(values, list):
        raise ValueError("缺指数日线/明确前复权日线")
    rows = []
    for r in values:
        if len(r) < 6:
            raise ValueError("腾讯日线字段不足")
        rows.append({"date": r[0], "open": r[1], "close": r[2], "high": r[3], "low": r[4], "volume": r[5], "turnoverRate": None})
    return validate_bars(rows, start, through)


def em_params(secid, start, through, adjusted):
    return {"secid": secid, "fields1": "f1,f2,f3,f4,f5,f6", "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61", "klt": "101", "fqt": "1" if adjusted else "0", "beg": start.replace("-", ""), "end": through.replace("-", "")}


def tx_params(symbol, start, through):
    return {"param": f"{symbol},day,{start},{through},640,qfq"}


def load_sessions(start, through, fetch=get_json):
    errors = []
    for source, call in [
        ("上证指数实际日K / 东方财富直连", lambda: em_bars(fetch(EM, em_params("1.000001", start, through, False)), "000001", start, through)),
        ("上证指数实际日K / 腾讯备用", lambda: tx_bars(fetch(TX, tx_params("sh000001", start, through)), "sh000001", start, through, index=True)),
    ]:
        try:
            sessions = [b["date"] for b in call()]
            if len(sessions) < 60:
                raise ValueError("指数实际交易日不足60个")
            return sessions, source
        except Exception as exc:
            errors.append(f"{source}: {type(exc).__name__}: {str(exc)[:160]}")
    raise RuntimeError("交易日历所有来源不可用；不估算交易日。" + " | ".join(errors))


def load_stock(code, start, through, fetch=get_json):
    if len(code) != 6 or not code.isdigit():
        raise ValueError("无效六位代码")
    market = "sh" if code.startswith("6") else "sz" if code.startswith(("0", "3")) else "bj" if code.startswith(("4", "8", "92")) else None
    if market is None:
        raise ValueError("不支持的股票市场")
    errors = []
    feeds = [("东方财富直连前复权", "手", lambda: em_bars(fetch(EM, em_params(("1." if market == "sh" else "0.") + code, start, through, True)), code, start, through))]
    if market != "bj":
        feeds.append(("腾讯备用前复权", "腾讯原始量（单位未核验；仅同源计算量比）", lambda: tx_bars(fetch(TX, tx_params(market + code, start, through)), market + code, start, through)))
    for source, unit, call in feeds:
        try:
            return call(), {"priceSource": source, "volumeUnit": unit, "sourceFailures": errors.copy()}
        except Exception as exc:
            errors.append(f"{source}: {type(exc).__name__}: {str(exc)[:160]}")
    raise RuntimeError(" | ".join(errors))
