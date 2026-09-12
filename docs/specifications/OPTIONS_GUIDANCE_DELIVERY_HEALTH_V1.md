# Guidance delivery health

September 12, 2026. F02–F04 correction: saved public reports continued while the
latest brokerage capture remained September 10 00:44 UTC. Actual Host turn errors
show allowance exhaustion before execution. The current market automation file
still matches the authorized 28-wake schedule. A successful public refresh or a
newly issued WATCH report cannot establish a new brokerage observation.

## Reviewed design

Add a deterministic, read-only projection over verified guidance captures, slot
claims, attributed analysis and issued reports. Reuse the existing guidance
reader and current decision engine; do not alter report inputs, fingerprints,
ranking, old policies or any source/scheduler/account permissions.

Expose the last seven calendar dates, no earlier than September 8 activation.
Audit only the three unconditional guidance slots (09:50, 12:50, 15:50 New York),
using the reviewed session calendar. Each original routing window ends ten
minutes later. Holidays/weekends and slots after an early close are not expected;
unknown calendar years stay unknown. Event-dependent extra reads and full-chain
close captures are explicitly outside this denominator. Do not reconstruct past
event requirements from today's calendar.

A saved capture matches a window only when its original request start falls
inside that window and its receipt/record clocks are known by the assessment.
Claims alone do not prove a call or completion. Before a window ends, absence is
pending; afterward it is no saved capture as of the check, not proof the broker
failed. Late persistence can subsequently change the read-only diagnosis. Source
origin must be Host market-tool responses; synthetic data cannot satisfy slots.
Show requested/returned/missing quotes and complete/partial capture separately
from source-clock freshness and execution qualification. Bound catalogs and keep
corrupt records visible as failures rather than silently skipping them.

The current delivery chain shows capture/quote clocks, whether attributed analysis
follows the latest capture and is current, and whether the latest independently
verified issued report contains the exact current market input projection.
Matching a capture does not prove it was scheduled or fresh, establish substantive
analysis quality, or qualify a trade. Current WATCH and candidate blockers remain
the decision authority. Add the same compact projection to frontend and Host brief,
plus an offline CLI. GET and CLI views must not claim slots, make network requests
or write source, paper or Owner records. Scheduled Host uses this view to identify
misses; never retries a missed past slot or increases the authorized call budget.

## Acceptance

Calendar/DST/early-close boundaries; pending versus missed; claim without capture;
partial/missing quotes; synthetic exclusion; late or future recording; mismatched
or stale published input; analysis ordering; corrupted catalog failure; no-write
recovery and original-byte preservation; synchronized English frontend and Host
output. Save the actual failure audit without credentials or raw source payloads.
No real-price gate advances from this operational check.
