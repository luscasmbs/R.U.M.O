import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from app.api.routes.dashboard import _date_filters, _forecast_probability, _trend


class DashboardHelperTests(unittest.TestCase):
    def test_probability_prefers_explicit_model_value(self):
        forecast = SimpleNamespace(
            explanation={"probability": 0.42},
            risk_score=91,
        )

        self.assertEqual(_forecast_probability(forecast), 0.42)

    def test_baseline_does_not_invent_probability(self):
        forecast = SimpleNamespace(
            explanation={"method": "moving_average_baseline"},
            risk_score=65,
        )

        self.assertIsNone(_forecast_probability(forecast))

    def test_reversed_period_is_rejected(self):
        from datetime import date

        with self.assertRaises(HTTPException) as context:
            _date_filters(date(2026, 2, 1), date(2026, 1, 1))

        self.assertEqual(context.exception.status_code, 400)

    def test_trend_compares_the_two_latest_periods(self):
        series = [
            {"period": "2026-01-01", "incidents": 10},
            {"period": "2026-01-08", "incidents": 15},
        ]

        self.assertEqual(_trend(series), 50.0)


if __name__ == "__main__":
    unittest.main()
