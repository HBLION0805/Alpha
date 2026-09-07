# Synthetic collection-window rehearsal delivery

Task: OPT-COLLECT-REHEARSE-1. Date: 2026-09-07.

## Change and purpose

Added `scripts/options-collection-rehearsal.mjs`, fifteen focused tests,
package/validation registration and focused overview, architecture, decision,
roadmap, handoff and status documentation. The
[specification](specifications/OPTIONS_COLLECTION_REHEARSAL_V1.md) preceded code.

`npm run options:collection-rehearsal -- --run` uses the hash-checked Host tick
with only workspace, study, plan hash and four contract literal substitutions.
Its control flow and GLD/IBIT quote tool scope remain intact. Fake quote ports
and fixed in-process command routing exercise original observation, collector
and closeout storage in fresh temporary directories. No shell or actual provider
is invoked. Original source/calendar fixtures are expanded into four synthetic
contracts; no owner dataset is copied or relabeled.

The output retains actual run start/end separately from simulated September 4
source, request, receipt, recording, freeze and assessment clocks. Every scenario
saves a pre-window closeout and final report, reopens all inputs/reports and
checks same-clock save reuse and unchanged pre-window bytes. Missed/invalid data
remains recorded as such; operational and quote-quality lessons remain candidates.

## Actual engineering rehearsal

Actual run: **2026-09-07T07:10:44.493Z to 07:10:49.057Z**. Retained evidence:
`C:/Users/liuha/AppData/Local/Temp/alpha-collection-rehearsal-xTb9eg`.
A compact copy is in `data/runtime/options-readiness/collection-rehearsal-receipt.json`.
Receipt SHA-256: `890a74505ecbf14d1b836218be61f449d2b1fea8a3bce556026a772d04201eff`.

| Synthetic scenario | Attempts | Tool-failure batches | Saved frames | Complete usable slots | Usable contract observations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Healthy | 20 | 0 | 20 | 20 of 20 | 80 |
| Mixed | 19 | 2 | 17 | 13 of 20 | 58 |
| Slow | 10 | 0 | 10 | 0 of 20 | 0 |

Mixed failures include an omitted wake, two tool exceptions, stale data, a zero
ask size, a missing quote and a final response received after close. It retains
one missing-request slot, three missing-frame slots and seven slots without a
complete usable contract set. Slow seventy-second responses skip alternate wakes
under the declared busy-host model; all saved quotes are stale. No empty slot is
filled with an assumed quote and no source failure becomes market inactivity.

All twenty-two protected active source/study/report files and the active host
configuration hash matched after the exercise. No actual quote frame, source
retrieval, trade review or knowledge candidate was appended to active stores.

## Validation, risks and next step

Commands: focused rehearsal tests, actual rehearsal CLI, protected-file/host hash
checks, Git diff review and `npm run alpha:validate`. The aggregate passed
**3,012/3,012 tests**, 116 components, zero failures in 58,431 ms.
Measured results are in [the checkpoint](status/collection-rehearsal.json).
Fifteen focused tests passed, covering expected counts, errors, gaps, origin,
clock meanings, host literal boundaries, no network, immutable recovery, safe
provider text and preserved production bytes. No runtime rehearsal failure occurred.

Assumptions and risks: synthetic coverage is not a strategy win rate. In-process
ports do not test Windows process launch, real transport, OAuth entitlement,
market quote quality or actual Codex scheduling. Busy-wake behavior is a declared
model, not a measured host promise. A source that never settles remains untested;
the current Host program awaits tool completion. Temporary evidence is local and
may be removed by OS cleanup. Actual journal append times remain separate from
simulated scenario clocks. NO_REPLAY and no-order boundaries remain in force.

Next: inspect actual September 8 09:30-09:50 New York collection and its saved
closeout. Only then qualify quote semantics and execution-cost assumptions for
a separate real-price replay. Changes are reviewed, committed and pushed under
the Owner's standing authorization after validation. The live Host program,
production repositories, frozen study and source journals remain unchanged.
