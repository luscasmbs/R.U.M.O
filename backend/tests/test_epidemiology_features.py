import unittest

import pandas as pd

from app.services.ml.features import add_horizon_target, prepare_daily_features


class EpidemiologyFeatureTests(unittest.TestCase):
    def test_daily_panel_fills_missing_days_with_zero(self):
        counts = pd.DataFrame(
            {
                "neighborhood_id": ["a", "a"],
                "day": ["2025-01-01", "2025-01-03"],
                "cases": [2, 1],
            }
        )

        result = prepare_daily_features(
            counts,
            pd.Timestamp("2025-01-01"),
            pd.Timestamp("2025-01-03"),
            warmup_days=0,
        )

        self.assertEqual(result["cases"].tolist(), [2.0, 0.0, 1.0])
        self.assertEqual(result["rolling_7d"].tolist(), [2.0, 2.0, 3.0])
        self.assertEqual(result["cases_lag_1"].tolist(), [0.0, 2.0, 0.0])

    def test_horizon_target_excludes_observation_day(self):
        frame = pd.DataFrame(
            {
                "neighborhood_id": ["a"] * 5,
                "cases": [1, 2, 3, 4, 5],
            }
        )

        result = add_horizon_target(frame, 2)

        self.assertEqual(result.loc[0, "target"], 5.0)
        self.assertEqual(result.loc[1, "target"], 7.0)
        self.assertTrue(pd.isna(result.loc[4, "target"]))

    def test_targets_do_not_mix_neighborhoods(self):
        frame = pd.DataFrame(
            {
                "neighborhood_id": ["a", "a", "b", "b"],
                "cases": [1, 2, 100, 200],
            }
        )

        result = add_horizon_target(frame, 1)

        self.assertEqual(result.loc[0, "target"], 2.0)
        self.assertTrue(pd.isna(result.loc[1, "target"]))
        self.assertEqual(result.loc[2, "target"], 200.0)

    def test_supported_horizons_use_the_expected_future_window(self):
        frame = pd.DataFrame(
            {
                "neighborhood_id": ["a"] * 30,
                "cases": list(range(1, 31)),
            }
        )

        for horizon in (1, 7, 28):
            with self.subTest(horizon=horizon):
                result = add_horizon_target(frame, horizon)
                self.assertEqual(result.loc[0, "target"], sum(range(2, horizon + 2)))
                self.assertEqual(result["target"].notna().sum(), 30 - horizon)

    def test_invalid_horizon_is_rejected(self):
        frame = pd.DataFrame({"neighborhood_id": ["a"], "cases": [1]})

        with self.assertRaisesRegex(ValueError, "at least 1"):
            add_horizon_target(frame, 0)


if __name__ == "__main__":
    unittest.main()
