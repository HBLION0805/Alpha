# Event Contract Collection Runner Durable Fixture Rehearsal MR4 Readiness Review

## Review identity

- Review: `Day15-T3B14-MR4`
- Review date: `2026-07-25`
- Reviewed baseline: `fa5836b`
- C1 phase-composition drills: `3/3`
- C2 Worker/claim/Stop/replay drills: `5/5`
- C3 exact process-boundary drills: `5/5`
- Runtime transaction-boundary drills: `11/11`
- Durable evidence process drills: `14/14`
- Package process drills: `4/4`
- Complete Alpha validation: `2377/2377`
- Scope: independent review of C3 and the complete T3B14 durable fixture
  rehearsal foundation
- Authority: architecture and readiness review only

## Executive decision

T3B14 now satisfies its deterministic foundation and process-evidence
acceptance criteria. C1 composes one phase per process, C2 invokes the real
fixture Worker transaction chain, and C3 closes the exact pre-claim,
post-T6/pre-receipt, post-T10/pre-receipt, changed-replay, and
package-substitution boundaries. The twenty required drills now map to
matching process evidence, and complete validation passes `2377/2377`.

This does not make the test fixture an approved rehearsal operation. The
current entry point is under `scripts/fixtures`, accepts test-owned temporary
roots, uses a generated one-test validation repository, and has no
Owner-authenticated manifest/phase command surface. Invoking it outside its
test harness would bypass the operation authority described by the
architecture.

Decision:

- `DURABLE_FIXTURE_REHEARSAL_FOUNDATION_ACCEPTED`
- `TWENTY_PROCESS_DRILLS_ACCEPTED`
- `GO_FOR_EXACT_OWNER_GATED_REHEARSAL_OPERATION_DESIGN`
- `NO_GO_FOR_REHEARSAL_EXECUTION`
- `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`
- `NO_GO_FOR_BOUNDED_LIVE`

## Acceptance assessment

| T3B14 acceptance criterion | Result |
| --- | --- |
| Durable registry survives process boundaries | PASS |
| Projection and append-only history reconcile | PASS |
| One invocation performs one exact phase | PASS |
| One STEP performs at most one foreground action | PASS |
| No phase arranges the next phase | PASS |
| Crash ambiguity preserves exact durable truth | PASS |
| Stop precedes every mutable phase | PASS AS PROCESS FAULT EVIDENCE |
| Rehearsal profile is new-store and fixture-only | PASS |
| Online backup and manifest are immutable and bound | PASS |
| Fresh verifier reconstructs backup truth | PASS |
| Validation comes from the fixed adapter | PASS FOR COMPOSITION |
| Two clean roots preserve scenario truth | PASS |
| All twenty process drills map to matching evidence | PASS |
| Complete Alpha validation passes | PASS — `2377/2377` |
| Test implementation and rehearsal execution remain separate | PASS |
| Owner-gated executable rehearsal operation exists | NOT IMPLEMENTED |

## Findings

### Accepted — C3 closes every MR3 process-evidence finding

The pre-claim child exits after request and durable-state validation but before
`claimStep`. The post-T6 and post-T10 children exit after the exact foreground
transaction and before `completeStep`, allowing a fresh process to reconstruct
both Runner and rehearsal state. Four changed-replay children cover phase,
ordinal, recovery fingerprint, and manifest fingerprint. A separate child
changes a published package artifact before a fresh verifier returns
`FAIL_CLOSED`.

These are matching process boundaries rather than renamed component tests.

### Accepted — C2 Worker and validation-accounting corrections remain sound

The clean STEP sequence reaches the reviewed T7, T8, T8B, and T10 repository
transactions and leaves one committed evidence record with no live lease.
Normalized validation counts `drills passed` output and includes all
registered process suites.

### High boundary — The test fixture is not an Owner-gated rehearsal operation

The C1/C2/C3 phase child is a test-only fault and composition harness. It:

- accepts a temporary root selected by the test parent;
- constructs hard-coded synthetic identities;
- creates a separate one-test Git repository for validation;
- exposes test-only crash and substitution modes;
- does not verify an immutable Owner-approved operation manifest;
- does not authenticate an Owner phase command;
- does not bind an invocation to the actual clean Alpha commit and complete
  validation suite.

Those properties are appropriate for deterministic tests and inappropriate
for a rehearsal operation. MR4 therefore accepts the foundation while
retaining `NO_GO_FOR_REHEARSAL_EXECUTION`.

## Recommended next stage

The next task should be design-only:

`Day15-T3B15-T1 — Exact Owner-Gated Network-Free Rehearsal Operation Architecture`

It must define:

1. one immutable rehearsal operation manifest bound to the exact Alpha commit,
   approved fixture catalog entry, runtime build, provider mapping, roots,
   phase sequence, validation suite, test total, and expiry;
2. a local Owner-authenticated command that invokes exactly one phase and
   exits;
3. fixed registered roots rather than caller-selected paths;
4. actual clean Alpha validation rather than the one-test validation fixture;
5. an explicit preflight/status surface and durable phase receipt;
6. Stop, ownership, restart, recovery, and no-repeat behavior;
7. a final fresh-process verifier invocation and sanitized Owner report;
8. a separate implementation review and a separate explicit authorization
   before any rehearsal execution.

The design must add no phase loop, timer, polling, background runtime, network
request, provider discovery, real Pilot, T1/T2 delivery, recommendation,
broker, order, execution, or capital authority.

## Explicitly prohibited

MR4 does not authorize:

- invoking the fixture child as a rehearsal operation;
- executing or claiming one complete rehearsal;
- a general start/run command or automatic multi-phase orchestrator;
- a loop, timer, scheduler, daemon, polling, retry orchestration, or service;
- network access, future-market discovery, or Robinhood automation;
- a real Pilot, T1/T2 delivery, or dataset qualification;
- probability output, recommendation, sizing, Portfolio mutation, broker,
  order, execution, or capital behavior.
