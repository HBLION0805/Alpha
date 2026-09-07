# Research observation and saved evidence references

Task OPT-RESEARCH-OBSERVATION-1. Design reviewed September 7, 2026 against the
existing protocol registration and context capture implementations. This is the
next bounded part of OPT-RESEARCH-PROTOCOL-1; implementation is pending.

## Purpose and accepted boundaries

A new observation must identify the protocol and market context that were
actually recovered before it was recorded. Existing protocol and context pairs
already support independent recomputation. Reuse their verifiers instead of
accepting caller-supplied verification flags or implementing another validator.

The record describes an observation or an explicit reason to refrain from
trading. It cannot create a paper fill, completed NO_ENTRY outcome, reviewed
mistake, strategy recommendation or sample-partition input. The old journals
and first qualified real-price paper-flow requirements remain unchanged.

## Input contract

The exact declaration contains version OPTIONS_RESEARCH_OBSERVATION_INPUT_V1,
observationId, protocolId, captureId, symbol, disposition and reason. IDs use the
existing exportId filename validator. Symbol is GLD or IBIT. Disposition is
OBSERVE_ONLY or NO_TRADE. Reason is nonblank text of at most 16,384 characters;
allow newlines and tabs, reject other control characters and unpaired surrogates.
Treat this text as research data, never instructions or executable code.

Reject unknown keys, supplied clocks, order/position fields, performance,
probability, outcome and feature-completeness assertions. The input file has a
256 KiB bound and uses the existing strict UTF-8/duplicate-key JSON parser. Retain
its exact text, including any BOM, byte count and hash as in protocol registration.

No command chooses a protocol, dataset split, context capture or disposition on
the user's behalf. Synthetic test fixtures must remain in isolated temporary
workspaces and cannot register a formal active-workspace research protocol.

## Read-only resolution before recording

1. Validate the declaration before loading dependency stores.
2. Run the existing protocol --verify and context-capture --verify implementations
   on the declared IDs. A complete context pair may preserve unavailable sources;
   its missing/blocked components do not prevent recording an observation.
3. Read the four dependency files through the existing bounded safe storage
   helper. Match their exact bytes against the verifiers' returned hashes before
   using the saved declarations, context report and member manifest.
4. Read the actual local observationAt only after these operations. Both complete
   dependency verifications must strictly precede observationAt. Their receipt
   preparation clocks alone do not establish that receipt writes had finished.
   Equality or clock regression fails without waiting, retrying or fabricating a
   later millisecond. Original verifiers enforce their internal clock ordering.
5. Preserve registration timing, context cutoff, all source states, membership
   hashes and the original context report without rewriting its clocks. Record
   elapsed time from cutoff to observation separately. Context freshness remains
   the original assessment at its own cutoff; successful recovery does not mean
   the context is fresh at the new observation time.

The binding identifies protocol payload/receipt hashes, declaration and definition
hashes; context payload/receipt hashes, context and manifest hashes; and the actual
dependency verification clocks. Save the original full context report once in the
observation payload so its coverage and exact members remain reviewable. Link the
full protocol through its immutable pair rather than copying definitions again.

Retain late registrations and observations outside declared windows as visible
diagnostics. Do not assign a sample partition: the original auditor requires the
whole information interval, which this observation does not establish. Do not
add or duplicate window/gap validation or label a declaration as a sealed holdout.

## Exclusive storage and recovery

The planned commands are --inspect <input>, --record <input>, --verify <id>.
Inspection resolves references but writes nothing and reports recordSaved:false.
Recording uses data/runtime/options-research-observations/<observationId>/ with
exclusive payload.json and receipt.json files. Bound payload to 128 MiB and
receipt to 64 KiB; reject an oversized representation before claiming the ID.

Build a canonical payload from the exact input, original dependency reports and
the newly observed clock. Recheck input and all four dependency byte identities
immediately before claiming the directory. Use the existing exclusive fsync/close
writer for the payload. Only afterward read payloadSavedAt and receiptPreparedAt
and write the receipt binding exact payload bytes. Never reuse an existing empty,
partial or complete directory. Interrupted writes remain explicit failed pairs.

Verification requires this pair and both original dependency pairs. Recover the
dependencies through their existing verifiers; compare saved byte identities and
recompute all deterministic projections using the original recorded observation
and dependency-verification clocks. Do not replace them with recovery-time clocks.
The new verification clock is separate and must not precede saved receipt times.
Check exact canonical bytes, expected entries and stable re-reads as in the two
existing storage modules. Missing or changed dependencies fail verification; do
not silently downgrade to trusting an embedded successful summary.

An isolated recovery rehearsal copies exactly these three pairs into a fresh
workspace and verifies in a new process with no source journals, original input,
network, host connection or credentials. A reference-only design deliberately
requires retaining all three pairs together. This unit does not alter the existing
evidence-export format or claim it already exports these new stores.

## Honest outputs and limitations

Keep featureWindowStartAt, featuresKnownAt, episodeId, outcomeState and
outcomeKnownAt null. Keep featureCompletenessProven, sampleInputGenerated,
historicalDecisionProven, heldOutAccessSealed, replayAllowed and executionAllowed
false; winProbability is null. Explicit no-trade text does not generate a
successful trade, closed review or approved mistake guard.

Local clocks and hashes establish reproducible local consistency, without external
timestamp attestation, atomic snapshots across stores, durable disk guarantees
beyond the existing writer, or proof of when a person formed a view. Observing
current files cannot repair unknown knowledge clocks in old paper plans.

## Acceptance and bounded delivery

First implement exact input validation and read-only reference resolution with
real existing verifier calls. Then add exclusive recording and isolated recovery.
Keep source modules and old CLI semantics unchanged; do not expose private storage
helpers merely to avoid testing the real consumer path.

Acceptance includes valid GLD/IBIT observations and no-trade reasons; unsupported
scope/authority/clock fields; exact bytes including BOM; missing/corrupt/mismatched
dependencies; stale and unavailable context; late protocol registration; equal or
regressing clocks; changes between verification and recording; duplicate/partial
IDs; unsafe paths/hard links; payload limits; fresh-process recovery with only
the three pairs; and rejection when any dependency is absent or changed. Assert
original journal bytes and old reviews remain unchanged and sample counts stay
zero. Full validation follows behavioral implementation, not this design-only unit.
