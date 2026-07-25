# Event Contract Collection Runner Durable Fixture Rehearsal Milestone Review

## Review identity

- Review: `Day15-T3B14-MR1`
- Review date: `2026-07-25`
- Reviewed baseline: `a692f6f`
- Registered validation baseline: `2355/2355`
- Focused T3B14-T5 process drills: `12/12`
- Combined T5 boundary checks: `45/45`
- Scope: Day15-T3B14-T1 through Day15-T3B14-T5
- Authority: architecture and readiness review only

## Executive decision

The T3B14 durable registry, schema profile, PREPARE/STEP/RECOVER coordinator,
terminal evidence transaction, online backup, immutable envelope, and
fresh-process verifier are accepted as deterministic, network-free
foundations.

The milestone is not ready for a fixture rehearsal run. The passing T5
process drills prove the envelope boundary, but their source database is
assembled by a synthetic fixture that writes terminal Runner and rehearsal
records directly. They do not execute the reviewed phase composition in a new
process per phase. The same fixture constructs a passing validation receipt
directly instead of obtaining it from the fixed local validation adapter.

This is a split decision:

- `DURABLE_REHEARSAL_COMPONENTS_ACCEPTED`: the v3 schema, durable
  PREPARE/STEP/RECOVER state, recovery rules, terminal evidence transaction,
  online backup, immutable envelope, and independent backup reconstruction are
  accepted.
- `GO_FOR_REHEARSAL_READINESS_CORRECTION`: Alpha may close the exact
  composition, validation-authority, freeze-enforcement, and process-drill
  gaps listed below.
- `NO_GO_FOR_REHEARSAL_RUN`: no fixture rehearsal may yet be represented as
  executed or independently verified end to end.
- `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`: no general command, loop,
  timer, polling, retry orchestration, daemon, service, or background runner is
  authorized.
- `NO_GO_FOR_BOUNDED_LIVE`: no network provider, future-market discovery,
  Robinhood automation, real Pilot, or dataset-readiness claim is authorized.

## Evidence reviewed

The review inspected:

- the T3B14 architecture and all acceptance criteria;
- commits `30780ba`, `80fb117`, `0522075`, `b3be96c`, and `a692f6f`;
- durable contracts, Migration 003, repository transactions, coordinator,
  preparation and foreground adapters;
- fixed local validation, terminal freeze, online backup, package, envelope,
  and independent verifier behavior;
- T3B12 transaction-boundary drills, T3B13 package drills, T3B14 coordinator
  tests, and T3B14-T5 child-process drills;
- the T5 child-process entry point and the synthetic terminal-state fixture;
- complete Alpha validation, provider/network/credential boundaries, and Git
  state.

## Readiness matrix

| Gate | Status | Evidence | Decision |
| --- | --- | --- | --- |
| Rehearsal-only SQLite profile | PASS | New-store-only Migration 003 and exact v3 inspection | Retain |
| Durable registry and history | PASS | Projection, transitions, claims, receipts, failures, and evidence plan reconstruct | Retain |
| PREPARE/STEP/RECOVER semantics | PASS AS COMPONENTS | Closed programmatic coordinator with CAS and no-repeat recovery | Retain |
| One foreground action | PASS AS COMPONENT | T3B12 adapter invokes at most one exact action | Retain |
| Stop and recovery precedence | PASS AS COMPONENTS | Coordinator and prior process drills fail closed | Retain |
| Terminal evidence transaction | PASS | Freeze claim, validation identity, plan, and transitions commit atomically | Retain |
| Online backup and immutable envelope | PASS | Fixed inventory, digest binding, atomic publication, no overwrite | Retain |
| Fresh-process backup verification | PASS | Backup is reopened and Runner plus rehearsal truth reconstructs | Retain |
| Substitution and missing evidence | PASS | Backup, manifest, receipt, extra-file, and missing-backup drills | Retain |
| Two-run fingerprint separation | PASS FOR SYNTHETIC FIXTURE | Stable scenario and distinct execution fingerprints | Re-prove through real phase composition |
| Exact per-phase process composition | BLOCKED | Child process exposes combined synthetic build and verify only | Implement closed phase operation |
| End-to-end foreground rehearsal | BLOCKED | Terminal Runner and rehearsal records are directly seeded | Exercise real PREPARE and T3B12 STEP |
| Authoritative validation in the drill | BLOCKED | Passing receipt is directly constructed with synthetic identities | Invoke fixed adapter and bind expected authority |
| Independent validation-receipt authority | BLOCKED | Verifier proves receipt self-consistency, not registered commit/suite/total authority | Add closed expected-validation registry binding |
| Post-freeze source immutability | INCOMPLETE | Packaging opens read-only, but no reviewed store-wide barrier proves later writer rejection | Add mutation guard and process drill |
| Required 20-drill traceability | INCOMPLETE | Component tests cover many boundaries, but no exact requirement-to-process evidence matrix exists | Add explicit assembled mapping |
| Real rehearsal operation | BLOCKED | No approved manifest-bound local operation exists | Separate Owner approval after correction |
| Continuous or bounded-live operation | BLOCKED | Explicitly outside T3B14 authority | Separate future architecture |

## Acceptance assessment

| T3B14 acceptance criterion | Result |
| --- | --- |
| Durable registry survives process boundaries | PASS AS PERSISTENCE FOUNDATION |
| Projection and append-only history reconcile | PASS |
| One invocation performs one exact phase | PASS ONLY FOR PREPARE/STEP/RECOVER PROGRAMMATIC CALLS |
| STEP performs at most one foreground action | PASS AS COMPONENT |
| No phase arranges the next phase | PASS |
| Crash ambiguity reconciles without retry guessing | PASS AS COMPONENT |
| Stop precedes mutation | PASS AS COMPONENT |
| Rehearsal profile cannot reinterpret an existing store | PASS |
| One online backup and manifest enter the envelope | PASS |
| Fresh verifier reconstructs backup truth | PASS |
| Validation comes from the fixed adapter | BLOCKED IN THE END-TO-END DRILL |
| Two clean assembled runs produce stable scenario truth | BLOCKED |
| All 20 required process drills are traceable | INCOMPLETE |
| Complete Alpha validation passes | PASS — `2355/2355` |
| Implementation and rehearsal-run approval remain separate | PASS |

## Findings

### Accepted — Durable persistence and evidence components close the prior structural blockers

T3B14 replaces the in-memory rehearsal ledger with a strict durable profile,
binds ambiguous actions to append-only claims and receipts, creates one
independently readable online backup, and verifies terminal Runner and
rehearsal truth without reopening the mutable source. These are material,
reusable improvements over T3B13.

### High — The T5 clean run bypasses the reviewed phase composition

The T5 fixture directly inserts a completed Pilot, committed task, attempt,
result, normalized evidence, counters, and Outbox record. It then directly
calls repository initialization, claim, completion, and freeze methods.

Consequently, the child-process `build` mode proves that a self-consistent
terminal database can be packaged and verified. It does not prove that
separate PREPARE, real T3B12 STEP, recovery, validation, freeze, package, and
verify invocations produce that database.

### High — The process drill does not use authoritative fixed validation

The T5 fixture directly constructs a passing validation receipt with a
synthetic repository commit, suite fingerprint, test total, and output digest.
It does not invoke `FixedLocalDurableFixtureRehearsalValidationAdapter`.

The fresh verifier reconstructs the receipt and checks its fingerprint and
passing status, but it has no registered expected commit, suite fingerprint,
or test-total input against which to compare those fields. A self-consistent
synthetic passing assertion therefore satisfies the current drill.

### High — The closed phase surface is incomplete

The durable coordinator intentionally accepts only `PREPARE`, `STEP`, and
`RECOVER`. The T5 child process exposes only combined `build` and `verify`
modes. There is no reviewed local operation for `VALIDATE`, `FREEZE`,
`PACKAGE`, or an exact phase-by-phase process sequence.

This is safe as a non-operational foundation, but it cannot support the
architecture's later one-phase-per-process rehearsal without correction.

### Medium — Post-freeze immutability is not proven as a store-wide invariant

The envelope builder correctly opens the source database read-only. The review
did not find a store-wide mutation gate proving that another ordinary writer
cannot modify Runner tables after the rehearsal reaches `EVIDENCE_FROZEN`.
The correction must make the composition reject all later source mutations and
prove that behavior in another process.

### Medium — Passing component tests are not a substitute for one assembled drill

The `45/45` combined checks and `2355/2355` complete suite remain valid. They
prove their individual boundaries. They cannot be added together to claim that
the required phase sequence itself ran in separate processes. Milestone
readiness requires explicit evidence lineage, not arithmetic aggregation of
isolated tests.

## Required correction

The recommended next task is:

`Day15-T3B14-C1 — End-to-end Phase Composition and Validation Authority Correction`

It must:

1. define one fixed local, manifest-bound, one-phase-per-process operation for
   the closed fixture phases without adding a loop;
2. compose the existing PREPARE coordinator and real T3B12 foreground STEP,
   rather than seeding their terminal results;
3. invoke the fixed validation adapter and persist its actual immutable
   receipt;
4. bind verifier acceptance to registered expected repository commit,
   validation-suite fingerprint, validation policy, and test total;
5. enforce and drill rejection of every source-store mutation after terminal
   freeze;
6. execute two complete clean rehearsals through distinct process/root
   identities and compare their reconstructed scenario truth;
7. provide an exact matrix mapping all 20 required drills to fresh-process
   evidence;
8. retain test-only, temporary, network-free, synthetic fixture authority;
9. add no automatic next-phase invocation, provider, real Pilot, T1/T2
   delivery, recommendation, broker, order, or execution behavior.

After correction, a separate `T3B14-MR2` must determine whether one exact
Owner-approved rehearsal operation is ready. Correction approval does not
authorize the rehearsal itself.

## Explicitly prohibited after this review

This review does not authorize:

- running or claiming a fixture rehearsal;
- a general start/run command or automatic multi-phase orchestrator;
- a loop, timer, polling, retry scheduler, daemon, or background process;
- caller-selected paths, commands, ports, evidence, or validation truth;
- network access, future-market discovery, or Robinhood automation;
- real Pilot activation, T1/T2 delivery, or dataset qualification;
- probability research, recommendation, sizing, Portfolio mutation, broker,
  order, or execution behavior.

## Owner review recommendation

Approve T3B14-MR1 as:

`DURABLE_REHEARSAL_COMPONENTS_ACCEPTED / GO_FOR_REHEARSAL_READINESS_CORRECTION / NO_GO_FOR_REHEARSAL_RUN / NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`

Then begin
`Day15-T3B14-C1 — End-to-end Phase Composition and Validation Authority Correction`.
Do not combine correction approval with a rehearsal run or any bounded-live or
capital authority.
