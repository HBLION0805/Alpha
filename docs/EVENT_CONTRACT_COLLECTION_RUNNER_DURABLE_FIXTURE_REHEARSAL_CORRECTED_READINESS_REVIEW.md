# Event Contract Collection Runner Durable Fixture Rehearsal Corrected Readiness Review

## Review identity

- Review: `Day15-T3B14-MR2`
- Review date: `2026-07-25`
- Reviewed baseline: `e8f1ec2`
- C1 phase-composition drills: `3/3`
- Durable evidence process drills executed: `14/14`
- Registered complete-validation total: `2346/2346`
- Scope: T3B14-C1 correction against the T3B14-MR1 findings
- Authority: architecture and readiness review only

## Executive decision

T3B14-C1 materially improves the rehearsal foundation. Separate child
processes now execute PREPARE, three foreground STEP invocations, VALIDATE,
FREEZE, PACKAGE, and VERIFY. Fresh verification is bound to registered
validation authority, Pilot completion is explicit, and the reviewed store
rejects mutable repository access after terminal freeze.

The corrected baseline is still not ready for an Owner-approved rehearsal
operation. The clean C1 STEP fixture reaches the real foreground-step boundary
but supplies a test executor that writes task, attempt, evidence, budget, and
Outbox rows directly. It does not compose the reviewed T7/T8/T8B/T10 fixture
Worker transaction chain. In addition, the twenty-requirement matrix maps
several required process drills to coordinator/component tests rather than
fresh OS-process evidence. Finally, the normalized validation report records
the durable evidence process-drill component as zero tests because its summary
line does not match the registered count parser.

Decision:

- `C1_CORE_CORRECTIONS_ACCEPTED`
- `GO_FOR_NARROW_PROCESS_EVIDENCE_CORRECTION`
- `NO_GO_FOR_REHEARSAL_RUN`
- `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`
- `NO_GO_FOR_BOUNDED_LIVE`

## Evidence reviewed

- commit `e8f1ec2` and its complete 21-file boundary;
- the C1 phase child, fixture composition, and two-root process drill;
- durable coordinator, step adapter, foreground step, fixture Worker, SQLite
  store, validation adapter, envelope builder, and fresh verifier;
- the twenty-requirement C1 evidence matrix;
- transaction, ownership-recovery, package, durable-evidence, and C1 process
  drills;
- complete Alpha validation and normalized count reporting;
- provider, network, credential, runtime-data, and capital-authority scans.

## Readiness matrix

| Gate | Result | Review conclusion |
| --- | --- | --- |
| One phase per fresh process | PASS | C1 child selects one closed phase and exits |
| No automatic next phase | PASS | Parent test alone invokes the next child |
| Durable PREPARE | PASS | Existing coordinator and v3 repository are composed |
| Real foreground-step boundary | PASS WITH LIMITATION | Foreground planner and one-action boundary run, but the injected executor bypasses the reviewed Worker transactions |
| Fixed validation adapter | PASS FOR COMPOSITION | Test-owned clean repository avoids recursive Alpha validation |
| Registered validation authority | PASS | Commit, policy, suite fingerprint, and total are matched |
| Terminal freeze | PASS | Claim, transitions, validation identity, and plan commit atomically |
| Post-freeze mutable repository rejection | PASS | Fresh process receives query-only store behavior and no mutable repositories |
| Immutable package and backup verification | PASS | Fresh verifier reconstructs backup truth |
| Two-run scenario identity | PASS | Scenario identity is stable and execution identity differs |
| Twenty required process drills | INCOMPLETE | Several rows cite component tests, not fresh-process drills |
| Normalized validation accounting | INCOMPLETE | Durable evidence `14/14` executes but is reported as zero |
| Exact rehearsal operation | BLOCKED | No reviewed Owner command or complete Worker-composed operation exists |
| Provider or capital authority | BLOCKED | Explicitly outside scope |

## Findings

### High — C1 STEP bypasses the reviewed Worker transaction chain

The C1 composition invokes `EventContractCollectionRunnerRuntimeForegroundStep`
and proves that its planner selects only one action. For the evidence-commit
action, however, the injected fixture executor directly updates
`scheduled_tasks` and inserts attempt, result, normalized evidence, budget,
and Outbox records with local SQL.

This is stronger than the synthetic terminal-state seeding rejected by MR1,
but it does not prove that the assembled phase chain can drive the existing
T7 lease, T8 attempt claim, T8B validation, and T10 commit transaction
boundaries. Those boundaries pass their own process drills, but are not
composed into the C1 clean run.

### High — The twenty-requirement matrix is not entirely process-level

The matrix is useful traceability, but rows including unresolved phase claims,
Stop-after-claim, exact durable phase replay, and changed replay identity
refer to coordinator/component evidence. The architecture requires the
required crash, Stop, replay, and recovery cases to be demonstrated at the
fresh-process boundary.

Passing unit and component tests remain valid; they cannot be relabeled as
process evidence.

### Medium — Complete validation undercounts an executed process suite

The durable evidence process drill prints `14/14`, but its summary wording
does not match the validation-count parser. The normalized report therefore
shows zero tests for that component while still passing the command. The
registered total `2346/2346` is internally consistent with the parser, but it
does not include those fourteen executed drills.

The reporting format or parser must be corrected, covered by a reporting
regression test, and the authoritative complete total regenerated.

### Accepted — Validation authority and frozen-store controls close MR1 gaps

The fresh verifier rejects an otherwise self-consistent passing receipt unless
its repository commit, validation policy, suite fingerprint, and registered
test total match pre-registered authority. A source store containing an
`EVIDENCE_FROZEN` rehearsal enters query-only mode and refuses both mutable
repository factories. These corrections are accepted.

## Required correction

The next task should be:

`Day15-T3B14-C2 — Worker-composed Process Evidence and Validation Accounting Correction`

It must:

1. replace C1's direct-SQL fixture executor with the reviewed fixture Worker
   transaction composition;
2. add fresh-process drills for every matrix row currently supported only by
   a coordinator or component test;
3. preserve one phase and at most one action per process;
4. correct durable-process-drill validation accounting and add a parser
   regression test;
5. regenerate an exact requirement-to-test mapping with test file, case, and
   process boundary;
6. rerun two clean roots and the complete Alpha validation suite;
7. retain test-only, temporary, network-free, synthetic authority;
8. add no phase loop, real Pilot, provider, T1/T2 delivery, recommendation,
   broker, order, execution, or capital authority.

After C2, a separate `T3B14-MR3` must decide whether one exact, separately
Owner-approved network-free rehearsal operation is ready.

## Explicitly prohibited

This review does not authorize a real rehearsal, executable multi-phase
command, loop, timer, scheduler, daemon, network request, provider admission,
Robinhood automation, real Pilot, T1/T2 delivery, dataset qualification,
probability or recommendation output, Portfolio mutation, broker action,
order, execution, or capital behavior.
