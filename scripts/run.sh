#!/usr/bin/env bash
# Scheduled entry point: poll feeds → emit new alerts → refresh digest.
# Usage: scripts/run.sh [--digest-only|--no-digest]
# Brief: every run → data/out/brief-latest.md (+ macro-latest.json for the digest, scenarios-latest.json for leader state)
# Volume: 7:00–9:29 (prior session, feeds premarket) and 16:15–16:59 ET → data/out/volume-latest.md (src/cli/volume.ts)
# Env: ALPHA_VOLUME=1 forces volume; ALPHA_NODE_BIN (dir with node 24), ALPHA_DB, ALPHA_ALERT_THRESHOLD, ALPACA_KEY/ALPACA_SECRET (optional)
set -uo pipefail
cd "$(dirname "$0")/.."
[ -n "${ALPHA_NODE_BIN:-}" ] && export PATH="$ALPHA_NODE_BIN:$PATH"
for d in /home/box/.local/node24/bin /workspace/node-v24.22.0-linux-x64/bin; do
  node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' 2>/dev/null && break
  [ -x "$d/node" ] && export PATH="$d:$PATH"
done
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' || { echo "Node 24+ required (set ALPHA_NODE_BIN)" >&2; exit 2; }
mkdir -p data/out data/logs
exec 9>data/.run.lock
flock -n 9 || { echo "[run] previous run still active; skipping" >&2; exit 0; }
log="data/logs/run-$(date +%Y%m%d).log"
{
  echo "=== $(date '+%F %T %Z') ==="
  if [ "${1:-}" != "--digest-only" ]; then
    node src/cli/poll.ts | tail -1
    hm=$(TZ=America/New_York date +%H%M)
    # volume anomalies: prior session before the open, today's after 16:15 ET (or ALPHA_VOLUME=1)
    if [ "${ALPHA_VOLUME:-}" = "1" ] || { [ "$hm" -ge 0700 ] && [ "$hm" -lt 0930 ]; } || { [ "$hm" -ge 1615 ] && [ "$hm" -lt 1700 ]; }; then
      node src/cli/volume.ts --out data/out/volume-latest.md >/dev/null || echo "[run] volume failed"
    fi
    # ONE daily brief every run (macro + premarket + scenarios + levels; each series fetched once). Its alarms and
    # leading-scenario changes go into the store, so the alert step below picks them up.
    node src/cli/brief.ts --out data/out/brief-latest.md >/dev/null || echo "[run] brief failed"
    node src/cli/alerts.ts --out data/out/alerts-latest.md --jsonl data/out/alerts.jsonl
    # paper ledger close step (Mon–Fri 15:45–16:59 ET): mark with the routine's fresh Robinhood quotes
    # (data/in/rh-option-quotes.json, see docs/ROUTINE_PAPER.md), then expire (settles after 16:00; VIX needs
    # data/in/settle.json, else stays pending) and the Friday 15:45 mentor weekend rule; then the review report.
    dow=$(TZ=America/New_York date +%u)
    if [ "$dow" -le 5 ] && [ "$hm" -ge 1545 ] && [ "$hm" -lt 1700 ] && [ -s data/journal/paper.json ]; then
      node src/cli/paper.ts mark || echo "[run] paper mark failed"
      node src/cli/paper.ts expire || echo "[run] paper expire failed"
      node src/cli/review.ts >/dev/null || echo "[run] review failed"
    fi
  fi
  if [ "${1:-}" != "--no-digest" ]; then
    [ "${1:-}" = "--digest-only" ] && { node src/cli/brief.ts --no-alarms --out data/out/brief-latest.md >/dev/null || echo "[run] brief failed"; }
    # options dashboard when a fresh chain was saved from Robinhood MCP (data/in/spy-chain.json)
    if [ -s data/in/spy-chain.json ]; then node src/cli/options.ts data/in/spy-chain.json --out data/out/options-latest.md >/dev/null || echo "[run] options failed"; fi
    node src/cli/digest.ts --hours 24 --out data/out/digest-latest.md
  fi
} >>"$log" 2>&1
status=$?
# surface new alerts on stdout for whatever invoked us (cron mail, agent, notifier)
[ "${1:-}" != "--digest-only" ] && [ -s data/out/alerts-latest.md ] && find data/out/alerts-latest.md -newer data/.run.lock -print -quit >/dev/null && cat data/out/alerts-latest.md
exit $status
