# Public collector startup recovery

## Result and actual evidence

The existing hourly public collector recovered in its normal 23:00 New York
attempt on September 8, 2026. All nine fixed news feeds returned OK and the
Coinbase BTC-USD context read succeeded. BEA still reports one rejected headline
item as partial coverage. Successful transport does not imply new stories,
complete coverage, a trading signal or continuous availability.

The earlier launcher ran inside the restricted command environment. Its child
could serve the local interface while outbound news requests returned structured
EACCES/EPERM-derived FEED_NETWORK_ACCESS_DENIED. This identifies the execution
environment problem; it is not evidence that the Owner set a restriction or that
a specific Windows firewall rule caused it. See the
[correction specification](OPTIONS_COLLECTOR_STARTUP_CORRECTION.md).

After matching the exact workspace command and sole loopback listener, only old
PID 22976 was stopped. The existing launcher was run through the supported
per-command network approval path. New PID 23484 started at
2026-09-09T02:51:55.296Z, listening only on 127.0.0.1:4173. Subsequent launcher
reuse kept that process. No global security settings or collection logic changed.

The failed UTC hour 02 claims and receipts were retained. No reset or duplicate
acquisition was used. The unchanged timer began UTC hour 03 at
2026-09-09T03:00:55.500Z:

| Existing collector | Completion, UTC | Result |
| --- | --- | --- |
| Original six feeds | 03:00:56.190Z | OK; BEA rejected one invalid item |
| Coinbase BTC-USD | 03:00:56.471Z | OK; usable at receipt |
| Three focused feeds | 03:00:56.790Z | OK |

The BTC source timestamp was 03:00:54.375466312Z; actual receipt was
03:00:56.442Z, with midpoint $78,702.775. This is a dated spot snapshot, not an
IBIT conversion or an executable option quote. The focused view retained 50
relevant titles out of 176 stored titles. The original six-feed refresh added
zero new observations; a successful read must not be described as new news.

The service automatically issued guidance at 03:00:59.374Z. A separate attributed
operational note at 03:02:25.835Z then recorded recovery without claiming an
article-body or new brokerage review. The subsequent 03:02:37.729Z issued report
was verified. Both ETFs remain WATCH / INSUFFICIENT_HISTORY.

## Preservation and interface checks

Exclusive before/after evidence is saved locally at:

- `data/runtime/options-workbench-development/collector-startup-before-20260909.json`
- `data/runtime/options-workbench-development/collector-startup-after-20260909.json`

The latter was recorded at 03:03:37.355Z with SHA-256
`b49f9c7bb6ddcb492d3f9fe9de659c8cf10c1078e60144dc58672928b4e8cb28`.
It links the actual hourly claims/receipts, focused feed record, analysis and
both issued reports. Twelve original file hashes match, including failed
claims/receipts, prior analysis, allocation settings, old/new check snapshots,
issued guidance and frozen PPI plans. The original driver and BTC journal byte
prefixes match after appends. Runtime artifacts remain excluded from Git.

Owner ledger events remain zero, with original head
`a9d04c6517e2143e9d74dac740a1a2fd92511b1324392f4ec0a2816e52784e1c`.
The $1,000 account declaration, $100–$500 allocation and null guidance costs
remain exact. The independent $5 planned-loss / $25 full-premium caps remain.

The launcher now reports local-interface readiness explicitly. The shared
workbench banner describes the hourly schedule without asserting successful
reads. News & calendar highlights only current structured permission failures;
it does not relabel HTTP or unknown failures. Reloading actual recovered records
removes the denial notice and displays all nine new source clocks, retaining the
BEA caveat and earlier headline dates. Desktop before/after DOM and screenshots
were inspected: document/scroll width both 1265px, no browser errors.

## Changed files and validation

- `scripts/start-options-workbench.mjs`: clarify launcher readiness output.
- `apps/options-workbench/app.js` and `focused-news.js`: distinguish schedule,
  current access-denied health and source recovery.
- `scripts/options-focused-news.test.mjs`: four focused regression cases covering
  structured classification, recovered status, unknown failures and retained
  source clocks/headlines.
- Daily guidance runbook, workbench guide, correction/delivery/checkpoint,
  README, AGENTS and Handoff: document approved startup and actual evidence.

Focused-news checks passed **45/45**. `node scripts/alpha-validate.mjs` passed
**4,116 tests across 162 components**, zero failures, including type checking.
The aggregate log is
`data/runtime/options-workbench-development/collector-startup-validation.log`.
Guidance verification passed for the automatic report, recovery note and final
issued report. Preservation assertions passed. The launcher reuse check printed
the corrected readiness text. `git diff --check` passed; Git's CRLF normalization
warnings and expected uncommitted-working-tree warning are informational.

## Limits, next step and Git

The public collector runs while this Alpha process and computer remain running.
The completed hour verifies this process's actual access; it does not guarantee
future source availability. BEA partial coverage remains visible. No auth,
account/order calls, paid source, source endpoint, Host schedule or development
automation changed. No real-price paper-flow gate advanced.

The fixed development comparison remains **4 local / 3 partial / 3 not validated**;
first real-price paper-flow gates remain **3 available / 3 open**. Next reconcile
the minimum allocation with the independent risk caps and require eligible
aligned source/contract/session evidence before qualifying a paper adapter.
Do not silently relax the caps to manufacture a candidate.

Change set is on `codex/gld-ibit-options-foundation`, based on `23ca2d0`.
The Owner's standing authorization covers the reviewed commit and push; the
conversation's final Git confirmation records the resulting commit.
