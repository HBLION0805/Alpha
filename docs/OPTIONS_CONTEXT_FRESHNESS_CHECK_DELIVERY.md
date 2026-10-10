# Context freshness correction

Focused news now retains publication-after-original-receipt anomalies even when
assessment time advances. A later actual receipt may qualify the later view.
The existing 72-hour publication window, source registry and trading rules stay
unchanged. Three regression cases cover the anomaly, later receipt and boundary.

A separate isolated one-shot check exercised the existing 15 public reads without
retry. Retrieval succeeded; one malformed BEA item was rejected. Old OFAC content
remained stale, BEA/EIA publication times remained unknown, and daily/weekly macro
observations stayed distinct from intraday data. Calendars are schedules, and
nowcasts are model estimates with unresolved publication precision.

The check does not establish a global collection outage or continuous background
operation. No production store, schedule, ledger or strategy was changed. Raw
feeds, local workspace inventory, source timestamps and Host records stay private
in ignored runtime storage. See [validation](status/context-freshness-check.json).
