# Day15-T3B15-MR3 Independent Owner Review

Date: 2026-07-26

Reviewed commit:
`385aa9b6e61c606c84c6cc65c3fab578472ca555`

## Decision

`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`

T3B15-C2 materially improves executable identity, transactionality, authority
drift detection, and trusted-code isolation. It still does not prove one exact
network-free rehearsal through a closed real composition and independently
reopened durable truth. This review grants no authority to create a real
Operation Manifest, invoke a rehearsal phase, access a provider or network,
activate a real Pilot, deliver T1/T2 evidence, or perform any recommendation,
order, execution, or capital action.

## Confirmed C2 closures

- Git is bound to a canonical executable and SHA-256 identity.
- The normal VALIDATE path commits its validation receipt and phase result in
  one SQLite transaction.
- An empty structurally recognized Control `1.0` store can migrate atomically
  to `1.1`, while a non-empty store fails closed before new objects are added.
- The reviewed Node and Python trusted-code guards reject the tested Worker,
  cleared-environment, unregistered-child, spawn, fork, and `os.exec*` paths.
- The Control read-only path enables SQLite `query_only`.
- The production-shaped runtime exposes Preflight, Status, and final
  verification, but no phase-execution method.

## Blocking findings

### High — durable observation is still not proven as independent durable truth

The composition accepts an arbitrary observation implementation and checks
only object-reference separation. The reviewed operation composition does not
construct a concrete observer that independently reopens the rehearsal SQLite
store query-only and reconstructs phase truth. The focused test returns
in-memory evidence, so interface separation is not yet end-to-end proof.

### High — the production-shaped runtime is not a closed real composition

The runtime still receives its roots, stores, adapters, readiness, Owner,
Stop, ownership, executable identities, and verifier authorities from its
caller. It does not itself fix the six registered roots, five real T3B14
mutation adapters, query-only observers, Control store, exact executables, and
fresh-process verifier into one non-executing composition root.

### High — Node and Python identities are path-bound but not digest-bound

Git gained canonical-path and digest verification. Node and Python remain
canonical-path identities without immutable file digests or a recheck bound to
the phase authority. A same-path executable substitution is therefore not
covered by the same authority model.

### High — the authority seal leaves a transient substitution interval

The seal catches persistent drift before authorization and after observation,
but it does not bind an immutable authority snapshot into the phase adapter or
hold verified identities across invocation. A transient substitution between
checks can be restored before the later seal and escape detection.

### High — child and Git allowlists are not exact enough

The bootstrap verifies that guard environment values contain reviewed
fragments rather than exactly matching canonical guard paths and digests. Git
is restricted by its first subcommand, but full arguments and local Git helper
configuration are not closed against external-diff, textconv, fsmonitor, or
similar helper execution.

### High — Control `1.0` migration does not verify the exact legacy schema

Migration checks table names and emptiness, but not exact columns, `STRICT`
definitions, indexes, foreign keys, triggers, or a schema checksum. The test
accepts simplified lookalike tables, so an unknown or altered database can be
misclassified as the reviewed legacy schema.

### High — standalone validation-receipt persistence remains reachable

The corrected normal path is atomic, but the public standalone
`appendValidationReceipt` path remains available and is used by a verification
test. Existing `1.1` stores containing a receipt without its bound result have
no explicit detection and recovery rule.

### High — no fresh-process final verifier proves both durable stores

The security inspection child reopens Control query-only, but only emits a
snapshot. The final verification test still uses the same process and a
writable store with test-supplied history. It does not independently reopen
both rehearsal and Control stores query-only and verify the complete package.

### Medium — process evidence does not exercise the corrected real composition

There is no OS-process evidence for the closed real composition, exact legacy
migration, fixed executable digests, transient authority drift, atomic
VALIDATE crash boundary, exact guard/Git helper allowlists, or fresh-process
final verification over both durable stores.

## Validation evidence

- TypeScript strict typecheck: PASS
- Operation Control: `40/40`
- Operation Validation/Verification: `4/4`
- Security process drills: `11/11`
- Complete Alpha validation: `2463/2463`, zero failed
- Git diff checks: PASS
- Reviewed `main` and `origin/main`:
  `385aa9b6e61c606c84c6cc65c3fab578472ca555`
- Reviewed worktree: clean

Passing tests confirm C2 regression stability. They do not replace the missing
closed composition, exact executable/schema authority, independent durable
observation, or fresh-process verification evidence.

## Required next task

`Day15-T3B15-C3 — Closed Durable Composition, Exact Authority, Migration, and
Fresh-process Verification Correction`

C3 must:

1. construct real phase mutation adapters and separate concrete query-only
   durable observers;
2. close one fixed non-executable composition over all six roots, both stores,
   Owner, Stop, ownership, exact executables, and verifier authorities;
3. digest-bind and recheck Git, Node, Python, and guard files;
4. bind the immutable authority snapshot into the phase boundary and close
   transient substitution races;
5. migrate only an exact verified Control `1.0` schema;
6. remove standalone validation-receipt writes and define orphan detection and
   recovery for existing `1.1` stores;
7. enforce exact guard paths and complete child/Git invocation allowlists;
8. add true separate-process, query-only final verification over rehearsal and
   Control durable evidence; and
9. add adversarial OS-process evidence for every correction.

After C3, a new independent T3B15-MR4 is required. One exact rehearsal remains
blocked unless that review explicitly returns
`GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.
