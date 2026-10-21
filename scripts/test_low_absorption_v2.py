import copy
import unittest
from datetime import date, timedelta
from backtest_low_absorption import study, summarize
from low_absorption_research import archive_identity, research_facts, nomination


class ResearchTest(unittest.TestCase):
    def setUp(self):
        # Synthetic sessions; intentionally not a real-world holiday calendar.
        self.sessions = [(date(2026, 1, 1) + timedelta(days=i)).isoformat() for i in range(70)]
        self.bars = [{"date": d, "open": 12., "high": 12.2, "low": 11.8, "close": 12., "volume": 100.} for d in self.sessions]
        self.days = {d: {"stocks": [], "down": []} for d in self.sessions}
        self.stock = {"code": "000001", "name": "synthetic", "boards": 4}
        self.days[self.sessions[48]]["stocks"] = [self.stock]
        # Above all MAs initially, then a separate touch episode on day 51.
        for i in (49, 50):
            self.bars[i].update(open=13., high=13.2, low=12.9, close=13.)
        self.bars[51].update(open=12.1, high=12.3, low=11.5, close=12.0)
        self.snapshot = {"tradeDate": self.sessions[-1], "source": "synthetic-only", "calendar": {"sessions": self.sessions}, "stocks": [{"code": "000001", "bars": self.bars}]}

    def test_identity_and_rolling_count(self):
        self.assertEqual(nomination(4, 5), "C1")
        self.assertEqual(nomination(5, 0), "C2")
        self.assertEqual(nomination(1, 6), "C2")
        for i in (40, 41, 43, 45, 47, 48):
            self.days[self.sessions[i]]["stocks"] = [{**self.stock, "boards": 1}]
        identity = archive_identity("000001", self.days, self.sessions, self.sessions[-1])
        self.assertEqual(identity["limitCount10"], 6)  # Must not decay when today's rolling10 is empty.
        self.assertEqual(identity["leaderClass"], "C2")

    def test_two_clocks_and_no_future_features(self):
        self.bars[55].update(open=13., high=14., low=12.9, close=13.8, volume=200.)
        asof = self.sessions[56]
        a = research_facts("000001", self.bars, self.days, self.sessions, asof)
        self.assertEqual(a["boardAge"], 8)
        self.assertEqual(a["activeAge"], 1)
        mutated = copy.deepcopy(self.bars)
        mutated[60].update(high=1000., close=999., volume=100000.)
        self.days[self.sessions[60]]["stocks"] = [{**self.stock, "boards": 20}]
        self.assertEqual(a, research_facts("000001", mutated, self.days, self.sessions, asof))

    def test_touch_episodes_not_each_bar(self):
        first = research_facts("000001", self.bars, self.days, self.sessions, self.sessions[52])
        self.assertEqual(first["touches"][1]["touchCount"], 1)
        for i in (53, 54):
            self.bars[i].update(open=14., high=14.2, low=13.9, close=14.)
        self.bars[55].update(open=12., high=13., low=11., close=12.)
        repeated = research_facts("000001", self.bars, self.days, self.sessions, self.sessions[55])
        self.assertEqual(repeated["touches"][1]["touchCount"], 2)

    def test_missing_archives_unknown_not_confident(self):
        del self.days[self.sessions[45]]
        facts = research_facts("000001", self.bars, self.days, self.sessions, self.sessions[55])
        self.assertEqual(facts["priority"], "数据待核")
        report = study(self.snapshot, self.days)
        self.assertTrue(any(r["status"] == "归档或日线缺口" for r in report["rows"]))
        self.assertEqual(report["descriptive"]["completed"], 0)

    def test_T1_fills_separated_and_losers_retained(self):
        self.bars[52].update(open=12., high=12.2, low=11.5, close=11.6)
        self.bars[53].update(open=11., high=11.2, low=10.5, close=10.8)
        report = study(self.snapshot, self.days)
        row = next(r for r in report["rows"] if r["signalDate"] == self.sessions[51] and r["period"] == 10)
        self.assertEqual(row["entryDate"], self.sessions[52])
        self.assertEqual(row["exitDate"], self.sessions[53])
        self.assertAlmostEqual(row["forwardReturnPct"], -10.2)
        self.assertAlmostEqual(row["maePct"], -12.5)
        self.assertIsNone(row["netReturnPct"])
        self.assertEqual(report["executable"]["completed"], 0)
        self.assertIsNone(report["descriptive"]["expectedR"])
        self.bars[52]["verifiedOpenFill"] = {"price": 12., "source": "fixture quote", "available": True}
        self.bars[53]["verifiedCloseFill"] = {"price": 10.8, "source": "fixture quote", "available": True}
        verified = study(self.snapshot, self.days)
        row = next(r for r in verified["rows"] if r["signalDate"] == self.sessions[51] and r["period"] == 10)
        self.assertAlmostEqual(row["netReturnPct"], -10.2)
        self.assertLess(row["realizedR"], 0)
        self.assertEqual(verified["descriptive"]["samples"], report["descriptive"]["samples"])

    def test_unseasoned_missing_stock_and_executable_refusal(self):
        snapshot = copy.deepcopy(self.snapshot)
        snapshot["tradeDate"] = self.sessions[52]
        snapshot["calendar"]["sessions"] = self.sessions[:53]
        snapshot["stocks"].append({"code": "000002", "error": "suspended"})
        report = study(snapshot, self.days)
        self.assertTrue(any(r["status"] == "未成熟" for r in report["rows"]))
        self.assertEqual(report["missingStocks"][0]["code"], "000002")
        # A one-word flag or wrong price is not fill evidence.
        self.bars[52]["verifiedOpenFill"] = True
        self.bars[53]["verifiedCloseFill"] = {"price": 1., "source": "fixture", "available": True}
        self.assertEqual(study(self.snapshot, self.days)["executable"]["completed"], 0)

    def test_stock_clusters_and_no_fake_payoff(self):
        self.assertIsNone(summarize([])["payoffRatio"])
        report = study(self.snapshot, self.days)
        self.assertEqual(report["descriptive"]["stockClusters"], 1)
        self.assertGreater(report["descriptive"]["samples"], 1)  # Multiple MAs are not independent stocks.
        self.assertIsNone(report["descriptive"]["payoffRatio"])  # All returns have same sign.
        with self.assertRaises(ValueError):
            study(self.snapshot, self.days, float("inf"))


if __name__ == "__main__":
    unittest.main()
