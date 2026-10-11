# Bounded company refresh configuration — October 11, 2026

The Owner requested automatic acquisition capability for already usable company
IR and SEC sources. A separate finite company process now reuses the existing
issuer HTTP reader, immutable originals, parsers and coverage projection. The
active ten-source process is unchanged. The 4178 preview remains the independently
reviewed ae8a88c code archive; this new implementation needs independent review.

## Scope and configuration

[Default configuration](config/weekly-company-refresh.json) permits eleven IR
URLs: MSFT, AVGO, AMD, LRCX, KLAC, ARM, CRWD, WDC and the separately verified
ADBE/AMAT/DELL event URLs. It also permits all 36 existing SEC submissions URLs.
These are six selectable batches: IR 6/5 and SEC 10/10/10/6. Only one named batch
is selected per run. Configuration is not evidence that any process is running.

The default source interval is six hours; the minimum remains one hour. A run
has at most ten source IDs, at most twenty requests and a mandatory future UTC
deadline within 24 hours. A smaller config can lower the budget. No configuration
can opt an unverified or blocked source into this process. The exact config and
its hash, selected batch and implementation hashes are copied into the manifest.
Subsequent config edits do not alter a running batch.

Every due check re-reads saved evidence. A source needs a latest successfully
parsed original; missing evidence or any latest acquisition/parser failure
disables that source until explicit review and a separately successful acquisition.
An HTTP 403 or 429 stops the current batch. There is no automatic retry or missed
slot catch-up. A clean restart preserves the last request and interval. SEC uses
the unchanged public-research User-Agent and serial 1.1-second spacing, without
filing-body calls, credentials or parallel pool requests. Existing ten-ID,
512 KiB/12-second, 500-record and 64 MiB archive bounds remain enforced; archive
capacity exhaustion requires review, not deletion or silent limit expansion.

The 18 original denied companies remain outside the allowlist: AAPL, GOOGL,
AMZN, META, NVDA, TSLA, TSM, MU, QCOM, ORCL, CRM, SNOW, SNPS, ANET, CSCO, VRT,
STX and APH (their IR scopes only; their independently successful SEC sources
are eligible). NOW, CDNS, dynamic PLTR, bounded HPE and unadapted/individually
interpreted PANW/ETN/ASML IR scopes also stay out. No browser adapter is added.
The `--plan` output retains each catalog source's last request and disabled reason;
eligible sources include last request/receipt, status and next eligible time.

## Annual PDF

Cboe PDF checking is disabled in the default company config. An explicit config
may select `cboe_pdf_metadata` in a separate one-source batch. It needs the exact
complete saved PDF baseline and enforces at least seven days since that baseline
or the last metadata check, irrespective of the shorter company interval.
The existing baseline was requested October 11 at 06:38:22.046 UTC; the first
possible check is October 18 at 06:38:22.046 UTC. No PDF check was due or performed
in this delivery.

Checks use a fixed official URL, HEAD and the original ETag conditional header,
with no redirect/retry or GET fallback. They retain a small metadata receipt and
download zero PDF body bytes. HTTP 304 is a server not-modified claim; matching
ETag is a metadata comparison, not fresh byte verification. Changed or missing
validators require review and disable further automatic checks. The seven mapped
calendar rows retain their original PDF/image/review hashes and dates; metadata
checks never rewrite them or qualify individual contracts.

## Commands and lifecycle

Use the intended development checkout explicitly. Replace the deadline placeholder
with an actual future UTC timestamp; these examples do not start a process here.

```powershell
npm run options:weekly-company-runner -- --plan --workspace C:/projects/Alpha-weekly-source-integration-20261011
npm run options:weekly-company-runner -- --run --workspace C:/projects/Alpha-weekly-source-integration-20261011 --batch sec-1 --until <UTC-ISO-MILLISECONDS>
npm run options:weekly-company-runner -- --status --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id <EXACT-RUN-ID>
npm run options:weekly-company-runner -- --stop --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id <EXACT-RUN-ID>
```

`--config <workspace-relative-json>` selects a bounded alternative; `--first-at`
can defer first eligibility but cannot bypass saved source cooldown. The command
runs in the invoking process. A caller can explicitly start it hidden with a
deadline; it creates no OS startup entry, service or cloud schedule. Closing or
killing the process ends collection, and sleep/offline periods are not covered.

Company ownership and fingerprint-linked journals use `company-runner`, separate
from the active headline/event `runner`. Duplicate company processes are rejected.
Source claim locks remain shared with the existing manual issuer acquisition.
`--stop` records a request; terminal status must confirm stopping. After abrupt
termination, `--recover --run-id` only releases an owner proven absent and never
deletes an unfinished source claim. A PID alone is not healthy-collection evidence.

## Real due execution

Run `e54bb517-3e64-442b-8f7e-a8e44d0078ee` used a separately saved three-source
config, the original one-hour minimum, three-request budget, first-at
2026-10-11T07:30:48.777Z and deadline 07:32:33.782Z. All three prior originals
already exceeded the minimum interval before launch; no timestamps or cooldown
rules were changed for this acceptance.

| Source | Previous request UTC | New request UTC | Result |
|---|---|---|---|
| AAPL SEC | 06:11:38.804 | 07:30:50.124 | HTTP 200, parsed original |
| MSFT IR | 05:52:28.454 | 07:30:50.882 | HTTP 200, parsed original |
| TSM SEC | 06:11:49.203 | 07:30:52.817 | HTTP 200, parsed original |

These occurred at 03:30:50–03:30:52 America/New_York on October 11. SEC requests
were serial; the two SEC starts were 2.693 seconds apart. All receipts remain
`OBTAINED_PENDING_REVIEW`, not approved news conclusions, quote evidence or fills.
The run recorded `BUDGET_EXHAUSTED` at 07:30:53.276Z and released ownership. Its
configured deadline was not reached because the budget stopped it first. The
three sources' next hourly eligibility is 08:30:50.124 / 08:30:50.882 /
08:30:52.817 UTC, but no company process remains scheduled for those times.
The default six-hour config would instead make them eligible at 13:30 UTC.

Only this three-source batch actually ran. The other 44 configured company sources
were not refreshed again. The ten-source process retains its original PID 23512,
six-hour intervals, twenty-request budget and 17:46:05.993 UTC cutoff; it does
not include these issuer URLs. Annual PDF metadata remained disabled/not due.

## Validation and review boundary

The new isolated suite passes 18 tests, including deferred due requests, saved
spacing, bounded expiry, budget, duplicate ownership, interruption/recovery,
denial/parser failure suppression, original preservation, unchanged headline
ownership, serial SEC identity and PDF HEAD-only/304/changed-validator cases.
Real due execution above is separate from those synthetic tests.

Final equipped regression passed: 236 components, 5,980 tests, zero failures.
The first sandbox invocation encountered existing filesystem hard-link permission
failures; the equipped rerun passed without changing those tests or permissions.
All 82 prior issuer originals and 25,907 protected files retain their hashes;
the frozen experiment remains clean at 2dabc114. Preview PID 37080 and existing
source PID 23512 retain their original startup identities. Company PID 12376
has exited, and its ownership file has been released.

Real acceptance is saved at
`data/runtime/options-weekly-sources/company-runner-acceptance/real-acceptance.json`,
SHA-256 `4d00ebefcea2cccec9cff4291cb37975ea2e7efee00ff47a138c250ba4f67761`.
It records the original request clocks, elapsed minimum intervals, all three new
receipt hashes, actual implementation hashes, terminal journal and preserved
process identities. See [sanitized status](status/weekly-company-refresh.json).

Raw originals, preflight, launch, logs and lifecycle receipts remain ignored/local
under `data/runtime/options-weekly-sources/company-runner-acceptance`. The delivery
does not modify the frozen October 12 experiment, $160 challenge ledger, original
CPI/15:50 schedule, strategy or risk thresholds. No quote, brokerage, order or
Paper execution authority is added. No always-on company collection is claimed.
