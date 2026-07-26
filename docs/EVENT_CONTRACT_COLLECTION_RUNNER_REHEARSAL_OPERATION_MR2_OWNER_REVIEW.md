# Day15-T3B15-MR2 Independent Owner Review

Date: 2026-07-26

Reviewed commit:
`c6d6bc947d066cba16249f48fef11fc0a59cb8d7`

## Decision

`NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`

T3B15-C1 materially strengthens the fixture-only operation-control foundation,
but it does not yet prove that one exact network-free rehearsal can be safely
authorized. This review grants no authority to create a real Operation
Manifest, invoke a rehearsal phase, access a provider or network, activate a
real Pilot, or perform any recommendation, order, execution, or capital action.

## Confirmed C1 closures

- Durable Stop is checked inside the same SQLite transaction as result insert.
- A prior non-`COMPLETED` result cannot advance the normal phase plan.
- `consumed: true` participates in authorization fingerprinting and is required
  when the durable authorization is read.
- Validation receipts are append-only and final verification reconstructs their
  fingerprints and authority fields.
- Final verification checks complete authorization/result history and rejects
  a durable Stop.
- Repository cleanliness includes untracked files.
- Post-ownership readiness inspection is materially stronger than MR1.

## Blocking findings

### High — durable phase truth is not structurally independent

The closed composition routes mutation and observation through the same phase
adapter instance. A defective adapter can return the same fabricated evidence
from both methods. Separate interfaces alone do not prove an independent
read-only reconstruction from durable state.

### High — no closed runnable operation composition exists

There is no production composition root or package command that binds the exact
registry, real five phase adapters, writable Control store, separately reopened
read-only verifier, Owner authentication, Stop, ownership, readiness, and fixed
roots. The current composition is a closed injected map, not a runnable
operation.

### High — Git executable identity remains ambient

Node and npm are resolved to reviewed canonical paths, but Preflight and actual
validation still invoke bare `git` while preserving `PATH`. Commit and
cleanliness evidence can therefore come from an unreviewed executable.

### High — application-level network isolation is not yet sufficient

The guard is trusted-code defense in depth, not independently enforced host
isolation. Remaining bypass classes include inherited guard removal before an
allowed child process, unrestricted worker threads, Python `os.exec*`, and an
incomplete Git subcommand denylist. Current process drills test selected APIs,
not real composed phases or these escape paths.

### High — post-ownership authority retains a TOCTOU interval

The second inspection occurs before authorization and invocation, but relevant
Git/filesystem/root state is neither locked nor content-revalidated at the
mutation boundary. State may drift after inspection and before a phase acts.

## Additional correction requirements

- Define a reviewed Control schema `1.0` to `1.1` migration or explicit safe
  replacement rule. The current open path may add `1.1` objects to a `1.0`
  database and then reject its unchanged metadata.
- Reconcile the cross-transaction crash where a VALIDATE receipt is durable but
  its Control result is absent.
- Add OS-process evidence for read-only Control reopening, fixed Git
  substitution rejection, schema handling, validation-receipt recovery,
  post-inspection drift, closed real composition, and isolation escapes.

## Validation evidence

- TypeScript strict typecheck: PASS
- Operation Manifest/Registry: `31/31`
- Operation Control: `33/33`
- Operation Validation/Verification: `4/4`
- Security process drills: `11/11`
- Complete Alpha validation: `2456/2456`, zero failed
- Git diff checks: PASS
- Reviewed worktree: clean

Passing tests demonstrate regression stability. They do not close the authority,
composition, executable, or isolation findings above.

## Required next task

`Day15-T3B15-C2 — Independent Durable Authority, Fixed Executable, Closed
Runtime Composition, and Isolation Proof Correction`

C2 must:

1. bind mutation and durable observation to different types, concrete
   instances, and independently reopened read-only state;
2. add one closed, non-executed composition root using the real five phase
   adapters and fixed registry/control/Owner/Stop/ownership authorities;
3. execute final verification in a separate process over a query-only reopened
   Control store;
4. bind Git to one reviewed canonical executable;
5. close the post-inspection TOCTOU boundary;
6. define Control `1.0` to `1.1` migration or replacement semantics;
7. reconcile a durable validation receipt without its Control result;
8. provide independently enforced OS isolation or a closed, verified
   trusted-code allowlist with adversarial escape tests; and
9. add process evidence for every correction.

After C2, a new independent T3B15-MR3 is required. Even a future GO decision
would authorize at most a separately Owner-approved single exact rehearsal.
