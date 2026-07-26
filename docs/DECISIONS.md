# Alpha Architecture Decisions

## 2026-07-26 - Day15-T3B15-C1 Operation Boundary Correction

- Decision: revalidate all external authority after ownership and before
  authorization, and require an independent durable observation after phase
  invocation.
- Decision: durable Stop is checked inside result-commit transaction and any
  non-`COMPLETED` result blocks normal phase progression.
- Decision: upgrade the isolated Control store to schema `1.1` with immutable
  operation validation receipts and read-only complete-history verification.
- Decision: resolve only the fixed Node-adjacent npm CLI, include untracked
  files in cleanliness, and extend network guards to deny unapproved native
  subprocess escape.
- Decision: add an exact closed five-phase composition; no executable command
  or real manifest is authorized by C1.
- Consequence: require independent T3B15-MR2 and retain
  `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.

## 2026-07-26 - Day15-T3B15-MR1 Independent Operation Readiness Review

- Decision: return `NO_GO_FOR_ONE_EXACT_NETWORK_FREE_REHEARSAL`.
- Decision: passing `2447/2447` validation does not override missing
  post-ownership authority revalidation, in-flight Stop enforcement,
  independent durable phase observation, or exact Control-ledger verification.
- Decision: treat runtime API guards as defense-in-depth, not sufficient proof
  of an independently enforced network-isolation boundary.
- Decision: require `T3B15-C1` to close all MR1 findings, followed by a new
  independent `T3B15-MR2`.
- Consequence: no Operation Manifest, rehearsal phase, complete rehearsal,
  continuous runtime, provider/network access, or capital authority is
  permitted.

## 2026-07-26 - Day15-T3B15-T5 Operation Security Drills

- Decision: exercise authorization and artifact boundaries in separate OS
  processes against the actual append-only Control-root SQLite repository.
- Decision: a process exit after authorization but before a result is
  ambiguous regardless of whether an artifact exists; neither exact nor
  changed commands may automatically replay it.
- Decision: a committed result remains terminal even if the process exits
  before reporting success, and subsequent commands cannot duplicate it.
- Decision: strengthen the network-disabled marker with inherited Node and
  Python bootstraps that replace network constructors with deterministic
  rejection and include both in the validation-suite fingerprint.
- Decision: permit exactly
  `scripts/network-disabled-python/sitecustomize.py` through the Python-change
  scope check; all other Python changes retain the existing fail-closed rule.
- Consequence: Node and Python validation children are actively network-blocked and
  credential-scrubbed. This remains fixture-operation evidence, not authority
  to run a rehearsal or connect to a provider.

## 2026-07-25 - Day15-T3B15-T4 Validation and Final Verification

- Decision: retain the reviewed T3B14 envelope format and add an operation-level
  validation receipt, preventing an unreviewed rewrite of durable evidence.
- Decision: allow `VALIDATE` through the Owner phase gate only when the trusted
  composition supplies the fixed actual-Alpha adapter; keep executable,
  arguments, repository root, environment, timeout, and test filters outside
  the caller contract.
- Decision: require one unambiguous unified-report `overall` object whose
  total and passing count exactly equal the manifest authority and whose failed
  count is zero.
- Decision: expose final verification as a fresh, read-only `verify` command
  with no Owner secret or mutable authorization.
- Consequence: T4 proves fixture-operation evidence only and still grants no
  rehearsal, network, provider, recommendation, order, or capital authority.

## 2026-07-25 - Day15-T3B15-T3 Local Operation Control Boundary

- Decision: store one-use operation authorization, result, and Stop truth in
  one independent fixed-name SQLite ledger under the registered Control root.
  PREPARE cannot depend on the rehearsal store because that store does not
  exist until PREPARE succeeds.
- Decision: preserve the rehearsal-profile SQLite store as the sole Runner
  and rehearsal lifecycle authority; the control ledger records only command
  authority and operation-level receipts.
- Decision: require phase ordering to be enforced both by the immutable
  manifest and a `BEGIN IMMEDIATE` append transaction. An authorization
  without a result is ambiguous and cannot be automatically replayed.
- Decision: expose closed Preflight, Status, phase, and Stop command parsing;
  accept no caller path, executable, environment, network, payload, retry,
  schedule, provider, probability, recommendation, or capital field.
- Decision: keep VERIFY, actual full-suite execution, recursion protection,
  envelope authority, and fresh-process final verification in T3B15-T4.
- Decision: keep RECOVER fail-closed until its unresolved-authorization
  reconciliation and crash evidence boundary is implemented and drilled.
- Consequence: T3 remains network-free and fixture-only and grants no
  authorization to run a real rehearsal.

## 2026-07-25 - Day15-T3B15-T2 Operation Manifest Contracts and Registry

- Decision: implement T2 as pure immutable contracts, deterministic
  constructors/verifiers, and a read-only in-memory registry.
- Decision: do not add Migration 004 in T2; durable one-use phase
  authorization and result transactions belong to the separately reviewed
  command/gate boundary.
- Decision: require exactly six registered root purposes, pairwise-disjoint
  canonical paths, inspected filesystem identities, and a read-only Alpha
  repository root.
- Decision: separate the content-addressed manifest proposal from Owner
  approval so approval can bind an exact proposal without a circular
  fingerprint.
- Decision: require the validation authority to bind one full Alpha commit,
  clean-tree enforcement, fixed command, exact suite/test total, recursion
  policy, and zero network/credential authority.
- Consequence: T2 grants no command, phase transaction, rehearsal execution,
  continuous runtime, bounded-live, or capital authority.

## 2026-07-25 - Day15-T3B15-T1 Exact Owner-Gated Rehearsal Operation

- Decision: one future rehearsal operation must be bound to one immutable
  Owner-approved manifest, one exact clean Alpha commit, one fixture catalog
  entry, one registered root set, and one complete validation authority.
- Decision: every mutable phase requires fresh local Owner authentication and
  one durable one-use authorization; one foreground process performs exactly
  one phase and exits.
- Decision: expose only read-only Preflight/Status, authenticated phase and
  Stop, and read-only fresh-process Verify; prohibit run-all, continuation,
  loops, timers, polling, daemons, scheduling, and automatic next-phase work.
- Decision: validate the actual registered Alpha repository and exact complete
  suite; generated validation repositories and caller-selected paths,
  executables, arguments, filters, or expected totals are not authority.
- Decision: separate T3B15 implementation, independent MR1, and explicit
  authorization for one exact rehearsal.
- Consequence: retain `NO_GO_FOR_REHEARSAL_EXECUTION`,
  `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`, and
  `NO_GO_FOR_BOUNDED_LIVE`.

## 2026-07-25 - Day15-T3B14-MR4 Final Foundation Readiness Review

- Decision: accept the T3B14 durable fixture-rehearsal foundation and exact
  twenty-drill process evidence at baseline `fa5836b`.
- Decision: do not authorize rehearsal execution through the test fixture,
  which lacks an Owner-approved operation manifest, authenticated phase
  command, registered fixed roots, and binding to actual complete Alpha
  validation.
- Decision: permit design-only T3B15-T1 for one exact Owner-gated,
  network-free rehearsal operation.
- Consequence: retain `NO_GO_FOR_REHEARSAL_EXECUTION`,
  `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`, and
  `NO_GO_FOR_BOUNDED_LIVE`.

## 2026-07-25 - Day15-T3B14-C3 Exact Process Boundary Evidence

- Decision: place C3 crash checkpoints around the assembled rehearsal
  `claimStep` and `completeStep` boundaries without adding production
  fault-injection APIs.
- Decision: require fresh-process no-mutation evidence for each changed phase,
  ordinal, recovery fingerprint, and manifest fingerprint.
- Decision: require a published package artifact to be modified before an
  independent verifier process rejects the envelope.
- Decision: require a separate T3B14-MR4 before any rehearsal-run decision.
- Consequence: C3 grants no command, loop, timer, provider, real Pilot, T1/T2,
  recommendation, broker, order, execution, or capital authority.

## 2026-07-25 - Day15-T3B14-MR3 Independent Readiness Review

- Decision: accept C2's real Worker transaction composition, durable
  claim/Stop/exact-replay evidence, and normalized validation accounting.
- Decision: do not accept the twenty-drill matrix while rows 3, 5, 9, 14, and
  17 cite a different process boundary or mutation from the architecture's
  exact requirement.
- Decision: require narrow T3B14-C3 assembled crash/replay/substitution process
  evidence, followed by a separate T3B14-MR4.
- Consequence: retain `NO_GO_FOR_REHEARSAL_RUN`,
  `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`, and
  `NO_GO_FOR_BOUNDED_LIVE`.

## 2026-07-25 - Day15-T3B14-C2 Worker-composed Process Evidence

- Decision: require the clean test-only STEP phase to invoke the reviewed
  fixture Worker instead of directly constructing Worker-owned transaction
  rows.
- Decision: close requirements 4, 10, 13, and 14 with fresh child-process
  crash, Stop, exact-replay, and changed-replay evidence.
- Decision: count both `tests passed` and `drills passed` result formats in
  normalized validation and lock that behavior with a regression test.
- Decision: retain `NO_GO_FOR_REHEARSAL_RUN` until a separate T3B14-MR3
  independently reviews C2 and the complete validation evidence.
- Consequence: C2 grants no command, loop, timer, provider, real Pilot, T1/T2,
  recommendation, broker, order, execution, or capital authority.

## 2026-07-25 - Day15-T3B14-MR2 Corrected Readiness Review

- Decision: accept C1's one-phase-per-process chain, validation-authority
  binding, explicit Pilot completion, and post-freeze read-only barrier.
- Decision: retain `NO_GO_FOR_REHEARSAL_RUN` because the clean STEP fixture
  directly writes Worker-owned transaction records and several required
  crash/Stop/replay cases remain component rather than fresh-process evidence.
- Decision: treat normalized validation accounting as incomplete while the
  executed durable evidence `14/14` is recorded as zero by the count parser.
- Decision: require T3B14-C2 Worker-composed process evidence and validation
  accounting correction, followed by a separate T3B14-MR3.
- Consequence: no rehearsal command, loop, provider, real Pilot, T1/T2,
  recommendation, broker, order, execution, or capital authority is granted.

## 2026-07-25 - Day15-T3B14-C1 Phase Composition Correction

- Decision: close the MR1 composition gap with a test-only, manifest-bound,
  one-phase-per-process surface; no phase may invoke the next phase.
- Decision: require fresh verification to match registered repository commit,
  validation policy, suite fingerprint, and test total.
- Decision: treat `EVIDENCE_FROZEN` as a store-wide read-only boundary for the
  reviewed store composition.
- Consequence: T3B14-MR2 is required before any exact rehearsal operation can
  be considered, and no rehearsal-run or capital authority is granted.

## 2026-07-25 - Day15-T3B14 Durable Fixture Rehearsal Milestone Review

- Decision: accept the rehearsal-only SQLite profile, durable PREPARE/STEP/RECOVER components, terminal evidence transaction, online backup, immutable envelope, and fresh-process verifier as reusable deterministic foundations.
- Decision: classify readiness as `DURABLE_REHEARSAL_COMPONENTS_ACCEPTED / GO_FOR_REHEARSAL_READINESS_CORRECTION / NO_GO_FOR_REHEARSAL_RUN / NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`.
- Rationale: the T5 clean process fixture directly seeds terminal Runner/rehearsal state instead of executing the reviewed phase sequence through one new process per phase.
- Rationale: the T5 fixture directly constructs a passing validation receipt, while the independent verifier proves only receipt self-consistency and has no registered expected commit, suite fingerprint, or test-total authority.
- Rationale: the concrete coordinator exposes only PREPARE, STEP, and RECOVER; no closed VALIDATE/FREEZE/PACKAGE phase operation or store-wide post-freeze mutation barrier is yet proven.
- Decision: require T3B14-C1 to compose actual phases, invoke fixed validation, bind verifier authority, enforce frozen-store immutability, and map all 20 required process drills before a second readiness review.
- Consequence: MR1 documentation and passing component tests do not authorize a fixture rehearsal, general command, loop, provider access, real Pilot, T1/T2 delivery, recommendation, or capital behavior.

## 2026-07-25 - Day15-T3B14-T5 Durable Evidence Drills

- Decision: run every new evidence build and verification assertion in a separate OS process using only test-owned temporary roots.
- Decision: expose deterministic observer checkpoints only for tests; production code receives no sleep, retry, kill, or arbitrary fault-injection input.
- Decision: quarantine a pre-existing staging directory by a deterministic identity before rebuilding, and never overwrite a published envelope.
- Decision: normalize the staged backup to rollback-journal mode before hashing so the immutable envelope has exactly one SQLite file and no WAL/SHM sidecars.
- Decision: require terminal Pilot/task truth, no live lease, no unresolved attempt, committed evidence, coherent budget counters, Outbox evidence, and valid durable rehearsal reconstruction before `PASS`.
- Consequence: T3B14-MR1 may review fixture readiness, but only a later explicit Owner approval may authorize one exact real rehearsal.

## 2026-07-25 - Day15-T3B14-T4 Durable Evidence Boundary

- Decision: preserve immutable Migration 003 and settle the `FREEZE` claim through the evidence plan in the same final transaction; fixed validation is read-only and its exact receipt fingerprint is committed with the terminal freeze.
- Decision: forbid caller-selected validation commands and arguments; only the version-controlled Alpha validation bundle, clean commit identity, registered suite fingerprint, and registered test total can produce a passing receipt.
- Decision: build one fixed-name envelope in an isolated staging directory, use SQLite online backup for the frozen source, and publish only by same-filesystem atomic rename without overwrite.
- Decision: keep final verification independent and read-only. It resolves a registered evidence root, requires the backup, recomputes all file identities, verifies the exact v3 profile, and reconstructs durable state from the backup.
- Consequence: T3B14-T5 must still prove the boundary in fresh OS processes and cover crash, Stop, substitution, leakage, missing-backup, source-isolation, and two-run determinism drills before milestone review.

## 2026-07-25 - Day15-T3B14-T3 Durable Phase Coordinator and Recovery Reconciliation

- Decision: expose only the closed `PREPARE`, `STEP`, and `RECOVER` programmatic phases in T3; do not add an executable command or multi-phase runner.
- Decision: commit a STEP claim and `READY -> STEPPING` transition before invoking the existing foreground action, then commit the exact receipt and terminal/ready transition only after independently rereading durable truth.
- Decision: an unresolved STEP claim is durable ambiguity. Exact STEP replay cannot repeat work; only an Owner-authenticated RECOVER phase may reconcile it.
- Decision: RECOVER never executes fixture work. Exactly proven success may settle the original STEP claim; unknown evidence becomes `RECOVERY_REQUIRED`, conflicting evidence becomes `FAILED_CLOSED`.
- Decision: Stop is checked before ownership and immediately before mutation/action. Ownership is released only after verified clean completion; post-claim failure preserves ambiguity.
- Decision: preparation and foreground execution reuse the reviewed T3B13 and T3B12 boundaries through narrow adapters, while the v3 store exposes both existing Runner truth and new durable-rehearsal truth.
- Consequence: T3 closes the durable phase/ambiguity blocker for later evidence composition, but grants no command, rehearsal run, loop, provider, real Pilot, T1/T2 delivery, recommendation, or trading authority.

## 2026-07-25 - Day15-T3B14-T2 Rehearsal-profile Contracts and Migration 003

- Decision: implement only the strict immutable records, pure aggregate verifier, and isolated SQLite schema profile required before durable phase composition.
- Decision: apply Migration 003 only while creating a new empty rehearsal store; never upgrade, replace, or reinterpret an ordinary v2, populated, unversioned, or altered store.
- Decision: preserve durable lifecycle projection separately from append-only transitions, claims, invocation receipts, failure receipts, and evidence plans, while binding all records to the rehearsal and manifest.
- Decision: verify the exact 001-003 migration chain, common build lineage, foreign-key enforcement, strict table catalog, integrity checks, and complete schema-catalog checksum on every profile inspection.
- Decision: keep aggregate verification pure and fail closed on unknown fields, fingerprint drift, transition/ordinal gaps, duplicate or unresolved claims, receipt mismatch, projection drift, and invalid evidence-plan placement.
- Consequence: T3B14-T3 may implement a durable one-phase coordinator over this closed profile, but T2 grants no command, rehearsal run, backup/package production, provider, real Pilot, T1/T2 delivery, recommendation, or trading authority.

## 2026-07-25 - Day15-T3B14-T1 Durable Fixture Rehearsal Composition

- Decision: use an explicit `FIXTURE_REHEARSAL_V3` schema profile only for newly created isolated rehearsal stores; ordinary runner stores remain `RUNNER_BASE_V2`.
- Decision: keep durable rehearsal lifecycle and the synthetic Runner/Pilot/task state in the same SQLite database so one independently reopened backup contains all authoritative scenario truth.
- Decision: preserve a compare-and-swap current projection and separate append-only transitions, operation claims, receipts, failures, and artifact bindings.
- Decision: permit one future closed Owner-invoked phase per process and prohibit automatic phase progression, internal loops, caller paths, arbitrary ports, and caller evidence truth.
- Decision: reconcile a committed runner action without a rehearsal receipt from durable task, attempt, lease, evidence, Outbox, Stop, and recovery records; never repeat or guess the action.
- Decision: publish exactly one online backup, manifest, fixed validation receipt, sanitized package, and envelope manifest as one content-addressed immutable envelope.
- Decision: require the final verifier to run in a fresh process, reopen the backup, reconstruct durable truth, and prove two-run scenario-fingerprint stability.
- Consequence: T3B14-T1 is design-only and grants no migration, implementation, command, rehearsal run, provider, Pilot, dataset, recommendation, or trading authority.

## 2026-07-25 - Day15-T3B13 Fixture Rehearsal Milestone Review

- Decision: accept T3B13 contracts, preparation, one-action coordination, evidence packaging, independent package-directory reread, and package-level process drills as reusable deterministic foundations.
- Decision: classify readiness as `FIXTURE_REHEARSAL_FOUNDATION_ACCEPTED / GO_FOR_DURABLE_REHEARSAL_COMPOSITION_DESIGN / NO_GO_FOR_REHEARSAL_RUN / NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`.
- Rationale: the only rehearsal step-ledger implementation is in memory, so separate process invocations cannot reconstruct authoritative lifecycle, ordinal, replay, and recovery state.
- Rationale: SQLite, backup, and validation verification is an injected trust boundary with no concrete implementation, and the package verifier cannot independently reopen the referenced backup.
- Rationale: package child-process drills do not assemble preparation, the real T3B12 foreground step, restart/recovery, backup, package construction, and fresh-process verification.
- Decision: require a design-only durable rehearsal composition and evidence task before implementation or any rehearsal run.
- Consequence: T3B13 implementation approval does not authorize fixture execution, a general command, a loop, network access, a real Pilot, T1/T2 delivery, dataset qualification, recommendation, broker, order, or execution.

## 2026-07-25 - Day15-T3B13-T5 Evidence Package and Process Drills

- Decision: permit package mutation only under a repository-disjoint pre-registered root and only after an injected port verifies bound SQLite, backup, and validation evidence.
- Decision: write bounded sanitized artifacts to a staging directory and publish the package through one atomic directory rename.
- Decision: require an independent verifier to reread the exact file set, recompute byte counts and digests, scan excluded data, and return only `PASS`, `FAIL_CLOSED`, or `INCOMPLETE`.
- Decision: return exact replay without rewriting, reject changed replay, and quarantine incomplete staging without recursive deletion.
- Decision: keep catalog identity and catalog-entry identity distinct; the preparation receipt binds the entry while the manifest binds the catalog.
- Decision: use real test-only child termination to prove behavior before and after atomic publication, and fresh child processes to prove Stop and leakage rejection.
- Consequence: T3B13 may proceed to MR1 review, but no rehearsal command, network provider, continuous runtime, live Pilot, recommendation, or trading authority is approved.

## 2026-07-25 - Day15-T3B13-T4 Programmatic Rehearsal Step

- Decision: require a separate explicit call for each exact manifest-declared invocation ordinal and execute at most one existing T3B12 foreground action.
- Decision: bind the call to the current lifecycle version, recovery fingerprint, scenario phase, and invocation identity before foreground execution.
- Decision: require an injected local verifier to affirm that every Stop/recovery Owner authorization reference is valid and unexpired.
- Decision: return exact replay from the append-only step ledger without a second foreground action; reject every changed replay.
- Decision: reread and fingerprint durable Pilot/task truth independently after the foreground action and before creating the sanitized invocation receipt.
- Decision: classify substituted actions and unambiguous clean failures as fail closed, while ambiguous mutation, identity disagreement, or durable-state mismatch requires recovery.
- Consequence: T3B13-T5 may package and process-drill these programmatic results, but T4 grants no executable command, loop, network, live Pilot, recommendation, or trading authority.

## 2026-07-25 - Day15-T3B13-T3 Isolated Preparation Boundary

- Decision: callers select only pre-registered catalog and allowed-root identities; they cannot supply fixture payloads or arbitrary workspace paths.
- Decision: derive the exclusive workspace name from the verified manifest fingerprint and prohibit overlap with the source repository or a filesystem root.
- Decision: reuse the existing strict SQLite migration/store/repository boundary to seed the synthetic Runner, Pilot, budget, and task.
- Decision: treat partial preparation as non-valid until the canonical exclusive preparation record exists.
- Decision: return exact replay only when manifest, catalog, workspace, runtime configuration, paths, transition, timestamp, store, and receipt identities all match.
- Decision: quarantine failed preparation directories and never recursively delete or overwrite unresolved content.
- Consequence: T3B13-T4 may consume one verified prepared fixture workspace, but T3B13-T3 grants no authority to execute a foreground step.

## 2026-07-25 - Day15-T3B13-T2 Pure Rehearsal Verification Boundary

- Decision: construct the rehearsal identity from the complete closed manifest rather than accept a caller-selected rehearsal ID.
- Decision: require contiguous exact invocation ordinals and bind each receipt to the manifest-declared action and resulting task state.
- Decision: keep lifecycle transitions append-only and reject backward movement or terminal reopening.
- Decision: classify independent verification as exactly `PASS`, `FAIL_CLOSED`, or `INCOMPLETE`; missing evidence can never be operator-promoted to success.
- Decision: use separate fingerprints for environment-specific execution evidence and stable scenario truth.
- Decision: exclude filesystem, SQLite, command, runtime data, fixture execution, network, real Pilot, model, recommendation, broker, order, and execution behavior from T3B13-T2.
- Consequence: later preparation and process work can consume reviewed immutable records without inheriting hidden runtime authority.

## 2026-07-25 - Day15-T3B13-T1 Fixture Rehearsal and Evidence Architecture

### Rehearsal Is Manual, Fixture-Only, and One Action Per Invocation

- Decision: advance one frozen rehearsal only through separate explicit foreground invocations, each bound to an exact ordinal and permitted to execute at most one T3B12 action.
- Rationale: repeating the step internally would silently create the continuous runtime that T3B12-MR1 prohibited.
- Consequence: the first rehearsal has no timer, wait, polling, self-invocation, daemon, network transport, or real Pilot authority.

### Manifest and Fixture Catalog Own Rehearsal Admission

- Decision: bind every build, fixture, provider, mapping, synthetic Pilot, task, expected action, bound, and evidence policy through one immutable manifest and one allow-listed catalog entry.
- Rationale: caller-selected business records, paths, or provider identities would bypass reviewed source and runtime authority.
- Consequence: a changed manifest receives a new rehearsal identity; undeclared fields, catalog drift, arbitrary paths, and dynamic discovery fail closed.

### Package Verification Is Independent From Package Construction

- Decision: preserve both an execution-specific package fingerprint and an environment-independent scenario-result fingerprint, then require a pure independent verifier to return `PASS`, `FAIL_CLOSED`, or `INCOMPLETE`.
- Rationale: process identity and timing legitimately vary, while the frozen scenario's actions and durable outcome must remain deterministic.
- Consequence: two clean runs must have the same scenario-result fingerprint; `INCOMPLETE` is never treated as success.

### Fixture Success Grants No Market or Capital Authority

- Decision: require a versioned non-authority declaration in every manifest, package, and review output.
- Rationale: local fixture orchestration cannot establish live-source availability, complete Robinhood evidence, dataset qualification, model edge, or trading readiness.
- Consequence: rehearsal evidence cannot contain or support predictions, recommendations, sizing, Portfolio changes, broker actions, orders, or execution.

## 2026-07-25 - Day15-T3B12 Assembly and Recovery Milestone Review

### Accept Assembly and Recovery Without Authorizing Operation

- Decision: record `ASSEMBLY_RECOVERY_FOUNDATION_ACCEPTED / GO_FOR_FIXTURE_REHEARSAL_DESIGN / NO_GO_FOR_EXECUTABLE_RUNTIME / NO_GO_FOR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`.
- Rationale: T3B12 closes the reviewed assembly, T6, stale-lock recovery, and real process-kill gaps, but still exposes only a programmatic one-action fixture boundary.
- Consequence: Alpha may design a network-free fixture rehearsal, but may not add or invoke a general runtime command, loop, provider, or real Pilot.

### Rehearsal Evidence Must Not Claim Source or Dataset Readiness

- Decision: a future fixture rehearsal may prove deterministic orchestration and recovery only.
- Rationale: frozen fixtures do not prove future-market admission, Robinhood platform evidence, API reliability, complete T1/T2 assembly, or prospective dataset qualification.
- Consequence: every rehearsal report must preserve those blockers and contain no probability, recommendation, or trading claim.

### Continuous Runtime Requires New Architecture

- Decision: prohibit wrapping the foreground step in an external loop under current authority.
- Rationale: supervision, wake-up, cross-process Stop, suspend/resume, retention, and operator recovery are not consequences of repeating a safe single step.
- Consequence: continuous runtime remains a separately specified and Owner-approved subsystem.

## 2026-07-25 - Day15-T3B12-T5 Transaction-Boundary Process Drills

### Crash Evidence Must Come From Real Process Termination

- Decision: transaction-boundary recovery drills launch a fixture-only child process, wait for an explicit checkpoint, terminate that process, and inspect only reopened durable state.
- Rationale: same-process exceptions cannot prove OS-handle loss, WAL recovery, stale ownership, or process-session invalidation.
- Consequence: production code gains no crash switch; all termination controls and fault staging remain isolated under test fixtures.

### Ambiguous Requests and Partial Control Writes Fail Closed

- Decision: a crash after an attempt claim preserves an unresolved attempt without automatic retry, while a crash inside an uncommitted Stop write preserves no partial Stop, receipt, or Pilot transition.
- Rationale: provider outcome ambiguity and local transaction atomicity are different failure classes and must remain distinguishable.
- Consequence: restart policy must inspect durable attempt/lease/Stop truth and cannot infer success, retry, or authority from the prior process.

### Durable Completion and Quarantine Are Exactly Replayable

- Decision: T10 evidence commit and stale-ownership quarantine must return their original durable result after process restart.
- Rationale: a process can die after commit or rename but before reporting success.
- Consequence: exact replay creates neither duplicate evidence nor a second quarantine mutation; changed replay remains fail closed.

## 2026-07-25 - Day15-T3B12-T4 Single Foreground Fixture Step

### One Invocation Selects and Executes At Most One Action

- Decision: one ready Preflight and one bounded work snapshot feed the pure planner exactly once; the composition then invokes at most one T6, fixture, or Stop executor and exits.
- Rationale: separating due-state transition, fixture collection, and Stop into distinct invocations makes crash outcomes and durable authority unambiguous.
- Consequence: no action may fall through into another planner call, Worker cycle, wait, retry, timer, or background operation.

### Clean Release Requires a Fresh Terminal-State Read

- Decision: the composition rereads current terminal safety after the selected action, closes resources, and releases ownership only when both checks complete cleanly.
- Rationale: a successful executor receipt is not proof that Stop, health, store, or cleanup state remained safe through shutdown.
- Consequence: uncertain mutation, terminal read, close, or ownership release preserves recovery evidence and cannot report a verified clean shutdown.

## 2026-07-25 - Day15-T3B12-T3 Authenticated Ownership Recovery

### Invalid Lock Evidence Is Classified but Never Authorized

- Decision: malformed, replaced, missing, linked, or identity-mismatched ownership evidence receives a sanitized content fingerprint and `LOCK_EVIDENCE_INVALID`, with no trusted ownership object.
- Rationale: recovery inspection must preserve auditable evidence without treating unverified fields as authority.
- Consequence: invalid evidence remains fail closed and cannot create an Owner challenge, decision, guard, receipt, or quarantine mutation.

### Quarantine Is the Only Ownership-Recovery Mutation

- Decision: one exact local Owner authorization may atomically rename a verified stale lock into a deterministic same-filesystem quarantine directory.
- Rationale: deletion loses crash evidence and automatic takeover can create two owners.
- Consequence: the original owner record and flushed recovery receipt remain preserved; the decision cannot Resume a Pilot, create a session, or start runtime work.

### Recovery Guards and Receipts Are Exactly Replayable

- Decision: a per-lock guard binds the assessment, Owner decision, stale ownership, and quarantine destination; exact replay may complete or return the original receipt.
- Rationale: interruption before or after rename must not create a second mutation or require deleting ambiguous evidence.
- Consequence: changed replay, guard conflict, destination conflict, or reinspection drift fails closed and leaves evidence for later recovery.

## 2026-07-25 - Day15-T3B12-T2 Contracts and Pure Planners

### The Planner Selects Exactly One Action From One Verified Snapshot

- Decision: one immutable bounded work snapshot and current process authority produce one closed action, reason code, exact versions, and fingerprint.
- Rationale: a pure one-action boundary makes ordering, replay, and crash outcomes independently testable before an executable composition exists.
- Consequence: the planner performs no repository read, SQLite write, filesystem mutation, provider call, wait, retry, or Worker invocation.

### Authority and Recovery Gates Precede Task Selection

- Decision: configuration, lock, session, clock, Emergency Stop, process Stop, Pilot state, expiry, reconciliation, and budget checks run before task ordering.
- Rationale: task eligibility cannot widen authority after ownership, health, Stop, recovery, or budget evidence fails.
- Consequence: invalid or ambiguous evidence fails closed or requests the explicit reviewed Stop path before any task action.

### T6 Receives Exact Compare-and-Swap Evidence

- Decision: T6 requests bind the activation, task and budget versions, observation time, work-snapshot fingerprint, planner-decision fingerprint, and reason.
- Rationale: an executor must not infer a task or reuse a planner result against changed durable state.
- Consequence: T6 execution remains a separately implemented, session-gated port and cannot fall through into fixture Worker execution.

## 2026-07-25 - Day15-T3B12-T1 Fixture Runtime Assembly and Recovery Architecture

### The First Assembly Is One Foreground Step

- Decision: the first executable composition will perform at most one deterministic action and exit.
- Rationale: a single step can prove startup, T6, Worker, Stop, cleanup, crash, and replay ordering without creating timer or continuous-run authority.
- Consequence: `WAIT_AND_EXIT` reports the next time but never sleeps or schedules another invocation; loops and background operation remain separately blocked.

### T6 and Fixture Work Are Separate Steps

- Decision: a T6 due or missed transition ends the current invocation; fixture work may begin only in a later invocation that observes the durable state.
- Rationale: a crash after T6 must be distinguishable from lease acquisition or provider invocation.
- Consequence: the action planner is closed and one invocation cannot fall through from `TRANSITION_EXACT_TASK_DUE` into Worker execution.

### Stale Ownership Is Quarantined, Not Deleted

- Decision: only an exact locally authenticated Owner decision may move verified stale ownership into an allow-listed same-filesystem quarantine.
- Rationale: automatic takeover is unsafe and deletion destroys crash evidence.
- Consequence: recovery preserves the original owner record and an immutable receipt; Pilot Resume remains a separate SQLite authority.

### Real Crash Drills Precede Runtime Start

- Decision: require operating-system child-process kills at lock, session, T6, lease, attempt, validation, T10, Stop, and quarantine boundaries.
- Rationale: injected exceptions do not prove durable restart behavior at every authority boundary.
- Consequence: implementation may use fixture-only checkpoint observation, but production code receives no crash command or unrestricted fault-injection API.

## 2026-07-25 - Day15-T3B11 Fixture Runtime Milestone Review

### Accept the Foundation Without Authorizing Runtime Start

- Decision: record `FIXTURE_RUNTIME_FOUNDATION_ACCEPTED / GO_FOR_ASSEMBLY_DESIGN / NO_GO_FOR_RUNTIME_START / NO_GO_FOR_BOUNDED_LIVE`.
- Rationale: T3B11 establishes strong reusable authority and execution primitives, but no reviewed composition root owns startup, recovery, T6 due transition, one-cycle execution, shutdown, and cleanup as one boundary.
- Consequence: the existing classes may support the next architecture task, but they cannot be assembled ad hoc into an operating command.

### Require Authenticated Stale-Lock Recovery

- Decision: preserve fail-closed stale locks until a separately designed local Owner procedure binds liveness, boot identity, store integrity, recovery evidence, and one-time authority.
- Rationale: automatic takeover is unsafe, while manual filesystem deletion is unaudited authority.
- Consequence: no stale-lock deletion or ownership supersession may be added before T3B12 design review.

### Require Real Transaction-Boundary Process-Kill Drills

- Decision: retain T5 ownership-process drills as valid evidence but classify the full process-kill acceptance gate as partial.
- Rationale: injected Worker failures do not prove operating-system crash behavior after lease, attempt, validation, or evidence commit.
- Consequence: runtime start remains blocked until a reviewed foreground fixture composition supports those drills.

## 2026-07-25 - Day15-T3B11-T5 Process Failure and Replay Drills

### A Crash Preserves Ownership Ambiguity

- Decision: forced process exit leaves the immutable ownership directory and owner record intact, and a restart must fail closed.
- Rationale: process disappearance alone does not prove that recovery, store integrity, or prior mutation outcomes are safe.
- Consequence: there is no automatic stale-lock deletion or takeover; recovery remains an explicit separately authorized Owner boundary.

### Stop and Time Boundaries Outrank Acquisition

- Decision: Stop, retry-transition requirements, and cutoff state are evaluated before any task acquisition in the process drill matrix.
- Rationale: a wake-up or retry opportunity cannot widen authority after Stop or after evidence timing becomes invalid.
- Consequence: Stop requests graceful completion, `RETRY_WAIT` requires its durable due transition, and a task at cutoff is marked missed rather than acquired.

### Replay Must Be Exact

- Decision: an exact repeated Stop command is deterministic, while a changed command using the same durable identity fails closed.
- Rationale: idempotency must prevent duplicate side effects without accepting authority drift.
- Consequence: conflicting replay leaves the process Stop barrier active and cannot restore healthy status.

## 2026-07-25 - Day15-T3B11-T4 Local Operator and Health Surface

### Health Is a Conjunction of Current Safety Evidence

- Decision: report `HEALTHY` only when configuration, ownership, store, integrity, clock, recovery session, and Stop-barrier checks all pass.
- Rationale: partial availability must not be presented as operational safety.
- Consequence: ownership, session, integrity, or Stop failure is `FAIL_CLOSED`; unavailable store/clock evidence is at best `DEGRADED`, and Preflight is not ready.

### Status and Outbox Are Payload-Free Read Models

- Decision: query a bounded allow-listed SQLite projection and expose only Pilot/task/budget/lease chronology plus Outbox identities and delivery metadata.
- Rationale: health inspection does not require provider content and must not create a new evidence-export path.
- Consequence: canonical JSON, normalized snapshots, raw payload, secrets, provider narrative, Portfolio, recommendation, and order data cannot leave the repository through this surface.

### Authenticated Stop Has Barrier Precedence

- Decision: verify the exact local Owner command, trip the irreversible process barrier, persist graceful or Emergency Stop through an existing named boundary, then publish a fingerprint-bound in-process notification.
- Rationale: loss of SQLite or notification must not allow new work after an authenticated Stop.
- Consequence: persistence failure returns a sanitized failure while leaving the barrier active; notification failure cannot undo a durable Stop.

## 2026-07-25 - Day15-T3B11-T3 Fixture Scheduler and Worker

### Scheduling Is a Pure One-Action Decision

- Decision: validate one closed caller-supplied snapshot and emit exactly one immutable action using required time, cutoff, deadline, platform-before-exchange lane, and task ID ordering.
- Rationale: scheduling must be replayable and cannot hide clock reads, sleeps, repository access, or parallel selection.
- Consequence: only exact `DUE` tasks may be acquired; eligible `SCHEDULED` and `RETRY_WAIT` tasks return an explicit wait reason until the existing durable due transition is separately composed.

### The First Worker Has One Explicit Fixture Cycle

- Decision: allow one explicitly invoked fixture-only Worker cycle and keep continuous-run and network authority permanently false in this task.
- Rationale: transaction ordering, cancellation, cutoff, retry, and crash ambiguity must be proven independently from process lifetime and provider transport.
- Consequence: the Worker has no timer, loop, command, daemon, market discovery, or transport construction surface.

### Every Mutation Retains Recovery-Session Authority

- Decision: require the concrete session-gated repository, exact runtime ownership, process Stop barrier, immutable artifacts, and exact fixture adapter policy/source fingerprints before any write.
- Rationale: accepting the unrestricted repository port or caller-selected source data would bypass Owner Resume and admission authority.
- Consequence: writes follow only T7/T8/T8B/T9/T10; cancellation after claim is durable, raw payload is not accepted, and unresolved post-lease ambiguity irreversibly stops the process.

## 2026-07-25 - Day15-T3B11-T2 Runtime Foundation

### Runtime Configuration Cannot Grant Operation

- Decision: T2 accepts exactly one `FIXTURE_ONLY` configuration shape and derives immutable configuration, path, store, lock, and session identities from it.
- Rationale: configuration must narrow authority rather than provide hidden provider, network, Worker, or caller-selected session extension points.
- Consequence: T2 grants no Worker operation; `networkPermitted` remains false, and only the separately reviewed T3 composition may set one explicit fixture Worker while continuous run remains prohibited.

### Local Ownership Uses Atomic Directory Creation

- Decision: derive one stable lock address from canonical store and activation identity, acquire it with atomic non-recursive directory creation, bind the exact configuration/path fingerprints in one canonical immutable owner record, and refuse every existing directory without inspecting it as authority to take over.
- Rationale: the primitive is supported by the current Node runtime on Windows and prevents two cooperating Alpha processes from becoming owner.
- Consequence: incomplete or stale locks remain fail-closed and require the separately designed authenticated recovery command; T2 implements no lock stealing.

### Process Session Identity Is System-Minted

- Decision: derive the process session from configuration, path, store, activation, boot, process ID, build, and an operating-system CSPRNG nonce after lock acquisition.
- Rationale: a caller-selected or restart-reused process session would defeat recovery-control isolation.
- Consequence: the T2 acquisition API has no process-session input, and every new acquisition produces a new session when the nonce changes.

### Unverified Local Time Is Not Healthy Time

- Decision: expose separate wall, monotonic, and clock-health ports; the default local health probe returns `UNKNOWN` and cannot pass the healthy snapshot gate.
- Rationale: the local system clock alone cannot prove synchronization or offset without reviewed external evidence.
- Consequence: later runtime composition must inject a reviewed health source; unavailable, stale, future-dated, expired, unsynchronized, or excessive-offset evidence fails closed.

## 2026-07-25 - Day15-T3B11-T1 Shadow Pilot Runtime Architecture

### The First Runtime Is Foreground and Fixture-Only

- Decision: The first runtime implementation must be an explicit foreground local process composed only with an injected fixture adapter.
- Rationale: process ownership, Stop, clock, and crash behavior must be proven before adding background lifetime or network uncertainty.
- Consequence: T3B11 approval cannot start a daemon, operating-system scheduled job, real provider request, or Pilot.

### Process Authority Begins With an Atomic Lock

- Decision: Derive one stable local lock address from store and activation identity, bind the configuration fingerprint inside its ownership evidence, acquire it atomically, and never steal or delete a stale lock automatically.
- Rationale: SQLite serializes writes but does not prove which local process owns the runtime and in-memory stop barrier.
- Consequence: crashes leave a fail-closed stale lock, and only a later Owner-authenticated recovery flow may archive it after process-liveness and store-recovery checks.

### Runtime Identity Is Minted, Not Supplied

- Decision: Create a fresh process nonce after lock acquisition and derive the process session from boot, process, configuration, build, store, and activation identities.
- Rationale: accepting a process session from arguments or configuration would make restart isolation caller-controlled.
- Consequence: every restart has a distinct session and an operational Pilot must follow existing recovery authorization rules.

### Time Has Three Separate Authorities

- Decision: Require injected wall-clock, monotonic-clock, and clock-health ports and prohibit hidden clock calls in the deterministic scheduler.
- Rationale: chronology, elapsed duration, and synchronization confidence have different semantics and failure modes.
- Consequence: unavailable or stale health evidence blocks acquisition and may trigger Emergency Stop; monotonic values never cross a process identity.

### Outbox Delivery Is Replayable, Not Cross-Store Atomic

- Decision: Keep SQLite source evidence authoritative and require a later T1/T2 consumer to use idempotent target writes and replayable delivery evidence.
- Rationale: the Runner SQLite store and current shadow ledger do not share one transaction.
- Consequence: a crash may replay a delivery but may not duplicate, overwrite, or infer missing platform evidence.

## 2026-07-25 - Day15-T3B10 Runner Milestone Review

### Foundation Acceptance Does Not Authorize Operation

- Decision: Accept T3B10 as sufficient to begin a Shadow Pilot Runtime Architecture design, while retaining a hard no-go on fixture-worker, continuous-runner, provider-request, and real-Pilot operation.
- Rationale: authority, SQLite transactions, recovery, Owner authentication, and stop/crash behavior are validated, but no reviewed runtime process owns clocks, locking, scheduling, provider composition, lifecycle commands, or evidence integration.
- Consequence: the next task is T3B11-T1 design only and cannot be combined with worker implementation or live authorization.

### Runtime Ownership Precedes Scheduling

- Decision: Require one explicit local process owner, single-instance lock, immutable runtime configuration, and exact boot/process-session issuance before implementing the scheduler or worker.
- Rationale: SQLite transaction serialization protects records but does not determine which process owns runtime authority.
- Consequence: duplicate-process and child-process crash drills become mandatory before a fixture runtime can pass its own milestone review.

### Exchange-Only Collection Cannot Claim Dataset Readiness

- Decision: Treat the current fixed-market Kalshi source as bounded transport evidence, not as an operating provider for future plans or a substitute for Robinhood platform evidence.
- Rationale: the transport is bound to one historical market, and Kalshi cannot provide the Robinhood quote and fee-preview evidence required by T1.
- Consequence: future runtime work remains fixture-only until exact future-market admission and a reviewed platform-evidence operating plan are separately approved.

## 2026-07-25 - Day15-T3B10-T4D Recovery-Control Drills

### Race Safety Is Proven by Both Durable Commit Orderings

- Decision: Exercise Stop-before-Resume and Resume-before-Stop through two independent SQLite store connections rather than relying on timing-sensitive threads.
- Rationale: `BEGIN IMMEDIATE` serializes the actual durable winner; testing both legal commit orderings is deterministic and covers the safety outcome without flaky wall-clock scheduling.
- Consequence: Stop-first invalidates an unconsumed decision, while Resume-first may create evidence but the subsequent Stop revokes the session before any further gated mutation.

### Revocation Changes the Session Record Fingerprint Atomically

- Decision: Recompute and compare-and-swap the authorization fingerprint in the same transaction that writes session revocation time and reason.
- Rationale: A fingerprint over lifecycle fields becomes stale if revocation columns change without the fingerprint, making the safety record unreadable exactly when it is needed.
- Consequence: the pre-stop fingerprint can no longer authorize work, while the revoked record remains internally verifiable and auditable.

### Fault Drills Preserve Ambiguity Rather Than Inventing Completion

- Decision: Inject transaction and durable-stop failures only at local repository boundaries, then close and reopen the store to inspect committed truth.
- Rationale: A crash drill must distinguish committed evidence from process-local intent and must not repair, delete, or infer an uncommitted outcome.
- Consequence: Resume transaction failure leaves no partial authority; durable Stop failure leaves the current process barrier tripped and the next startup mutation-blocked.

## 2026-07-25 - Day15-T3B10-T4C Local Authentication and Session Gate

### Secrets Never Enter Command Arguments or Durable Evidence

- Decision: Accept the local Owner secret only through standard input, verify it with a pre-provisioned fixed-policy `scrypt` verifier and constant-time comparison, and bind the exact command fingerprint as the challenge.
- Rationale: Arguments and environment values are routinely exposed through process inspection, shell history, logs, and diagnostics.
- Consequence: verifier provisioning and recovery remain separate owner-controlled operations; the command emits only sanitized receipt evidence and a generic authentication failure.

### Resume Authority Is Rechecked Before Every Write

- Decision: Wrap the ordinary repository and validate the exact session authorization, process/boot identity, activation version, task membership, expiry, revocation, store/schema/recovery identity, and Emergency Stop state before each permitted mutation.
- Rationale: Checking only when a repository handle is created would leave a stale handle usable after stop, expiry, revocation, or Pilot change.
- Consequence: recovery sessions cannot create runner definitions, Pilots, or new task authority, and any changed durable fact immediately fails closed.

### In-Memory Stop Does Not Depend on SQLite Success

- Decision: Trip an irreversible process-local stop barrier before attempting durable Emergency Stop execution.
- Rationale: database failure must not allow the process to continue acquiring work.
- Consequence: persistence failure leaves durable ambiguity for the next startup, while the current process remains mutation-blocked.

## 2026-07-25 - Day15-T3B10-T4B Durable Recovery-Control Transactions

### Recovery Authority Uses a Separate Restricted Repository

- Decision: Persist and execute recovery-control evidence through named transactions that remain separate from the ordinary runner repository and never clear its startup recovery blocker.
- Rationale: Recovery authority must be durable and auditable without allowing an untrusted caller to bypass the exact process-session gate planned for T4C.
- Consequence: `APPROVE_RESUME` creates a one-time session-authorization record only; T4C must authenticate the operator and enforce that record before ordinary mutation can become available.

### Migration 002 Requires Protected Upgrade Evidence

- Decision: New and empty v1 stores may reach schema v2 automatically, while populated v1 stores fail closed until a separately verified pre-migration backup exists.
- Rationale: Adding authority-bearing control tables to a store with operational evidence is a recovery-sensitive migration and must not silently proceed without rollback evidence.
- Consequence: migration 001 remains immutable, migration 002 is checksum-bound, and a later owner-operated upgrade flow must create and verify the backup before reopening a populated v1 store.

### Emergency Stop Invalidates Resume Authority Atomically

- Decision: Emergency Stop, Pilot compare-and-swap, decision/session invalidation, receipt creation, and outbox evidence occur in one `BEGIN IMMEDIATE` transaction.
- Rationale: A partial stop could leave durable resume authority active after the Pilot has been stopped or failed closed.
- Consequence: stop wins over unconsumed resume decisions and existing session authorizations; exact idempotent replay returns the original receipt, while altered replay fails closed.

## 2026-07-25 - Day15-T3B10-T4A Deterministic Recovery-Control Boundary

### Authorization Evidence Does Not Execute

- Decision: T4A may construct immutable owner-decision evidence with explicit authorization facts, but it may not persist, consume, or execute that authorization.
- Rationale: Separating deterministic validation from later authenticated operator and transactional boundaries prevents a pure engine from silently gaining runtime authority.
- Consequence: T4B/T4C must independently revalidate the exact assessment, activation version, store identity, boot/process session, expiry, and Emergency Stop state before any mutation can occur.

### Closed Dispositions and Stop Precedence

- Decision: Recovery classification and the allowed owner action for each disposition are closed deterministic mappings; integrity or database stop triggers require fail-closed behavior.
- Rationale: Ambiguous recovery and stop behavior must not be resolved by caller preference or permissive defaults.
- Consequence: Unknown fields, altered assessments, owner mismatch, incompatible actions, unhealthy clocks, terminal states, and observed Emergency Stop conditions cannot authorize resume.

## 2026-07-24 - Day15-T3B10-T4 Recovery Control and Emergency Stop

### Resume Is a Session Authorization, Not a State Loop

- Decision: Keep the durable Pilot `ACTIVE` after an eligible restart and authorize mutation through a one-time owner decision bound to a new boot/process session.
- Rationale: Adding `ACTIVE -> ACTIVE` would fabricate lifecycle movement and blur restart authorization with business state.
- Consequence: Every later restart requires a fresh assessment and owner decision; the authorization cannot extend time, budgets, attempts, or authority.

### Emergency Stop Always Wins

- Decision: Stop invalidates unconsumed resume/session authority and blocks leases, retries, and new requests before cancellation is attempted.
- Rationale: Cancellation is best effort, while preventing additional work is deterministic and locally enforceable.
- Consequence: Persistence failure still stops the process in memory and forces the next startup to expose an unresolved blocker.

## 2026-07-24 - Day15-T3B10-T3C Recovery, Backup, and Restore

### Recovery Blockers Disable Mutation

- Decision: Every open produces an immutable recovery report, and any issue prevents creation of the writable repository.
- Rationale: Detecting drift without enforcing it would still permit corrupted or ambiguous state to gain persistence authority.
- Consequence: Operational pilots after restart require a separately reviewed explicit owner-resume transaction.

### Back Up Through SQLite and Restore Only to a New Path

- Decision: Use the SQLite online backup API, bind every backup to a canonical SHA-256 manifest, and restore only to a non-existing target.
- Rationale: Ordinary live-file copying can split WAL state, while overwriting an active store destroys rollback evidence.
- Consequence: Restore verification never switches application configuration and always requires owner switch plus operator resume.

## 2026-07-24 - Day15-T3B10-T3B SQLite Repository Ports and Atomic Transactions

### Expose Named Transactions, Not a Database Handle

- Decision: The store constructs one restricted `EventContractCollectionRunnerRepository`; callers receive named T2-T10/T8B commands and sanitized immutable reads only.
- Rationale: This keeps authority, canonical validation, compare-and-swap, idempotency, budgets, and outbox evidence inseparable from persistence mutations.
- Consequence: Domain, provider, scheduler, and operator surfaces cannot execute arbitrary SQL or read raw canonical database JSON.

### Add an Explicit Validating Transition

- Decision: Add T8B `markTaskValidating` between the durable T8 attempt claim and T10 evidence commit.
- Rationale: T10 normatively requires `VALIDATING`, but the T2 transaction sequence did not define how `IN_FLIGHT` reached it.
- Consequence: The bridge is durable and audited but performs no request, stores no result, and changes no budget counter.

### Exhausted Attempts Cannot Return to Retry Wait

- Decision: T9 rejects `RETRY_WAIT` when the current attempt number has reached the task maximum.
- Rationale: Allowing the transition would create a task that advertises retry while T8 correctly prohibits a third claim.
- Consequence: The final attempt must finalize into `MISSED`, `TERMINAL_FAILED`, or `CANCELLED`.

## 2026-07-24 - Day15-T3B10-T3A SQLite Dependency and Migration Foundation

### Use Node's SQLite Binding for the Local Research Pilot

- Decision: Use Node 24.12+ built-in `node:sqlite` rather than adding an npm SQLite package.
- Reason: The synchronous standard-library boundary is sufficient for deterministic local migration/open checks and avoids a separate native addon, package license, install path, and dependency supply chain.
- Limitation: Node documents the module as active development. It is approved only for a single-host local research pilot and is not Alpha's commercial or production persistence decision.

### Open and Migrate Fail Closed

- Decision: Canonicalize the approved root, restrict store IDs, reject symbolic-link or non-file database/sidecar identities, disable extensions and ambiguous SQL parameter behavior, enable defensive mode, and verify every safety-critical pragma.
- Decision: Bind migration 001 to the exact SHA-256 digest of its SQL, apply schema and metadata atomically, reject forward/inconsistent/altered histories, and require the exact 14-table `STRICT` catalog plus clean quick and foreign-key checks.
- Consequence: The migration layer never silently repairs, downgrades, deletes, or adopts an unversioned database.

### Keep Database Authority Private

- Decision: Expose only sanitized immutable readiness, resolved store path, and close. Do not expose `DatabaseSync`, arbitrary SQL, or repository mutation operations.
- Consequence: T3B10-T3B must add reviewed named repository transactions instead of allowing callers to bypass domain and persistence invariants.

## 2026-07-24 - Day15-T3B10-T2 SQLite Schema and Transaction Boundaries

### The Pilot Store Is SQLite, Not NDJSON

- Decision: Specify one local SQLite `STRICT`/WAL store with one writer and transactional repository ports for the collection pilot.
- Reason: Runner state requires compare-and-swap updates, unique idempotency, durable leases, multi-record atomic commit, and crash recovery that current single-process NDJSON repositories cannot provide.
- Consequence: This is a local research-pilot storage direction only. Production and commercial persistence remain separately blocked.

### Invocation Claims and Results Are Separate Immutable Records

- Decision: Insert an immutable attempt claim before transport and append one immutable result afterward instead of updating one historical attempt row.
- Reason: Recovery must distinguish a durable invocation claim with no known result from a completed attempt without rewriting history.
- Consequence: Claim/result mismatches become explicit startup blockers, and one attempt cannot receive two results.

### Monotonic Time Cannot Cross a Restart Boundary

- Decision: Persist UTC lease chronology plus boot identity, process-session identity, and monotonic values; use monotonic comparison only within the same boot/session.
- Reason: A monotonic clock origin can change across process or system restart and cannot independently prove durable lease expiry.
- Consequence: Cross-restart recovery requires healthy UTC, the persisted expiry, a safety margin, explicit recovery evidence, and operator resume.

### Evidence Commit Is One Transaction

- Decision: Commit attempt result, normalized evidence, task transition, counters, lease removal, and outbox event atomically under `BEGIN IMMEDIATE`.
- Reason: Any partial combination would make recovery guess whether evidence was accepted and could duplicate or lose a research sample.
- Consequence: Commit acknowledgement loss is reconciled by idempotency key and fingerprint; conflicting evidence is an integrity incident and is never overwritten.

### Backup and Restore Must Prove Integrity

- Decision: Use a reviewed SQLite online backup mechanism, validate every backup independently, restore only to a new offline path, and require owner approval before switching stores.
- Reason: Ordinary copying of a live WAL database or in-place restore can produce inconsistent or destructive results.
- Consequence: Backup, restore, and corruption drills are implementation prerequisites before a real pilot.

## 2026-07-24 - Day15-T3B10-T1 Runner Contracts and State Validation

### Lifecycle Authority Is Validated Before Persistence Exists

- Decision: Implement immutable provider-neutral runner records and deterministic transition validation before adding SQLite, scheduling, or worker behavior.
- Reason: Persistence and orchestration must consume one reviewed state model rather than each inventing lifecycle and authority rules.
- Consequence: T3B10-T1 can construct research-only records and validate state edges, but it cannot activate, schedule, lease, retry, collect, or persist anything.

### Runner Ceilings Are Constants in the First Contract Version

- Decision: Require exactly one pilot, one worker, one in-flight request, one request per second, and a 1,000-millisecond clock-offset threshold; bound task attempts to two.
- Reason: Caller-configurable expansion would allow a future composition to bypass the reviewed pilot safety envelope.
- Consequence: Increasing concurrency, rate, clock tolerance, or retry count requires a new reviewed contract version.

### Platform and Exchange Admission Are Mutually Exclusive

- Decision: Require a complete admitted mapping for exchange-lane tasks and prohibit mapping fields on platform-lane tasks.
- Reason: An exchange mapping proves cross-venue identity but must not relabel exchange-native evidence as Robinhood-displayed platform evidence.
- Consequence: Each evidence lane remains explicit through task construction and incomplete platform evidence cannot be silently repaired.

### State Changes Use Compare-and-Swap Versions

- Decision: Require every pilot and task transition to provide the current aggregate version and an equal expected version, then increment exactly once.
- Reason: Later persistence needs deterministic stale-writer rejection and append-only transition ordering.
- Consequence: Same-state, skipped, reverse, stale-version, unknown, and terminal-state transitions fail closed before repository implementation.

## 2026-07-24 - Day15-T3B9 Collection Runner Architecture

### A Runner Coordinates Admitted Evidence; It Does Not Discover Authority

- Decision: Require every scheduled source task to bind a prospectively frozen event, provider fingerprint, exact mapping fingerprint, capability, source record, budgets, cutoff, and owner-approved pilot activation before transport.
- Reason: Dynamic discovery or mapping inside the runner would combine scheduling with source authority and could silently collect the wrong contract.
- Consequence: The initial runner architecture cannot discover markets, approve mappings, extend plans, or start without a separately approved activation.

### Platform and Exchange Evidence Remain Separate Lanes

- Decision: Preserve independent Robinhood platform and exchange-native evidence tasks through collection and commit.
- Reason: Kalshi data does not establish Robinhood-displayed quotes, order-preview fees, or platform observation time.
- Consequence: Kalshi-only automation cannot create a complete T1 observation or qualify the research dataset. Missing platform evidence remains explicitly missing.

### Missed Pre-Event Evidence Is Never Backfilled

- Decision: Mark an observation task `MISSED` when its evidence cutoff passes without eligible evidence.
- Reason: Later quotes, candlesticks, screenshots, or outcomes would contaminate a forward sample.
- Consequence: Runner failures reduce coverage instead of improving results through hindsight.

### At-Least-Once Reads End in Idempotent Atomic Commits

- Decision: Use append-only attempt history, durable leases, unique task idempotency keys, expected aggregate versions, and one atomic attempt/evidence/task/outbox transaction.
- Reason: A read-only provider call can be repeated after ambiguous failure, but accepted evidence must never be duplicated or overwritten.
- Consequence: A conflicting fingerprint is a terminal integrity incident. T3B10 should use single-host SQLite in WAL mode rather than concurrent NDJSON writes.

### One Retry and One Worker Are the Initial Hard Ceiling

- Decision: Permit one worker, one in-flight request, and at most two total attempts per task.
- Reason: The pilot must establish clock, cutoff, recovery, and idempotency behavior before adding throughput or distributed coordination.
- Consequence: Only timeout, connection failure, `429`, `5xx`, or an expired crash lease may retry, and no retry may cross the evidence deadline.

## 2026-07-24 - Day15-T3B8 Bounded Kalshi Live-Read Smoke

### One Exact Public Market Before Any Collection Runner

- Decision: Permit only the official public `GET /trade-api/v2/markets/KXBTC15M-26JUL232045-45` endpoint in T3B8.
- Reason: T3B7 proves the exact cross-venue identity for this market, while discovery or a changing current-market selector would introduce unreviewed mapping and scheduling authority.
- Consequence: T3B8 can validate one real transport path but cannot collect future events, poll, retry, discover markets, or populate a dataset.

### Default Dry Run and Separate Live Authorization

- Decision: Make the manual command network-free unless `--confirm-live-read` is supplied after a separate owner decision.
- Reason: Code approval and execution of an external request are distinct authority changes.
- Consequence: Automated tests and normal command execution make zero network calls. The owner later authorized exactly one successful real request, which does not authorize repetition or scheduling.

### Bounded Live Policy Is an Exact Capability Token

- Decision: Allow the source engine to accept only the existing exact fixture policy or one exact T3B8 policy with a 100,000-byte and one-record ceiling.
- Reason: Merely declaring `BOUNDED_LIVE_READ` on a provider must not enable arbitrary callers, budgets, or policies.
- Consequence: Altering the policy identity, execution modes, versions, byte budget, or record budget fails closed.

### Exchange Settlement Is Not a Robinhood Quote

- Decision: Normalize only settlement evidence from this live-read smoke and suppress raw quote, fee, rule, and price fields from the command result.
- Reason: Kalshi venue data cannot be relabeled as a Robinhood platform observation.
- Consequence: The smoke creates research-source lineage only and cannot create a T1 observation, ledger entry, probability, recommendation, or trade.

## 2026-07-24 - Day15-T3B7 Official Robinhood Mapping Evidence Correction

### Contract-Specific Terms Link Establishes the Exchange Mapping

- Decision: Treat the exact Robinhood public event page's direct `CRYPTO15M.pdf` link, together with identical window, target, BRTI source, and complete rules, as reviewed evidence that this platform contract maps to Kalshi market `KXBTC15M-26JUL232045-45`.
- Reason: The evidence is contract-specific and originates on Robinhood's official public event surface; it no longer relies on provider-name inference or display similarity alone.
- Consequence: The fixture adapter may construct one `REVIEWED_EXACT` mapping and one fixture-only settlement snapshot. The decision does not generalize to other Robinhood events.

### Preserve Native Labels and Opaque Identifiers Without Inventing Semantics

- Decision: Preserve Robinhood and Kalshi native titles separately, use a shared canonical semantic title inside the exact mapping, use the Robinhood page slug as platform market identity, and use the routable `event_contracts?id=` UUID as platform contract identity.
- Reason: Native titles differ even though the complete settlement rules are identical. Robinhood does not document the separate `ec_id` parameter's meaning.
- Consequence: Title presentation differences do not create a false mismatch, while `ec_id` remains evidence-only and cannot silently become a market or contract identifier.

### Content-Address the Terms Version

- Decision: Use the complete SHA-256 digest of the reviewed Kalshi `CRYPTO15M.pdf` bytes as the terms version.
- Reason: The official PDF contains no separate visible version number; a full content digest is reproducible and fails closed if the document changes.
- Consequence: A changed PDF requires a new evidence review and mapping version. The digest is not represented as a provider-issued human-readable version.

## 2026-07-24 - Day15-T3B7 Kalshi Fixture and Mapping Evidence Gate

### Exact Displayed Facts Establish a Candidate, Not Cross-Venue Identity

- Decision: Admit the official Kalshi BTC 15-minute payload as a concrete fixture while keeping the Robinhood mapping `PENDING`.
- Reason: The interval, target `$64,839.26`, and BRTI source match the operator screenshot, but the screenshot does not expose Robinhood's declared exchange, platform market/contract/terms IDs, terms version, or complete rule text.
- Consequence: Alpha can validate and normalize the exchange fixture, but it cannot create an eligible T3B6 mapping or exchange snapshot. T3B8 remains blocked until authoritative platform terms evidence closes every missing field.

### Provider Lifecycle Time Is Not Contract Evaluation Time

- Decision: Derive the reviewed evaluation time from the exact contract rule and market close, not from Kalshi's later `occurrence_datetime`.
- Reason: The fixture rule evaluates the BRTI averages at 8:30 and 8:45 PM EDT, while the lifecycle field is 8:50 PM EDT.
- Consequence: The adapter preserves the exact 15-minute contract semantics and does not shift the label by five minutes.

## 2026-07-24 - Day15-T3B6 Provider-Neutral Event Contract Source Contracts

### Capability Must Follow Source Authority

- Decision: Restrict provider capabilities by platform, exchange, settlement-reference, or operator-evidence source class.
- Reason: A technically available feed cannot claim facts outside the authority of its source.
- Consequence: Settlement references cannot claim platform quotes, operator evidence cannot claim credentials, and undeclared capabilities cannot produce snapshots.

### Exact Review Is a Deterministic Equality Claim

- Decision: Make `REVIEWED_EXACT` require complete equality across canonical BTC 15-minute terms and matching provider, exchange, and venue identities.
- Reason: A review label without machine-enforced content equality could conceal a one-field contract difference.
- Consequence: Any title, version, window, evaluation, threshold, target, settlement-source, or identity mismatch fails closed. Pending and rejected mappings cannot qualify snapshots.

### Declared Live Capability Is Not Live Authorization

- Decision: Represent a future bounded-live mode in provider capabilities while restricting the T3B6 snapshot policy to fixtures.
- Reason: Contract stability should precede a concrete adapter, but a type declaration must not silently authorize network use.
- Consequence: Bounded-live snapshot creation fails until the separately reviewed T3B8 policy changes the allowed execution boundary.

## 2026-07-24 - Day15-T3B5 Real Collection Source Architecture

### Cross-Venue Similarity Does Not Establish Contract Identity

- Decision: Require exact reviewed Robinhood-to-exchange mapping across the exchange, market, contract, side semantics, instrument, window, threshold, evaluation, settlement source, and terms version before exchange data can support a platform observation.
- Reason: Robinhood offers contracts through multiple exchanges, and visually similar events may differ in terms, venue liquidity, timing, or settlement.
- Consequence: Matching titles, target prices, or cutoff times remain insufficient. Ambiguous mappings fail closed and cannot enter the T1/T2 research ledger.

### Platform and Exchange Evidence Retain Separate Authority

- Decision: Preserve Robinhood quote and fee-preview evidence separately from exchange-native order books, trades, and settlements.
- Reason: A different venue's price or fee is not proof of what the operator could observe or trade on Robinhood.
- Consequence: A future adapter cannot relabel exchange quotes as Robinhood quotes, infer Robinhood fees, or fill missing platform evidence.

### Private Brokerage Automation Is Not a Collection Strategy

- Decision: Prohibit undocumented Robinhood endpoints, reverse-engineered mobile traffic, browser/mobile automation with an authenticated brokerage session, and reuse of brokerage credentials.
- Reason: These paths create material security, reliability, terms, and execution-safety risks before Alpha has a production secret or automation boundary.
- Consequence: Future collection uses reviewed official sources and separately approved bounded transports. Live reads, scheduling, persistence, and a forward pilot remain independent owner decisions.

## 2026-07-24 - Day15-T3B4 Local Collection Operator Surface

### Frozen Plans Are Created Once and Reverified Before Use

- Decision: Persist a prospective plan only through exclusive file creation and reconstruct both its canonical plan fingerprint and outer artifact fingerprint before progress inspection.
- Reason: Silent overwrite or trusting editable JSON would destroy the evidence that the declared population predated its outcomes.
- Consequence: Existing outputs and altered artifacts fail closed. A changed plan requires a new explicit artifact path and valid identity/version.

### Progress Inspection Must Not Initialize Collection State

- Decision: Require an already-existing Day15-T2 ledger before constructing its repository and keep `progress` read-only.
- Reason: A status command that silently creates an empty ledger can conceal an operator path error as zero collection coverage.
- Consequence: Missing, corrupt, or unsafe ledger identities fail explicitly; capture and settlement remain separate reviewed T1/T2 commands.

## 2026-07-24 - Day15-T3B3 Forward Shadow Collection Control

### Plan Identity Is Derived Before Outcomes

- Decision: Generate every BTC 15-minute event identity from one aligned future cutoff sequence and freeze the canonical plan before the first cutoff.
- Reason: Caller-authored event lists can hide gaps, duplicates, reordering, or post-outcome additions.
- Consequence: Late, misaligned, discontinuous, duplicated, or rewritten plans fail closed. A changed plan requires a different plan identity or version.

### Progress Reporting Must Not Select Research Samples

- Decision: Report all exact matching observations and settled candidates for every planned event without choosing one.
- Reason: Silent “best” or “latest” selection can introduce outcome-dependent bias and would take authority away from the explicit T3B2 binding.
- Consequence: T3B3 reports collection state and coverage only. T3A audit creation, T3B2 binding, and T3B qualification remain separate reviewed steps.

## 2026-07-24 - Day15-T3B2 Research Shadow Dataset Assembly

### Missing Evidence Must Remain Missing

- Decision: Assemble samples only from one explicit frozen-plan binding, one exact reconstructable shadow observation, one exact official settlement, and one eligible reconstructable T3A audit.
- Reason: Choosing a convenient ledger record, inferring an outcome, or repairing a missing event would silently reintroduce selection and lookahead bias after the integrity gate.
- Consequence: Missing, unsettled, duplicated, cutoff-mismatched, audit-mismatched, or feature-mixed events block assembly and produce no T3B input.

### Assembly Is an Adapter, Not a Data Pipeline

- Decision: Keep T3B2 as an in-memory deterministic engine over caller-supplied read-only snapshots; do not add a filesystem console, scheduler, provider, or repository.
- Reason: Existing NDJSON storage is a local single-process development ledger and must not become an implied production collection pipeline.
- Consequence: Manual T1/T2 capture and T3A audit preparation remain separate. The existing T3B engine retains sole qualification and split authority.

## 2026-07-24 - Day15-T3B Research Dataset Qualification and Temporal Split

### Collection Intent Must Predate Outcomes

- Decision: Require one continuous BTC 15-minute collection plan to be frozen strictly before its first event cutoff and measure qualification against the full declared plan.
- Reason: Choosing events after seeing their results creates selection bias even when every individual feature record passes point-in-time leakage checks.
- Consequence: Missing or unplanned events reduce or invalidate coverage; a clean subset cannot silently replace the declared population.

### Minimum Eligibility Is Not Statistical Proof

- Decision: Require explicit minimum sample, date, coverage, outcome-count, and outcome-balance thresholds plus one immutable feature and Research Integrity policy lineage.
- Reason: Individually valid observations can still form a dataset too small, narrow, imbalanced, or operationally inconsistent to support honest model research.
- Consequence: `QUALIFIED` means only that a pre-declared minimum research gate passed; it does not establish predictability, calibration, profitability, or trade authority.

### Time Order and Embargo Protect Evaluation

- Decision: Split deterministically by event cutoff into training, calibration, and sealed final-test partitions, remove embargo samples between adjacent partitions, and require all earlier labels to be known before the next partition begins.
- Reason: Random shuffling and overlapping outcome windows leak later market states and tuning information into earlier research.
- Consequence: Any split-integrity issue blocks the dataset and returns no partitions. Day15-T3B adds no model, probability, threshold, recommendation, sizing, or execution behavior.

## 2026-07-23 - Day15-T3A Research Integrity and Leakage Prevention

### Information Availability, Not Dataset Download Time, Defines Historical Knowledge

- Decision: Preserve occurrence, publication, supported availability, and receipt as separate timestamps. Historical replay may receive and freeze a dataset after the simulated cutoff only when the exact source version has a reviewed point-in-time availability reference at or before that cutoff.
- Reason: Requiring historical files to have been downloaded in the past would make retrospective research impossible, while using later corrections without their original availability time would create lookahead bias.
- Consequence: `HISTORICAL_REPLAY` and `FORWARD` have different receipt/freeze gates, but neither may use a source version unavailable at the cutoff.

### Completed Intervals and Outcomes Fail Closed

- Decision: Canonical Bar evidence must be final and end no later than the research cutoff. Outcome, settlement, or caller-marked outcome-bearing evidence is forbidden from pre-outcome research.
- Reason: An unfinished candle and an already-known result can make a weak strategy appear accurate even though neither was available at decision time.
- Consequence: Leakage remains an explicit `BLOCKED` audit issue; it cannot be averaged away or downgraded to a warning.

### Frozen Manifest Is Research Eligibility, Not Model Authority

- Decision: Bind every audit to one exact dataset manifest of evidence IDs and content fingerprints and emit only `ELIGIBLE` or `BLOCKED` under `RESEARCH_ONLY_NOT_TRADE_AUTHORITY`.
- Reason: Reproducible model work requires exact inputs, but clean inputs alone do not establish sample sufficiency, calibration, profitability, or a tradable edge.
- Consequence: Day15-T3A creates no probability, recommendation, expected value, sizing, Decision/Risk/Portfolio mutation, broker, order, or execution path.

## 2026-07-23 - Day15-T2 Event Contract Shadow Ledger

### Outcome Evidence Must Be Bound to the Original Observation

- Decision: Preserve validated event-contract observations in a canonical append-only local ledger and accept one later official settlement only when it matches the exact observation, terms, contract, and declared settlement source.
- Reason: Calibration based on unrelated, revised, duplicated, or unverifiable outcomes would create false model confidence.
- Consequence: Exact replay is idempotent, conflicting IDs and second settlements fail closed, repository history is revalidated on reload, and both-side hypothetical net results retain observation and settlement fingerprints.

### Shadow Accounting Does Not Grant Trading Authority

- Decision: Calculate only fee-inclusive hypothetical UP and DOWN outcomes from the recorded order previews and official winning side.
- Reason: This establishes the evidence needed to measure future model quality without claiming that Alpha made or executed a decision.
- Consequence: Every result is `SHADOW_ONLY_NOT_TRADE_AUTHORITY`; Day15-T2 adds no probability model, recommendation, sizing, broker integration, credential access, network request, order, or execution path.

## 2026-07-23 - Day15-T1 BTC Event Contract Observation

### Contract Facts Precede Probability

- Decision: Add one immutable BTC 15-minute observation boundary that requires exact settlement semantics, BRTI reference-price identity, both UP/DOWN quotes, both order-fee previews, and exact evidence references before later probability work.
- Reason: A chart title or displayed price cannot establish whether the event is evaluated at expiry or by touch, which source settles it, or what fee-inclusive price must be beaten.
- Consequence: Missing, stale, future, unrelated, arithmetically inconsistent, or undeclared data fails closed. Day15-T1 emits no recommendation or probability estimate.

### Fee-inclusive Break-even Is Deterministic Observation Arithmetic

- Decision: Derive maximum profit and break-even probability from exact caller-supplied order previews, while leaving mutable fee schedules and actual execution truth with Robinhood and the exchange.
- Reason: Cheap contracts can have large fee percentages, and high-price contracts can require a materially higher win probability than the headline price suggests.
- Consequence: Preview price must bind to the exact quote, subtotal and fees must reconcile, payout must equal one dollar per contract, and no-profit previews are rejected. The record remains observation-only and cannot size or execute a position.

## 2026-07-23 - Day13/Day14 Owner-review Corrections

### Boundary Shape and Provenance Fail Closed

- Decision: Recursively reject undeclared Capital Allocation fields, construct outputs from explicit allow lists, bind each eligible candidate to the exact gated Fusion record, and restrict future evidence sources to the dedicated extension boundary.
- Reason: Broad cloning or type/state-only evidence checks could preserve hidden ranking, leverage, sizing, provider, credential, AI, order, or unrelated evidence authority.
- Consequence: Unknown or mismatched nested data produces structured validation failure. Candidates remain `UNRANKED`; no new authority or runtime integration is added.

### Risk and Event Observations Preserve Exact Ordering

- Decision: Require Risk evaluation at or after both Fusion and Market Regime, require unique explicit constraints for `CONSTRAINED`, and bind Event Analyzer candles to the immediately preceding completed PT1M interval, exact current-price close, canonical BTC instrument, event identity, observation time, and bounded local provenance.
- Reason: A formally valid but stale, unrelated, or temporally impossible record cannot satisfy an evidence or Risk gate.
- Consequence: Incoherent Event evidence is invalid and `NO_TRADE`; impossible Risk ordering blocks allocation construction. Local provenance remains fixture coherence, not authoritative external market truth.

### Fixed-decimal and Git Validation Are Bounded

- Decision: Bound Event Analyzer atomic values to 24 digits and scales to `0..8`, reject unsafe bigint conversions, keep body-pressure shares exactly complementary, and validate staged and unstaged whitespace separately.
- Reason: Non-finite numeric output and staged-diff validation blind spots undermine deterministic review evidence.
- Consequence: Unsafe calculations fail closed before output, JSON cannot silently convert non-finite values to `null`, and staged whitespace defects fail `alpha:validate`.

## 2026-07-22 - Day14-T1 Capital Allocation Framework v1.0

### Capital Allocation Is Downstream of Evidence and Risk

- Decision: Add one deterministic construction boundary that requires a current Portfolio reference, a `READY` Fusion snapshot, an accepted Market Regime assessment, and a `CLEARED` or `CONSTRAINED` Risk assessment before constructing an immutable allocation recommendation.
- Reason: Prediction or producer-specific evidence must never directly create an allocation. Allocation needs one auditable envelope without duplicating Portfolio, Evidence Fusion, Market Regime, or Risk authority.
- Consequence: Missing, stale, contradictory, rejected, future-dated, or insufficient upstream state produces structured validation failure and no partial recommendation. Existing engines and source records remain unchanged.

### V1 Standardizes Candidates but Does Not Rank or Size Them

- Decision: Define bounded candidate metadata, optional integer-basis-point weight placeholders, `UNRANKED` priority, deterministic candidate-ID ordering, cash posture, avoid records, and review-oriented actions without an allocation algorithm.
- Reason: Opportunity Ranking, weight optimization, leverage, and execution each require separate evidence, policy, validation, and ownership. Implementing them inside a foundation contract would hide authority and encourage premature coupling.
- Consequence: `topCandidates` means eligible for later review, not scored winners. V1 never calculates a weight, score, probability, expected return, leverage ratio, order size, or trade.

### Recommendation Authority Is Not Execution Authority

- Decision: Mark every output `FRAMEWORK_ONLY_NOT_EXECUTION_AUTHORITY` and keep future Leverage Decision and Opportunity Ranking engines external and downstream.
- Reason: A standardized recommendation is an analytical capital-allocation output, not an approved trade plan, owner approval, Portfolio mutation, broker order, or execution instruction.
- Consequence: Portfolio System remains capital-state truth, Risk Engine retains constraint authority, and Decision/trade-plan, owner-approval, leverage, ranking, and execution integrations require separate milestones. No AI, API, provider, persistence, or runtime wiring is added.

## 2026-07-21 - Day13-T3 Deterministic One-minute Candle Correction

### Structured Candles Replace Coarse Momentum Authority

- Decision: Add a bounded 5..30 candle `PT1M` input with exact UTC chronology and fixed-decimal OHLCV validation. Derive returns, direction streaks, body pressure, close location, range expansion, acceleration, relative volume, reversal risk, and richer momentum deterministically.
- Reason: A real v0.1 test returned BUY UP while recent structure was reversing downward. The manually supplied UP label could not represent the weakening evidence and was incorrectly treated as adequate.
- Consequence: Candle-derived momentum overrides manual momentum. Legacy momentum-only analysis remains visible for comparison but always returns `NO_TRADE`; malformed and insufficient candle evidence also fails closed.

### Candle Influence Is Bounded and Still Uncalibrated

- Decision: Apply versioned, capped candle contributions to the existing target-distance/time heuristic and clamp final output to 10%..90%. No single feature may create an extreme estimate.
- Reason: Recent structure is relevant but one small window cannot establish a calibrated probability or guarantee the event outcome.
- Consequence: Every assessment exposes the exact features, quality, contradictions, versions, and `calibrated: false`. Relative volume makes no absolute volume-unit claim, and missing volume contributes nothing.

### Contradiction Blocks the Selected Side, Not Automatically Buys the Opposite

- Decision: Require sufficient evidence, positive edge, acceptable market price, time, and no severe side contradiction for BUY. Up-to-down reversal blocks BUY UP; down-to-up reversal blocks BUY DOWN.
- Reason: Capital protection requires refusing unstable evidence rather than mechanically flipping into an opposite position.
- Consequence: `NO_TRADE` remains the fail-closed outcome. Decision, Risk, portfolio, brokerage, and execution authority remain unchanged.

## 2026-07-21 - Day13-T2 Event Analyzer Console Prototype

### Probability Is a Transparent Uncalibrated Test Heuristic

- Decision: Implement one fixed-decimal BTC 15-minute heuristic from target distance, remaining time, and an explicit momentum classification. Preserve its versioned inputs, policy, formula, fingerprint, and `calibrated: false` disclosure.
- Reason: The first executable workflow needs deterministic output without pretending that Alpha has historical calibration, a statistical model, provider evidence, or AI authority.
- Consequence: The estimate may be compared with a caller-supplied binary contract price, but it is not a probability guarantee, expected return, or evidence that a strategy is profitable.

### Recommendation Requires Edge and Remains Non-authoritative

- Decision: High probability alone never produces `BUY`. `BUY` requires the selected contract's estimated fair value to exceed market price by the versioned minimum edge while enough time remains; small positive edge produces `HOLD`, and non-positive edge or too little time produces `NO_TRADE`.
- Reason: Separating outcome likelihood from price paid prevents an expensive high-probability contract from appearing attractive merely because its event is likely.
- Consequence: Profitability remains `NOT_EVALUATED`; fees, spread, slippage, liquidity, execution quality, sizing, Risk constraints, and portfolio effects are outside the calculation.

### Console Output Does Not Bypass Evidence, Decision, or Risk

- Decision: Treat every Day13-T2 result as `PROTOTYPE_ONLY_NOT_AUTHORIZED`. The console is an isolated test harness, not the Decision Engine, and does not consume live/provider data or issue execution instructions.
- Reason: Alpha's “No Evidence, No Decision” and capital-control boundaries remain authoritative even when a prototype emits the requested analytical vocabulary.
- Consequence: A future actionable workflow must separately supply reviewed event evidence through Evidence Fusion, Decision evaluation, Risk evaluation, owner approval, and execution controls. Day13-T2 adds none of those integrations.

## 2026-07-21 - Day13-T1 Evidence Fusion Layer Foundation

### Future Decision and Risk Consumers Depend on Fusion, Not Producers

- Decision: Add one provider-neutral Evidence Fusion boundary that validates explicit source inputs and returns one immutable snapshot. Future Decision and Risk integrations may consume that snapshot, never raw benchmark observations or producer-native contracts.
- Reason: Direct dependencies on Broad Market, Sector, Volatility, Breadth, News, Macro, Calendar, or Liquidity producers would duplicate evidence gates and tightly couple decision logic to source evolution.
- Consequence: Day13-T1 supports only Broad Market Evidence through an explicit adapter. New evidence domains require a reviewed discriminated source type, adapter, policy entry, fixtures, and version change.

### Fusion Is a Fail-closed Gate Without Scoring Authority

- Decision: Accept only complete, current, schema-compatible, sufficiently referenced required evidence. Preserve missing, incomplete, stale, future-dated, contradictory, and invalid states as explicit blockers or validation failures.
- Reason: Scores, probabilities, or narrative aggregation could conceal required blockers and violate No Evidence, No Decision.
- Consequence: `READY` means only that the Fusion evidence gate passed. It is not a market regime, recommendation, trade signal, risk approval, or execution authorization.

### Unified Audit Remains Authoritative

- Decision: Translate Fusion assessments into the existing Unified Audit input and create no Fusion-specific persistence or audit repository.
- Reason: A second audit authority would fragment traceability and recovery semantics.
- Consequence: Fusion preserves source assessment/snapshot identity, source and fusion policy versions, evidence references, snapshot fingerprint, issues, contradictions, warnings, and audit references through one deterministic translation.

## 2026-07-21 - Day12-T1 Broad Market Evidence Foundation

### Broad-market Composition Precedes Regime Classification

- Decision: Add one provider-independent Broad Market Evidence snapshot and deterministic composition engine between reviewed Canonical Bar references and a future Market Regime input adapter.
- Reason: Market Regime must not assemble unrelated benchmark observations or allow future consumers to invent conflicting definitions of broad-market coverage.
- Consequence: The new layer reports evidence facts and quality only. Market Regime remains the authority for bull, bear, correction, relief-rally, range, and condition classifications; Decision and Risk behavior is unchanged.

### Benchmark Membership Is Explicit and Reviewed

- Decision: Versioned policy declares every ETF or index Canonical Instrument benchmark as required or optional, and snapshot membership must match it exactly. Individual equities, symbol guessing, provider aliases, and automatic discovery are rejected.
- Reason: A popular ticker or provider symbol is not a durable broad-market identity or proof of representative coverage.
- Consequence: Missing evidence remains explicit, optional absence warns without automatically failing required sufficiency, and provider-native data cannot cross the snapshot boundary.

### Evidence Quality and Strength Are Fail-closed Facts

- Decision: Compose `COMPLETE`, `PARTIAL`, `STALE`, `CONTRADICTORY`, and `INSUFFICIENT` through explicit precedence and use evidence-strength bands only for deterministic adequacy, never probability.
- Reason: Cross-benchmark disagreement, stale observations, and missing required membership must remain visible and cannot be averaged into a regime or confidence score.
- Consequence: Feature calculations are fixed-decimal and versioned; assessments preserve canonical observation references, policy/rule/feature versions, issues, warnings, and Unified Audit traceability without persistence or action authority.

## 2026-07-21 - Day11-T2 Market Regime Engine Foundation

### Regime Describes Environment but Does Not Authorize Action

- Decision: Add one immutable provider-independent regime snapshot and one deterministic engine that returns a primary price-structure regime, independent secondary conditions, evidence strength, reason codes, unresolved requirements, and versioned policy metadata.
- Reason: Future Volume, Breadth, Risk, Signal, Research, and Backtesting work needs a shared market-environment vocabulary without duplicating Decision Engine or Risk Engine authority.
- Consequence: `BULL_TREND`, `BEAR_TREND`, `CORRECTION`, `RELIEF_RALLY`, `RANGE_BOUND`, and `INSUFFICIENT_EVIDENCE` are primary outcomes. `HIGH_VOLATILITY` may coexist as a condition. An assessment cannot recommend, size, plan, execute, mutate portfolio state, or override risk.

### Distribution and Accumulation Require Verified Non-price Evidence

- Decision: Treat `DISTRIBUTION_RISK` and `ACCUMULATION_CANDIDATE` as evidence-dependent secondary conditions. The conservative v1 gate requires verified volume evidence with explicit unit semantics and verified breadth evidence.
- Reason: Price movement alone cannot establish market-wide distribution or accumulation, and Alpha currently has no approved breadth source or general verified equity-volume semantics.
- Consequence: Missing, unverified, unavailable, or contradictory supplemental evidence remains an ordered unresolved requirement. AI, provider narrative, or a transport-success response cannot fill the gap.

### Evidence Strength Is Not Probability

- Decision: Use `STRONG_EVIDENCE`, `MODERATE_EVIDENCE`, `WEAK_EVIDENCE`, and `INSUFFICIENT_EVIDENCE` only as deterministic coverage classifications.
- Reason: Alpha has no calibrated statistical regime model, so numeric confidence or probability would be misleading.
- Consequence: Every assessment preserves the exact feature values, policy/rule-set version, reason codes, source references, input fingerprint, and Unified Audit translation needed to reconstruct the result.

## 2026-07-21 - Day11-T1 Twelve Data Live Smoke Transport Foundation

### One Manual HTTPS Request Is a Separate, Fail-closed Capability

- Decision: Add one Twelve Data-owned concrete HTTPS transport and one explicit manual command. Dry run is the default; transport invocation requires `--confirm-live-smoke` and is bounded to AAPL, PT5M, one request, 10 records, one API credit, and one regular trading day.
- Reason: The fixture adapter must be tested against the real provider only through a reviewable seam that cannot become polling, automation, routing, persistence, or trading authority. Credentials must remain process-local and every diagnostic must remain redacted.
- Consequence: The transport allow-lists the Twelve Data HTTPS endpoint, rejects redirects, supports timeout/cancellation, performs no retry, and returns safe typed errors. Tests inject fake executors and make no live calls. Owner execution remains a separate authorization after code review.

### Unverified Live Equity Volume Blocks Canonical Acceptance

- Decision: Permit sanitized transport/parser diagnostics but reject live Canonical Bar acceptance until official evidence proves the equity-volume unit required by Alpha.
- Reason: Treating the provider's `volume` field as canonical `BASE_UNITS` without authoritative evidence would violate No Truth Without Traceability.
- Consequence: A successful provider response may report `BLOCKED_UNVERIFIED_VOLUME`; no unknown unit is invented, no Canonical validity rule is weakened, and no data is persisted or forwarded to Evidence, Decision, Risk, Portfolio, Replay, or execution systems.

## 2026-07-21 - Day10-T3B Market Data Boundary Consolidation

### Provider Registry Authority Is Bound Through Explicit Composition

- Decision: Keep the Provider Registry as the sole provider-metadata authority and bind capability-specific adapters through a separate immutable composition boundary. A provider may expose distinct Quote and Bar adapters; duplicate bindings fail per provider ID plus capability.
- Reason: Registry records and adapter descriptors previously formed catalogs that could disagree, and the service rejected one provider implementing multiple capabilities. Composition validates identity, lifecycle/enablement, capability, and asset-class compatibility without making the registry instantiate adapters.
- Consequence: `MarketDataService` is a small facade over Quote and Bar orchestrators. There is no universal adapter, runtime reflection, automatic selection, routing, fallback, or live transport.

### Observation Content Is Separate from Local Ingestion Metadata

- Decision: Canonical Quote and Bar fingerprints represent stable provider observation content and exclude receipt, normalization, quality-evaluation, local freshness, and ingestion-run metadata. Logical identity remains separate and stable across content corrections.
- Reason: Re-fetching unchanged provider content at a later local time must not masquerade as a market-data correction.
- Consequence: Exact duplicates and provider corrections are classified using the observation fingerprint. A future complete-ingestion-record fingerprint must be separate. FNV-1a remains deterministic local change detection, not cryptographic integrity.

### Live Smoke Requires a Versioned Manual Fail-closed Policy

- Decision: Any future Twelve Data smoke execution must name approved evidence, provider, symbol, interval, lookback, record and API-credit limits and must prohibit polling, persistence, and secret logging.
- Reason: An injected transport interface is not permission to perform network activity. Live behavior requires explicit bounded owner approval and unresolved volume evidence still blocks acceptance.
- Consequence: D10-T3B validates the policy contract only; it adds no concrete transport or network request.

## 2026-07-20 - Day10-T1 Twelve Data Development-Provider Decision

### Official Evidence Authorizes Only a Constrained Intraday Bar Adapter

- Decision: Approve Twelve Data as Alpha's first development market-data provider only for a future personal/internal, REST-only, fixture-first U.S. stock/ETF intraday Bar adapter governed by `TWELVE-DATA-BAR-NORMALIZATION-1.0` and immutable reviewed Provider Symbol mappings.
- Reason: Official sources establish authentication, Basic-plan limits, listed U.S. stock/ETF access, `/time_series` interval/timestamp/order/adjustment semantics, and a current non-commercial personal/internal licensing path. They also establish that the default real-time U.S. feed represents about 5% of trading volume and leave record IDs, publication times, corrections, volume units, and retention duration unresolved.
- Consequence: Default intraday coverage is `PARTIAL_MARKET`, never SIP or NBBO; unknown endpoint semantics fail closed; P1D, extended hours, persistence, streaming, live requests, public display, redistribution, Paper Trading, brokerage, and execution remain unauthorized. Approval expires outside the documented private-development scope. See [Twelve Data Official Evidence and Bar Semantics](research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md).

## 2026-07-20 - D9-T2 Provider Registry Foundation

### Provider Metadata and Adapter Implementations Are Separate Authorities

- Decision: Use one immutable provider registry as the authority for canonical provider identity, lifecycle status, declared capabilities, supported asset classes, static discovery priority, default enablement, and documentation. Adapter descriptors remain implementation compatibility declarations and are not the discovery catalog.
- Reason: Provider discovery must not depend on adapter instances, runtime reflection, domain imports, or provider-specific schemas. Separating metadata from implementations lets future providers add reviewed records without changing registry logic or domain systems.
- Consequence: Registration is constructor-time and validated; results are immutable and deterministically ordered. Priority is discovery order only, not dynamic ranking or selection. The registry does not instantiate adapters, call APIs, route, fail over, or authorize provider use.

## 2026-07-20 - D9-T1 Market Data Layer Foundation

### Market Data Uses a Provider-Neutral, Quote-First, Fail-Closed Boundary

- Decision: Alpha's first Market Data Layer contract supports explicit latest-quote requests over caller-selected provider adapters. Canonical identities are Alpha-owned, monetary values use fixed-decimal atomic strings and scale, observation and receipt time remain distinct, and transport, normalization, validation, and availability remain separate result stages.
- Reason: This is the smallest useful provider boundary for future Evidence, Replay, and Paper Trading consumers. It prevents provider schemas and aliases from becoming domain truth and prevents transport success from bypassing deterministic validation.
- Rejected alternatives: Direct provider clients in Evidence, Decision, Risk, or Dashboard; floating-point canonical prices; inferred timestamps or units; AI repair or validation; opaque data-confidence scores; silent provider fallback or merging; and a premature universal market-data ontology. Trades, bars, event contracts, streaming, live adapters, persistence, and downstream wiring require separate review.

## 2026-07-20 - D8-T3B Minimal Knowledge Approval Foundation

### Eligibility Does Not Grant Authority

- Decision: Implement eligibility as a pure, versioned, deterministic result that can only declare a Candidate Knowledge item eligible for owner review or blocked. Approval always requires a separate explicit owner decision with an authorization-policy reference.
- Reason: Mechanical evidence checks can fail closed but cannot grant durable knowledge authority. Keeping the records separate prevents AI content, profitability, or a passed checklist from becoming implicit approval.
- Consequence: Missing or incomplete Strategy Reviews, non-`SUFFICIENT` evidence, unavailable sources, missing provenance, inadequate samples, incompatible versions, material conflicts, staleness, or missing owner authority remain visible blockers. The narrow severe-safety exception changes sample eligibility only and still requires the owner.

### Append-only Local Aggregate and Read-only Projection

- Decision: Use one cohesive local aggregate with explicit Candidate, owner-decision, Approved Knowledge, and lifecycle records; store them in an append-only in-memory development repository and expose a separate read-only projection.
- Reason: Candidate and Approved Knowledge must remain distinct and immutable without adding production infrastructure or a competing persistence/audit framework.
- Consequence: Exact typed claim keys and command identities are deterministic, terminal history cannot be reopened, supersession/deprecation/revocation are appended, and Unified Audit translation reuses the existing Learning Review conventions. Production transactions, authentication, persistence, AI adapters, and Strategy Change Proposals remain deferred.

## 2026-07-20 - D8-T3A Knowledge Approval Layer Architecture

### No Strategy Change Without Approved Knowledge

- Decision: Adopt “No Strategy Change Without Approved Knowledge” as a fail-closed architecture rule. Facts, interpretations, Candidate Knowledge, Approved Knowledge, Strategy Change Proposals, and Strategy Versions are separate records and approval gates.
- Reason: A completed or profitable result can support a candidate lesson without proving a reusable rule. Collapsing review, learning, and strategy change would invite overfitting, hindsight bias, and unauthorized mutation.
- Consequence: Only current, applicable Approved Knowledge may support a future Strategy Change Proposal. Approved Knowledge does not itself require, create, approve, or activate a strategy change; Strategy Versioning and owner approval remain authoritative, and active frozen plans remain unchanged.

### Deterministic Eligibility, Owner-only Approval

- Decision: Versioned deterministic policy may block a Candidate Knowledge item or declare it eligible for owner review, but only an authorized owner may approve or reject knowledge during the personal-system phase.
- Reason: Evidence completeness, lifecycle status, provenance, sample counts, version compatibility, conflicts, and stale sources are deterministic checks; granting durable authority is a governance decision.
- Consequence: Incomplete reviews, non-`SUFFICIENT` review evidence, unresolved conflicts, incompatible versions, stale sources, missing authority, and unmet policy fail closed. AI narrative or confidence cannot satisfy a blocker or grant approval. A single verified severe safety or hard-policy violation may use only an explicit versioned exception and still requires owner approval.

### Immutable Knowledge Lifecycle Without a Memory Database

- Decision: Knowledge Approval owns append-only candidate, decision, and Approved Knowledge lifecycle records, including explicit supersession, deprecation, and revocation. It does not become a general notes, research, pattern, configuration, or memory database.
- Reason: Journal, Research Lab, Historical Pattern Library, Evidence Assessment, Strategy Review, and Strategy Versioning already own their records; copying their payloads would create conflicting authority.
- Consequence: The layer stores bounded approved statements and typed references. Duplicate and contradiction checks use exact declared keys and scopes, not fuzzy or semantic matching. Prior history is never edited or deleted.

### One Cohesive Minimal Implementation

- Decision: After D8-T3A owner approval, implement one bounded D8-T3B Knowledge Approval Foundation containing contracts, deterministic approval guards, owner decisions, append-only lifecycle, an in-memory repository/current read model, and audit translation.
- Reason: Separate Candidate, Approval Workflow, and Approved Knowledge Store tasks would leave partial authority boundaries and add overhead without improving the Phase 1 MVP.
- Consequence: Strategy Change Proposal workflow, AI review adapters, broader retrieval, and production persistence remain backlog. D8-T3B should close the minimum governance gap without delaying API and Paper Trading work.

## 2026-07-20 - D8-T2 Strategy Review Foundation

### Single-Cycle Review Before Performance Evaluation

- Decision: Implement Strategy Review as a deterministic read-only assessment of one explicitly completed prediction, frozen-plan, execution, risk, and realized-outcome cycle.
- Reason: Alpha needs to preserve prediction quality, execution quality, risk discipline, and trading profitability independently before any reviewed learning or multi-strategy evaluation can be trusted.
- Consequence: The foundation consumes normalized, versioned source snapshots and produces no source mutation, aggregate score, ranking, execution instruction, lesson approval, or strategy change. Durable outcome persistence and multi-cycle comparison remain future work.

### Finalized Snapshot Without Production Outcome Authority

- Decision: Permit the local foundation to classify realized profitability only when a caller supplies an explicit finalized read snapshot with source and audit references.
- Reason: Existing `TradeRecord` contracts contain structured plan-adherence, risk-review, and realized economic fields, but Alpha does not yet have a durable append-only Trade Outcome Log.
- Consequence: D8-T2 can prove dimension separation and lifecycle behavior without claiming production durability or replacing a future Trade Outcome Log. Pending, unavailable, or unrealized outcomes cannot produce a completed formal review.

### Independent Dimensions and Frozen-Trade Protection

- Decision: Never infer one review dimension from another and never allow Strategy Review to reopen a completed trade or modify an active frozen plan.
- Reason: Profit can coexist with an incorrect prediction, non-compliant execution, or a risk violation; a correct prediction can coexist with a loss.
- Consequence: Profitable violations remain violations, no composite strategy score exists, all lessons require later human review, and regret, excitement, or fear of missing out cannot emit re-entry behavior.

## 2026-07-19 - Architecture Checkpoint 1: Deterministic Intelligence Layer Direction

### Evidence Assessment Before Recommendation

- Decision: Begin the next phase with an Evidence Assessment Foundation that derives transparent completeness, availability, provenance, version-consistency, and limitation indicators only from explicit linked evidence.
- Reason: Day 7 now supplies read-only historical evidence and cross-system link resolution, but no consumer should turn heterogeneous evidence into an opaque recommendation or a new source of truth.
- Consequence: The proposed “Evidence Engine” is renamed to Evidence Assessment Foundation. It remains deterministic, read-only, provider-neutral, and unable to create links, infer relevance, rank capital opportunities, or change Decision/Risk/Portfolio/Trade state.

### No Evidence, No Decision Gate

- Decision: Adopt “No Evidence, No Decision” as a fail-closed architecture rule. A decision request may proceed to downstream decision evaluation only when its required evidence assessment is explicitly `SUFFICIENT` under a traceable, versioned deterministic policy.
- Context or problem: Missing, unresolved, unavailable, or materially conflicting required evidence could otherwise be silently ignored, hidden by averaging, or replaced by unsupported AI reasoning.
- Rationale: A categorical evidence gate preserves source provenance, makes blockers explainable, and prevents an incomplete evidence set from acquiring false authority through a recommendation or confidence score.
- Rejected alternatives: AI guessing, semantic inference, silently dropping unresolved items, averaging required conflicts into a score, and treating optional evidence as universally mandatory.
- Consequences: `INSUFFICIENT`, `CONFLICTING`, and `UNAVAILABLE` stop progression. `SUFFICIENT` is necessary but never guarantees `BUY`, `ENTER`, profitability, or execution; the Decision Engine still evaluates the opportunity, the Risk Engine may reject or constrain it, frozen-plan rules remain binding, and human approval or later execution controls may still be required. AI cannot override the gate.

### Strategy Review Before Knowledge Approval

- Decision: Follow evidence assessment with a deterministic single-cycle Strategy Review, then a separately governed Knowledge Approval Layer.
- Reason: Strategy Versioning already owns version lineage, validation, approval, activation, comparison, and recorded performance evidence; Prediction Log already separates forecast evidence, outcomes, and reviews. A broad learning engine would duplicate authority and risk reactive strategy changes.
- Consequence: Prediction quality and trading profitability remain separate. A future durable Trade Outcome Log remains required for production outcome authority and multi-cycle evaluation. Candidate Knowledge requires owner approval before it becomes Approved Knowledge, and any strategy change remains a later separate proposal and Strategy Versioning approval.

### No General-Purpose Alpha Memory Authority

- Decision: Defer Alpha Memory as a general database. Treat any future need as a read-only Knowledge Retrieval Policy / Read Model with a concrete consumer, authority-precedence rules, privacy/retention review, and production-persistence alignment.
- Reason: Journal, Research Lab, Config, Strategy Versioning, Historical Pattern Library, project documentation, and existing evidence links already own the proposed fact categories.
- Consequence: No duplicate memory store, embeddings, semantic retrieval, automatic relationship discovery, or graph database is approved for Day 8.

### Milestone Review, Not an Intelligence Review Engine

- Decision: Merge “Intelligence Layer Review” into continuous task review and the D8-T4 milestone review.
- Reason: A standing review engine would add no source authority or deterministic calculation beyond normal architecture, validation, and owner-review procedures.
- Consequence: D8-T4 is documentation and validation reconciliation only; it creates no runtime subsystem.

## 2026-07-19 - Day 7 Integration and Evidence Foundations Complete

- Decision: Record D7-T1 through D7-T4 as complete local foundations: Python-TypeScript Integration Boundary, Unified Validation Reporting, Historical Evidence Product Surface, and Cross-System Evidence Linking.
- Reason: The four tasks provide a narrow read boundary, normalized validation reporting, stable historical evidence access, and explicit version-aware link resolution without transferring domain ownership.
- Consequence: Day 8 may consume explicit evidence through deterministic read models. No Day 7 component is a dashboard, graph database, recommendation engine, AI reasoning layer, automatic learning mechanism, production persistence system, provider integration, or capital-execution path.

## 2026-07-19 - D7-T1 Python-TypeScript Integration Boundary

### Contract and Port Before Runtime Implementation

- Decision: TypeScript application code depends on a versioned typed client and transport port, while a fixed Python entry point owns request dispatch to existing Python domain engines.
- Reason: Consumers must not depend on Python modules, shell commands, raw stdout, or Python exceptions, and the transport must remain replaceable.
- Consequence: The local subprocess is an adapter only. A future service transport can replace it without changing business consumers or registered operation contracts.

### Closed Operation Registry

- Decision: Python executes only exact operations in an immutable registry, beginning with the read-only `risk.calculate_limits` operation over the existing deterministic Risk Engine.
- Reason: Arbitrary module/function execution would create command-execution risk, weak validation, and unstable coupling; duplicating the risk calculation in TypeScript would create competing business logic.
- Consequence: New operations require mirrored contracts, validation, registration, focused tests, and architecture review. Caller-selected imports, module paths, functions, and process arguments are prohibited.

### Local Subprocess Foundation

- Decision: Use a fixed no-shell local subprocess with bounded JSON stdin/stdout, timeout, and output size for the current single-owner local runtime.
- Reason: Alpha already has a local Python prototype and TypeScript core, while HTTP, deployment, authentication, background services, and network operations are not justified for one read-only capability.
- Consequence: The synchronous adapter is not a production service boundary. Remote transport, retries, process supervision, mutable operations, cross-runtime transactions, and product wiring remain separate owner-reviewed work.

## 2026-07-19 - Day 6 Milestone Closeout

### Historical Evidence Infrastructure Completed for Local Foundations

- Decision: Close Day 6 with Codex workflow rules, production persistence architecture, Historical Pattern Library, Historical Analogy Engine, and Event Replay Architecture recorded as complete local foundations.
- Reason: The five Day 6 tasks establish development workflow, production-readiness boundaries, and deterministic historical evidence primitives without expanding into production systems.
- Consequence: Day 7 can plan integration work from stable documentation and contracts, but no Day 7 implementation is included in the closeout.

### Production Boundaries Remain Closed

- Decision: Keep production persistence, live provider adapters, live market data, broker integration, backtesting, execution simulation, Python/TypeScript runtime integration, and automated capital execution as future owner-reviewed work.
- Reason: Day 6 intentionally defined or implemented foundations only; production behavior requires separate architecture, validation, and owner approval.
- Consequence: Current repositories remain local single-owner development persistence, and Alpha remains a decision-support system with owner-controlled execution.

## 2026-07-19 - D6-T5 Event Replay Architecture Foundation

### Evidence Reconstruction, Not Backtesting

- Decision: Implement Event Replay as deterministic reconstruction of caller-supplied historical timelines, observation windows, and immutable checkpoints.
- Reason: Alpha needs stable chronology and replay provenance before research or learning systems cite event timelines.
- Consequence: Replay reports completeness, confidence, quality, missing data, and limitations, but it does not calculate returns, simulate execution, optimize strategy, or predict future outcomes.

### References Without Ownership Transfer

- Decision: Event Replay may freeze references to Historical Events, Historical Patterns, Historical Analogies, Research Lab, Prediction Log, Alpha Journal, snapshots, and supporting source evidence.
- Reason: Replay evidence should connect existing sources of truth without rewriting or replacing them.
- Consequence: Historical Pattern Library remains historical truth, Historical Analogy Engine remains comparison truth, Research Lab remains interpretation truth, and Decision/Risk/Portfolio/Trade systems retain authority.

### Local Append-Only Foundation

- Decision: Provide defensive in-memory and canonical local NDJSON repositories under `data/runtime/event-replays/` with no update, overwrite, or delete path.
- Reason: This matches Alpha's development persistence convention while avoiding premature production storage choices.
- Consequence: Local replay storage remains unencrypted single-owner, single-process development persistence. No provider, network, live-market, broker, Python, production persistence, or Day 7 work is added.

## 2026-07-19 - D6-T4 Historical Analogy Engine Foundation

### Deterministic Comparison, Not Prediction

- Decision: Compare frozen current-situation dimensions against exact finalized Historical Event or Historical Pattern versions with transparent integer basis-point arithmetic.
- Reason: Reproducible comparison evidence reduces subjective analogy while preventing AI-generated scoring or hidden model behavior from becoming authoritative.
- Consequence: Similarity, difference, completeness, evidence quality, candidate quality, and comparison confidence are separate; no score implies causation, future return, or a trading signal.

### Explicit Missing Data and Bias

- Decision: Every weight profile declares one missing-data policy, and every result preserves missing weight, exclusions, material differences, bias risks, and limitations.
- Reason: Treating unknown input as a neutral match would inflate similarity and conceal evidence weakness.
- Consequence: Required missing data may fail closed, be penalized, remain incomplete, or require review; high similarity with low completeness cannot be high quality.

### Frozen Authority Boundaries

- Decision: Historical Pattern Library remains historical truth and Research Lab remains interpretation truth; analogy records freeze exact candidate, snapshot, profile, method, and limitation evidence without mutating consumers.
- Reason: Comparison must not rewrite historical evidence or become an implicit Prediction, Strategy, Decision, or Risk override.
- Consequence: Later candidate, snapshot, profile, or method changes create a new analogy and append-only supersession. Prediction/Strategy references are compatibility boundaries only.

### Local Append-Only Foundation

- Decision: Provide defensive in-memory and canonical local NDJSON repositories under `data/runtime/historical-analogies/` with no update, overwrite, or delete path.
- Reason: The established development convention proves ordering, replay, corruption handling, privacy-aware export, and audit translation without selecting production storage.
- Consequence: Local storage remains unencrypted single-owner, single-process development persistence. No AI provider, network, embedding, vector database, live market data, Event Replay, broker, Python, or production persistence is added.

## 2026-07-19 - D6-T3 Historical Pattern Library Foundation

### Separate Historical Events from Reusable Patterns

- Decision: Historical Event records preserve what happened and under which regime; Historical Pattern records preserve reusable evidence-backed structures derived from one or more events.
- Reason: Treating an event as a pattern would hide sample size, exceptions, regime dependence, and the difference between observation and generalization.
- Consequence: Patterns require supporting finalized events and limitations, never claim guaranteed recurrence, and cannot become predictions or trading decisions.

### Preserve Fact and Interpretation Boundaries

- Decision: Store historical facts, quantitative observations, source claims, interpretations, inferences, hypotheses, disputed claims, counterevidence, and unknowns as distinct classifications.
- Reason: Historical narratives are exposed to hindsight and causal overstatement; confidence alone cannot convert an inference into fact.
- Consequence: Deterministic validation requires source evidence for factual claims and rejects structurally detectable inference-as-fact and guaranteed-recurrence language.

### Append-Only Historical Authority

- Decision: Finalized historical records are immutable; corrections, reviews, supersession, and archive state append new records without update, overwrite, or deletion.
- Reason: Later research or reinterpretation must not rewrite what evidence and classification were authoritative at an earlier time.
- Consequence: Repository sequence is authoritative, prior records remain visible, supersession rejects cycles, and local NDJSON remains development persistence only.

### Future Analogy Boundary

- Decision: Define only frozen queries and a provider-neutral input boundary for a future Historical Analogy Engine.
- Reason: Stable evidence contracts are needed now, but comparison, replay, backtesting, prediction, and capital decisions require separate specifications and owner review.
- Consequence: D6-T3 adds no analogy scoring, Event Replay, live data, provider/network integration, automated prediction, trading authority, or D6-T4 work.

## 2026-07-19 - D6-T2 Production Persistence and Recovery Architecture

### Architecture Before Production Storage

- Decision: Define production persistence, transaction, crash-recovery, backup, restore, retention, durability, integrity, and repository-ownership requirements before selecting or implementing any production storage technology.
- Reason: Alpha's current repositories are intentionally local and single-process; production durability affects evidence integrity, external side effects, owner review, and future capital safety.
- Consequence: D6-T2 adds architecture only. No production database, runtime persistence change, provider integration, network/API code, credential path, broker integration, or market integration is added.

### Preserve Development Persistence

- Decision: Keep existing in-memory and local NDJSON repositories as development persistence while documenting that they are not production storage.
- Reason: The local repositories remain valuable for deterministic tests and inspectable single-owner development.
- Consequence: Future production repositories must preserve provider-neutral ports and must not break local development repositories.

### Transaction or Outbox Required

- Decision: Production workflows must use either a single transactional boundary or a reviewed transactional outbox/inbox boundary for multi-step durable state.
- Reason: Separate repository appends cannot be treated as atomic, especially before live provider execution or future broker/market integrations.
- Consequence: Future implementation tasks must define crash points, replay ownership, idempotent consumers, poison/dead-letter handling, and manual reconciliation before production use.

### Durable Execution Claims

- Decision: Live provider execution requires a durable execution claim before any cost-bearing invocation.
- Reason: Recovery must distinguish not-invoked from invoked-but-not-persisted states without guessing or repeating external side effects.
- Consequence: Production providers remain blocked until durable execution claims and recovery behavior are implemented and owner-reviewed.

## 2026-07-19 - D6-T1 Development Efficiency Standard v1

### Quality-First Token Optimization

- Decision: Centralize repeated Codex execution, validation, reporting, owner-review, and Git-safety rules in `docs/CODEX_DEVELOPMENT_STANDARD.md`.
- Reason: Future tasks can use shorter prompts only after stable requirements are version-controlled and unambiguous.
- Consequence: Token optimization is accepted only when architecture quality, implementation quality, test coverage, validation rigor, owner review, auditability, and safety boundaries remain intact.

### Context Layers and Prompt Compression

- Decision: Use a five-layer context hierarchy covering permanent core context, architecture context, subsystem context, task context, and evidence context.
- Reason: Loading every specification for every task wastes context, but omitting relevant authority documents creates architecture drift.
- Consequence: Future prompts may reference the Codex standard and task template for stable rules, while uncertainty still requires targeted inspection rather than guessing.

### Validation Bundle Boundary

- Decision: Add a dependency-free local `npm run alpha:validate` bundle for existing safe checks while preserving individual commands.
- Reason: Alpha's validation workflow has become repetitive enough to centralize locally without adding dependencies, network access, provider SDKs, credentials, runtime-data mutation, or Git side effects.
- Consequence: The bundle is a convenience wrapper only. It does not replace task-specific validation judgment, owner approval, commits, pushes, or Development Validation Log persistence.

### D6-T2 Boundary

- Decision: D6-T1 does not begin Development Validation Log report integration, production persistence work, historical engines, or Python/TypeScript runtime integration.
- Reason: Those areas require separate specifications and owner review.
- Consequence: At D6-T1 completion, Day 6 had started but D6-T2 had not started. D6-T2 is now recorded as a separate architecture decision above.

## 2026-07-19 - Day 5 Learning Infrastructure Milestone

### Local Evidence Foundations Completed

- Decision: Close Day 5 with Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, and Development Validation Log implemented as deterministic provider-neutral TypeScript foundations.
- Reason: Together they establish distinct sources of truth for predictions, context and reflection, research, strategy lineage, and engineering-task evidence without transferring authority between systems.
- Consequence: The milestone provides contracts, validators, deterministic engines, focused tests, in-memory repositories, and local append-only NDJSON repositories where specified. It does not claim production persistence, cross-repository transactions, live data, provider execution, or Python/TypeScript runtime integration.

### Production and Day 6 Boundary

- Decision: Record Day 6 priorities as proposed follow-up work only; do not treat them as implemented or approved by the Day 5 closeout.
- Reason: Production hardening and development-workflow integration require separate specifications, owner review, and explicit scope.
- Consequence: Day 6 has not started. Current foundations remain single-owner local development systems, and all capital, provider, network, credential, and external-execution boundaries remain unchanged.

### Milestone References

- Prediction Log: `9677838c930c05d900eb8fa5c3b05af5bfa09a4a`
- Alpha Journal: `2098353a41215d70fcb02fff61f34e930a5ecea8`
- Research Lab: `41105b70254d94d9058fa9f4b958cbfbd8a3d579`
- Strategy Versioning: `50686a955930a182b49d6d9b02381d74974c71e2`
- Development Validation Log: `cc9fb3fb47b467764ee9227993e77047a5c1a11d`

## 2026-07-18 - Development Validation Log Foundation

### Structured Engineering Memory, Not a Git Replacement

- Decision: Development Validation Log is the append-only authority for structured task, scope, validation, warning, defect, risk, owner-decision, Git-reference, handoff, lesson, and follow-up evidence.
- Context or problem: Git proves code history but does not preserve the complete requested goal, validation meaning, environment warnings, accepted risks, approval conditions, and follow-up context.
- Rationale: One immutable sequence-ordered record per engineering event preserves historical intent without copying raw diffs or logs.
- Consequences: Git remains code/version-history truth, Unified Audit remains trace truth, HANDOFF/CHANGELOG remain summaries, Alpha Journal remains reflection truth, and issue tracking remains future external work.

### Deterministic Lifecycle and Owner Authority

- Decision: Enforce ordered task evidence from PLANNED through implementation, validation, owner review, approval, commit, push, handoff, and close; require owner identity for review/approval/rejection; reject AI owner impersonation.
- Context or problem: Recording approval, commit, or push out of order would make workflow evidence misleading and weaken the existing owner-controlled Git process.
- Rationale: Explicit status transitions and category-specific requirements make every milestone independently reviewable.
- Consequences: Blocking failures prevent approval unless an immutable owner exception names the evidence, reason, and follow-up. Environment warnings remain distinct from code failures.

### Git Evidence Is Supplied, Never Executed

- Decision: Store structured branch, base commit, resulting commit, message, remote, push, synchronization, and working-tree evidence supplied by the workflow; never invoke Git from the subsystem.
- Context or problem: A record repository that performs Git operations would mix evidence ownership with side effects and duplicate Git authority.
- Rationale: Pure reference validation preserves a narrow deterministic boundary and supports local tests without repository mutation.
- Consequences: The caller remains responsible for verifying external Git facts. The log detects internal conflicts but does not fetch, commit, push, tag, or repair history.

### Local Persistence and Day 6 Boundary

- Decision: Provide defensive in-memory and canonical append-only local NDJSON repositories only; defer report-convention and automation integration to a separately reviewed Day 6 task.
- Context or problem: Alpha needs a structured record target before defining a future Codex development standard, but must not begin that standard implicitly.
- Rationale: Existing local event-store patterns prove identity, sequence, replay, privacy, export, corruption, and path behavior at low cost.
- Consequences: Files are unencrypted, single-process development storage without cross-system transactions. No `CODEX_DEVELOPMENT_STANDARD`, provider/network integration, business-logic mutation, or future-task creation is included.

## 2026-07-18 - Strategy Versioning Foundation

### Immutable Authority and Semantic Lineage

- Decision: Strategy Versioning is the sole authority for immutable strategy definitions, version snapshots, semantic lineage, lifecycle history, and explicit changes.
- Context or problem: Mutable strategy settings cannot prove which rules, parameters, assumptions, evidence, or risk boundaries governed a historical decision.
- Rationale: Content-derived identity, direct-parent lineage, exact PATCH/MINOR/MAJOR enforcement, and append-only events prevent hindsight rewriting.
- Consequences: Draft editing remains outside the authoritative repository. Published versions are never updated or deleted, and material changes require evidence.

### Owner-Controlled Lifecycle and Active-Version Invariant

- Decision: Authoritative versions begin PROPOSED; validation and approval are separate; only the owner can approve or reject; activation requires passed validation and valid owner approval; at most one version per definition is ACTIVE.
- Context or problem: AI or subsystem self-approval would collapse recommendation and authority, while multiple active versions would make decision provenance ambiguous.
- Rationale: Explicit lifecycle gates preserve human control and deterministic eligibility.
- Consequences: AI may propose or analyze but cannot approve or activate. Suspension blocks new plan freezes, rejection remains visible, and retirement preserves history.

### Trade-Plan Freeze and Rollback Policy

- Decision: A new trade plan may reference only an ACTIVE strategy and freezes its exact version, ruleset fingerprint, parameters, risk-policy reference, decision timestamp, and owner approval. Rollback always creates a new version.
- Context or problem: Referencing a mutable or merely latest strategy would let later changes silently alter historical intent.
- Rationale: Frozen references preserve the rule set used at decision time; a new rollback version preserves both failure and recovery evidence.
- Consequences: The foundation defines a contract only. It adds no trade repository, broker, execution, or automatic restoration path.

### Evidence Ownership, Performance, and Local Persistence

- Decision: Link external evidence through typed frozen references, keep prediction accuracy, trading profitability, and process quality metrics separate, and provide only in-memory plus canonical local NDJSON persistence in v1.
- Context or problem: Copying source records would create conflicting authorities, blended performance would hide causes, and production integration is not yet approved.
- Rationale: References and separated metric groups preserve provenance; narrow append-only repositories prove behavior without operational overclaim.
- Consequences: Prediction Log, Research Lab, Alpha Journal, and Unified Audit retain their ownership. Local files remain unencrypted, single-process development storage with no provider, network, live-market, credential, or cross-repository transaction guarantee.

## 2026-07-18 - Research Lab Foundation

### Append-Only Research Authority

- Decision: Research Lab is the source of truth for structured point-in-time research evidence and conclusions; authoritative records begin finalized and are never updated or deleted.
- Context or problem: The prior generic Research placeholder exposed create, update, and delete operations and could not preserve what evidence justified a conclusion before later information arrived.
- Rationale: Canonical content-derived identity, complete draft-to-finalized provenance, immutable evidence, and separate amendments, reviews, and supersession preserve historical honesty.
- Consequences: Draft collection and analysis remain workspace state. Finalized and superseded research, sources, assumptions, counterevidence, and uncertainty remain retrievable.

### Evidence Ownership and Frozen References

- Decision: Research Lab links to Prediction Log, Alpha Journal, Unified Audit, and future Strategy/Historical systems only through stable typed resolved/unresolved references.
- Context or problem: Copying or mutating records across systems would create conflicting authorities and allow later research to rewrite locked predictions.
- Rationale: Frozen research version, status, conclusion, and confidence references give downstream systems sufficient evidence without transferring ownership.
- Consequences: Prediction Log remains prediction truth, Alpha Journal remains context/reflection truth, Unified Audit remains normalized trace truth, and future Strategy Versioning remains the only strategy-state authority.

### Local Persistence and External Integration Boundary

- Decision: Research Lab v1 provides deterministic in-memory and canonical append-only local NDJSON repositories only.
- Context or problem: Alpha needs reviewable local evidence before approving production storage, live sources, or provider integrations.
- Rationale: A narrow single-process repository proves validation, ordering, replay, privacy, and corruption behavior without network or operational complexity.
- Consequences: Local files are unencrypted and not multi-writer or transactionally coordinated. No market-data API, scraping, provider SDK, credential, AI generation, Strategy Versioning, historical engine, or business execution is included.

## 2026-07-18 - Alpha Journal Foundation

### Authoritative Evidence, Not Mutable Notes

- Decision: Store only finalized Journal entries in the authoritative repository; keep draft workspace behavior outside the append-only port.
- Context or problem: Mutable draft and finalized records in one repository would blur when a note becomes evidence and permit hindsight overwrite.
- Rationale: Finalization as the first event produces a clear evidence boundary while append-only reviews, amendments, and archive history preserve later knowledge honestly.
- Consequences: There is no update, overwrite, or delete interface. Reviews and amendments never replace original text or context.

### Typed Evidence Without Ownership Transfer

- Decision: Link Prediction, Research, Decision, Trade, Strategy, Portfolio, Audit, Journal, and Development Validation records through stable typed resolved/unresolved references.
- Context or problem: Copying external records into Journal would duplicate sources of truth, while untyped IDs would weaken traceability.
- Rationale: Typed references preserve subsystem ownership and support future systems that do not exist yet.
- Consequences: Prediction Log remains prediction truth. Journal cannot mutate predictions, strategies, trades, decisions, or portfolio state.

### Privacy-Aware Local Event Store

- Decision: Use deterministic in-memory and canonical local NDJSON event repositories with non-public defaults and restricted export.
- Context or problem: Personal evidence can be sensitive and needs inspectable durability before a production database is selected.
- Rationale: Existing Alpha event-store conventions provide monotonic ordering, idempotency, defensive copies, strict reload, and low operating cost without new dependencies.
- Consequences: `LOCAL_ONLY` cannot be externally exported and sensitive export may require authorization. Local files remain unencrypted, single-process, and non-production.

## 2026-07-18 - Prediction Log Repository and Review Lifecycle

### Prediction as Immutable Evidence

- Decision: Treat the canonical prediction snapshot as immutable evidence identified deterministically from its complete canonical content.
- Context or problem: Mutable status, amendment, resolution, and deletion operations could allow hindsight changes and weaken later learning evidence.
- Rationale: Append-only lifecycle events preserve what Alpha expected before outcome while still allowing state reconstruction and review.
- Consequences: The repository exposes no delete or overwrite path. Outcome, review, and archival information is appended as new linked records.

### Accuracy and Profitability Separation

- Decision: Store and aggregate prediction accuracy independently from trading profitability.
- Context or problem: A correct forecast does not guarantee profitable execution, and profitability does not prove forecast quality.
- Rationale: Separate classifications and rationales allow future Learning Loop and Trade Outcome analysis to attribute forecast, decision, execution, and position-sizing quality honestly.
- Consequences: No component may derive one measurement from the other. Not-applicable and indeterminate cases remain explicit.

### Local Event-Store Boundary

- Decision: Use defensive in-memory storage and append-only local NDJSON event persistence for the Day 5 foundation.
- Context or problem: Alpha needs reviewable local prediction history before selecting a production database or integrating later business systems.
- Rationale: A versioned event envelope proves the repository port and restart reconstruction with no new dependency or external service.
- Consequences: The local store is single-owner and single-process only. It does not provide cross-record transactions, signing, encryption, backup, multi-writer coordination, or production crash recovery.

## 2026-07-18 - Alpha AI Infrastructure v1 Milestone

### Provider-Independent Foundation Completed

- Decision: Accept AI Infrastructure v1 as the implemented and tested deterministic foundation spanning Router, Cost Governor, Provider Adapter boundary, Execution Coordinator, Reservation Manager, Cost Ledger, Unified Audit Repository, and Runtime Workflow.
- Rationale: Provider-neutral contracts and explicit subsystem authority prevent the first live provider from defining Alpha's business, budget, accounting, or audit architecture.
- Consequences: The milestone contains no production adapter or live API integration. AI remains advisory and cannot mutate capital state.

### Production Provider Gate

- Decision: Do not add or enable a production provider until durable execution claims and transactional or reviewed outbox/inbox behavior for workflow, reservation, ledger, and audit state receive owner review.
- Rationale: Repository-level idempotency cannot safely infer whether a cost-bearing external call occurred before a crash.
- Consequences: Production credentials, adapters, billing reconciliation, health polling, and rollout remain separate future tasks.

### Specification and Local Persistence Policy

- Decision: Major subsystems require an approved specification before implementation. Local canonical NDJSON is approved only for current single-owner, single-process development.
- Rationale: Specifications stabilize ownership and failure boundaries; local files provide inspectable development durability without pretending to be a production database.
- Consequences: Cost Ledger remains monetary truth and Unified Audit Repository remains evidence truth. Local persistence provides no cross-repository transaction, encryption, backup, archival, or multi-writer safety.

### Milestone References

- AI Router foundation: `3e47739ffb956621fdba8c22b39e023ac544eb27`
- AI Cost Governor foundation: `20993926a532e91625807df1ff7a760dd4b7a397`
- Alpha AI Infrastructure v1: `780ca3a9ebd889cab05c479f0a7270cf08f61f8e`

## 2026-07-18 - Deterministic AI Runtime Orchestration

### Thin Workflow, Existing Authorities

- Decision: Coordinate the provider-neutral AI lifecycle in one deterministic workflow while leaving Router, Cost Governor, Reservation Manager, Cost Ledger, Unified Audit Repository, and Execution Coordinator authoritative for their existing responsibilities.
- Context or problem: Correct standalone components did not prove safe ordering or identity continuity across a complete request.
- Rationale: A thin orchestration boundary prevents bypass of routing, budget, reservation, accounting, and audit gates without duplicating subsystem policy.
- Consequences: Router remains the only model selector, Cost Ledger remains the monetary source of truth, Unified Audit remains the evidence source of truth, and the workflow owns no capital-domain behavior.

### Replay Boundary Before Provider Invocation

- Decision: Store a canonical complete workflow result by workflow and idempotency identity and return it for exact replay without re-entering orchestration.
- Context or problem: Repository-level idempotency cannot make a repeated external provider invocation harmless.
- Rationale: The workflow result is the minimum local execution-deduplication boundary and makes caller replay deterministic.
- Consequences: The v1 repository is in memory and defensive but not durable. Production requires a durable execution claim that can distinguish not-invoked from invoked-with-unpersisted-response states.

### Explicit Compensation, No Fake Atomicity

- Decision: Report ordered compensation actions and replay/manual-reconciliation dispositions rather than claim rollback across separate repositories.
- Context or problem: Reservation, ledger, audit, workflow, and provider execution do not share a transaction.
- Rationale: Explicit release, ledger replay, audit replay, and manual reconciliation preserve evidence and prevent hidden repeated execution.
- Consequences: A later failure never silently reverses a successful monetary transition or reruns a provider. Production requires a transactional store or reviewed outbox/inbox design before live providers are enabled.

## 2026-07-18 - Unified Append-Only Audit Evidence

### Evidence Index, Not Business Authority

- Decision: Normalize subsystem audit records behind one append-only evidence repository while leaving each source system authoritative for its decisions and state.
- Context or problem: Router, cost, reservation, execution, and ledger audits otherwise cannot be reviewed as one deterministic chain.
- Rationale: Stable cross-system references and trace reconstruction improve review and debugging without coupling source engines or duplicating business logic.
- Consequences: The repository never routes, approves budget, mutates reservations, executes providers, or calculates monetary usage. The Cost Ledger remains the accounting source of truth.

### Repository Sequence and Privacy Boundary

- Decision: Assign atomic monotonic audit sequences independently from timestamps and require privacy and retention classifications on every normalized record.
- Context or problem: Equal or delayed timestamps cannot uniquely order evidence, while unclassified exports could cross local or sensitive boundaries.
- Rationale: Repository order, explicit stale-import policy, privacy downgrade prevention, and export authorization produce deterministic and reviewable behavior.
- Consequences: `LOCAL_ONLY` evidence cannot enter external exports; configured `SENSITIVE` exports require authorization. Retention remains metadata only and no update/delete interface exists.

### Canonical Local Persistence

- Decision: Use canonical append-only NDJSON under a Git-ignored audit runtime directory for current single-owner development.
- Context or problem: Restart-persistent evidence is useful now, but selecting a production database before transactional requirements are reviewed would be premature.
- Rationale: The existing Cost Ledger storage pattern provides a small, inspectable durability proof using only the standard library.
- Consequences: Reload fails on malformed, truncated, duplicate, non-canonical, or sequence-inconsistent data. The implementation is not concurrent-writer safe, encrypted, authenticated, or a production transaction boundary.

## 2026-07-18 - Append-Only AI Cost Accounting

### Ledger Sequence as Accounting Order

- Decision: AI cost events are immutable and ordered by repository-assigned monotonic sequence rather than caller timestamp.
- Context or problem: Equal, stale, retried, or delayed timestamps cannot provide unique accounting order, and rewriting history would hide operational inconsistencies.
- Rationale: Atomic local sequence assignment, immutable caller identities, and canonical payload fingerprints make replay and reconciliation deterministic.
- Consequences: Identical idempotent replay retains the original entry and sequence. Out-of-order business timestamps fail closed unless policy explicitly allows and flags them.

### Local NDJSON Persistence Boundary

- Decision: The current durable local ledger uses canonical newline-delimited JSON under a Git-ignored runtime directory, with strict reload validation and no new dependency.
- Context or problem: Alpha needs restart-persistent accounting during single-owner development without prematurely selecting a production database, ORM, or distributed coordination model.
- Rationale: Append-only standard-library files preserve history, remain inspectable, and prove the persistence port while keeping implementation and operating cost low.
- Consequences: The repository flushes each append and refuses corrupt, truncated, duplicate, non-canonical, or traversal-derived input. It is single-process only; a future transactional store must atomically coordinate reservation, ledger, operation, and audit records.

### Manual Adjustments Are New Authorized Events

- Decision: A manual adjustment is permitted only by explicit policy and authorization reference and is always a new signed append-only event.
- Context or problem: Owner corrections are sometimes necessary, but altering prior entries would destroy the accounting trail.
- Rationale: A dedicated signed delta with reason and target scope preserves both the original event and its correction.
- Consequences: Normal entries remain non-negative. Adjustments cannot delete, replace, convert, or silently repair prior history.

## 2026-07-18 - Deterministic AI Reservation Lifecycle

### Versioned Reservation State Machine

- Decision: Approved Cost Governor plans are acquired and settled only through explicit reservation states with safe integer amount conservation and compare-and-set versions.
- Context or problem: Read-only budget snapshots cannot prevent duplicate acquisition, stale overwrite, double settlement, or indefinitely retained unused amounts.
- Rationale: A small provider-independent state machine makes accounting transitions deterministic and independently testable before any live provider is introduced.
- Consequences: `COMMITTED`, `RELEASED`, `EXPIRED`, `CANCELLED`, and `REJECTED` are terminal. Partial settlement preserves committed usage and releases only the remainder.

### Idempotent Operations and Instruction-Only Ledger Boundary

- Decision: Every mutation requires caller-supplied deterministic operation and idempotency IDs; successful operations return append-only ledger instructions but do not persist Cost Ledger entries.
- Context or problem: Retries must reproduce their original outcome without applying cost twice, while durable cross-system audit storage is not yet approved.
- Rationale: Canonical payload fingerprints, stored original results, operation uniqueness, and optimistic versions provide a clear local transaction boundary without introducing a database prematurely.
- Consequences: The in-memory reservation repository is test/local only and is not distributed-safe. The Cost Ledger can now persist instructions locally, but production storage must atomically persist reservation state, operation results, ledger entries, and audits behind provider-neutral ports.

## 2026-07-18 - Deterministic AI Execution Coordination

### Single-Attempt Coordination

- Decision: The execution coordinator validates immutable Router, Cost Governor, reservation, adapter, health, and trace inputs before invoking exactly one selected adapter.
- Context or problem: A live orchestration layer could otherwise reroute, bypass budget approval, retry without cost visibility, or hide inconsistent references.
- Rationale: A single-attempt deterministic boundary completes the pipeline while preserving upstream ownership and making every outcome auditable.
- Consequences: The coordinator never selects another provider/model or runs a retry loop. Invalid or missing inputs fail closed before adapter execution.

### Instruction-Only Retry and Settlement

- Decision: Retry, return-to-Router, reservation release/retain, and usage commit are returned as deterministic plans and instructions rather than executed side effects.
- Context or problem: Durable reservation and ledger services do not exist, and hidden retries could create unapproved cost.
- Rationale: Explicit instructions preserve future transactional boundaries and owner visibility without pretending persistence or idempotency is solved.
- Consequences: The deterministic local Runtime Workflow now enacts settlement instructions and returns retry/fallback control explicitly. Durable production persistence and recovery remain separate reviewed work.

## 2026-07-18 - AI Provider Adapter Execution Boundary

### Provider-Neutral Execution Contract

- Decision: Future provider integrations must implement a shared request, response, compatibility, health, usage, and normalized-error interface after Router selection and Cost Governor approval.
- Context or problem: Adding a first provider directly to the Router or business modules would expose vendor types and make that provider the implicit execution architecture.
- Rationale: A narrow adapter interface preserves replaceability and keeps core logic independent from SDKs, credentials, and provider-native behavior.
- Consequences: Adapters execute only the selected provider/model and must preserve routing, cost-decision, reservation, trace, and correlation references.

### Coordination and Adapter Separation

- Decision: Adapters report outcomes and retryability but do not route, retry, approve cost, acquire or commit reservations, persist data, or select fallbacks.
- Context or problem: Combining these responsibilities would let vendor integrations bypass deterministic policy and create unclear budget ownership.
- Rationale: The execution coordinator can own a single attempt while the separate Reservation Manager owns reservation lifecycle and adapters remain translation boundaries.
- Consequences: The adapter foundation includes only contracts, validation, an in-memory registry, and a test-local fixture. Production adapters and durable reservation persistence require separate owner-reviewed tasks.

## 2026-07-18 - Deterministic AI Cost Governor Boundary

### Integer Monetary Enforcement

- Decision: AI cost policy is evaluated in non-negative safe integer minor units under one declared currency and scale.
- Context or problem: Floating-point arithmetic and mixed currencies can make exact budget boundaries ambiguous.
- Rationale: Integer arithmetic makes equality, remaining budget, reservations, and audit values deterministic.
- Consequences: The Router boundary converts major-unit estimates once using a 1,000,000-unit scale; invalid, unsafe, or currency-mismatched values fail closed.

### Reservation and Persistence Separation

- Decision: The foundation returns a reservation plan and defines a ledger repository port but performs no persistence or provider execution.
- Context or problem: Reliable production budget enforcement requires durable transactional reservation storage and reconciliation; the implemented in-memory Reservation Manager is not sufficient for that boundary.
- Rationale: Separating pure evaluation from atomic acquisition keeps policy testable while making the future consistency boundary explicit.
- Consequences: An allowed plan is not permission to execute until the Reservation Manager acquires it. Commit, release, and expiry now exist in memory; durable atomic state, ledger, audit, and usage reconciliation remain separate reviewed work.

### Router Integration Boundary

- Decision: Router estimates and aggregate usage are translated through a provider-neutral mapping boundary before governor evaluation.
- Context or problem: Directly embedding budget persistence or provider concerns in the Router would couple planning, enforcement, and execution.
- Rationale: A narrow mapping preserves existing Router behavior and lets both engines evolve behind stable contracts.
- Consequences: Core business logic depends only on neutral contracts; future provider or ledger implementations do not change capital-domain rules.

## 2026-07-18 - Deterministic AI Router Planning Boundary

### Provider-Independent Selection

- Decision: The AI Router planning engine evaluates provider-neutral profiles using hard eligibility constraints followed by deterministic, stable ordering.
- Context or problem: Alpha needs to balance capability, privacy, reliability, latency, context, and cost without coupling business logic to a provider or introducing random routing.
- Rationale: Provider-neutral contracts and explicit rejection and ranking rules allow providers and models to be replaced through configuration while keeping every selection reproducible and auditable.
- Consequences: Provider display names never affect selection, all rejected candidates retain normalized reasons, and identical request, configuration, budget, and clock snapshots produce identical decisions.

### Planning and Execution Separation

- Decision: The minimum Router Engine ends after returning a routing decision, fallback plan, and audit record.
- Context or problem: Combining selection with provider execution would introduce SDK, credential, network, retry, and persistence concerns before the deterministic boundary is proven.
- Rationale: A planning-only engine is easier to validate and preserves the architecture rule that provider adapters remain replaceable infrastructure.
- Consequences: The engine performs no network calls, model invocation, retries, audit persistence, or business action. Those capabilities require separate reviewed tasks.

## 2026-07-16 - Architecture Consistency Review

### Prediction Freeze Placement

- Decision: Finalize and freeze prediction records before the final capital decision and execution.
- Context or problem: Predictions recorded after decisions or execution could be changed with hindsight.
- Rationale: Preserving the original forecast enables an honest comparison between prediction quality, decision quality, execution quality, and outcomes.
- Consequences: Later evidence must be stored as a linked amendment or resolution and must not rewrite the original prediction.

### Decision Engine Ownership

- Decision: Specialized systems own opportunity evaluation, prediction records, instrument ranking, and risk constraints. The Decision Engine combines those outputs and owns the final capital decision and approved trade plan.
- Context or problem: Broad Decision Engine responsibilities overlapped with specialized systems and made ownership unclear.
- Rationale: Explicit boundaries prevent duplicated logic and preserve independent evaluation stages.
- Consequences: The Decision Engine coordinates validated outputs but does not replace upstream evaluation or Risk Engine enforcement.

### Execution Boundary

- Decision: Execution remains external and owner-controlled. Future broker integration must not bypass owner approval, the frozen trade plan, or Risk Engine limits.
- Context or problem: Alpha is a decision-support system, and execution authority must remain explicit.
- Rationale: Owner control and deterministic risk enforcement protect capital and prevent unauthorized automated execution.
- Consequences: Execution automation requires separate approval and must preserve the existing approval and risk boundaries.

### Learning and Strategy Approval

- Decision: The Learning Loop proposes improvements, Strategy Versioning reviews changes, and the owner approves activation or rollback. Automatic production strategy replacement is prohibited.
- Context or problem: Learning outputs must not silently alter active production strategies.
- Rationale: Separating proposal, review, and approval protects historical integrity and prevents reactive strategy changes.
- Consequences: Old strategy versions remain available, and every activation or rollback requires an auditable owner approval.

### Implementation Order

- Decision: Define deterministic record and storage contracts before implementing the new intelligence and learning systems. Add AI Router integration only after deterministic boundaries are stable.
- Context or problem: Implementing orchestration before stable system contracts would create unclear dependencies and provider coupling.
- Rationale: Deterministic contracts provide reliable ownership, validation, storage, and enforcement boundaries.
- Consequences: Day 4 followed this order through AI Infrastructure v1. Future major subsystems must continue to stabilize specifications, record ownership, and persistence behavior before orchestration or external integration.
