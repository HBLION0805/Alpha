# Exact Owner-Gated Network-Free Rehearsal Operation Architecture v1

## Status

- Task: `Day15-T3B15-T1`
- Mode: implementation through C3; independent MR4 returns NO-GO; no rehearsal authority
- Reviewed baseline: `43bcca8ee62a313be744e6e6d6e3349704e429e4`
- T3B15-T1: committed and pushed as `b27687c`
- T3B15-T2: committed and pushed as `f42e482`
- T3B15-T3: committed and pushed as `21d263f`
- T3B15-T4: committed and pushed as `b682921`
- T3B15-T5: committed and pushed as `483d4e3`
- T3B15-MR1: committed and pushed as `217d0ba`; returns
  `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`
- T3B15-C1: committed and pushed as `c6d6bc9`
- T3B15-MR2: committed and pushed as `8e20a23`; returns
  `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`
- T3B15-C2: committed and pushed as `385aa9b`
- T3B15-MR3: committed and pushed as `6746947`; returns
  `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`
- T3B15-C3: committed and pushed as `43bcca8`
- T3B15-MR4: complete locally; returns
  `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`
- Rehearsal execution: not authorized
- Authority: local fixture-rehearsal operation design only
- T5/MR1 validation baseline: complete Alpha bundle passes `2447/2447`
- C1 validation: complete Alpha bundle passes `2456/2456`
- C2 validation: focused suites pass `40/40`, `4/4`, and `11/11`; complete
  Alpha bundle passes `2463/2463`
- C3/MR4 validation: focused suites pass `3/3`, `42/42`, `4/4`, `11/11`,
  `19/19`, and `6/6`; complete Alpha bundle passes `2469/2469`

This design follows the T3B14-MR4 decision:

`DURABLE_FIXTURE_REHEARSAL_FOUNDATION_ACCEPTED /
TWENTY_PROCESS_DRILLS_ACCEPTED /
GO_FOR_EXACT_OWNER_GATED_REHEARSAL_OPERATION_DESIGN /
NO_GO_FOR_REHEARSAL_EXECUTION /
NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME /
NO_GO_FOR_BOUNDED_LIVE`

T3B15-T1 changes documentation only. It does not create a command, database
migration, credential, runtime root, operation manifest, rehearsal record, or
evidence package, and it does not invoke any rehearsal phase.

## T3B15-T2 implementation

T3B15-T2 implements only the immutable contract and read-only registry
foundation:

- exact closed records for six fixed root purposes, filesystem inspection
  identities, validation authority, phase plans, manifest proposals,
  proposal-bound Owner approvals, final manifests, and registry snapshots;
- deterministic content-addressed construction with recursive freezing and
  unknown-field rejection;
- exact root completeness, uniqueness, canonical-path, disjointness,
  creation-policy, and no-link/reparse evidence checks;
- fixed actual-Alpha validation authority with a full Git commit, clean-tree
  requirement, exact package/suite/test-total identities, fixed command and
  recursion policy, and no network or credential permission;
- closed normal phase order with contiguous STEP ordinals and RECOVER reserved
  for the separately gated recovery path;
- an immutable registry that verifies root, fixture catalog,
  provider/mapping, Runner/plan, validation, rehearsal, and approval bindings
  and exposes defensive read-only queries;
- `31/31` focused deterministic tests.

T2 adds no Migration 004. One-use phase authorization, consumption, and result
transactions belong to T3B15-T3 after separate Owner review. T2 performs no
filesystem inspection or mutation, local authentication, command execution,
phase invocation, validation process, evidence construction, or rehearsal.

## T3B15-T3 implementation

T3B15-T3 implements the network-free local control boundary:

- closed immutable phase and Stop commands with exact manifest, commit, root,
  lifecycle, ordinal, recovery, process, time, and nonce bindings;
- a five-minute maximum command lifetime and the existing stdin-only scrypt
  Owner verifier;
- fixed-root resolution through registered IDs plus current non-link
  filesystem inspection;
- read-only repository/package/suite inspection, deterministic Preflight, and
  bounded sanitized Status;
- a fixed `rehearsal-operation-control.sqlite3` ledger under `CONTROL_ROOT`
  with append-only authorization, result, and Stop tables;
- `BEGIN IMMEDIATE` one-use authorization consumption, strict phase-plan
  ordering, replay rejection, and unresolved-authorization ambiguity;
- Stop-before-ownership, Stop-before-authorization, and Stop-before-phase
  checks, exclusive ownership, exactly one injected phase call, validated
  phase evidence, and one durable result;
- `26/26` focused deterministic and SQLite persistence tests.

The Control-root ledger is separate from the rehearsal-profile store because
PREPARE must be authorized before that store exists. It owns no Runner,
rehearsal lifecycle, evidence, or execution truth. T3 does not compose VERIFY,
run actual Alpha validation, create a real manifest, invoke a rehearsal, or
grant network, provider, recommendation, order, execution, or capital
authority. RECOVER, VALIDATE, and VERIFY fail closed until their separately
reviewed reconciliation, validation, and verification bindings exist.

## Purpose

T3B14 proves the durable fixture-rehearsal components and their exact process
boundaries. Its executable child is intentionally a test harness. It accepts
test-owned roots, hard-coded synthetic identities, fault modes, and a generated
one-test validation repository. Those properties must not become operational
authority.

T3B15 defines the missing local control boundary for one future, separately
approved rehearsal:

1. an immutable Owner-approved operation manifest;
2. registered fixed roots rather than caller-selected paths;
3. local Owner authentication bound to one exact command;
4. exactly one closed phase per foreground process;
5. validation of the actual clean Alpha commit and complete registered suite;
6. durable authorization and result evidence;
7. fail-closed Stop, restart, recovery, and replay behavior;
8. a fresh-process verifier and bounded Owner report.

## Non-authority statement

Even a successful future operation would prove only that one frozen,
network-free, synthetic fixture scenario can pass the reviewed local Alpha
rehearsal and evidence boundaries.

It would not prove:

- current or future Kalshi or Robinhood market availability;
- Robinhood quote, fee-preview, session, or order integration;
- live network timing, rate-limit, credential, or provider behavior;
- complete T1 observations, T2 ledger delivery, or dataset qualification;
- probability accuracy, calibration, edge, expected return, or profitability;
- recommendation, allocation, sizing, Portfolio mutation, broker, order,
  execution, or capital authority.

The exact versioned declaration must appear in every operation manifest,
authorization receipt, phase receipt, evidence envelope, verification result,
status report, and Owner completion report.

## Design decision

The first operation is a local foreground utility with these fixed properties:

- one preconstructed immutable operation manifest;
- one exact clean Alpha commit;
- one reviewed fixture catalog entry and mapping;
- one registered control root, workspace root, SQLite root, backup root,
  evidence root, and validation repository root;
- one synthetic fixture-only Runner, Pilot, and task set;
- one closed phase per Owner-authenticated invocation;
- one process per phase, followed by process exit;
- no command that performs multiple phases;
- no automatic selection or invocation of the next phase;
- no network, URL, provider discovery, credential, or external write;
- no loop, timer, polling, wait, retry orchestrator, daemon, service, or
  background process.

The operation layer authorizes and records a phase. It does not replace the
T3B14 coordinator, Runner SQLite repository, recovery control, Stop barrier,
validation adapter, backup builder, package publisher, or verifier.

## Authority topology

```text
Reviewed Alpha commit + registered roots + fixture catalog
                         |
                         v
             Immutable operation manifest
                         |
                         v
       Local Owner authentication for one command
                         |
                         v
        Durable one-use phase authorization receipt
                         |
                         v
      One foreground process invokes one closed phase
                         |
                         v
       Existing T3B14 durable phase/evidence boundary
                         |
                         v
          Durable operation-phase result receipt
                         |
                         v
        Fresh-process independent verification
                         |
                         v
                Sanitized Owner report
```

No caller-supplied record, path, test count, Git identity, or success flag may
replace an authority in this chain.

## Source-of-truth ownership

| Concern | Source of truth |
| --- | --- |
| Reviewed source and validation definition | exact clean Alpha Git commit |
| Allowed filesystem locations | immutable local root registry |
| Fixture scenario and native mapping | reviewed fixture catalog entry |
| Permitted operation and phase sequence | immutable operation manifest |
| Owner identity verification | pre-provisioned local Owner verifier |
| Current rehearsal and Runner state | rehearsal-profile SQLite store |
| Stop and recovery authorization | existing durable recovery-control state |
| One-use command authority | durable operation authorization receipt |
| Phase outcome | durable operation result plus T3B14 phase evidence |
| Validation outcome | fixed Alpha validation receipt |
| Portable evidence | immutable evidence envelope |
| Final disposition | fresh-process verifier result |

The operation registry does not duplicate Runner, Pilot, task, attempt, lease,
Outbox, rehearsal lifecycle, backup, or package truth.

## Immutable operation manifest

### Required identity

The future manifest must contain only allow-listed fields and bind:

- schema, policy, command, validation, and non-authority versions;
- operation ID and rehearsal ID;
- exact 40-character Alpha commit;
- required clean-tree policy;
- runtime build fingerprint;
- fixture catalog entry ID and fingerprint;
- provider descriptor and exact mapping fingerprints;
- Runner definition, frozen plan, synthetic Pilot, and task-set fingerprints;
- registered root IDs and their registry fingerprint;
- exact store profile and migration/catalog identities;
- exact ordered phase plan and maximum invocation count;
- validation command policy, suite fingerprint, and registered test total;
- planned backup, package, envelope, and retention identities;
- Owner identity, approval evidence identity, approval time, and expiry;
- deterministic operation-manifest fingerprint.

Unknown fields, missing bindings, mutable references, expired approval, a
changed commit, changed suite, changed root registry, or changed fixture
catalog fail closed.

### Immutability and approval

- The manifest is content-addressed and append-only.
- Approval applies to one exact manifest fingerprint, not an operation name.
- A changed field requires a new manifest and new Owner approval.
- Approval expiry cannot be extended in place.
- A manifest is valid for one rehearsal identity and cannot authorize a
  second run.
- Approval to implement this architecture does not approve a manifest.
- Approval of an operation implementation does not approve a rehearsal.

## Registered fixed roots

### Registry boundary

The operation command accepts root IDs only. It never accepts an absolute
path, relative path, workspace name, database filename, executable path, or
environment-derived override.

The trusted composition root resolves these immutable registrations:

- `CONTROL_ROOT`;
- `WORKSPACE_ROOT`;
- `SQLITE_ROOT`;
- `BACKUP_ROOT`;
- `EVIDENCE_ROOT`;
- `ALPHA_REPOSITORY_ROOT`.

Every entry binds a canonical path identity, purpose, filesystem identity,
creation policy, and registry fingerprint.

### Filesystem rules

- roots must be local, canonical, and pairwise disjoint where required;
- repository, runtime, backup, and evidence roots cannot overlap;
- UNC paths, traversal, alternate data streams, substitutions, and unresolved
  segments are rejected;
- symlinks, junctions, mount-point redirection, and reparse points fail closed;
- derived child names come only from the manifest fingerprint;
- an unexpected pre-existing child is preserved and blocks creation;
- incomplete work is quarantined by identity-preserving same-filesystem
  rename, never recursively deleted or silently reused.

## Local Owner authentication

### Secret handling

The operation reuses the reviewed local Owner-verifier pattern:

- the secret enters through standard input only;
- it never appears in arguments, environment values, files, logs, receipts,
  status, exceptions, or evidence packages;
- verification uses the fixed reviewed `scrypt` policy and constant-time
  comparison;
- request and verifier files must be regular non-link files;
- authentication failure is generic and grants no state information.

Credential provisioning, rotation, recovery, remote authentication, and
commercial multi-user identity are outside this architecture.

### Exact command challenge

Authentication must bind all of:

- command schema and command ID;
- operation-manifest fingerprint;
- selected phase;
- expected rehearsal lifecycle version and phase;
- expected invocation ordinal or explicit `null`;
- expected recovery fingerprint;
- current Alpha commit;
- root-registry fingerprint;
- current boot and newly minted process-session identities;
- command creation and expiry;
- unique challenge nonce and command fingerprint.

Changing any field requires new authentication. A successful authentication
cannot be replayed by another process, boot, phase, ordinal, manifest, or
commit.

## Closed command surface

The future local command surface may expose only:

- `preflight` — read-only eligibility report;
- `status` — read-only sanitized state report;
- `phase` — authenticate and invoke one named phase;
- `stop` — authenticate and request graceful or Emergency Stop;
- `verify` — read-only fresh-process envelope verification.

There is no `start`, `run`, `run-all`, `continue`, `next`, `watch`, `serve`,
`daemon`, `schedule`, or caller-configured retry command.

### Phase command

`phase` accepts only registry and identity fields:

- operation-manifest ID and fingerprint;
- closed phase enum;
- expected lifecycle version;
- expected ordinal or `null`;
- expected recovery fingerprint;
- command ID, creation time, and expiry.

It accepts no paths, arbitrary JSON, SQL, shell text, executable, environment
override, URL, provider, credential, payload, delay, interval, retry count,
fault mode, probability, position, order, or capital value.

Allowed phases remain:

- `PREPARE`;
- `STEP`;
- `RECOVER`;
- `VALIDATE`;
- `FREEZE`;
- `PACKAGE`;
- `VERIFY`.

Every mutable phase requires fresh Owner authentication. `RECOVER` additionally
requires the existing exact recovery evidence and decision boundary. One
process invokes one phase and exits regardless of success, failure, or
incomplete state.

## Operation authorization and receipts

### Durable one-use authorization

Before a mutable phase starts, one named `BEGIN IMMEDIATE` transaction must:

1. verify the operation manifest and approval;
2. verify exact phase, lifecycle, ordinal, recovery, commit, root, boot, and
   process-session bindings;
3. verify the absence of a durable or process-local Stop;
4. verify there is no prior conflicting authorization or result;
5. append one immutable one-use authorization;
6. record its consumed status and operation claim atomically.

The authorization is not a Runner lease and cannot mutate Runner authority.
If consumption is ambiguous, the phase cannot be repeated until explicit
recovery proves the result.

### Result receipt

After the selected phase, the operation must independently reread durable
truth and append a sanitized immutable result containing:

- exact authorization, manifest, command, phase, ordinal, process, and boot
  identities;
- prior and resulting rehearsal lifecycle/version/fingerprint;
- referenced T3B14 claim, receipt, failure, validation, freeze, backup,
  package, or verification identities as applicable;
- start, end, exit, and disposition metadata;
- sanitized output digest;
- non-authority declaration version;
- result fingerprint.

It contains no secret, raw payload, evidence body, account, position, P&L,
probability, recommendation, order, or provider credential.

## Preflight

`preflight` is read-only and returns `ELIGIBLE`, `BLOCKED`, or `INCOMPLETE`.
It must verify:

- the exact current Git commit equals the manifest commit;
- tracked source is clean, with no staged or unstaged change;
- the Alpha repository root and package definition match registered identity;
- the validation policy, suite fingerprint, and registered total match;
- the operation manifest, Owner approval, catalog, mapping, runtime build,
  root registry, and expiry are valid;
- all required roots are canonical, safe, and correctly disjoint;
- the store is absent for `PREPARE` or exact for later phases;
- schema, migration, recovery, integrity, ownership, clock, Stop, lifecycle,
  ordinal, and unresolved-claim state permit only the requested phase;
- no network-capable or caller-selected transport is composed.

Preflight cannot create directories, open a mutable repository, acquire
ownership, authenticate a phase, repair state, or infer success.

## Status

`status` is a bounded read-only projection. It may expose:

- operation, manifest, rehearsal, phase, lifecycle, and ordinal identities;
- approval validity and expiry without verifier material;
- Git/validation/root/store readiness states;
- Stop, ownership, recovery, ambiguity, and terminal dispositions;
- sanitized receipt, backup, envelope, and verification identities;
- blockers and the only eligible next phase, if exactly one exists;
- the non-authority declaration.

It must not expose secrets, verifier hashes, raw payloads, fixture bodies,
normalized evidence, account data, P&L, probabilities, recommendations, or
orders. Status never invokes the next phase.

## Actual Alpha validation authority

The `VALIDATE` phase must validate the actual registered Alpha repository,
not a generated or copied test repository.

The fixed adapter must:

- use the exact manifest commit and require a clean tree;
- invoke only the version-controlled Alpha validation bundle through a fixed
  executable and fixed arguments without a shell string;
- prohibit caller-selected executables, arguments, working directories, test
  filters, or environment overrides;
- run with network access absent and credentials unavailable;
- bind package and validation-policy fingerprints before execution;
- capture exit status, registered total, passed/failed counts, start/end time,
  and a bounded sanitized output digest;
- fail closed on timeout, signal, missing total, unexpected suite, dirty tree,
  commit drift, nonzero exit, output overflow, or process ambiguity.

The validation bundle must not invoke this operation command, a rehearsal
phase, or itself recursively. An explicit process marker and fixed validation
policy reject recursion.

The manifest's registered total is an exact reviewed expectation, not a
minimum. A changed total requires a new manifest and Owner approval.

## Gate ordering

Each mutable invocation follows this order:

1. parse and strictly validate the closed command;
2. resolve the registered manifest and roots;
3. run read-only preflight;
4. verify exact local Owner authentication;
5. trip no mutation if Stop is already present;
6. acquire exact exclusive process ownership;
7. mint and bind the process session;
8. reopen and revalidate manifest, commit, roots, store, recovery, and Stop;
9. atomically consume one phase authorization;
10. recheck Stop immediately before the phase boundary;
11. invoke exactly one existing T3B14 phase;
12. independently reread authoritative durable truth;
13. atomically append the operation result;
14. close resources;
15. release ownership only after verified clean completion;
16. emit one sanitized report and exit.

`PREPARE` uses the reviewed exclusive creation/quarantine path. `PACKAGE` reads
the frozen source store and publishes separately. `VERIFY` is always a fresh
read-only process and creates no mutable authorization.

## Stop, crash, restart, and recovery

- The irreversible process-local Stop barrier is checked before ownership,
  authorization, every mutation, and phase invocation.
- Durable Stop has precedence over approval, authorization, claim, recovery,
  packaging, and any eligible next phase.
- A crash before authorization commit means the operation phase did not
  start.
- A crash after authorization consumption is never automatically retried.
- A fresh process must reconcile the authorization, T3B14 claim/result,
  Runner state, rehearsal state, Outbox, Stop, and artifacts.
- Only proven exact success may append a recovered result.
- Unknown or conflicting truth remains `RECOVERY_REQUIRED` or
  `FAILED_CLOSED`.
- Old boot, process-session, command, authentication, and authorization
  identities cannot be reused after restart.
- Ownership is never auto-stolen or deleted. Verified stale ownership follows
  the existing authenticated quarantine boundary.
- A terminal operation or rehearsal cannot reopen. A new attempt requires a
  new manifest, rehearsal identity, and Owner approval.

## Fresh-process verification and Owner report

`VERIFY` starts with no mutable store or prior process object. It receives only
the registered evidence-root ID plus expected manifest and envelope
fingerprints.

It must:

- resolve the fixed evidence root;
- reject link, reparse, traversal, missing, or extra-file conditions;
- recompute every artifact length and digest;
- reopen the backup read-only;
- verify schema, migration, store, rehearsal, Runner, Pilot, task, attempt,
  evidence, Outbox, validation, freeze, package, and authorization/result
  histories;
- verify the exact Alpha commit, validation authority, registered total, root
  registry, fixture catalog, Owner approval, and non-authority declaration;
- return only `PASS`, `FAIL_CLOSED`, or `INCOMPLETE`.

The sanitized Owner report includes exact identities, phase chronology,
validation counts, artifact digests, verifier disposition, blockers, and the
non-authority declaration. `PASS` is evidence of this fixture operation only.

## Threat model

The implementation must fail closed against:

- manifest, approval, fixture, mapping, build, commit, suite, or test-total
  substitution;
- caller-selected or environment-substituted paths;
- symlink, junction, reparse-point, traversal, or root overlap;
- command-field injection, unknown fields, shell construction, or executable
  substitution;
- secret exposure through arguments, environment, output, receipts, or logs;
- replay across phase, ordinal, lifecycle, recovery, manifest, process, boot,
  commit, or expiry;
- duplicate ownership, concurrent phase claims, or authorization reuse;
- Stop racing authentication, authorization, claim, mutation, or publication;
- crash after authorization, Runner action, validation, freeze, backup,
  staging, publication, or result commit;
- validation recursion, filtering, generated-repository substitution, or
  incomplete-suite reporting;
- network construction, provider discovery, credential access, or external
  write;
- raw payload, account, P&L, probability, recommendation, order, or capital
  leakage;
- fixture success represented as live-source, T1/T2, dataset, prediction,
  profitability, or trading readiness.

## Implementation and review sequence

Approval of one item grants no authority for the next:

1. **T3B15-T1 — Exact Owner-Gated Network-Free Rehearsal Operation
   Architecture:** this documentation-only design.
2. **T3B15-T2 — Operation Manifest Contracts and Registry Foundation:**
   committed and pushed as `f42e482`; immutable
   manifest/root/approval/validation contracts, pure verification, and a
   read-only registry are implemented without a new migration.
3. **T3B15-T3 — Local Owner Command, Preflight, Status, and Phase Gate:**
   committed and pushed as `21d263f`; stdin-only authentication,
   fixed-root resolution, one-use authorization, one-phase invocation, Stop,
   and sanitized reporting are implemented without running a rehearsal.
4. **T3B15-T4 — Actual Alpha Validation and Final Verification Binding:**
   committed and pushed as `b682921`; clean-commit validation,
   recursion guard, exact suite accounting, operation validation receipt,
   envelope authority, and fresh-process verification are implemented without
   running a rehearsal.
5. **T3B15-T5 — Operation Security, Crash, Stop, and Replay Drills:** committed
   and pushed as `483d4e3`; nine fresh-process drills cover
   authorization, result, artifact, Stop, replay, recursion, environment, and
   active Node network-isolation boundaries without running a rehearsal.
6. **T3B15-MR1 — Independent Operation Readiness Review:** independent review
   of implementation, complete validation, threat model, and process matrix
   returns `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`; T3B15-C1 correction
   and a new independent MR2 are required.
7. **T3B15-C1 — Operation Authority, Verification, Isolation, and Process
   Evidence Correction:** post-ownership revalidation, atomic Stop/result
   precedence, independent durable observation, immutable validation receipts,
   complete Control-history verification, fixed executable identity,
   untracked-file rejection, closed composition, authorization integrity,
   non-completed-result blocking, and subprocess isolation.
8. **T3B15-MR2 — Independent Corrected Operation Readiness Review:** completed
   over exact C1 commit `c6d6bc9`; confirms material closures but returns
   `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.
9. **T3B15-C2 — Independent Durable Authority, Fixed Executable, Closed Runtime
   Composition, and Isolation Proof Correction:** committed and pushed as
   `385aa9b`; mutation
   and durable observation are disjoint, Git is content-bound, the authority
   seal is rechecked, Control migration and Validate transactions are atomic,
   process escapes are denied, and the closed runtime remains non-executable.
10. **T3B15-MR3 — Independent Corrected Readiness Review:** complete over
   exact C2 commit `385aa9b`; confirms material closures but returns
   `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.
11. **T3B15-C3 — Closed Durable Composition, Exact Authority, Migration, and
   Fresh-process Verification Correction:** complete locally; concrete
   query-only durable observation, a fixed non-executable composition root,
   exact executable/guard/Git authority, exact Control migration, atomic
   Validate recovery rules, and dual-store child-process verification pass
   complete validation `2469/2469`.
12. **T3B15-MR4 — Independent C3 Readiness Review:** complete locally over
   exact C3 commit `43bcca8`; confirms material C3 closures but returns
   `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.
13. **T3B15-C4 — Real Adapter Composition, Fully Reconstructed Durable
   Evidence, and Positive Fresh-process Verification Correction:** required
   before any further rehearsal-readiness decision.
14. **Separate Owner authorization for one exact rehearsal:** only if a later
   independent review explicitly returns
   `GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.
15. **Post-rehearsal independent review:** evidence review before any further
   rehearsal or expansion.

There is no standing, repeatable, continuous, or implied run authority.

## Acceptance criteria

T3B15 architecture is acceptable only if it:

- separates architecture approval, implementation approval, operation review,
  and rehearsal authorization;
- binds one immutable manifest to one clean Alpha commit and one rehearsal;
- uses registered fixed roots and accepts no caller-selected paths;
- authenticates the Owner for every mutable phase;
- consumes one exact authorization for one phase in one process;
- cannot arrange, infer, or invoke the next phase;
- validates the actual complete Alpha suite with exact registered accounting;
- preserves Stop precedence and crash ambiguity without automatic retry;
- reuses existing Runner, rehearsal, recovery, backup, and verification
  authorities rather than duplicating them;
- produces bounded sanitized durable receipts and a fresh-process Owner report;
- remains network-free, fixture-only, local, and non-capital-authoritative.

## Explicit exclusions

T3B15-T1 does not authorize:

- source code or database changes;
- an executable rehearsal command;
- creation or approval of an operation manifest;
- creation of roots, credentials, stores, or runtime data;
- any rehearsal phase or complete rehearsal;
- loop, timer, polling, scheduling, daemon, service, or background execution;
- network access, provider discovery, Robinhood automation, or credentials;
- real Pilot activation, T1/T2 delivery, or dataset qualification;
- probability research, recommendation, sizing, Portfolio mutation, broker,
  order, execution, or capital behavior.

## Recommended next task

After Owner review and explicit approval, commit and push T3B15-MR4, then begin
`Day15-T3B15-C4`. C4 must internally construct the real five-phase adapters,
reconstruct complete phase evidence from durable records, bind full authority
at every phase boundary, and prove a positive fresh-process verification path.
The runtime remains non-executable and no rehearsal may run unless a later
independent T3B15-MR5 explicitly returns
`GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.
