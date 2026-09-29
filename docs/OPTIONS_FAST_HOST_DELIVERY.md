# Fast Host guidance orchestration — September 29, 2026

Tracked code integration is complete on the development branch. Deployment status
is **DEPLOYMENT_PENDING_HOST_PROMPT_UPDATE**. No installed automation fields were
changed in this delivery.

The 15:50 Host keeps the existing route/calendar check, exclusive claim and
`--host-source` market collector. It sends one compact captured JSON line to
`--ingest --workspace <private-root>`. Ingest accepts only the normal actual Host
capture: 24 or fewer fully receipted calls, 36 selected and returned quotes,
18 per ETF, two equity rows, terminal instrument pagination, no collector failure,
and explicit false account/execution authority. It saves the exact raw bytes to
the existing ignored inputs namespace using a verified synced temporary file and
atomic rename. In one local process it records, verifies, observes paper plans and
builds the existing Host brief. It emits a bounded context summary and opaque
identity. It does not save analysis or publish.

The equipped Host writes its own short attributed GLD/IBIT assessment from that
summary, retaining sources and unknowns. `--finish --workspace <private-root>
--identity <ingest.identity>` reads exactly one compact analyst-note line. The
existing analyst-note validator remains authoritative. Finish checks the latest
receipt, raw hash, verified capture fingerprint and latest captured record, then
records analysis, publishes with an expected-capture guard, and reads decision
cards and delivery health. The operational PASS/FAIL result does not change the
guidance dispositions. A newer or different capture blocks the finish. A failed
finish after its start marker needs development inspection; it does not repeat
market acquisition. Receipts and source data remain ignored under the private
runtime root.

The code does not call any market, public, account, position or order tool. It
does not change the collector, schedule, 09:00 public context, freshness, risk,
capital, paper enrollment or decision rules. The private latency runner was a
mechanics reference only; its assessment prose was not promoted.

Local isolated synthetic tests cover a nanosecond quote, frame/size rejection,
invalid authority and coverage, terminal pagination, atomic collision, no ingest
analysis/publication, analyst validation, identity mismatch, exact report linkage,
a newer capture through the normal record path, and fresh versus stale operational
results. An approximately 419 KiB compact synthetic capture took 137 ms for ingest
and 486 ms for finish within the local test process; output was 3,822 and 1,542
bytes respectively. These measurements exclude Host collection and tool transport.
The original daily-guidance and timestamp tests and full validation are separate
checks. Passing local checks does not establish that the installed automation has
used this route or that a natural market capture has passed.
