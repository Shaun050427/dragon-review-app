"""Create a dated, source-labelled limit-up review from Eastmoney AKShare pools."""

import html
import json
import math
import os
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import akshare as ak

TZ = ZoneInfo("Asia/Shanghai")
OUT = Path(os.environ.get("REVIEW_OUTPUT_DIR", "/tmp/limit-review"))


def number(value):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("非有限行情数值")
    return result


def clock(value):
    raw = str(value).split(".")[0].replace(":", "").zfill(6)
    return f"{raw[:2]}:{raw[2:4]}:{raw[4:6]}" if re.fullmatch(r"\d{6}", raw) else "—"


def normalize_pool(frame, board=False):
    needed = {"代码", "名称", "所属行业"} | ({"连板数", "首次封板时间", "最后封板时间", "涨停统计", "成交额", "炸板次数"} if board else set())
    if frame.empty and not board and needed.issubset(frame.columns):
        return []
    if frame.empty or not needed.issubset(frame.columns):
        raise ValueError(f"股池为空或字段变化: {needed - set(frame.columns)}")
    result = []
    for _, row in frame.iterrows():
        code = str(row["代码"]).zfill(6)
        if not re.fullmatch(r"\d{6}", code):
            raise ValueError("股票代码格式错误")
        item = {"code": code, "name": str(row["名称"]), "industry": str(row["所属行业"])}
        if board:
            boards = int(number(row["连板数"]))
            if boards < 1:
                raise ValueError("连板数无效")
            item.update(boards=boards, firstSeal=clock(row["首次封板时间"]), lastSeal=clock(row["最后封板时间"]),
                        limitStats=str(row["涨停统计"]), turnover=number(row["成交额"]), openCount=int(number(row["炸板次数"])))
        result.append(item)
    if len({item["code"] for item in result}) != len(result):
        raise ValueError("股池代码重复")
    return result


def build(date, observed, ups, downs, broken, lhb=None):
    sectors = defaultdict(list)
    ladder = defaultdict(list)
    for stock in ups:
        sectors[stock["industry"]].append(stock["code"])
        ladder[str(stock["boards"])].append(stock["code"])
    lhb = lhb or []
    return {
        "schemaVersion": 1, "tradeDate": date, "observedAt": observed,
        "sources": {"pools": "东方财富涨停股池、跌停股池、炸板股池 / AKShare", "themes": "所属行业字段；不是概念题材统计", "lhb": "东方财富龙虎榜详情 / AKShare；仅榜单净买额，不归因自然人"},
        "counts": {"limitUp": len(ups), "limitDown": len(downs), "broken": len(broken), "firstBoard": len(ladder.get("1", []))},
        "ladder": dict(sorted(ladder.items(), key=lambda pair: -int(pair[0]))),
        "industries": [{"name": name, "count": len(codes), "codes": codes} for name, codes in sorted(sectors.items(), key=lambda item: (-len(item[1]), item[0]))],
        "stocks": ups, "down": downs, "broken": broken, "lhb": lhb,
    }


def render(data):
    e = lambda value: html.escape(str(value), quote=True)
    c = data["counts"]
    stocks = {stock["code"]: stock for stock in data["stocks"]}
    ladder = "".join(f'<section class="row"><h3>{e(level)}板 <small>{len(codes)}家</small></h3><p>{" · ".join(e(stocks[code]["name"] + " " + code) for code in codes)}</p></section>' for level, codes in data["ladder"].items())
    industry = "".join(f'<span>{e(item["name"])} <b>{item["count"]}</b></span>' for item in data["industries"])
    table = "".join(f'<tr><td>{e(s["name"])} <small>{e(s["code"])}</small></td><td>{s["boards"]}</td><td>{e(s["limitStats"])}</td><td>{e(s["firstSeal"])}</td><td>{e(s["lastSeal"])}</td><td>{s["openCount"]}</td><td>{s["turnover"] / 1e8:.2f}亿</td><td>{e(s["industry"])}</td></tr>' for s in sorted(data["stocks"], key=lambda s: (-s["boards"], s["firstSeal"], s["code"])))
    leaders = "".join(f'<tr><td>{e(s["name"])} {e(s["code"])}</td><td>{e(s["reason"])}</td><td>{s["netBuy"] / 1e8:.2f}亿</td></tr>' for s in data["lhb"])
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{e(data["tradeDate"])} 涨停复盘</title><style>
    *{{box-sizing:border-box}}body{{margin:0;background:#edf2f5;color:#13273a;font:16px/1.5 "Microsoft YaHei",sans-serif}}main{{width:1500px;min-height:950px;margin:auto;padding:46px 54px;background:#fff}}header{{display:flex;justify-content:space-between;align-items:end;border-bottom:4px solid #153f58;padding-bottom:18px}}h1{{margin:0;font-size:42px}}h2{{font-size:23px;margin:26px 0 12px}}h3{{margin:0;color:#c54636}}small,.note{{color:#65788b}}.meta{{text-align:right}}.stats{{display:flex;gap:14px;margin-top:25px}}.stats div{{flex:1;background:#eaf4f8;padding:17px;border-radius:10px}}.stats b{{display:block;font-size:32px;color:#bd4536}}.row{{display:flex;gap:24px;padding:10px 4px;border-bottom:1px solid #dce5e9}}.row h3{{min-width:110px}}.row p{{margin:0}}.row small{{font-size:13px}}.industries{{display:flex;flex-wrap:wrap;gap:9px}}.industries span{{background:#edf4f8;padding:7px 13px;border-radius:7px}}.industries b{{color:#ba4b38}}table{{width:100%;border-collapse:collapse;font-size:13px}}td,th{{padding:6px;border-bottom:1px solid #dde5ea;text-align:left}}thead{{background:#eef4f8}}.note{{font-size:13px;margin-top:28px}}@media(max-width:1500px){{main{{width:100%}}}}
    </style></head><body><main><header><div><small>龙空龙 · 每日行情事实</small><h1>涨停复盘图</h1></div><div class="meta">{e(data["tradeDate"])}<br><small>采集 {e(data["observedAt"])}</small></div></header>
    <div class="stats"><div>涨停<b>{c["limitUp"]}</b></div><div>首板<b>{c["firstBoard"]}</b></div><div>跌停<b>{c["limitDown"]}</b></div><div>炸板<b>{c["broken"]}</b></div></div>
    <h2>连板梯队</h2>{ladder or '<p>暂无连板数据</p>'}<h2>行业分布</h2><div class="industries">{industry}</div>
    <h2>涨停明细</h2><table><thead><tr><th>股票</th><th>连板</th><th>涨停统计</th><th>首次封板</th><th>最后封板</th><th>炸板次数</th><th>成交额</th><th>所属行业</th></tr></thead><tbody>{table}</tbody></table>
    <h2>龙虎榜（已披露股票）</h2>{'<table><thead><tr><th>股票</th><th>上榜原因</th><th>榜单净买额</th></tr></thead><tbody>' + leaders + '</tbody></table>' if leaders else '<p>采集时暂无可用榜单；席位归因需要另行核实。</p>'}
    <p class="note">数据：东方财富，经 AKShare 采集。行业不等于题材；涨停统计为数据源口径，不代表连续交易日。龙虎榜通常晚于收盘披露，截图以采集时间为准。个人判断与次日候选保存在私人复盘仓库。</p></main></body></html>'''


def main():
    now = datetime.now(TZ)
    if now.weekday() >= 5 or now.hour < 15:
        raise RuntimeError("仅在交易日收盘后采集；空池不覆盖旧快照")
    date = now.strftime("%Y%m%d")
    ups = normalize_pool(ak.stock_zt_pool_em(date=date), board=True)
    downs = normalize_pool(ak.stock_zt_pool_dtgc_em(date=date))
    broken = normalize_pool(ak.stock_zt_pool_zbgc_em(date=date))
    lhb = []
    try:
        frame = ak.stock_lhb_detail_em(start_date=date, end_date=date)
        if {"代码", "名称", "上榜原因", "龙虎榜净买额"}.issubset(frame.columns):
            seen = set()
            for _, row in frame.iterrows():
                code = str(row["代码"]).zfill(6)
                if code in seen or code not in {item["code"] for item in ups}:
                    continue
                seen.add(code)
                lhb.append({"code": code, "name": str(row["名称"]), "reason": str(row["上榜原因"]), "netBuy": number(row["龙虎榜净买额"])})
    except Exception as exc:
        print(f"龙虎榜暂不可用：{exc}")
    data = build(now.strftime("%Y-%m-%d"), now.isoformat(timespec="seconds"), ups, downs, broken, lhb)
    OUT.mkdir(parents=True, exist_ok=True)
    stem = data["tradeDate"]
    (OUT / f"{stem}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / f"{stem}.html").write_text(render(data), encoding="utf-8")
    print(f"生成 {stem}：{len(ups)} 涨停 / {len(downs)} 跌停 / {len(broken)} 炸板")


if __name__ == "__main__":
    main()
