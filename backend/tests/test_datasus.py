import unittest

from app.services.connectors.datasus import SAMPLE_LIMIT, summarize_notifications


class DatasusSummaryTests(unittest.TestCase):
    def test_marks_limited_sample_and_keeps_latest_date(self):
        records = [
            {"dt_notific": "2026-01-10", "id_mn_resi": "261160"},
            {"dt_notific": "2026-07-17", "id_mn_resi": "230440"},
        ] * (SAMPLE_LIMIT // 2)

        result = summarize_notifications(records, "dengue")

        self.assertEqual(result["records_sampled"], SAMPLE_LIMIT)
        self.assertTrue(result["sample_limit_reached"])
        self.assertEqual(result["latest_notification_date"], "2026-07-17")
        self.assertEqual(result["recife_resident_records_sampled"], SAMPLE_LIMIT // 2)
