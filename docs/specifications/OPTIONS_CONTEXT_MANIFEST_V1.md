# Options context member manifest and capture receipt v1

Task OPT-CONTEXT-MANIFEST-1. Design reviewed September 7, 2026 during the first
actual automatic development wake. Status: DESIGN_REVIEWED_IMPLEMENTATION_PENDING.
Current configured model; no delegation. Complexity: medium/high. Implement in
bounded continuation units, preserving unfinished work at the router deadline.

## Problem and current evidence

The sample inventory has fifteen current cases but no complete sampling inputs.
Context cutoff v2 already recomputes five source histories and excludes records
discovered/received after a requested cutoff. It does not establish when a
particular compiled snapshot was first saved for a future research decision.
Its `journalAppendTimesKnown`, `historicalDecisionProven` and publisher-vintage
authentication flags correctly remain false.

An actual read-only inspection at cutoff `2026-09-07T19:35:40.201Z`, constructed
`2026-09-07T19:35:40.267Z`, recovered all five stores with no missing/blocked store.
The context SHA-256 was
`2d935e1a4d6bab4bc3611420f42b96820873cb3a4ddb2df56e73aa4fb6c0bfb1`.
This is a design inspection of existing records, not a prospective capture
receipt, a new source refresh or proof that all values are currently fresh.

## Ownership and implementation boundary

Keep `OptionsContextCutoff` and `OptionsContextCutoffV2` calculations unchanged.
Add a narrow context-member manifest composition under `options-readiness` and
a local CLI. Extract the existing cutoff CLI history-loading sequence for reuse,
preserving its clocks, source order, before/after byte checks, independent errors
and v1/v2 behavior. Do not add a second parser or direct source connector.

The manifest consumes histories only after the original v2 engine has validated
them. It retains context and source-prefix fingerprints plus explicit members:
source component, observation-versus-health category where relevant, original
record index, exact record SHA-256 and existing receipt/discovery clock.
Headlines use the original `observedAt` selection; Treasury, BTC, BLS and FOMC
use `receivedAt`. Equal-clock records remain distinct by index. Never replace
these clocks with a page-update, event-date, market-bar or new snapshot clock.

Missing and blocked components contain no manufactured members. An available
empty prefix has an empty member list and unknown earliest/latest knowledge
clocks; it is not a neutral market reading. Validate the entire recovered source
before selecting its prefix, retaining the original corruption and future-clock
rules. Later valid appends must not change earlier selected member identities.
No raw source error body may enter a manifest or diagnostic.

## Actual capture and persistence protocol

`--inspect` is read-only and creates no capture receipt. `--capture <new-id>`
chooses its cutoff from the actual current clock; it accepts no caller-supplied
historical capture time. The current five-store snapshot remains non-atomic
across sources. Retain per-source recovery/check clocks and original semantics.

Use existing bounded path/byte helpers and strict JSON/UTF-8/duplicate-key/depth
validation. Define explicit payload/manifest size limits during implementation,
consistent with the existing source limits; do not silently truncate members.

1. Load/recompute the existing v2 histories and member manifest.
2. Exclusively write the payload containing exact recovered histories, context
   and member manifest, then complete its existing fsync/close operation.
3. Read the actual clock only after that write completes. This clock records the
   payload-save observation and must not precede cutoff or construction.
4. Exclusively write a separate receipt binding payload bytes/hash and that
   observed save clock. Preserve another actual receipt-preparation clock.
5. Verify both immutable files, recompute the original v2 context/members from
   saved histories, and return an actual verification clock after file checks.

An incomplete payload/receipt pair is incomplete evidence. Never overwrite,
delete or silently finish an old partial pair using a fabricated earlier clock.
A new attempt uses a new ID. No old journal, dashboard, evidence package or paper
record is mutated. Recovery must not reopen active stores or call a source.
Local checksums and wall clocks establish local consistency under stated clock
assumptions; they are not provider signatures or external timestamp attestations.

## Subsequent binding and non-goals

A later separately specified consumer can reference this capture receipt in a
research protocol/decision. It must compare the actual payload-save clock with
the declared decision cutoff, preserve all freshness/coverage errors, and retain
the exact protocol and feature-definition fingerprints. Existing retrospective
records cannot acquire historical knowledge by attaching a new capture.

This module does not itself define numerical predictive features, claim that a
context component is a complete feature window, register a research protocol,
seal a holdout, bind a live order or qualify a dataset. All current sample
inventory gaps remain until their actual required evidence exists. It does not
change the frozen September 8 study or collector, invent future quotes, refresh
news, make a market signal, calibrate a probability or increase position sizes.

## Acceptance and bounded continuation plan

First unit: typed member manifest and pure composition with tests for membership,
category/index identity, equal clocks, cutoff exclusion, later valid appends,
blocked/empty histories, unchanged original context hashes and bounded inputs.
Second unit: reuse the existing loader; implement inspect/capture/recovery CLI
with exclusive pair persistence, actual post-write clocks, corruption/partial
failure tests and new-process recomputation. Run original cutoff CLI tests after
loader extraction; v2 CLI tests are in `scripts/options-context-cutoff.test.mjs`.
Third unit if needed: actual local capture, original-source/host preservation
audit, complete validation and delivery. Never rush partial changes into a commit
to meet the ten-minute development deadline.

Review source-clock and save-clock semantics before implementing the binding
consumer. Scope excludes all brokerage/account/order calls, market refreshes,
host edits, purchases, quota resets, new tasks and changes to original journals.
