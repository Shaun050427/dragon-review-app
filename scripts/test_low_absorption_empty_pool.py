import unittest
from copy import deepcopy
from build_limit_review import auxiliary_pool, normalize_pool, build, render


class Frame:
    empty = True
    columns = set()


class EmptyPoolTest(unittest.TestCase):
    def setUp(self):
        self.payload = {"rc": 0, "data": {"qdate": 20261105, "tc": 0, "pool": []}}

    def test_explicit_dated_zero_is_accepted_and_auditable(self):
        calls = []
        def fetch(url, params):
            calls.append((url, params))
            return self.payload
        rows, check = auxiliary_pool(Frame(), "20261105", "down", fetch)
        self.assertEqual(rows, [])
        self.assertEqual(check["status"], "verified_empty")
        self.assertEqual(check["responseDate"], "20261105")
        self.assertEqual(calls[0][1]["date"], "20261105")
        self.assertTrue(calls[0][0].endswith("getTopicDTPool"))
        data = build("2026-11-05", "2026-11-05T17:00:00+08:00", [], rows, [], pool_checks={"down": check})
        self.assertEqual(data["counts"]["limitDown"], 0)
        self.assertEqual(data["poolChecks"]["down"], check)
        self.assertIn("跌停<b>0</b>", render(data))

    def test_unknown_malformed_stale_and_nonempty_are_not_zero(self):
        invalid = [None, {}, {"rc": 0, "data": None}, {"rc": 1, "data": self.payload["data"]}]
        for patch in [{"qdate": 20261104}, {"qdate": None}, {"tc": 1}, {"tc": None}, {"tc": False}, {"pool": None}, {"pool": [{"c": "000001"}]}]:
            value = deepcopy(self.payload)
            value["data"].update(patch)
            invalid.append(value)
        for payload in invalid:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                auxiliary_pool(Frame(), "20261105", "down", lambda *args: payload)
        with self.assertRaises(ValueError):
            normalize_pool(Frame())

    def test_broken_uses_its_own_endpoint(self):
        def fetch(url, params):
            self.assertTrue(url.endswith("getTopicZBPool"))
            self.assertEqual(params["sort"], "fbt:asc")
            return self.payload
        self.assertEqual(auxiliary_pool(Frame(), "20261105", "broken", fetch)[0], [])

    def test_nonempty_still_requires_normal_fields_and_does_not_call_fallback(self):
        class Populated:
            empty = False
            columns = {"代码", "名称", "所属行业"}
            def iterrows(self):
                return iter([(0, {"代码": "000001", "名称": "fixture", "所属行业": "fixture"})])
        def no_fetch(*args):
            raise AssertionError("nonempty pool must not be replaced")
        rows, check = auxiliary_pool(Populated(), "20261105", "down", no_fetch)
        self.assertEqual(rows[0]["code"], "000001")
        self.assertEqual(check["status"], "normalized")
        bad = Populated()
        bad.columns = {"代码"}
        with self.assertRaises(ValueError):
            auxiliary_pool(bad, "20261105", "down", no_fetch)
