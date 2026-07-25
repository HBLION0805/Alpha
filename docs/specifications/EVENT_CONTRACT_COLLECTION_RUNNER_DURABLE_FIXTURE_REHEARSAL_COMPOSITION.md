# Event Contract Collection Runner Durable Fixture Rehearsal Composition and Evidence Architecture v1

## Status

Task: `Day15-T3B14-T1`

Status: design complete locally and pending Owner review.

Reviewed baseline:
`b02cadc`.

This design follows the T3B13-MR1 decision:

`FIXTURE_REHEARSAL_FOUNDATION_ACCEPTED / GO_FOR_DURABLE_REHEARSAL_COMPOSITION_DESIGN / NO_GO_FOR_REHEARSAL_RUN / NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`

T3B14-T1 adds documentation only. It creates no contract, migration, table,
repository, command, process, rehearsal data, backup, package, provider
request, Pilot activation, T1/T2 delivery, model, recommendation, broker,
order, or execution behavior.

## AI dispatch card

- Task ID: `Day15-T3B14-T1`
- Title: Durable Fixture Rehearsal Composition and Evidence Architecture
- Recommended model: GPT-5.6 Sol
- Reasoning level: high
- Complexity: high
- Expected implementation cost: documentation only
- Files allowed: architecture, specification, roadmap, decisions, changelog,
  README, handoff, and milestone documentation
- Restrictions: no source code, migration, package command, runtime data,
  fixture execution, network, credential, real Pilot, or capital behavior
- Acceptance: the four T3B13-MR1 blockers have explicit source-of-truth,
  transaction, recovery, evidence, process-drill, and later-task boundaries

## Purpose

T3B13 proves its components independently. It does not prove that separate
processes can advance one rehearsal from preparation to independently verified
evidence.

T3B14 defines the missing durable composition. It must answer:

1. Which record is authoritative for rehearsal lifecycle and next ordinal?
2. How does a new process distinguish an unstarted action from an action that
   committed before the prior process died?
3. How are the runner database, online backup, validation result, evidence
   package, and final disposition bound without trusting caller assertions?
4. How does one exact Owner-invoked phase run and exit without becoming a
   general runtime command or an internal loop?
5. What evidence must fresh processes prove before one separately approved
   network-free rehearsal may run?

## Non-authority statement

This architecture may eventually prove only that one frozen local fixture
scenario is durably composed and independently verifiable.

It cannot prove:

- future-market discovery or admission;
- current Kalshi or Robinhood availability;
- Robinhood quote or fee-preview collection;
- network timing, latency, credential, or rate-limit behavior;
- T1/T2 observation completeness;
- prospective dataset qualification;
- probability accuracy, calibration, edge, or profitability;
- recommendation, allocation, sizing, Portfolio, broker, order, or execution
  readiness.

Every manifest, operation receipt, backup manifest, evidence envelope,
verification result, and milestone report must preserve this statement or an
exact versioned equivalent.

## Design decision

The first durable composition uses:

- one immutable Owner-approved rehearsal manifest;
- one newly created rehearsal-profile SQLite database;
- one synthetic fixture-only Runner, Pilot, and frozen task set;
- one durable rehearsal registry in the same SQLite database;
- one exclusive foreground process at a time;
- one exact phase and at most one foreground action per invocation;
- one pre-registered runtime root, backup root, package root, and validation
  evidence root;
- one content-addressed final evidence envelope;
- one independently reopened SQLite backup;
- no network;
- no internal loop, timer, polling, wait, self-invocation, or scheduler loop.

The runner database remains the sole mutable durable store during the
rehearsal. The final evidence envelope is immutable.

## Authority topology

```text
Owner-approved manifest
        |
        v
Closed phase request + local Owner gate
        |
        v
Exclusive process ownership
        |
        v
Rehearsal-profile SQLite store
  |            |             |
  |            |             +--> runner/Pilot/task/attempt/Outbox truth
  |            +----------------> rehearsal lifecycle and invocation truth
  +-----------------------------> recovery and Stop truth
        |
        v
Terminal freeze and online backup
        |
        v
Fixed local validation receipt
        |
        v
Atomic evidence envelope
        |
        v
Fresh-process independent verifier
        |
        +--> PASS
        +--> FAIL_CLOSED
        +--> INCOMPLETE
```

No caller-supplied object may replace a durable record in this topology.

## Rehearsal-profile SQLite authority

### Schema profile

T3B14 must not silently change ordinary runner stores.

The future implementation introduces an explicit schema profile:

- `RUNNER_BASE_V2` — the existing schema and behavior;
- `FIXTURE_REHEARSAL_V3` — migrations 001 and 002 plus one reviewed
  rehearsal-only migration 003.

Rules:

- the profile is immutable at store creation;
- migration 003 may be applied only to a new, empty, isolated rehearsal store;
- an existing v2 store cannot be upgraded in place to a rehearsal store;
- an existing v3 rehearsal store cannot be opened through the v2 profile;
- store identity, profile, migration history, checksums, and schema catalog are
  included in readiness, recovery, backup, and package evidence;
- production or future live stores cannot select the rehearsal profile.

### Durable registry

Migration 003 must define strict closed tables for:

1. `fixture_rehearsals` — one manifest-bound current state and compare-and-swap
   version;
2. `fixture_rehearsal_transitions` — append-only lifecycle history;
3. `fixture_rehearsal_operation_claims` — immutable process/phase/ordinal
   claims;
4. `fixture_rehearsal_invocation_receipts` — immutable successful step
   receipts;
5. `fixture_rehearsal_failure_receipts` — immutable fail-closed or ambiguous
   results;
6. `fixture_rehearsal_evidence_plans` — immutable validation-receipt identity
   plus the exact planned backup, package, envelope, and retention identities
   that must be satisfied after database freeze.

The exact table names remain subject to T3B14-T2 contract and migration review,
but their authority separation is mandatory.

The current row in `fixture_rehearsals` is a compare-and-swap projection. It
does not replace append-only transition and receipt history.

### Required registry bindings

The durable registry binds:

- rehearsal, manifest, build, runner-definition, frozen-plan, catalog,
  provider, mapping, Pilot, task-set, workspace, store, and schema identities;
- lifecycle state and version;
- next expected invocation ordinal;
- expected and selected phase;
- expected recovery fingerprint;
- exact process-session and boot identities for a claimed phase;
- Stop state and Owner-authorization reference when required;
- invocation, terminal-report, durable-transition, Outbox, validation-receipt,
  and planned evidence-envelope fingerprints;
- scenario-result and execution-package fingerprints;
- non-authority declaration version.

Unknown fields, changed identities, missing history, or a projection/history
mismatch fail closed.

## Durable lifecycle

The mutable SQLite lifecycle remains append-only and ends at an irreversible
evidence freeze:

```text
PLANNED
  -> PREPARING
  -> PREPARED
  -> READY
  -> STEPPING
  -> READY
  -> COMPLETED
  -> VALIDATED
  -> EVIDENCE_FROZEN
```

Failure states:

```text
PREPARING
  -> PREPARATION_BLOCKED

READY/STEPPING
  -> FAILED_CLOSED
  -> RECOVERY_REQUIRED

COMPLETED/VALIDATED
  -> VERIFICATION_FAILED
  -> INCOMPLETE
```

Rules:

- no transition moves backward;
- one phase claim binds one lifecycle version;
- one `STEPPING` claim binds one exact invocation ordinal;
- a process never claims the next ordinal automatically;
- terminal states cannot reopen;
- recovery appends evidence; it does not rewrite a claim or receipt;
- a new attempt after a terminal failure requires a new manifest and rehearsal
  identity.

After `EVIDENCE_FROZEN`, the source store is read-only forever. Backup,
package, envelope publication, verification, and archive inventory use a
separate immutable envelope lifecycle:

```text
STAGING -> PUBLISHED -> VERIFIED -> ARCHIVED
             |
             +--> FAIL_CLOSED / INCOMPLETE
```

The envelope lifecycle never writes back to the frozen database. This avoids a
self-referential backup or a source database that changes after its digest is
recorded.

## Exact Owner-invoked phase operation

The future operation is not a general `start` or `run` command.

It accepts only a closed request containing:

- registered manifest ID;
- registered phase ID;
- exact rehearsal and manifest fingerprints;
- exact expected lifecycle version;
- exact expected invocation ordinal or `null` for non-step phases;
- exact expected recovery fingerprint;
- one invocation ID;
- one unexpired local Owner-authorization reference when the phase policy
  requires it.

It does not accept:

- paths;
- arbitrary JSON records;
- SQL;
- shell commands or executable names;
- URLs, providers, credentials, or payloads;
- process, boot, session, lease, or attempt identities;
- timers, intervals, retry counts, or background flags;
- probabilities, recommendations, positions, orders, or capital data.

The allowed phases are closed and versioned:

- `PREPARE`;
- `STEP`;
- `RECOVER`;
- `VALIDATE`;
- `FREEZE`;
- `PACKAGE`;
- `VERIFY`;
- `ARCHIVE_INVENTORY`.

Each invocation performs exactly one phase and exits.

`STEP` calls the T3B12 foreground boundary at most once. `RECOVER` may
reconcile durable state but cannot execute new fixture work. `VALIDATE`
commits one fixed validation receipt. `FREEZE` makes scenario truth
irreversibly read-only. `PACKAGE` creates the online backup and complete
evidence envelope from that frozen store without writing back to it. `VERIFY`
is read-only. `ARCHIVE_INVENTORY` records disposition but does not delete data.

## Gate ordering

Every store-mutable phase after preparation (`STEP`, `RECOVER`, `VALIDATE`,
and `FREEZE`) uses this order:

1. validate the closed request;
2. resolve only registered manifest and root identities;
3. verify local Owner authority when required;
4. check the irreversible process Stop barrier;
5. acquire exact exclusive process ownership;
6. open the exact rehearsal-profile store;
7. run startup recovery, schema, foreign-key, quick, and integrity gates;
8. verify durable rehearsal projection against append-only history;
9. verify expected lifecycle, ordinal, recovery, and phase identity;
10. append one immutable phase claim and compare-and-swap the lifecycle;
11. perform only the selected phase;
12. reread authoritative durable truth;
13. append one immutable result and transition;
14. close resources;
15. release ownership only after verified clean completion;
16. emit one sanitized receipt and exit.

Stop is checked again immediately before every mutation boundary. A Stop or
authority change after a claim but before mutation leaves an auditable
fail-closed result.

`PREPARE` uses its separately defined create-and-quarantine sequence.
`PACKAGE` acquires exclusive ownership, verifies the frozen source store
read-only, writes one exclusive envelope build record in staging, and never
appends a database claim. `VERIFY` is fully read-only.
`ARCHIVE_INVENTORY` may append only an external disposition record; it cannot
change the database or immutable envelope.

## Transaction and ambiguity model

### Before action

The phase claim and `READY -> STEPPING` transition commit atomically in the
rehearsal store before the T3B12 foreground action begins.

A crash before that transaction commits means the phase did not start.

### During action

The existing runner transactions remain authoritative for T6, T7, T8, T8B,
T9, T10, Stop, lease, attempt, evidence, and Outbox truth.

The rehearsal registry does not duplicate or overwrite those records.

### After action

The invocation receipt and `STEPPING -> READY/COMPLETED` transition commit
atomically after the action's durable state is independently reread.

A crash after the runner action commits but before the rehearsal receipt
creates an explicit `STEPPING` ambiguity. The next process must not repeat the
action. It enters `RECOVER`.

### Reconciliation

Recovery compares:

- the immutable phase claim;
- scheduled task and Pilot versions;
- lease and attempt state;
- T6/T7/T8/T8B/T9/T10 transitions;
- normalized evidence identity;
- Outbox identity and chronology;
- Stop and recovery-control evidence;
- the expected manifest action.

It may append a recovered success receipt only when exactly one outcome is
proven. Unknown or conflicting evidence becomes `RECOVERY_REQUIRED` or
`FAILED_CLOSED`; it is never guessed, retried, or converted to success.

## Preparation composition

`PREPARE` must:

1. verify the Owner-approved manifest and its expiry;
2. resolve one immutable fixture catalog entry;
3. create one new isolated workspace from registered root IDs;
4. create one new `FIXTURE_REHEARSAL_V3` store;
5. migrate 001, 002, and 003 in one reviewed sequence;
6. seed the synthetic Runner, Pilot, budgets, and exact task set;
7. create the rehearsal registry row and initial transitions;
8. verify canonical records, history, counters, schema, and store identity;
9. close the store;
10. write one sanitized preparation receipt.

If any post-creation step fails, the complete workspace is quarantined by
identity-preserving rename. It is not deleted or reused.

## Backup and immutable evidence envelope

### Terminal freeze

`FREEZE` is permitted only when:

- the rehearsal lifecycle is `COMPLETED`;
- the expected Pilot and every task are terminal;
- no active lease or ambiguous attempt exists;
- Outbox count and identities match the manifest;
- Stop and recovery evidence are coherent;
- startup recovery, quick check, integrity check, and foreign-key checks pass.

The operation appends the exact validation receipt, planned backup/package/
envelope identities, and terminal freeze binding in one final transaction.
No later store mutation is permitted.

### Online backup

The `PACKAGE` phase uses the reviewed Node SQLite online-backup boundary. It
opens the frozen source store read-only for verification, writes exactly one
database and one canonical manifest inside the envelope staging root, adds the
bounded package and envelope manifest, and atomically publishes the complete
envelope.

The manifest binds:

- rehearsal, manifest, store, schema-profile, migration, schema-catalog, and
  terminal-freeze identities;
- source and backup file identities;
- page count, byte count, SHA-256 digest, and creation time;
- retention policy and non-authority declaration;
- backup-manifest fingerprint.

Neither file may be overwritten.

### Evidence envelope

The final immutable envelope contains:

```text
rehearsal-<manifest-id>-evidence/
  backup/
    runner.sqlite3
    backup-manifest.json
  package/
    bounded sanitized JSON artifacts
    evidence-package.json
    build-record.json
  envelope-manifest.json
```

All names are fixed. No symlink, junction, reparse point, extra file, or
caller-selected relative path is permitted.

The envelope is built in one isolated staging directory, durably flushed, and
published by same-filesystem atomic rename. An incomplete staging directory is
quarantined and never treated as a valid envelope.

The package-size bound continues to exclude the SQLite backup, but the envelope
manifest includes its exact byte count and digest.

## Validation evidence

Validation truth cannot be a caller boolean.

The future validation phase uses one reviewed fixed local validation adapter:

- no shell string;
- no caller-selected executable or arguments;
- no network;
- no credentials;
- exact repository commit and clean-source identity;
- exact validation policy and registered suite fingerprint;
- exit status, registered test total, started/ended times, and sanitized output
  digest;
- bounded immutable validation receipt.

The adapter may invoke only the version-controlled Alpha validation bundle
through a fixed process boundary. A dirty source tree, changed suite,
unregistered test, nonzero exit, missing total, or process ambiguity fails
closed.

The validation receipt is copied into the envelope only after its identity is
committed to the rehearsal registry and the database has entered
`EVIDENCE_FROZEN`.

## Independent verification

The final verifier runs in a fresh process and receives only:

- one pre-registered evidence-root ID;
- one expected envelope fingerprint;
- one expected manifest fingerprint.

It:

1. resolves and canonicalizes the registered root;
2. rejects links, extra files, missing files, and path escapes;
3. recomputes every byte count and digest;
4. verifies the envelope and package manifests;
5. opens the backup read-only;
6. verifies schema profile and migrations 001-003;
7. runs quick, integrity, and foreign-key checks;
8. reconstructs rehearsal projection from append-only history;
9. verifies runner, Pilot, task, attempt, lease, evidence, Outbox, Stop, and
   recovery truth;
10. binds every invocation and terminal-report fingerprint;
11. verifies the fixed validation receipt;
12. scans all JSON artifacts for excluded data;
13. recomputes execution-package and scenario-result fingerprints;
14. returns exactly `PASS`, `FAIL_CLOSED`, or `INCOMPLETE`.

The verifier never opens the mutable source store and never trusts the package
builder's in-memory objects.

`PASS` requires the backup to be present and independently readable.

## Two-run determinism

Before a real rehearsal can be considered ready, process drills must complete
two clean executions of the same manifest in different temporary roots and
with different process, boot, session, workspace, store, and timing identities.

Required result:

- execution-package fingerprints differ;
- scenario-result fingerprints are identical;
- ordered selected actions, durable state transitions, evidence identities,
  Outbox identities, and final Pilot/task/budget truth are identical;
- no environment-specific identity enters the scenario fingerprint.

A scenario mismatch is `VERIFICATION_FAILED`.

## Required process drills

All drills use test-owned temporary roots and a new OS process for every phase.

Required drills:

1. clean preparation through fresh-process final verification;
2. two clean executions with identical scenario results;
3. crash before phase-claim commit;
4. crash after phase-claim commit and before action;
5. crash after T6 commit and before rehearsal receipt;
6. crash after T7 lease;
7. crash after T8 attempt claim;
8. crash during T8B validation;
9. crash after T10 and before rehearsal receipt;
10. Stop before every mutable phase;
11. stale ownership with authenticated quarantine;
12. old process-session rejection after restart;
13. exact phase replay without duplicate mutation;
14. changed phase, ordinal, recovery, or manifest replay rejection;
15. backup or backup-manifest substitution;
16. crash during backup and envelope publication;
17. package artifact and validation-receipt substitution;
18. excluded-data leakage;
19. missing backup returns `INCOMPLETE`, never `PASS`;
20. fresh-process verification cannot access the mutable source store.

Tests may use explicit fault-injection checkpoints. Production code exposes no
general fault-injection, sleep, timer, or kill surface.

## Retention and deletion

T3B14 preserves four identities:

- active workspace;
- quarantined recovery workspace;
- immutable backup/package envelope;
- archived source workspace.

The first implementation:

- never writes runtime evidence into Git;
- never recursively deletes a workspace or envelope;
- never overwrites a backup, manifest, receipt, or package;
- records only a read-only archive inventory and disposition;
- retains failed and quarantined evidence for Owner review;
- requires a later separately reviewed retention executor for deletion.

## Threat model

The composition must fail closed against:

- caller-supplied paths, ports, evidence, process identity, or shell commands;
- schema-profile substitution or migration drift;
- projection/history disagreement;
- duplicate process ownership or phase claims;
- skipped ordinals and changed replay;
- action commit without rehearsal receipt;
- stale process-session reuse;
- Stop racing any mutation;
- mutable source-store changes after terminal freeze;
- ordinary file copy presented as an online backup;
- backup, manifest, validation receipt, package, or envelope substitution;
- a verifier that can see only metadata but not the backup;
- symlink, junction, reparse-point, traversal, or root substitution;
- hidden loop, self-invocation, background execution, or network construction;
- raw payload, secret, account, Portfolio, P&L, probability, recommendation,
  broker, order, or execution leakage;
- fixture success represented as live-source, dataset, recommendation, or
  trading readiness.

## Proposed implementation sequence

T3B14 remains separately gated:

1. **T3B14-T1 — Durable Fixture Rehearsal Composition and Evidence
   Architecture:** this design.
2. **T3B14-T2 — Rehearsal-profile contracts and migration 003:** strict
   registry records, lifecycle transactions, schema-profile opening, and pure
   verification; no operation command.
3. **T3B14-T3 — Durable phase coordinator and recovery reconciliation:**
   concrete preparation, one-action step, and recovery composition over
   registered roots and ports; no internal loop.
4. **T3B14-T4 — Backup, validation, envelope, and fresh-process verifier:**
   concrete evidence reconstruction and portable immutable envelope.
5. **T3B14-T5 — End-to-end process drills:** clean, two-run, crash, Stop,
   replay, backup, validation, leakage, and source-isolation drills.
6. **T3B14-MR1 — Durable fixture-rehearsal readiness review.**
7. **Later separately approved operation:** one exact Owner-approved,
   network-free rehearsal run.

Approval of one task grants no authority to begin the next.

## Acceptance criteria

T3B14 may pass only when:

- one durable registry survives every process boundary;
- projection and append-only history independently reconcile;
- one invocation claims and performs only one exact phase;
- one `STEP` performs at most one foreground action;
- no phase arranges the next phase;
- crash ambiguity is reconciled from durable evidence without retry guessing;
- Stop precedes every mutation;
- the rehearsal profile cannot be selected for an existing or non-fixture
  store;
- exactly one online backup and manifest enter the immutable envelope;
- a fresh verifier opens the backup and reconstructs all required truth;
- validation evidence comes from one fixed local adapter, not caller input;
- two clean runs produce one stable scenario-result fingerprint;
- all required process drills and the complete Alpha validation suite pass;
- source code, runtime data, credentials, provider requests, and capital
  behavior remain outside the design task;
- implementation approval remains separate from rehearsal-run approval.

## Explicit exclusions

T3B14-T1 does not authorize:

- implementation;
- migration 003 or any schema change;
- an executable phase command;
- running a rehearsal;
- a loop, timer, scheduler, daemon, service, or background process;
- network access, provider discovery, or Robinhood automation;
- a real Pilot;
- T1/T2 delivery or dataset qualification;
- model research, probability, recommendation, sizing, Portfolio mutation,
  broker, order, or execution.

## Recommended next task

After Owner approval, begin:

`Day15-T3B14-T2 — Rehearsal-profile Contracts and Migration 003`

Do not combine T2 approval with implementation of the durable phase operation,
evidence envelope, rehearsal execution, provider admission, or capital
authority.
