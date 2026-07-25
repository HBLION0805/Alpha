# Event Contract Collection Runner Fixture Rehearsal and Evidence Architecture v1

## Status

Task: `Day15-T3B13-T1`

Status: design complete locally and pending Owner review.

Reviewed baseline:
`d9de7636cedff144e29cafbac731411f17e3876f`.

This design follows the T3B12-MR1 decision:

`ASSEMBLY_RECOVERY_FOUNDATION_ACCEPTED / GO_FOR_FIXTURE_REHEARSAL_DESIGN / NO_GO_FOR_EXECUTABLE_RUNTIME / NO_GO_FOR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`

T3B13-T1 adds documentation only. It creates no contract, engine, repository,
command, runtime root, SQLite store, fixture execution, timer, loop, network
request, Pilot activation, Outbox delivery, model, recommendation, broker,
order, or execution behavior.

## AI dispatch card

- Task ID: `Day15-T3B13-T1`
- Title: Fixture Rehearsal and Evidence Architecture
- Recommended model: GPT-5.6 Sol
- Reasoning level: high
- Complexity: high
- Expected implementation cost: documentation only
- Files allowed: architecture, specification, roadmap, decisions, changelog,
  README, and handoff documentation
- Restrictions: no source code, package command, dependency, runtime data,
  provider, network, credential, Pilot operation, or capital behavior
- Acceptance: exact authority, isolation, step, evidence, cleanup, replay,
  failure, and later-task gates are fully specified

## Purpose

T3B12 proves that Alpha's fixture-runtime components can safely perform one
foreground action and survive process loss. It does not yet prove that those
components can be assembled into a repeatable, reviewable system rehearsal.

T3B13 defines that rehearsal boundary.

The rehearsal exists to answer:

1. Can one frozen fixture scenario be prepared without network access?
2. Can separate foreground invocations advance it through the expected durable
   states without an internal loop?
3. Can Stop, crash, restart, quarantine, and replay evidence be retained?
4. Can a reviewer independently verify the result from a bounded sanitized
   evidence package?
5. Can the rehearsal make those claims without implying live-source, model,
   dataset, recommendation, or trading readiness?

## Non-authority statement

A fixture rehearsal proves only deterministic local orchestration, transaction
behavior, recovery behavior, and evidence packaging for the exact frozen
scenario.

It does not prove:

- future-market discovery or admission;
- Kalshi or Robinhood availability;
- Robinhood quote or fee-preview capture;
- live timing, latency, rate-limit, or credential behavior;
- complete T1 or T2 observation assembly;
- prospective dataset qualification;
- model accuracy, calibration, expected value, or profitability;
- recommendation, position sizing, Portfolio, broker, order, or execution
  readiness.

Every manifest, terminal report, package, and review summary must preserve this
statement or an exact versioned equivalent.

## Initial rehearsal decision

The first rehearsal is:

- local;
- fixture-only;
- network-free;
- one frozen scenario;
- one synthetic rehearsal Pilot in one isolated SQLite store;
- one worker;
- one action per process invocation;
- manually advanced;
- bounded by an exact maximum invocation count;
- retained as a sanitized evidence package;
- separately approved before it is run.

It is not a runtime service. It has no timer, wait, polling, self-invocation,
task scheduler loop, daemon, background worker, or remote control surface.

## Authority topology

```text
Owner-approved rehearsal manifest
                 |
                 v
Exact fixture-catalog resolution
                 |
                 v
Isolated rehearsal workspace preparation
                 |
                 v
Synthetic fixture Pilot + immutable task set
                 |
                 v
One explicit foreground invocation
                 |
                 +----> one Preflight
                 +----> one bounded snapshot
                 +----> one planned action
                 +----> one terminal report
                 |
                 v
Durable SQLite/recovery truth
                 |
                 v
Sanitized evidence-package builder
                 |
                 v
Independent deterministic verifier
                 |
                 v
PASS / FAIL_CLOSED / INCOMPLETE
```

The manifest grants no authority to use a provider, create a general runtime,
or activate any Pilot outside the isolated rehearsal workspace.

## Rehearsal manifest

The immutable manifest must contain only declared fields:

- schema and policy versions;
- rehearsal ID, scenario ID, and purpose;
- Owner approval evidence identity and expiry;
- exact application build fingerprint;
- exact runner-definition fingerprint;
- exact frozen-plan fingerprint;
- exact fixture-catalog version and package fingerprint;
- exact provider and mapping fingerprints;
- exact synthetic activation and task identities;
- exact runtime configuration template fingerprint;
- expected action sequence;
- maximum foreground invocations;
- expected terminal task and Pilot states;
- expected Outbox event identities and count;
- permitted fault scenario, if any;
- evidence-package policy version;
- workspace-retention policy version;
- non-authority declaration version;
- manifest fingerprint.

The manifest may not contain:

- arbitrary paths;
- URLs;
- provider credentials;
- Owner secrets;
- caller-selected boot, process, lease, or session identities;
- raw payloads;
- probabilities, predictions, recommendations, positions, orders, or P&L;
- undeclared extension fields.

The rehearsal ID is derived from the manifest fingerprint and cannot be reused
for a changed manifest.

## Fixture catalog

Only a version-controlled allow-listed fixture catalog may satisfy a manifest.

Each catalog entry binds:

- provider descriptor;
- reviewed mapping;
- fixture adapter identity and version;
- normalized snapshot or deterministic failure outcome;
- source-record identity;
- payload fingerprint, byte count, and record count;
- exact expected task state transitions;
- provenance references already permitted by the source contract;
- catalog-entry fingerprint.

The catalog contains no live URL, credential, mutable discovery rule, or
runtime-supplied provider payload.

Raw fixture bodies remain in their already reviewed fixture boundary. The
rehearsal evidence package records only their content identity and bounded
metadata.

## Workspace isolation

One rehearsal uses exactly two roots:

- a runtime-control root;
- a SQLite root.

Both are descendants of one rehearsal-specific parent chosen by reviewed
configuration, not a caller-supplied arbitrary path.

Rules:

- the parent must be beneath an allow-listed runtime-data or operating-system
  temporary root;
- the path must not be the repository root, user home, drive root, UNC path,
  symlink, junction, or pre-existing unrelated directory;
- source-controlled paths are prohibited;
- one manifest maps to one exclusive workspace identity;
- existing non-matching content blocks preparation;
- runtime configuration binds the canonical roots and store identity;
- preparation never overwrites or deletes an existing workspace;
- cleanup never recursively deletes an unresolved or identity-mismatched path.

The initial implementation should prefer quarantine/archive rename over
destructive cleanup. Test-only temporary directories may be removed by their
own parent harness after exact containment verification.

## Rehearsal lifecycle

```text
PLANNED
  -> PREPARED
  -> READY
  -> STEPPING
  -> READY
  -> COMPLETED
  -> PACKAGED
  -> VERIFIED
  -> ARCHIVED
```

Failure branches:

```text
PLANNED/PREPARED
  -> PREPARATION_BLOCKED

READY/STEPPING
  -> FAILED_CLOSED
  -> RECOVERY_REQUIRED

COMPLETED/PACKAGED
  -> VERIFICATION_FAILED
```

Rules:

- transitions are append-only and fingerprinted;
- no state moves backward;
- one `STEPPING` transition corresponds to one process invocation;
- `READY` does not arrange or schedule the next invocation;
- only exact replay may return an existing transition or package;
- terminal failure does not reopen automatically;
- Owner approval for a new attempt requires a new rehearsal identity.

## Preparation boundary

A future separately approved preparation operation may:

1. verify the manifest and Owner approval;
2. resolve the exact catalog entry;
3. create new isolated roots;
4. create the strict runtime configuration;
5. open and migrate a new SQLite store;
6. seed one synthetic fixture-only runner definition, Pilot, budgets, and
   exact task set;
7. verify the seeded canonical records and fingerprints;
8. close the store cleanly;
9. write one sanitized preparation receipt.

It may not:

- connect to any network;
- discover a market;
- use Robinhood;
- activate or resume a non-rehearsal Pilot;
- accept arbitrary JSON business records;
- create caller-selected process authority;
- execute a foreground step.

Preparation is a separate transaction phase from step execution.

## Manual foreground-step protocol

The first rehearsal may advance only through separate explicit invocations.

Each future step request must bind:

- exact rehearsal and manifest fingerprints;
- exact expected invocation ordinal;
- exact expected current rehearsal-state version;
- exact expected SQLite recovery fingerprint;
- exact scenario phase;
- one unexpired local Owner authorization reference when recovery or Stop
  requires it.

One invocation:

1. verifies the rehearsal registry and workspace identity;
2. acquires exact process ownership;
3. opens and verifies SQLite;
4. resolves recovery and session authority;
5. performs one Preflight;
6. reads one bounded work snapshot;
7. selects one action;
8. executes at most that one action;
9. rereads terminal safety;
10. emits one sanitized terminal report;
11. closes and releases only when clean;
12. appends one invocation receipt.

The user or test harness must explicitly initiate the next ordinal. The
operation cannot sleep, call itself, enqueue itself, or loop over remaining
work.

## Permitted scenario

The first happy-path scenario should contain a minimal fixed sequence:

1. prepare one scheduled exchange-lane fixture task;
2. one invocation performs T6 and exits with `DUE`;
3. one later explicit invocation performs one fixture Worker cycle through
   T7/T8/T8B/T10 and exits with `COMMITTED`;
4. one later explicit invocation observes terminal completion without
   mutation;
5. package and verify the evidence.

The exact number of invocations and expected action at each ordinal are frozen
in the manifest.

The first failure scenarios should be separate manifests, not branches hidden
inside the happy path:

- Stop before T6;
- crash after lease;
- crash after attempt claim;
- crash during validation;
- crash after T10 before report;
- stale ownership and authenticated quarantine;
- exact evidence-package replay;
- changed replay rejection.

## Evidence package

The rehearsal package is immutable, content-addressed, and bounded.

Required entries:

- verified rehearsal manifest;
- fixture-catalog entry identity;
- preparation receipt;
- sanitized invocation receipts in ordinal order;
- sanitized terminal reports;
- startup/recovery report fingerprints;
- ownership/quarantine receipt identities when applicable;
- task/Pilot/budget/lease/attempt terminal summary;
- payload-free Outbox identity and chronology index;
- SQLite quick/integrity-check result;
- independently created SQLite backup manifest and digest;
- validation-suite identity and result;
- cleanup/archive disposition;
- non-authority declaration;
- package inventory with path, byte length, digest, and package fingerprint.

Excluded entries:

- Owner secrets or verifier material;
- provider credentials, headers, cookies, or URLs;
- raw provider or fixture bodies;
- normalized evidence bodies;
- arbitrary SQL or exception stacks;
- account, Portfolio, P&L, position, probability, recommendation, broker,
  order, or execution data.

The initial bounds are:

- at most 16 foreground invocation receipts;
- at most 16 terminal reports;
- at most 64 Outbox identity records;
- no individual JSON record above 64 KiB;
- no package above 32 MiB excluding the independently verified SQLite backup;
- exactly one SQLite backup and manifest.

Changing a bound requires a new policy version and Owner review.

## Two fingerprint classes

Environment-specific evidence and deterministic scenario truth must not be
confused.

### Execution package fingerprint

Binds the exact:

- process and boot identities;
- observed timestamps and elapsed times;
- workspace and store identities;
- ownership, session, recovery, and package records.

It is expected to differ between independent rehearsal runs.

### Scenario result fingerprint

Binds only stable reviewed truth:

- manifest and fixture fingerprints;
- ordered selected actions and durable state transitions;
- normalized evidence and Outbox identities;
- final Pilot/task/budget outcome;
- declared expected-versus-actual result.

It excludes OS paths, PID, process nonce, boot identity, session identity,
wall-clock ingestion time, and performance timing.

Two clean executions of the same manifest must produce the same scenario
result fingerprint. A mismatch is `VERIFICATION_FAILED`, not a warning.

## Independent verifier

Package construction cannot approve its own output.

A pure verifier receives the package inventory and allow-listed records. It:

- verifies exact schemas and declared keys;
- recomputes every content digest and fingerprint;
- checks manifest/catalog/build bindings;
- validates invocation ordinals and maximum count;
- compares actual actions with the frozen expected sequence;
- validates lifecycle and durable state chronology;
- checks Stop and recovery precedence;
- verifies backup and SQLite integrity evidence;
- confirms excluded data is absent;
- confirms the non-authority declaration;
- returns exactly `PASS`, `FAIL_CLOSED`, or `INCOMPLETE`.

`INCOMPLETE` is not success and cannot be converted to `PASS` by an operator
override.

## Recovery and replay

- a crash before preparation commit leaves no valid prepared rehearsal;
- a crash after preparation preserves the preparation receipt and requires an
  exact next ordinal;
- a crash after an ambiguous action preserves ownership and durable
  lease/attempt truth;
- stale ownership requires the existing authenticated quarantine flow;
- old process-session authority cannot be reused;
- exact invocation replay returns the original durable receipt;
- changed ordinal, manifest, recovery, or state identity fails closed;
- package construction may resume only from verified immutable inputs;
- exact package replay returns the original package identity;
- changed package replay creates no overwrite.

No recovery path deletes evidence or infers an unknown provider outcome.

## Stop behavior

Stop remains higher authority than rehearsal progress.

- the process barrier is checked before every mutation;
- durable Emergency Stop remains authoritative;
- graceful completion prevents new acquisition;
- a Stop during an ambiguous attempt preserves that ambiguity;
- Stop does not package a rehearsal as successful;
- a stopped rehearsal is `FAILED_CLOSED` or `RECOVERY_REQUIRED` unless its
  manifest explicitly defines Stop as the expected scenario;
- no later step may clear Stop or reopen a terminal Pilot.

## Evidence retention

The design distinguishes:

- active workspace;
- quarantined recovery evidence;
- verified evidence package;
- archived completed workspace.

Retention rules must be versioned before implementation. Initial policy:

- never place rehearsal artifacts in Git;
- retain verified package and backup until Owner review completes;
- retain quarantine and failed-closed evidence longer than clean workspace
  data;
- do not implement automatic deletion in the first version;
- expose only a read-only inventory before any later retention executor;
- require exact path containment and identity before any future deletion.

## Threat model

The rehearsal must fail closed against:

- changed or undeclared manifest fields;
- fixture catalog substitution;
- build or policy drift;
- arbitrary or linked workspace paths;
- pre-existing workspace collision;
- duplicate preparation or step process;
- caller-selected process/session/lease identity;
- stale or altered ownership evidence;
- ordinal skipping or replay with changed state;
- hidden loops or self-invocation;
- accidental network transport construction;
- Stop arriving before any mutation boundary;
- partial SQLite commit or WAL recovery;
- evidence-package omission or digest substitution;
- leakage of raw payloads, secrets, or capital-domain data;
- a report presenting fixture success as live or trading readiness.

## Proposed implementation sequence

T3B13 remains separately gated:

1. **T3B13-T1 — Fixture Rehearsal and Evidence Architecture:** this design.
2. **T3B13-T2 — Manifest, lifecycle, receipt, and evidence contracts:** strict
   immutable records plus pure verification; no filesystem or SQLite.
3. **T3B13-T3 — Isolated workspace and preparation foundation:** safe new
   roots, exact catalog resolution, synthetic fixture store seeding, and
   preparation receipt; no step execution.
4. **T3B13-T4 — Programmatic rehearsal step and evidence collector:** one
   explicit ordinal, one T3B12 foreground action, one receipt; no loop or
   command.
5. **T3B13-T5 — Package builder, independent verifier, and process drills:**
   deterministic scenario fingerprint, backup/integrity evidence, crash,
   Stop, replay, and leakage tests.
6. **T3B13-MR1 — Fixture rehearsal readiness review.**
7. **Later separately approved operation:** one exact owner-approved rehearsal
   run; no network.
8. **Future separately designed work:** continuous runtime, provider admission,
   T1/T2 integration, bounded-live Pilot, and commercial infrastructure.

Approval of one task grants no authority to begin the next.

## Acceptance criteria

T3B13 may pass only when:

- one immutable manifest binds all rehearsal authority;
- one allow-listed fixture catalog supplies every source artifact;
- workspace creation is new, contained, isolated, and fail closed;
- no source-controlled or arbitrary path can become a workspace;
- preparation and step execution remain separate;
- one process invocation performs at most one action;
- no timer, wait, polling, self-invocation, or loop exists;
- exact ordinal and state replay is idempotent;
- changed replay fails closed;
- Stop and recovery authority remain higher than progress;
- package content is bounded, sanitized, and content-addressed;
- deterministic and environment-specific fingerprints remain separate;
- an independent verifier produces the final disposition;
- two clean runs produce the same scenario result fingerprint;
- complete validation and provider/network/credential scans pass;
- implementation approval does not authorize running the rehearsal;
- rehearsal success cannot claim live, dataset, recommendation, or trading
  readiness.

## Explicit exclusions

T3B13-T1 adds no:

- TypeScript or Python implementation;
- contract, engine, repository, export, dependency, or package command;
- runtime file or SQLite database;
- fixture execution;
- timer, sleep, polling, retry loop, daemon, or background process;
- network provider, market discovery, or Robinhood automation;
- real Pilot activation or Resume;
- Outbox delivery or T1/T2 assembly;
- dataset qualification, probability research, recommendation, sizing,
  Portfolio, broker, order, or execution authority.

## Owner review recommendation

Review T3B13-T1 as design only. If approved and pushed, begin
`Day15-T3B13-T2 — Manifest, Lifecycle, Receipt, and Evidence Contracts`.

Do not combine architecture approval with implementation, rehearsal execution,
provider admission, continuous runtime, bounded-live operation, or trading
authority.
