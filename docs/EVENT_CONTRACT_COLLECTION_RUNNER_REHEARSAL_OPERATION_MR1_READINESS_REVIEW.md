# Event Contract Collection Runner Rehearsal Operation MR1 Readiness Review

## Review identity

- Review: `Day15-T3B15-MR1`
- Review date: `2026-07-26`
- Reviewed baseline: `483d4e346a03931ead9a1ff15ff71b7d45b3cba8`
- Review method: independent read-only implementation, threat-model,
  process-matrix, and validation review
- Focused tests: manifest/registry `31/31`, operation control `26/26`,
  validation/verification `4/4`, security process drills `9/9`
- Complete Alpha validation: `2447/2447`
- Authority: readiness review only

## Executive decision

T3B15-T1 through T3B15-T5 establish useful deterministic operation-control
foundations, and all registered tests pass. They do not yet satisfy the
approved boundary for one exact Owner-gated network-free rehearsal.

The independent review found that authority can drift after Preflight,
in-flight Stop can race a completed result, phase evidence is not independently
reread, and final verification does not reconstruct the operation validation
receipt or inspect the authorization/result/Stop ledger. Fixed validation is
still influenced by ambient executable resolution, untracked files are
excluded from cleanliness checks, and the network guard is a runtime-level
defense rather than an independently enforced isolation boundary. There is
also no closed production composition root for the command.

Decision:

- `T3B15_OPERATION_FOUNDATION_NOT_ACCEPTED_FOR_REHEARSAL`
- `GO_FOR_T3B15_C1_CORRECTION`
- `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`
- `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`
- `NO_GO_FOR_BOUNDED_LIVE`

No Operation Manifest may be created or approved and no rehearsal may run on
this decision.

## Acceptance assessment

| T3B15 acceptance criterion | Result |
| --- | --- |
| Separate design, implementation, review, and run authorization | PASS |
| One immutable manifest binds one clean commit and rehearsal | PARTIAL — untracked files are excluded |
| Registered fixed roots; no caller-selected paths | PASS AT CONTRACT BOUNDARY |
| Fresh Owner authentication for every mutable phase | PASS |
| One authorization, phase, and process | PARTIAL — post-ownership state is not revalidated |
| No next-phase invocation or inference | PARTIAL — non-completed results can advance plan count |
| Actual complete Alpha validation with exact accounting | PARTIAL — executable resolution is ambient |
| Stop precedence and crash ambiguity | PARTIAL — Stop during phase/result race is uncovered |
| Existing phase/recovery/evidence authority is reused | PARTIAL — returned phase evidence is trusted |
| Sanitized receipts and fresh-process Owner report | FAIL — injected receipt is trusted and Control ledger omitted |
| Network-free, fixture-only, local, non-capital authority | PARTIAL — runtime guards are not isolation proof |
| Closed executable composition exists | NOT IMPLEMENTED |

## High findings

### 1. Authority is not revalidated after ownership acquisition

The gate performs Preflight before authentication, acquires ownership, checks
only Stop, and then consumes authorization. The SQLite transaction checks Stop
and local ledger ordering but cannot prove the external manifest, commit,
roots, lifecycle, recovery, or approval state has not changed.

Evidence: specification line 448;
`EventContractCollectionRunnerRehearsalOperationControlEngine.ts` around line
649; `EventContractCollectionRunnerRehearsalOperationControlSqliteStore.ts`
around line 381.

### 2. Stop can race phase completion and result commit

Stop is checked immediately before phase invocation, but not after the phase
returns or inside `appendResult`. A Stop committed while the phase is running
can coexist with a later `COMPLETED` result. T5 does not cover Stop during
phase execution or immediately before result commit.

Evidence: `EventContractCollectionRunnerRehearsalOperationControlEngine.ts`
around line 718;
`EventContractCollectionRunnerRehearsalOperationControlSqliteStore.ts` around
line 433; security process drill around line 231.

### 3. Phase results are not independently reread from durable truth

The phase gate validates selected fields from injected phase evidence and
writes a result from that object. It has no independent port that reopens
lifecycle, claim, receipt, Outbox, and artifact truth after the phase.

Evidence: `EventContractCollectionRunnerRehearsalOperationControlEngine.ts`
around lines 488 and 719.

### 4. Final verification trusts injected validation receipts

The fresh verifier accepts validation receipt objects through its constructor,
indexes them by the supplied fingerprint, and does not reconstruct the
fingerprint or fully verify commit, package, suite, policy, network,
credential, timing, exit, and output bindings. The passing test constructs an
incomplete receipt through a type assertion.

Evidence: `EventContractCollectionRunnerRehearsalOperationVerification.ts`
around lines 372 and 403; its test around line 161.

### 5. Final verification omits the operation Control ledger

The verifier never opens the T3B15 Control-root SQLite ledger. It therefore
cannot reject an unresolved authorization, missing result, durable Stop, or
substituted operation history, contrary to the authorization/result-history
requirement.

Evidence: specification lines 494-507;
`EventContractCollectionRunnerRehearsalOperationVerification.ts` around line
372.

### 6. Fixed validation executable resolution remains ambient

The adapter can use parent-process `npm_execpath`; otherwise non-Windows
execution resolves bare `npm` through inherited `PATH`. The executable is not
entirely selected by reviewed, registered identity.

Evidence: `EventContractCollectionRunnerRehearsalOperationVerification.ts`
around lines 135 and 158.

### 7. Clean-tree checks ignore untracked files

Preflight and validation use
`git status --porcelain --untracked-files=no`. Untracked configuration,
modules, or source can affect execution while the operation reports clean.

Evidence: `EventContractCollectionRunnerRehearsalOperationPreflight.ts` around
line 80; `EventContractCollectionRunnerRehearsalOperationVerification.ts`
around line 230.

### 8. Network denial is not an independently enforced isolation boundary

The Node and Python bootstraps are useful defense-in-depth, but patch selected
runtime APIs. They do not prove denial for native subprocesses, another
runtime, or an unpatched path. T5 probes one Node socket and one Python socket
path, while Preflight reports capability absence without inspecting concrete
phase composition.

Evidence: `scripts/network-disabled-bootstrap.cjs` around line 11;
`scripts/network-disabled-python/sitecustomize.py` around line 14; Preflight
around line 324; security process drill around line 371.

### 9. No closed operation composition or executable command exists

The console is a dependency-injected function. Fixed roots, registry, Control
store, Stop, ownership, validation, final verifier, and T3B14 adapters are not
assembled in one reviewed composition root, and no package command starts only
this boundary.

Evidence: `EventContractCollectionRunnerRehearsalOperationControlConsole.ts`
around lines 34 and 144; current `package.json` scripts.

### 10. Authorization consumption is not fingerprint-protected

`consumed: true` is added after the authorization body fingerprint is
calculated. Read validation excludes it from reconstruction and does not
independently require it to be true.

Evidence: `EventContractCollectionRunnerRehearsalOperationControlEngine.ts`
around line 465;
`EventContractCollectionRunnerRehearsalOperationControlSqliteStore.ts` around
line 214.

## Medium finding

### Non-completed results can advance the phase plan

Preflight treats authorization/result count equality as sufficient progress.
A `FAILED_CLOSED`, `RECOVERY_REQUIRED`, or `INCOMPLETE` result increments the
count and may make the next phase eligible. Only a semantically successful
result may advance the normal plan.

Evidence: `EventContractCollectionRunnerRehearsalOperationControlEngine.ts`
around line 533;
`EventContractCollectionRunnerRehearsalOperationControlSqliteStore.ts` around
line 392.

## Validation interpretation

The independent review verified strict TypeScript typecheck, the `31/31`,
`26/26`, `4/4`, and `9/9` focused suites, complete `2447/2447` Alpha
validation, Git whitespace checks, and a clean reviewed baseline.

Those results prove stability under registered tests. They do not cover
post-ownership drift, Stop during phase/result commit, forged validation
receipts, Control-ledger final verification, non-completed plan advancement,
executable substitution, untracked influence, or network-isolation bypass.

## Recommended correction stage

The next task should be:

`Day15-T3B15-C1 — Operation Authority, Verification, Isolation, and Process
Evidence Correction`

C1 must:

1. revalidate all authoritative state after ownership and before authorization;
2. atomically define and enforce Stop semantics at result commit;
3. independently reread and reconcile durable phase truth;
4. reconstruct validation receipts from durable content-addressed evidence;
5. verify exact authorization/result/Stop histories from the fixed Control root;
6. bind validation to a reviewed executable and reject influential untracked files;
7. strengthen and independently attest network isolation;
8. add one closed composition root without creating a real manifest;
9. fingerprint and validate every authorization field;
10. prevent non-completed results from advancing the normal phase plan;
11. add fresh-process adversarial tests for every finding.

After C1, a new independent `T3B15-MR2` is required. Only an explicit
`GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL` from that later review may permit a
separate Owner authorization for one rehearsal.

## Explicitly prohibited

MR1 does not authorize a real Operation Manifest, any rehearsal phase, a
complete rehearsal, automatic recovery/replay, continuous runtime, network or
provider access, Robinhood automation, credentials, real Pilot activation,
T1/T2 delivery, dataset qualification, recommendation, broker, order,
execution, or capital behavior.
