"""Publish daily facts before the slower radar; never regress latest pointers."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path
from datetime import date


def copy_file(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def forward_file(source, target, key):
    incoming = json.loads(source.read_text())
    previous = json.loads(target.read_text()).get(key, "") if target.exists() else ""
    if incoming[key] >= previous:
        copy_file(source, target)


def publish_files(root, daily, radar, day, phase):
    date.fromisoformat(day)
    relative = Path(day[:4]) / day[5:7] / f"{day}.json"
    if phase == "daily":
        raw = json.loads((daily / f"{day}.json").read_text())
        if raw.get("tradeDate") != day or raw.get("schemaVersion") != 1 or not raw.get("stocks"):
            raise ValueError("拒绝发布日期错配或空股池")
        for suffix in ["json", "html"]:
            copy_file(daily / f"{day}.{suffix}", root / "daily" / relative.with_suffix("." + suffix))
        forward_file(daily / f"{day}.json", root / "latest-limit-review.json", "tradeDate")
        forward_file(daily / "session-calendar.json", root / "session-calendar.json", "coveredThrough")
    else:
        if (daily / f"{day}.png").exists():
            copy_file(daily / f"{day}.png", root / "daily" / relative.with_suffix(".png"))
        snapshot = radar / "radar" / relative
        if not snapshot.exists():
            raise ValueError("日线雷达尚未生成；已发布的涨停候选保留")
        raw = json.loads(snapshot.read_text())
        if raw.get("tradeDate") != day or (raw.get("stocks") and not any(not s.get("error") and s.get("dataDate") == day for s in raw["stocks"])):
            raise ValueError("日线雷达无有效当日行情；拒绝覆盖")
        copy_file(snapshot, root / "radar" / relative)
        forward_file(radar / "trading-calendar.json", root / "trading-calendar.json", "coveredThrough")
        research = radar / "research" / relative
        if research.exists():
            copy_file(research, root / "research" / relative)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=["daily", "radar"], required=True)
    parser.add_argument("--trade-date", required=True)
    parser.add_argument("--root", type=Path, default=Path("/tmp/dragon-market-data"))
    args = parser.parse_args()
    publish_files(args.root, Path("/tmp/limit-review"), Path("/tmp/low-absorption"), args.trade_date, args.phase)
    def git(*parts):
        return subprocess.run(["git", "-C", str(args.root), *parts], check=True)
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    git("add", "daily", "latest-limit-review.json", "session-calendar.json")
    for path in ["radar", "research", "trading-calendar.json"]:
        if (args.root / path).exists():
            git("add", path)
    if subprocess.run(["git", "-C", str(args.root), "diff", "--cached", "--quiet"]).returncode:
        git("commit", "-m", f"market: {args.phase} {args.trade_date}")
        git("push", "origin", "HEAD:market-data")
