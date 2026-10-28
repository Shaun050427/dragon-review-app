import unittest
from datetime import date, timedelta
from urllib.error import URLError
from market_history import EM, TX, em_bars, load_sessions, load_stock, tx_bars, validate_bars


class HistoryTest(unittest.TestCase):
    def setUp(self):
        self.sessions = [(date(2026, 7, 1) + timedelta(days=i)).isoformat() for i in range(70)]
        self.start, self.through = self.sessions[0], self.sessions[-1]
        self.values = [[d, '10', '10.2', '10.5', '9.8', '123', {}, '50', '99'] for d in self.sessions]

    def tx(self, symbol='sh000001', adjusted=False):
        return {'code': 0, 'data': {symbol: {'qfqday' if adjusted else 'day': self.values}}}

    def test_calendar_fallback_bypasses_symbol_list_and_uses_real_dates(self):
        calls = []
        def fetch(url, params):
            calls.append((url, params))
            if url == EM:
                self.assertEqual(params['secid'], '1.000001')
                raise URLError('primary unavailable')
            self.assertEqual(url, TX)
            self.assertTrue(params['param'].startswith('sh000001,day,'))
            self.assertIn(',,640,qfq', params['param'])
            return self.tx()
        sessions, source = load_sessions(self.start, self.through, fetch)
        self.assertEqual(sessions, self.sessions)
        self.assertIn('腾讯', source)
        self.assertEqual(len(calls), 2)

    def test_stale_calendar_and_short_history_rejected(self):
        self.values = self.values[:-1]
        with self.assertRaises(RuntimeError):
            load_sessions(self.start, self.through, lambda url, params: self.tx())
        self.values = self.values[-10:]
        with self.assertRaises(RuntimeError):
            load_sessions(self.start, self.sessions[-2], lambda url, params: self.tx())

    def test_stock_fallback_keeps_whole_qfq_series_and_unknown_units(self):
        def fetch(url, params):
            if url == EM:
                self.assertEqual(params['secid'], '0.000823')
                self.assertEqual(params['fqt'], '1')
                raise URLError('primary down')
            return self.tx('sz000823', adjusted=True)
        bars, facts = load_stock('000823', self.start, self.through, fetch)
        self.assertEqual(len(bars), 70)
        self.assertEqual(bars[-1]['volume'], 123)
        self.assertIsNone(bars[-1]['turnoverRate'])  # Do not guess raw field 7's unit.
        self.assertIn('未核验', facts['volumeUnit'])
        self.assertEqual(len(facts['sourceFailures']), 1)

    def test_raw_stock_data_cannot_masquerade_as_qfq(self):
        with self.assertRaises(ValueError):
            tx_bars(self.tx('sz000823'), 'sz000823', self.start, self.through)
        with self.assertRaises(RuntimeError):
            load_stock('000823', self.start, self.through, lambda url, params: self.tx('sz000823'))

    def test_primary_em_fields_and_units(self):
        lines = [','.join([d, '10', '10.2', '10.5', '9.8', '123', '125000', '7', '2', '.2', '1.68']) for d in self.sessions]
        payload = {'data': {'code': '000823', 'klines': lines}}
        bars, facts = load_stock('000823', self.start, self.through, lambda url, params: payload)
        self.assertEqual(bars[-1]['turnoverRate'], 1.68)
        self.assertEqual(facts['volumeUnit'], '手')
        with self.assertRaises(ValueError):
            em_bars(payload, '600000', self.start, self.through)

    def test_future_duplicate_invalid_prices_and_stale_stock(self):
        values = self.values + [['2027-01-01', '100', '101', '102', '99', '10']]
        payload = {'code': 0, 'data': {'sz000823': {'qfqday': values}}}
        bars = tx_bars(payload, 'sz000823', self.start, self.through)
        self.assertEqual(len(bars), 70)
        for patch in [{'close': float('nan')}, {'high': 9}, {'volume': -1}]:
            with self.assertRaises(ValueError):
                validate_bars([{**bars[-1], **patch}], self.start, self.through)
        with self.assertRaises(ValueError):
            validate_bars([bars[-1], bars[-1]], self.start, self.through)
        with self.assertRaises(ValueError):
            validate_bars(bars[:-1], self.start, self.through)


if __name__ == '__main__':
    unittest.main()
