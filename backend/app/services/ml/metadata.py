from __future__ import annotations

from datetime import date


def with_current_freshness(explanation: dict | None, today: date | None = None) -> dict:
    """Return forecast metadata with freshness recalculated for the current day."""
    enriched = dict(explanation or {})
    data_end = (enriched.get("training_history") or {}).get("data_end")
    if not data_end:
        return enriched

    try:
        last_observation = date.fromisoformat(str(data_end)[:10])
    except ValueError:
        return enriched

    reference_day = today or date.today()
    enriched["data_freshness_days"] = max(0, (reference_day - last_observation).days)
    return enriched
