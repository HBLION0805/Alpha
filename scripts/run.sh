#!/usr/bin/env bash
# Scheduled entry point: poll feeds → emit new alerts → refresh digest.
# Usage: scripts/run.sh [--digest-only|--no-digest]
# Env: ALPHA_NODE_BIN (dir with node 24), ALPHA_DB, ALPHA_ALERT_THRESHOLD, ALPACA_KEY/ALPACA_SECRET (optional)
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
    node src/cli/alerts.ts --out data/out/alerts-latest.md --jsonl data/out/alerts.jsonl
  fi
  if [ "${1:-}" != "--no-digest" ]; then
    node src/cli/digest.ts --hours 24 --out data/out/digest-latest.md
  fi
} >>"$log" 2>&1
status=$?
# surface new alerts on stdout for whatever invoked us (cron mail, agent, notifier)
[ "${1:-}" != "--digest-only" ] && [ -s data/out/alerts-latest.md ] && find data/out/alerts-latest.md -newer data/.run.lock -print -quit >/dev/null && cat data/out/alerts-latest.md
exit $status
