"""Choose the latest completed exchange session, including delayed cron runs."""
import os
from datetime import date, datetime
from zoneinfo import ZoneInfo


def resolve_date(sessions, now, requested=""):
    now = now.astimezone(ZoneInfo("Asia/Shanghai"))
    days = sorted(set(str(d)[:10] for d in sessions))
    if requested:
        target = date.fromisoformat(requested).isoformat()
        if target not in days:
            raise ValueError("指定日期不在交易日历中")
        if target > now.date().isoformat() or target == now.date().isoformat() and now.hour < 15:
            raise ValueError("指定交易日尚未收盘")
        return target
    completed = [d for d in days if d < now.date().isoformat() or d == now.date().isoformat() and now.hour >= 15]
    if not completed:
        raise ValueError("没有已收盘交易日；不猜测日期")
    target = completed[-1]
    if (now.date() - date.fromisoformat(target)).days > 15:
        raise ValueError("交易日历过期；不静默回退旧日期")
    return target


if __name__ == "__main__":
    import akshare as ak
    calendar = ak.tool_trade_date_hist_sina()
    target = resolve_date(calendar["trade_date"], datetime.now(ZoneInfo("Asia/Shanghai")), os.environ.get("REQUESTED_DATE", ""))
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write(f"date={target}\n")
    print(f"采集已收盘交易日：{target}")
