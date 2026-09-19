"""Pull yesterday's limit-up pool and publish a validated, timestamped snapshot."""

import json
import math
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import akshare as ak

now = datetime.now(ZoneInfo("Asia/Shanghai"))
if now.weekday() >= 5 or not (9 * 60 + 25 <= now.hour * 60 + now.minute <= 15 * 60 + 10):
    raise RuntimeError("当前不在 A 股交易时段；拒绝发布可能过期的数据")
date = now.strftime("%Y%m%d")
frame = ak.stock_zt_pool_previous_em(date=date)
required = {"代码", "名称", "涨跌幅", "最新价", "昨日连板数", "昨日封板时间", "所属行业"}
if frame.empty or not required.issubset(frame.columns):
    raise RuntimeError("昨日涨停池为空或字段变化；拒绝覆盖上一次行情快照")

stocks = []
for _, row in frame.iterrows():
    change = float(row["涨跌幅"])
    price = float(row["最新价"])
    if not math.isfinite(change) or not math.isfinite(price):
        raise RuntimeError("行情包含无效价格；拒绝发布")
    seal = str(row["昨日封板时间"]).split(".")[0].zfill(6)
    stocks.append({
        "code": str(row["代码"]).zfill(6),
        "name": str(row["名称"]),
        "changePct": round(change, 4),
        "lastPrice": round(price, 3),
        "yesterdayBoards": int(row["昨日连板数"]),
        "yesterdaySeal": f"{seal[:2]}:{seal[2:4]}:{seal[4:6]}",
        "sector": str(row["所属行业"]),
    })

if len(stocks) < 3 or len({item["code"] for item in stocks}) != len(stocks):
    raise RuntimeError("样本过少或代码重复；拒绝发布")

output = {
    "schemaVersion": 1,
    "tradeDate": now.strftime("%Y-%m-%d"),
    "observedAt": now.isoformat(timespec="seconds"),
    "source": "AKShare stock_zt_pool_previous_em / 东方财富",
    "stocks": stocks,
}
Path("/tmp/yesterday-premium.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Fetched {len(stocks)} stocks for {output['tradeDate']} at {output['observedAt']}")
