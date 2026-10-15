#!/usr/bin/env bash
# Scheduled entry point: poll feeds → emit new alerts → refresh digest.
# Usage: scripts/run.sh [--digest-only|--no-digest]
# Premarket: 7:30 ET cron entry → data/out/premarket-latest.md (src/cli/premarket.ts)
# Volume: 7:00–9:29 (prior session, feeds premarket) and 16:15–16:59 ET → data/out/volume-latest.md (src/cli/volume.ts)
# Env: ALPHA_VOLUME=1 forces volume; ALPHA_PREMARKET=1 forces it; ALPHA_NODE_BIN (dir with node 24), ALPHA_DB, ALPHA_ALERT_THRESHOLD, ALPACA_KEY/ALPACA_SECRET (optional)
set -uo pipefail
cd "$(dirname "$0")/.."
[ -n "${ALPHA_NODE_BIN:-}" ] && export PATH="$ALPHA_NODE_BIN:$PATH"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' || { echo "Node 24+ required (set ALPHA_NODE_BIN)" >&2; exit 2; }
mkdir -p data/out data/logs
exec 9>data/.run.lock
flock -n 9 || { echo "[run] previous run still active; skipping" >&2; exit 0; }
log="data/logs/run-$(date +%Y%m%d).log"
{
  echo "=== $(date '+%F %T %Z') ==="
  if [ "${1:-}" != "--digest-only" ]; then
    node src/cli/poll.ts | tail -1
    # 7:30 ET premarket routine (runs on any invocation between 07:00 and 09:29 ET, or with ALPHA_PREMARKET=1); alarms go to the alert step below
    hm=$(TZ=America/New_York date +%H%M)
    if [ "${ALPHA_PREMARKET:-}" = "1" ] || { [ "$hm" -ge 0700 ] && [ "$hm" -lt 0930 ]; }; then
      node src/cli/volume.ts --out data/out/volume-latest.md >/dev/null || echo "[run] volume failed"
      node src/cli/premarket.ts --out data/out/premarket-latest.md >/dev/null || echo "[run] premarket failed"
    fi
    # 16:30 ET post-close run: today's volume anomalies (or ALPHA_VOLUME=1)
    if [ "${ALPHA_VOLUME:-}" = "1" ] || { [ "$hm" -ge 1615 ] && [ "$hm" -lt 1700 ]; }; then
      node src/cli/volume.ts --out data/out/volume-latest.md >/dev/null || echo "[run] volume failed"
    fi
    node src/cli/alerts.ts --out data/out/alerts-latest.md --jsonl data/out/alerts.jsonl
  fi
  if [ "${1:-}" != "--no-digest" ]; then
    node src/cli/macro.ts --out data/out/macro-latest.md || echo "[run] macro failed; digest continues without it"
    # options dashboard when a fresh chain was saved from Robinhood MCP (data/in/spy-chain.json)
    if [ -s data/in/spy-chain.json ]; then node src/cli/options.ts data/in/spy-chain.json --out data/out/options-latest.md >/dev/null || echo "[run] options failed"; fi
    node src/cli/digest.ts --hours 24 --out data/out/digest-latest.md
  fi
} >>"$log" 2>&1
status=$?
# surface new alerts on stdout for whatever invoked us (cron mail, agent, notifier)
[ "${1:-}" != "--digest-only" ] && [ -s data/out/alerts-latest.md ] && find data/out/alerts-latest.md -newer data/.run.lock -print -quit >/dev/null && cat data/out/alerts-latest.md
exit $status
