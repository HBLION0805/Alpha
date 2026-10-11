# Read-only source process health in Weekly plan — October 11, 2026

The existing Current source coverage panel now includes a compact refresh-health
section. It separates public-source and company processes, their actual selected
sets, confirmed request/unique-source counts, configured company universe,
prepared batch, disabled scopes and one-time supplements. This is operational
readback, not research qualification, a fresh quote, Paper execution or trading
permission. No separate dashboard, timer, OS service or cloud task was added.

## Read and display boundaries

`options-weekly-refresh-health.mjs` reads bounded manifests and fingerprint-linked
journals directly. It does not import launch/stop/recovery operations, create a
lock, mutate a file or acquire a source. An optional signal-zero process check
only checks existence: it never authenticates process identity. Missing access
is UNKNOWN; absent ownership without a terminal receipt is unresolved; an absent
owned process is interrupted. Reaching the deadline without a terminal record is
not presented as confirmed completion. The saved journal state remains separately
visible when the current process cannot be checked.

States cover waiting, requesting, ended, not started, interrupted, unresolved,
stop requested and expired without confirmed shutdown. Source sets come from the
selected manifest. Counts use completed request receipts, not mere STARTED events
or source-catalog registration. A pending request may therefore have no confirmed
receipt yet. No next scheduled check appears for ended/stopped/unknown processes,
used-up budgets, disabled sources or invalid source stores. An eligibility time
is distinct from an execution commitment.

Each row shows last request/receipt, last successful parse, next eligibility,
current process's earliest check, result/HTTP and a failure or disabled reason.
Public-source failure backoff and company failure suppression keep their existing
semantics. The company config's 47 sources are not described as all running;
current selection and the 37 unqueued sources are explicit. UTC and New York
clocks are displayed together. Prepared-config matching requires source set,
window, interval, budget and config hash to match the actual manifest.

The health JSON and HTML deliberately omit process PIDs, ownership tokens,
configuration contents, raw envelopes and local paths. Existing unrelated source
provenance panels retain their prior behavior. The new section has no start,
stop, retry or source-fetch control. Only selected safe status fields are projected;
text is escaped. One-time PDF/PANW/HPE/ETN/ASML records stay separate. HPE's local
2 MiB truncation, PLTR's complete dynamic shell and HTTP 403 retain different
reasons. Annual PDF metadata remains disabled and mapped dates stay unchanged.

Health is captured and frozen with the same page source-input snapshot. Later
journal updates cannot mutate that response. This additional current operational
projection does not enter the immutable owner-plan preview or its fingerprint.
Future source/receipt/event clocks are not included in an earlier assessment.
Damaged, oversized, unsafe or changing journal state is UNKNOWN, never success.

## Reviewed company process now waiting

After explicit independent clearance of 4b9d63e and e0ed70f, the already existing
`--first-at` option started one hidden finite process from a separate exact Git
archive of **e0ed70f7b47161b487e80920a0c244d785c63720**. Health-view development
cannot change that loaded code. The reviewed configuration hash remains
`678af497812ca9bf29dc2f31f76ffd561210463b6735b480b40b4af9bf595161`.

- Run ID: `daf66c62-fcaf-4052-8a0d-8697af10c01a`.
- PID: 7956; manifest start: **2026-10-11T07:56:03.560Z**.
- First-at / not-before: **13:40 UTC / 09:40 EDT**.
- Source interval: **360 minutes**; total request budget: **20**.
- Absolute cutoff: **20:00 UTC / 16:00 EDT**; budget can end it earlier.
- IR: MSFT, AMD, AVGO, AMAT events, ADBE events.
- SEC: AAPL, TSM, MSFT, NVDA, ASML. Other 37 sources are not queued.

Startup readback at 07:56:12.871 UTC confirmed STARTED then WAITING, zero attempt
starts. The health readback at **08:05:50.098 UTC** still showed both processes
WAITING, ten sources each and **zero requests in each current run**. The existing
public process's next eligibility remains 09:38:44.499 UTC and its cutoff remains
17:46:05.993 UTC. It was not restarted or changed.

Company six-hour acquisition, repeated-spacing and terminal acceptance remain
pending. Starting a waiting process does not validate those outcomes. The earlier
three-source dfd9242 run remains a distinct pre-hashed one-hour acceptance.
No source clock or minimum interval was changed, no extra batch was queued, and
no operating-system or cloud automation was installed.

## Validation and rollout

Fourteen new tests cover missing state and zero writes/network, selected versus
attempted counts, waiting/ended/in-flight/stopping/expired states, PID uncertainty,
corrupt and future records, source failures, exhausted budgets, exact prepared
config matching, sensitive-field omission, escaping and immutable-plan isolation.
The existing 22-test weekly-source suite also passes. Full equipped regression
passes **237 components, 5,997 tests, zero failures**. See the
[sanitized status](status/weekly-refresh-health.json). Full regression used core code
**904b0f4**; the final code **15f9125248d744713c365eeb60e2cee1773884f9**
adds only the verified two-column desktop / one-column mobile CSS adjustment.

The exact-code temporary preview at **http://127.0.0.1:4180/#weekly-plan**
passed desktop/mobile verification at **2026-10-11T08:17:03.345Z** and subsequent
visual inspection. There were no console, page, HTTP, network or external-origin
errors, no horizontal overflow, and no page-triggered outbound attempts. All
**25,907 protected files** retained their hashes. The health section has no control
buttons/forms and exposes no sensitive process or configuration paths. Writes
remain rejected; process creation and filesystem writes remain denied.

Final local receipt:
`data/runtime/options-workbench-development/readonly-preview-health-15f9125-20261011/acceptance-final-4180/verification-full-receipt.json`
SHA-256: `353c9979402397981d45dbe7826487ba7cd560736620b0cf7cb79a2e8b15f0d5`.
Desktop/mobile screenshots are retained beside it. A prior temporary-port attempt
failed its exact-code check while the older temporary process was still running;
that receipt remains preserved separately. After exact process identity/start-time
verification, only that temporary process was replaced and final acceptance passed.

The local **4178** preview remains **ae8a88c** pending independent review of final
health code. Host readback at **08:20:15.650 UTC** confirmed its unchanged process
and code, along with the original public process and waiting company process.
Temporary **4180** runs PID 7692 from 1,505 hash-pinned archived files. The existing
4178 archive and rollback remain preserved for a coordinated switch after review.
Raw evidence and preview receipts remain ignored/local. First six-hour company
acquisition and terminal acceptance remain pending; they are not UI acceptance.
