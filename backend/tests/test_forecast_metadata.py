import unittest
from datetime import date

from app.services.ml.metadata import with_current_freshness


class ForecastMetadataTests(unittest.TestCase):
    def test_freshness_is_recalculated_for_the_response_day(self):
        explanation = {"training_history": {"data_end": "2025-12-29"}}

        result = with_current_freshness(explanation, today=date(2026, 1, 8))

        self.assertEqual(result["data_freshness_days"], 10)
        self.assertNotIn("data_freshness_days", explanation)

    def test_missing_history_is_kept_without_inventing_freshness(self):
        explanation = {"method": "moving_average_baseline"}

        result = with_current_freshness(explanation, today=date(2026, 1, 8))

        self.assertEqual(result, explanation)


if __name__ == "__main__":
    unittest.main()
