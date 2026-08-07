import unittest

from app.services.connectors.open_meteo import normalize_weather_forecast


class OpenMeteoNormalizationTests(unittest.TestCase):
    def test_normalizes_current_and_next_24_hours(self):
        times = [f"2026-08-07T{hour:02d}:00" for hour in range(24)]
        payload = {
            "timezone": "America/Sao_Paulo",
            "current": {
                "time": "2026-08-07T00:00",
                "temperature_2m": 27.4,
                "relative_humidity_2m": 79,
                "precipitation": 0.2,
                "weather_code": 61,
                "wind_speed_10m": 12.5,
            },
            "hourly": {
                "time": times,
                "precipitation": [0.5] * 24,
                "precipitation_probability": [30] * 23 + [80],
            },
            "daily": {
                "time": ["2026-08-07"],
                "precipitation_sum": [12.0],
                "precipitation_probability_max": [80],
                "temperature_2m_min": [23.0],
                "temperature_2m_max": [29.0],
            },
        }

        result = normalize_weather_forecast(payload)

        self.assertEqual(result["current"]["condition"], "Chuva leve")
        self.assertEqual(
            result["next_24h"],
            {"precipitation_mm": 12.0, "precipitation_probability_pct": 80},
        )
        self.assertEqual(result["daily"][0]["temperature_max_c"], 29.0)
