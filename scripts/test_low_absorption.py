import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from build_low_absorption import candidates, load_archives, metrics, normalize_bars


class Frame:
    def __init__(self, rows):
        self.rows = rows
        self.empty = not rows
        self.columns = set(rows[0]) if rows else set()
    def to_dict(self, _):
        return self.rows


class RadarTest(unittest.TestCase):
    def setUp(self):
        # Synthetic consecutive completed sessions, never a claim about real prices.
        self.bars = [{"date": (date(2026, 8, 1) + timedelta(days=i)).isoformat(), "open": 10., "close": 10., "high": 10.2, "low": 9.8, "volume": 100., "turnoverRate": 5.} for i in range(40)]
        self.through = self.bars[-1]["date"]
        self.last_board = self.bars[-4]["date"]

    def test_volume_baseline_and_first_touch(self):
        self.bars[-1]["volume"] = 200.
        out = metrics("000001", self.bars, self.last_board, self.through, {self.through: {"000001"}})
        self.assertEqual(out["volumeRatio"], 2.)  # Excludes current day's volume.
        self.assertEqual(out["averages"][-1]["value"], 10.)
        self.assertEqual(out["averages"][-1]["firstTouchDate"], self.bars[-3]["date"])
        self.assertTrue(out["recent"][-1]["limitDown"])
        self.assertEqual(out["recent"][-1]["turnoverRate"], 5.)

    def test_stale_or_missing_last_board_rejected(self):
        with self.assertRaises(ValueError):
            metrics("000001", self.bars[:-1], self.last_board, self.through, {})
        with self.assertRaises(ValueError):
            metrics("000001", self.bars, "2025-01-01", self.through, {})

    def test_short_history_no_invented_ma30(self):
        out = metrics("000001", self.bars[-10:], self.last_board, self.through, {})
        self.assertIsNone(out["averages"][-1]["value"])
        self.assertIsNone(out["averages"][-1]["firstTouchDate"])

    def test_normalization_filters_future_rejects_nan_duplicates(self):
        row = {"日期": self.through, "开盘": 10., "收盘": 10., "最高": 11., "最低": 9., "成交量": 200., "换手率": 5.}
        out = normalize_bars(Frame([row, {**row, "日期": "2027-01-01"}]), self.through)
        self.assertEqual(len(out), 1)
        for rows in [[row, row], [{**row, "成交量": float("nan")}], [{**row, "最高": 8.}]]:
            with self.assertRaises(ValueError):
                normalize_bars(Frame(rows), self.through)

    def test_missing_archive_does_not_shorten_memory(self):
        sessions = [r["date"] for r in self.bars]
        old, recent = sessions[-17], sessions[-4]
        stock = {"code": "000001", "name": "fixture", "boards": 4}
        self.assertEqual(len(candidates({old: {"stocks": [stock]}}, sessions)), 1)  # Expired failures remain in research universe.
        self.assertEqual(len(candidates({recent: {"stocks": [stock]}}, sessions)), 1)

    def test_today_archive_and_corruption(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            today = {"schemaVersion": 1, "tradeDate": self.through, "stocks": [], "down": []}
            self.assertIn(self.through, load_archives(root, [self.through], today))
            previous = self.bars[-2]["date"]
            path = root / "daily" / previous[:4] / previous[5:7] / f"{previous}.json"
            path.parent.mkdir(parents=True)
            path.write_text(json.dumps({**today, "tradeDate": previous, "stocks": [{"code": "000001", "name": "bad", "boards": "4"}]}))
            self.assertNotIn(previous, load_archives(root, [previous], today))


if __name__ == "__main__":
    unittest.main()
