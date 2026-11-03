import unittest
import json
import tempfile
import textwrap
from datetime import datetime
from pathlib import Path
from resolve_market_date import resolve_date
from publish_market_archive import publish_files


class ScheduleTest(unittest.TestCase):
    def test_delayed_cron_and_weekend_resolve_completed_session(self):
        sessions = ["2026-10-30", "2026-11-02", "2026-11-03"]
        for clock, expected in [("2026-11-03T02:14:00+08:00", "2026-11-02"), ("2026-11-03T14:59:00+08:00", "2026-11-02"), ("2026-11-03T15:00:00+08:00", "2026-11-03"), ("2026-11-01T18:00:00+08:00", "2026-10-30")]:
            self.assertEqual(resolve_date(sessions, datetime.fromisoformat(clock)), expected)

    def test_explicit_date_requires_completed_exchange_day(self):
        now = datetime.fromisoformat("2026-11-03T02:14:00+08:00")
        sessions = ["2026-10-30", "2026-11-02", "2026-11-03"]
        self.assertEqual(resolve_date(sessions, now, "2026-11-02"), "2026-11-02")
        for day in ["2026-11-03", "2026-11-01", "2026-11-04"]:
            with self.assertRaises(ValueError):
                resolve_date(sessions, now, day)
        with self.assertRaises(ValueError):
            resolve_date(["2026-10-01"], now)

    def test_health_check_uses_real_archive_filename(self):
        workflow = (Path(__file__).parents[1] / ".github/workflows/limit-review.yml").read_text()
        script = workflow.split("python - <<'PYHEALTH'\n")[1].split("          PYHEALTH")[0]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for kind, payload in [("radar", {"stocks": [{"code": "000001"}]}), ("research", {"rows": []})]:
                path = root / kind / "2026/11/2026-11-02.json"
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps(payload))
            script = textwrap.dedent(script).replace("${{ steps.trade_date.outputs.date }}", "2026-11-02").replace("/tmp/low-absorption", directory)
            exec(compile(script, "workflow-health", "exec"), {})
            path = root / "radar/2026/11/2026-11-02.json"
            path.write_text(json.dumps({"stocks": [{"error": "stale"}]}))
            with self.assertRaises(SystemExit):
                exec(compile(script, "workflow-health", "exec"), {})

    def test_daily_facts_publish_before_radar_without_regressing_pointers(self):
        with tempfile.TemporaryDirectory() as directory:
            root, daily, radar = [Path(directory) / name for name in ["repo", "daily", "radar"]]
            for p in [root, daily, radar]:
                p.mkdir()
            (daily / "2026-11-03.json").write_text(json.dumps({"schemaVersion": 1, "tradeDate": "2026-11-03", "stocks": [{"code": "000001"}]}))
            (daily / "2026-11-03.html").write_text("fixture")
            (daily / "session-calendar.json").write_text(json.dumps({"coveredThrough": "2026-12-31"}))
            publish_files(root, daily, radar, "2026-11-03", "daily")
            self.assertTrue((root / "daily/2026/11/2026-11-03.json").exists())
            self.assertFalse((root / "radar").exists())
            self.assertEqual(json.loads((root / "latest-limit-review.json").read_text())["tradeDate"], "2026-11-03")
            with self.assertRaises(ValueError):
                publish_files(root, daily, radar, "2026-11-03", "radar")
            self.assertTrue((root / "daily/2026/11/2026-11-03.json").exists())
            (root / "latest-limit-review.json").write_text(json.dumps({"tradeDate": "2026-11-04"}))
            publish_files(root, daily, radar, "2026-11-03", "daily")
            self.assertEqual(json.loads((root / "latest-limit-review.json").read_text())["tradeDate"], "2026-11-04")
            (daily / "2026-11-03.json").write_text(json.dumps({"schemaVersion": 1, "tradeDate": "2026-11-02", "stocks": [{"code": "000001"}]}))
            with self.assertRaises(ValueError):
                publish_files(root, daily, radar, "2026-11-03", "daily")
