# Event Contract Collection Runner Durable Fixture Rehearsal MR3 Readiness Review

## Review identity

- Review: `Day15-T3B14-MR3`
- Review date: `2026-07-25`
- Reviewed baseline: `a9dbeda`
- C2 Worker-composed process drills: `5/5`
- C1 phase-composition drills: `3/3`
- Runtime transaction-boundary process drills: `11/11`
- Durable evidence process drills: `14/14`
- Package process drills: `4/4`
- Registered complete-validation total: `2372/2372`
- Scope: independent review of T3B14-C2 against MR2 and the T3B14
  architecture
- Authority: architecture and readiness review only

## Executive decision

T3B14-C2 materially closes the MR2 implementation findings. The clean STEP
phase now invokes the real fixture Worker and exercises the reviewed T7, T8,
T8B, and T10 repository transactions. Fresh processes prove crash after a
durable phase claim, Stop after claim, Stop before each mutable phase, exact
replay, and changed invocation-identity rejection. Normalized validation now
counts the durable evidence `14/14`.

The exact twenty-drill process-evidence gate is still incomplete. Several
matrix rows cite a fresh process, but the process performs a different
boundary from the required rehearsal-phase condition. Passing component and
runtime process drills remain valid; they cannot be relabeled as assembled
rehearsal receipt or substitution evidence.

Decision:

- `C2_CORE_CORRECTIONS_ACCEPTED`
- `PROCESS_EVIDENCE_MATRIX_NOT_ACCEPTED`
- `GO_FOR_C3_EXACT_PROCESS_DRILL_CORRECTION`
- `NO_GO_FOR_REHEARSAL_RUN`
- `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`
- `NO_GO_FOR_BOUNDED_LIVE`

## Accepted corrections

| C2 correction | Result | Evidence |
| --- | --- | --- |
| Real Worker composition | PASS | Clean STEP produces `SCHEDULED -> DUE -> LEASED -> IN_FLIGHT -> VALIDATING -> COMMITTED` with one attempt, result, evidence record, and no live lease |
| Crash after durable claim | PASS | Child exits after claim commit and fresh inspection finds one unresolved claim with no receipt |
| Stop after claim | PASS | Fresh process leaves `STEPPING` ambiguity and performs no foreground mutation |
| Stop before mutable phases | PASS AS FAULT-INJECTION EVIDENCE | Separate process is blocked before PREPARE, STEP, VALIDATE, FREEZE, and PACKAGE mutation |
| Exact phase replay | PASS | Fresh replay returns `REPLAYED` and inspection proves no duplicate mutation |
| Changed invocation identity | PASS | Fresh changed replay fails closed without mutation |
| Validation accounting | PASS | `drills passed: 14/14` is parsed and protected by a reporting regression test |
| Authority exclusions | PASS | No real rehearsal, provider request, real Pilot, recommendation, broker, order, or execution authority was added |

## Findings

### High — Rows 3, 5, and 9 do not prove the required rehearsal-phase receipt boundaries

Row 3 maps “crash before phase-claim commit” to a runtime startup drill that
crashes before ownership. That proves runtime ownership safety, not the
rehearsal coordinator's pre-claim process boundary.

Rows 5 and 9 map T6 and T10 runtime transaction drills. Those tests correctly
prove Runner state after the injected crash, but they do not create a durable
rehearsal phase claim and therefore cannot prove the required interval before
the rehearsal invocation receipt.

The correction must execute the assembled STEP phase in a child process, stop
at the exact pre-claim, post-T6, and post-T10/pre-receipt checkpoints, then use
a fresh process to inspect both Runner and rehearsal truth.

### High — Row 14 changes the invocation ID, not the required replay-bound fields

The C2 changed-replay helper changes only `invocationId`. The architecture
requires rejection when phase, ordinal, recovery identity, or manifest
identity changes. Existing component tests cover some of those fields, but
the matrix claims fresh-process evidence.

C3 must run separate changed-phase, changed-ordinal, changed-recovery, and
changed-manifest child-process cases and prove no durable mutation after each.

### High — Row 17 substitutes validation evidence but does not substitute a package artifact in a fresh process

The durable process drill correctly substitutes a validation receipt. The
package process case cited for the other half crashes after artifact creation;
it does not alter an artifact digest and invoke an independent verifier.

C3 must mutate one bounded package artifact after publication and prove that a
fresh verifier returns `FAIL_CLOSED`.

### Accepted — Full validation is correct but does not override semantic gaps

The normalized report now counts all registered suites and passes
`2372/2372`. This establishes implementation consistency. Readiness still
depends on each required drill proving its exact declared boundary.

## Required correction

The next task should be:

`Day15-T3B14-C3 — Exact Rehearsal Process Boundary Evidence Correction`

It must add only:

1. assembled child-process crash before rehearsal phase-claim commit;
2. assembled STEP crashes after T6 and after T10 but before rehearsal receipt,
   followed by fresh-process dual-store inspection;
3. fresh-process changed phase, ordinal, recovery, and manifest replay cases;
4. fresh-process package-artifact substitution and independent verification;
5. corrected exact matrix entries and complete validation.

It must reuse the current C2 Worker composition and add no production command,
phase loop, timer, network provider, real Pilot, T1/T2 delivery,
recommendation, broker, order, execution, or capital authority.

After C3, a separate `T3B14-MR4` must determine readiness. C3 approval does
not authorize a rehearsal run.

## Explicitly prohibited

MR3 does not authorize a real rehearsal, general executable phase command,
automatic multi-phase orchestrator, loop, timer, scheduler, daemon, network
request, provider admission, Robinhood automation, real Pilot, T1/T2
delivery, dataset qualification, probability output, recommendation,
Portfolio mutation, broker action, order, execution, or capital behavior.
