"""Versioned daily research facts; all feature calculations use bars <= as_of.

C2 is a nomination, never a confirmation of sector leadership. Daily touch studies
are not minute entries and may not be described as executable strategy returns.
"""
from statistics import mean

RULE_VERSION = "2.0"


def age(day, through, sessions):
    if not day or day not in sessions or through not in sessions or day > through:
        return None
    return sum(day < d <= through for d in sessions)


def nomination(max_boards, rolling_limits):
    if max_boards >= 5 or rolling_limits >= 6:
        return "C2"
    if max_boards >= 3:
        return "C1"
    return "unclassified"


def archive_identity(code, days, sessions, through):
    scan = [d for d in sessions if d <= through][-45:]
    events = [(d, s["boards"]) for d in scan if d in days for s in days[d]["stocks"] if s["code"] == code]
    max_boards = max((b for _, b in events), default=0)
    # Maximum rolling 10-session count within the scan, not only today's 10 days.
    rolling = max((sum(d in scan[max(0, i - 9):i + 1] for d, _ in events) for i in range(len(scan))), default=0)
    missing = [d for d in scan if d not in days]
    return {"maxBoards": max_boards, "limitCount10": rolling, "lastBoard": events[-1][0] if events else None,
            "leaderClass": nomination(max_boards, rolling), "identityStatus": "待核板块地位与持续活跃",
            "missingIdentitySessions": missing}


def active_day(bars):
    last = None
    for i in range(20, len(bars)):
        row = bars[i]
        ceiling = max(b["high"] for b in bars[i - 20:i])
        baseline = mean(b["volume"] for b in bars[i - 5:i])
        if baseline > 0 and row["high"] > ceiling and row["close"] > bars[i - 1]["close"] and row["volume"] >= 1.5 * baseline:
            last = row["date"]
    return last


def research_facts(code, bars, days, sessions, through):
    bars = [b for b in bars if b["date"] <= through]
    identity = archive_identity(code, days, sessions, through)
    last_board = identity["lastBoard"]
    active = active_day(bars)
    board_age, active_age = age(last_board, through, sessions), age(active, through, sessions)
    kind = identity["leaderClass"]
    if identity["missingIdentitySessions"] or board_age is None:
        priority = "数据待核"
    elif board_age == 0:
        priority = "当日涨停预备池"
    elif kind == "C1":
        priority = "优先观察" if board_age <= 5 else "常规观察" if board_age <= 10 else "降级保留"
    elif kind == "C2":
        clock = min(board_age, active_age) if active_age is not None else board_age
        priority = "优先观察·资格待核" if clock <= 10 else "扩展观察·资格待核" if clock <= 20 else "降级保留"
    else:
        priority = "模型外保留"
    touches = []
    for period in (5, 10, 20, 30):
        count, first, previous, current = 0, None, False, False
        for i, b in enumerate(bars):
            if i < period - 1 or not last_board or b["date"] <= last_board:
                continue
            ma = mean(v["close"] for v in bars[i - period + 1:i + 1])
            current = b["low"] <= ma * 1.01 and b["high"] >= ma * .99
            if current and not previous:
                count += 1
                first = first or b["date"]
            previous = current
        touches.append({"period": period, "touchCount": count, "firstTouchDate": first, "touching": current,
                        "stage": "S1候选·首次强分歧待核" if period <= 10 else "S2候选·首次深调待核"})
    return {"ruleVersion": RULE_VERSION, **identity, "lastActive": active, "boardAge": board_age, "activeAge": active_age,
            "priority": priority, "touches": touches}
