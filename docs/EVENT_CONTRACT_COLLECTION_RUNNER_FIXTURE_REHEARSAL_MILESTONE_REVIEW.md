# Event Contract Collection Runner Fixture Rehearsal Milestone Review

## Review identity

- Review: `Day15-T3B13-MR1`
- Review date: `2026-07-25`
- Reviewed baseline: `8ecf918e56c01fb6331894b9784c388e06d496b7`
- Registered validation baseline: `2261/2261`
- Focused T3B13 validation: `95/95`
- Scope: Day15-T3B13-T1 through Day15-T3B13-T5
- Authority: architecture and readiness review only

## Executive decision

The T3B13 fixture-rehearsal components are accepted as deterministic,
network-free foundations.

They are not yet ready for the separately approved rehearsal run described by
the T3B13 architecture. The review finds that process-to-process rehearsal
state, concrete SQLite/backup/validation evidence verification, and one
end-to-end assembled rehearsal path remain unimplemented.

This is a split decision:

- `FIXTURE_REHEARSAL_FOUNDATION_ACCEPTED`: the manifest, strict contracts,
  isolated preparation, one-action step coordinator, bounded evidence package,
  and package-level process drills are accepted.
- `GO_FOR_DURABLE_REHEARSAL_COMPOSITION_DESIGN`: Alpha may design one closed
  composition that owns durable rehearsal state, exact Owner invocation,
  concrete evidence verification, and end-to-end process drills.
- `NO_GO_FOR_REHEARSAL_RUN`: no fixture rehearsal may be represented as
  executed or independently verified from the current components.
- `NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME`: no general command, timer,
  polling loop, retry loop, daemon, scheduler loop, or background process is
  authorized.
- `NO_GO_FOR_BOUNDED_LIVE`: no provider request, future-market discovery,
  Robinhood automation, real Pilot, or dataset-readiness claim is authorized.

## Evidence reviewed

The review inspected:

- the complete fixture-rehearsal architecture and acceptance criteria;
- all T3B13 commits from `d687c206` through `8ecf918`;
- immutable manifest, lifecycle, receipt, package, and verification contracts;
- manifest and catalog binding, workspace isolation, SQLite preparation, and
  quarantine behavior;
- exact-ordinal one-action coordination and terminal-state reread;
- package staging, atomic publication, exact replay, independent directory
  reread, digest verification, and excluded-data scanning;
- package-level crash, Stop, replay, and leakage child-process drills;
- all T3B13 focused tests, exports, validation registration, and complete
  Alpha validation;
- provider, network, credential, runtime-loop, capital-authority, and
  repository-tracking boundaries.

## Readiness matrix

| Gate | Status | Evidence | Decision |
| --- | --- | --- | --- |
| Immutable rehearsal authority | PASS | Content-derived closed manifest and exact expected actions | Retain |
| Fixture catalog binding | PASS | Allow-listed immutable catalog identity and mapping fingerprints | Retain |
| Workspace isolation | PASS | Pre-registered repository-disjoint roots and derived workspace identity | Retain |
| Synthetic SQLite preparation | PASS AS FOUNDATION | Strict migrations, seeded fixture-only records, and immutable receipt | Retain |
| One-action coordination | PASS AS PROGRAMMATIC BOUNDARY | One exact ordinal invokes at most one T3B12 foreground action | Retain |
| Changed replay and Stop precedence | PASS | Closed replay checks and fail-closed Stop/recovery paths | Retain |
| Bounded sanitized package | PASS | Exact file set, byte/digest checks, excluded-data scan, and atomic publication | Retain |
| Package crash behavior | PASS | Real child-process termination before and after package commit | Retain |
| Durable rehearsal registry | BLOCKED | Only the in-memory step ledger implements rehearsal lifecycle persistence | Design and implement before a run |
| Cross-process exact-ordinal continuation | BLOCKED | No concrete durable ledger reloads lifecycle, ordinal, receipts, and recovery identity | Design and implement before a run |
| Concrete evidence verifier | BLOCKED | SQLite, backup, and validation truth is supplied through an injected port | Bind to authoritative local evidence |
| Portable backup verification | BLOCKED | The final package contains backup identity JSON, not the independently reopened backup and manifest | Close package/backup verification boundary |
| End-to-end assembled rehearsal | BLOCKED | Preparation, real T3B12 step, restart, recovery, package, and verifier are not exercised together | Add process-level assembly drills |
| Owner-invoked exact operation | BLOCKED | No reviewed operation owns manifest selection and all concrete ports | Separate bounded composition |
| Continuous operation | BLOCKED | No supervision or loop authority exists | Separate future architecture |
| Future-market provider admission | BLOCKED | Existing live smoke is one fixed historical public read | Separate provider review |
| Robinhood platform evidence | BLOCKED | No approved automatic quote or fee-preview source exists | Separate source design |
| T1/T2 and dataset qualification | BLOCKED | No authoritative Outbox consumer or prospective qualifying dataset exists | Collection and integration first |
| Commercial operation | BLOCKED | Fixture-only local infrastructure is not a production service | Separate commercial review |

## T3B13 acceptance assessment

| Acceptance criterion | Result |
| --- | --- |
| One immutable manifest binds rehearsal authority | PASS |
| One allow-listed fixture catalog supplies source identity | PASS |
| Workspace creation is isolated and fail closed | PASS |
| Preparation and step execution remain separate | PASS |
| One invocation performs at most one action | PASS AS PROGRAMMATIC BOUNDARY |
| No internal timer, polling, self-invocation, or loop exists | PASS |
| Exact in-process replay is idempotent | PASS |
| Changed replay fails closed | PASS |
| Stop and recovery outrank progress | PASS |
| Package content is bounded, sanitized, and content addressed | PASS |
| Scenario and execution fingerprints remain separate | PASS |
| Package directory receives an independent deterministic reread | PASS |
| Rehearsal lifecycle survives separate process invocations | BLOCKED |
| SQLite backup and validation truth is independently reconstructed | BLOCKED |
| Two assembled clean runs prove the same scenario result | BLOCKED |
| Complete registered validation passes | PASS |
| Implementation approval remains separate from operation | PASS |

## Findings

### Accepted — T3B13 closes the fixture-rehearsal component boundaries

T3B13 provides strict authority contracts, isolated deterministic preparation,
one-action coordination, sanitized evidence packaging, independent package
reread, and package-level crash behavior without adding a network or trading
path. These components are accepted for reuse.

### High — Rehearsal lifecycle state is not durable across invocations

The architecture requires separate explicit process invocations. The only
current implementation of `CollectionRunnerRehearsalStepLedgerPort` is
`InMemoryCollectionRunnerRehearsalStepLedger`.

After a process exits, the rehearsal lifecycle version, next invocation
ordinal, prior result, and recovery fingerprint are not reloaded from an
authoritative rehearsal registry. Recreating this ledger from caller-supplied
objects would make the caller, rather than durable evidence, authoritative.

No rehearsal run should begin until a closed durable registry and exact replay
boundary are designed, implemented, and crash-drilled.

### High — Final evidence still depends on a trusted injected assertion

Package construction requires
`CollectionRunnerRehearsalPackageEvidenceVerifierPort`, but T3B13 provides no
concrete implementation that reopens the exact SQLite store and backup,
recomputes their identities, and binds the validation-suite result.

The directory verifier independently verifies packaged JSON bytes and
semantics, but it cannot reconstruct the truth behind those injected evidence
claims. A test verifier returning `true` is sufficient for unit isolation, not
for a real rehearsal disposition.

### High — The backup is not independently verifiable from the package

The evidence directory contains `backup-evidence.json` with a manifest
fingerprint and digest. It does not contain or resolve one immutable backup
artifact through a closed registered root. Therefore a copied package can
return `PASS` even when the referenced backup is unavailable.

The next design must define whether the backup is a package sibling, a
content-addressed registered artifact, or part of a larger immutable rehearsal
envelope. In every case, the independent verifier must reopen it and validate
the manifest, digest, SQLite checks, and source-store binding.

### High — No end-to-end process rehearsal has been assembled

Current tests independently prove contracts, preparation, injected one-action
coordination, and package construction. Package child-process drills exercise
only package publication boundaries and use constructed test evidence.

No process drill currently performs preparation, exits, reloads durable
rehearsal state, executes the real T3B12 foreground step, crashes or restarts
at a declared boundary, completes the frozen sequence, creates the real SQLite
backup, packages evidence, and verifies the result from a fresh process.

### Medium — Exact Owner invocation remains undesigned

The current safety decision to omit a general executable command is correct.
Before one rehearsal can run, Alpha still needs a narrowly scoped,
manifest-bound Owner operation that selects only pre-registered roots and
concrete ports, performs one phase, writes a sanitized receipt, and exits.

This must not become a reusable `start`, background service, or caller-defined
composition surface.

## Required next design task

The recommended next task is:

`Day15-T3B14-T1 — Durable Fixture Rehearsal Composition and Evidence Architecture`

It must be design-only and specify:

1. one durable append-only rehearsal registry and exact compare-and-swap
   lifecycle authority;
2. process-safe ordinal, replay, receipt, and recovery-state reconstruction;
3. one narrowly scoped Owner-invoked phase operation with no internal loop;
4. concrete composition of T3B13 preparation, the real T3B12 foreground step,
   recovery, package construction, and independent verification;
5. authoritative SQLite quick/integrity checks and one online backup;
6. a content-addressed backup location that the independent verifier reopens;
7. validation-suite identity captured from an immutable local result;
8. fresh-process happy-path, crash, Stop, changed-replay, and two-run scenario
   fingerprint drills;
9. exact retention, archive, quarantine, and no-deletion rules;
10. separate Owner gates for implementation and for the later rehearsal run.

## Explicitly prohibited after this review

This review does not authorize:

- running a fixture rehearsal;
- a general rehearsal or runtime command;
- caller-supplied paths, manifests, ports, or evidence truth;
- a timer, polling loop, retry loop, daemon, service, or background runner;
- automatic stale-lock takeover or evidence deletion;
- a network request or dynamic future-market discovery;
- automatic Robinhood access;
- a real Pilot activation;
- T1/T2 delivery or dataset qualification;
- probability research, recommendation, sizing, Portfolio mutation, broker,
  order, or execution behavior.

## Owner review recommendation

Approve T3B13-MR1 as:

`FIXTURE_REHEARSAL_FOUNDATION_ACCEPTED / GO_FOR_DURABLE_REHEARSAL_COMPOSITION_DESIGN / NO_GO_FOR_REHEARSAL_RUN / NO_GO_FOR_EXECUTABLE_OR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`

Then begin
`Day15-T3B14-T1 — Durable Fixture Rehearsal Composition and Evidence Architecture`
as a design-only task. Do not combine its design approval with implementation,
rehearsal execution, provider admission, bounded-live operation, or trading
authority.
