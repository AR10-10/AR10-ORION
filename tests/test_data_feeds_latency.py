from __future__ import annotations

from data_ingestion.pipeline_orchestrator import public_feed_snapshot, synchronize_timestamps


def test_public_feeds_are_prepared_without_network() -> None:
    snapshot = public_feed_snapshot()
    synced = synchronize_timestamps(snapshot)
    assert synced["count"] == len(snapshot)
    assert all(item["mode"] == "READ_ONLY" for item in snapshot)
