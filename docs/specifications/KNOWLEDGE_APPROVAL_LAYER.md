# Knowledge Approval Layer Architecture

Status: D8-T3A architecture approved and committed; D8-T3B local foundation implemented pending owner review
Architecture version: `1.0`

Implementation boundary: D8-T3B provides versioned contracts, deterministic eligibility and lifecycle guards, an owner-decision service, an append-only in-memory development repository, a read-only current-state projection, and Unified Audit translation. It does not provide production persistence, authentication, AI drafting, Strategy Change Proposals, or strategy mutation.

## Problem Solved

Completed Strategy Reviews can establish facts, deviations, violations, and unresolved questions, but they do not establish reusable knowledge. Alpha needs a narrow governance boundary that prevents an isolated outcome, persuasive AI narrative, or profitable rule violation from silently becoming a permanent lesson or strategy change.

The governing rule is: **“No Strategy Change Without Approved Knowledge.”** Approved Knowledge is necessary evidence for a future strategy-change proposal; it never changes a strategy by itself.

## Expected Value

The layer provides:

- durable separation among facts, interpretations, candidate lessons, approved knowledge, strategy-change proposals, and strategy versions;
- deterministic evidence and policy gates before owner approval;
- explicit treatment of weak samples, conflicts, duplicates, supersession, deprecation, and revocation;
- immutable approval history suitable for audit and later production persistence;
- a provider-independent boundary where AI may assist drafting but cannot approve or mutate authority.

The initial personal-system operating cost is low: the owner reviews a small queue after completed reviews. The architecture deliberately excludes continuous AI review, multi-party governance, and a general-purpose memory database.

## Responsibilities

The Knowledge Approval Layer owns:

- Candidate Knowledge identity, declared scope, lifecycle, and provenance;
- versioned approval-policy evaluation and deterministic blocking checks;
- immutable owner approval decisions;
- immutable Approved Knowledge identity and lifecycle;
- explicit duplicate, contradiction, supersession, deprecation, and revocation references;
- read models for candidate review and current approved knowledge;
- append-only lifecycle and audit-event contracts;
- a boundary requiring Approved Knowledge references in future strategy-change proposals.

## Non-responsibilities

The layer does not:

- perform Strategy Review or recalculate its four dimensions;
- discover facts, infer causality, or generate automatic lessons;
- replace Alpha Journal, Research Lab, Historical Pattern Library, Evidence Assessment, or Strategy Versioning;
- approve or reject knowledge through AI or deterministic checks alone;
- create, edit, validate, approve, activate, suspend, or retire a Strategy Version;
- modify Config, Risk, Decision, Portfolio, Trade, execution, frozen-plan, or source records;
- rank strategies, optimize parameters, reopen trades, or intervene in active execution;
- provide semantic search, embeddings, fuzzy duplicate detection, or a general-purpose memory store;
- implement persistence, authentication, provider calls, live APIs, UI, or automation in D8-T3A.

## Conceptual Separation

### Fact

A fact is a directly supported, traceable statement from authoritative structured records. It carries source record IDs and versions, not an inferred probability. A Strategy Review finding such as an explicit risk violation may support a fact, but the Knowledge Approval Layer does not recreate that finding.

### Interpretation

An interpretation explains one or more facts. It must identify its author type, supporting fact IDs, limitations, and whether AI assisted its wording. It is never treated as a fact or approval evidence by itself.

### Candidate Knowledge

Candidate Knowledge is a proposed reusable observation, lesson, or process rule supported by completed Strategy Reviews. It may be submitted from a human-authored or AI-assisted draft, but it is unapproved and cannot govern downstream behavior.

### Approved Knowledge

Approved Knowledge is an immutable record created only after deterministic policy checks pass and the owner records an explicit approval decision. It may inform research or a later strategy-change proposal. It does not modify strategies.

### Strategy Change Proposal

A Strategy Change Proposal is a separate, future record explaining how one or more Approved Knowledge items might justify a change. Approval of knowledge does not create or approve this proposal.

### Strategy Version

Strategy Versioning remains the only authority for implemented strategy definitions, validation, owner approval, activation, and lineage. A strategy change exists only as a new immutable Strategy Version through its existing lifecycle.

## Candidate Knowledge Contract

The proposed `CandidateKnowledge` contract contains:

- candidate ID and schema version;
- explicit candidate type and stable caller-declared claim key;
- concise statement and normalized structured scope;
- source Strategy Review IDs and versions;
- source Evidence Assessment IDs, schema versions, and policy versions;
- source Strategy Version IDs;
- supporting fact records with authoritative source references;
- separately labeled interpretations, author type, AI-assisted flag, and supporting fact IDs;
- conflicting-evidence and contradiction references;
- completed-review count and distinct-outcome count;
- market, instrument, strategy-family, and strategy-version context where applicable;
- creator type and actor reference;
- created timestamp, privacy/retention classification, trace/correlation IDs, and audit references;
- blockers, warnings, policy reference, and lifecycle status.

Free-form payload objects are prohibited. Statements are bounded text for human understanding; deterministic gates operate on typed fields and references, not narrative quality.

### Candidate Types

The initial bounded types are:

- `OBSERVATION`
- `PREDICTION_LESSON`
- `EXECUTION_LESSON`
- `RISK_LESSON`
- `PROFITABILITY_OBSERVATION`
- `DATA_QUALITY_ISSUE`
- `PROCESS_IMPROVEMENT`

New types require an explicit source authority, evidence policy, failure behavior, and owner-reviewed contract version. This is a controlled vocabulary, not a broad knowledge ontology.

## Approval Lifecycle

Draft preparation is workspace state outside the authoritative repository. The authoritative Candidate Knowledge lifecycle is:

```text
PENDING_REVIEW
  -> NEEDS_MORE_EVIDENCE
  -> PENDING_REVIEW
  -> APPROVED | REJECTED | SUPERSEDED
```

- `PENDING_REVIEW`: immutable candidate submitted with a complete declared source set.
- `NEEDS_MORE_EVIDENCE`: deterministic policy or owner review found a remediable evidence gap.
- `APPROVED`: deterministic gates passed and an explicit owner approval created a separate Approved Knowledge record.
- `REJECTED`: owner rejected the candidate with an immutable reason; it remains retrievable.
- `SUPERSEDED`: a newer candidate replaces the pending proposition before approval; both remain retrievable.

`APPROVED`, `REJECTED`, and candidate `SUPERSEDED` are terminal. Correcting an approved conclusion occurs through Approved Knowledge lifecycle events, never by reopening or editing the candidate.

Deterministic checks may return `ELIGIBLE_FOR_OWNER_REVIEW` or `BLOCKED`; they do not grant approval and are not lifecycle actors.

## Approval Policy Contract

`KnowledgeApprovalPolicy` is explicit and versioned. It defines per candidate type and scope:

- minimum completed Strategy Review count;
- minimum distinct finalized-outcome count;
- required Strategy Review status `COMPLETE`;
- required Strategy Review Evidence Gate status `SUFFICIENT`;
- required source and provenance references;
- allowed strategy-version compatibility or lineage rules;
- sample-adequacy rules and applicability scope;
- material-conflict and contradiction handling;
- freshness requirements only where an authoritative timestamp and deterministic threshold exist;
- whether a verified severe safety or policy violation may use the single-event exception;
- owner authority and authorization policy reference;
- stale-candidate threshold and revalidation requirements.

The effective policy snapshot or immutable policy reference is preserved with every eligibility result and approval decision. No universal sample threshold is hard-coded across knowledge types.

### Single-event Safety Exception

One completed outcome may create any Candidate Knowledge item. It generally cannot support approval alone.

A single event may be eligible for owner approval only when a versioned policy explicitly allows a safety exception and the source contains a directly verified severe risk or hard-policy violation from the authoritative record. The exception cannot be based on interpretation, profit, AI judgment, or narrative severity. Owner approval and all other provenance, conflict, and version checks still apply.

## Fail-closed Rules

Approval eligibility is blocked when:

- any source Strategy Review is not `COMPLETE`;
- any source review's Evidence Gate is not `SUFFICIENT`;
- required evidence or provenance is unavailable or unresolved;
- material conflicts or contradictions remain unresolved;
- source or strategy versions are incompatible under policy;
- sample requirements are unmet and no applicable safety exception exists;
- the candidate or policy snapshot is stale;
- the owner approval authority or authorization evidence is absent;
- the approval command uses a different policy version from the eligibility decision;
- a source review, evidence assessment, or approved source record was superseded or revoked before approval;
- an active contradictory Approved Knowledge record exists for the same claim key and scope without an explicit resolution.

AI narrative, confidence language, or reviewer count cannot compensate for a blocker. The layer exposes criterion results and counts, not an opaque confidence probability or aggregate score.

## Approval Decision Contract

`KnowledgeApprovalDecision` records:

- decision ID, candidate ID, candidate revision, and expected repository version;
- decision `APPROVE`, `REJECT`, or `RETURN_FOR_EVIDENCE`;
- eligibility result ID and exact approval-policy version;
- owner actor identity and authorization reference;
- decision timestamp, reasons, conditions, and warnings acknowledged;
- source snapshot and conflict-resolution references;
- idempotency key, trace/correlation IDs, and audit reference.

Only an authorized `OWNER` actor may record `APPROVE` or `REJECT` in the initial personal-system phase. `RETURN_FOR_EVIDENCE` may be recommended by deterministic validation, but its authoritative transition still requires an authorized owner command.

## Approved Knowledge Contract

`ApprovedKnowledge` contains:

- knowledge ID, schema version, knowledge type, claim key, statement, and structured scope;
- approval-policy ID/version and approval-decision ID;
- supporting Candidate Knowledge IDs;
- source Strategy Review, Evidence Assessment, Strategy Version, fact, and audit references;
- approved timestamp and owner identity;
- effective-from timestamp and applicability constraints;
- privacy/retention, trace/correlation, warnings, and audit metadata;
- status and lifecycle references;
- optional `supersedes`, `supersededBy`, `deprecatedAt/by/reason`, or `revokedAt/by/reason` references.

The Approved Knowledge lifecycle is:

```text
ACTIVE -> SUPERSEDED | DEPRECATED | REVOKED
```

- `SUPERSEDED`: an explicitly approved replacement exists.
- `DEPRECATED`: the knowledge remains historically valid but should not support new proposals in its prior scope.
- `REVOKED`: the knowledge is invalid, unsafe, or no longer authorized; it cannot support new proposals.

All states are immutable append-only projections. History is never deleted. A replacement requires a new Approved Knowledge record and its own approval.

## Duplicate and Contradiction Handling

Authoritative duplicate detection uses exact typed keys, not semantic similarity. The deterministic comparison key is built from:

- candidate type;
- caller-declared claim key;
- normalized structured scope;
- strategy family and applicable version lineage;
- market and instrument context where applicable.

Exact command replay is idempotent. The same comparison key with a different payload is a conflict, not an overwrite. A candidate with additional evidence may append an evidence-revision event or submit a successor according to the future implementation contract.

Overlapping wording without the same key is flagged for human review. AI may suggest a possible duplicate or contradiction, but only explicit typed links and owner review make that relationship authoritative.

Contradictory active knowledge in the same scope blocks new approval until the owner records one of:

- an applicability distinction;
- rejection of the new candidate;
- supersession by an approved replacement;
- deprecation or revocation of prior knowledge.

New evidence challenging old knowledge creates a challenge/review event and candidate; it never edits the prior record in place.

## Strategy-change Boundary

The required dependency path is:

```text
Completed Strategy Review
  -> Candidate Knowledge
  -> deterministic eligibility checks
  -> owner approval decision
  -> Approved Knowledge
  -> separate Strategy Change Proposal
  -> separate validation and owner approval
  -> new Strategy Version
```

Every future Strategy Change Proposal must reference at least one current, applicable Approved Knowledge item and must preserve the exact knowledge and policy versions used. A revoked, deprecated-for-new-use, out-of-scope, or incompatible knowledge item cannot satisfy that gate.

Approved Knowledge never mutates active strategies, frozen plans, Config values, Risk policies, Decision rules, or Strategy Version records. Many Approved Knowledge items may remain informational and never lead to a strategy change.

## AI Boundary

AI may, through the existing provider-neutral AI Router boundary:

- draft candidate wording;
- summarize already supplied evidence;
- list objections and review questions;
- suggest possible duplicates or contradictions;
- draft a future strategy-change proposal.

Every AI contribution remains labeled, untrusted, and linked to its source facts and provider-neutral audit reference. AI cannot approve or reject knowledge, change lifecycle state, satisfy a deterministic evidence requirement, resolve a conflict, create authority, mutate strategy, or override the owner.

Source text and AI text are treated as untrusted data. Instructions embedded in evidence cannot alter policy or execute actions. No AI call or adapter is part of the initial Knowledge Approval implementation; a future optional drafting adapter must remain outside the authoritative service.

## Source-of-truth Boundaries

- Strategy Review owns completed single-cycle review conclusions.
- Evidence Assessment owns evidence sufficiency and blockers for its assessment.
- Prediction Log owns predictions, outcomes, and prediction review evidence.
- Alpha Journal owns point-in-time context, reflection, and informal lessons.
- Research Lab owns structured research, interpretations, assumptions, and review history.
- Historical Pattern Library owns historical-event and reusable-pattern records.
- Strategy Versioning owns strategy definitions, version lineage, validation, approval, and activation.
- Config and Risk Engine retain configuration and risk-policy authority.
- Unified Audit retains normalized cross-system trace authority.
- Knowledge Approval owns Candidate Knowledge governance, approval decisions, and Approved Knowledge lifecycle only.

The layer stores references and bounded approved statements; it does not copy source payloads or become a notes, research, pattern, configuration, or general memory database.

## Required Components

The minimum implementation foundation should contain:

1. Candidate Knowledge, Approval Policy, Eligibility Result, Approval Decision, Approved Knowledge, lifecycle-event, and audit-event contracts.
2. One deterministic Knowledge Approval service enforcing validation, policy gates, transitions, idempotency, duplicate keys, and optimistic concurrency.
3. Repository ports for append-only candidate, decision, knowledge, and lifecycle events plus deterministic queries.
4. An in-memory repository for focused tests and one minimal current-approved-knowledge read model.
5. Pure Unified Audit translation.

A separate AI review adapter is not required. A standalone Knowledge Read Model engine is not required. A Strategy Change Proposal implementation is not required.

## Persistence and Transaction Requirements

The future production implementation must align with the Production Persistence and Recovery Architecture:

- Candidate submission and initial lifecycle/audit evidence commit atomically.
- An approval transaction revalidates source/policy versions and atomically records the owner decision, candidate transition, new Approved Knowledge record, lifecycle event, audit evidence, and outbox entry where required.
- Supersession, deprecation, and revocation atomically preserve the new event and affected read-model projection.
- Commands use caller-supplied operation IDs, idempotency keys, and expected aggregate versions.
- Duplicate identities and payload conflicts fail closed.
- Recovery replays committed append-only events and idempotent outbox consumers without granting authority twice.
- Repository order is independent from timestamps; timestamps remain business evidence.

If records cannot share one transaction, a reviewed outbox/inbox workflow must preserve incomplete state explicitly. D8-T3A selects no database and implements no persistence.

## Audit Requirements

Audit events must cover candidate submission, evidence return, resubmission, eligibility checks, owner approval, rejection, candidate supersession, knowledge activation, supersession, deprecation, revocation, duplicate/conflict rejection, stale-command rejection, export, and validation failure.

Each event preserves actor identity, authorization reference, source and policy versions, operation/idempotency identity, prior and resulting state, reason codes, trace/correlation IDs, privacy/retention, and related source audit references. Raw sensitive payloads, secrets, and unrestricted source text are excluded.

## Security and Governance

Architecture-level mitigations include:

- owner authorization verified outside the domain record and referenced by the decision;
- idempotency, nonce/operation identity, expected versions, and terminal-state checks against replay or duplicate approval;
- approval-time revalidation against stale candidates, source supersession/revocation, and policy-version drift;
- least-privilege repository commands and no update/delete interface;
- AI-generated and source text treated as untrusted data, never executable instructions;
- privacy/retention classification and bounded audit metadata to limit leakage;
- no secret-bearing metadata, raw prompts, or provider-native payloads;
- explicit manual recovery and owner review for uncertain transaction outcomes.

Cryptographic identity, authentication, signatures, encryption, key management, multi-owner quorum, and tamper-evident production storage require later security review.

## Dependency Direction

```text
authoritative records and completed Strategy Reviews
  -> Knowledge Approval read adapters
  -> Candidate Knowledge and deterministic approval policy
  -> owner approval
  -> Approved Knowledge read model
  -> future Strategy Change Proposal
  -> Strategy Versioning
```

Source systems never depend on Knowledge Approval. Strategy Versioning may later validate references supplied by a proposal but must not depend on mutable Knowledge Approval internals. No circular mutation path is permitted.

## Extension Procedure

An extension requires:

1. a concrete consumer and authoritative source contract;
2. an explicit policy/version change and migration behavior;
3. typed failure and unavailable states;
4. source-authority, privacy, retention, and audit review;
5. deterministic duplicate and contradiction behavior;
6. focused transition, idempotency, concurrency, and recovery tests;
7. owner review before activation.

Multi-owner approval, AI drafting adapters, broader retrieval, and production persistence must extend ports and records without weakening owner authority or rewriting history.

## Recommended Implementation Sequence

### D8-T3A — Knowledge Approval Layer Architecture

- Problem: define governance before code.
- Value: prevents candidate lessons from becoming implicit strategy authority.
- Cost: medium architecture effort; no runtime operating cost.
- Dependencies: completed D8-T1 and D8-T2.
- Model: GPT-5.6 Sol, high reasoning.
- Decision: build now.
- Acceptance: this specification, reconciled principles/architecture/roadmap, documentation validation, owner approval.

### D8-T3B — Minimal Knowledge Approval Foundation

- Problem: provide one enforceable local path from completed review to owner-approved knowledge.
- Value: closes the minimum governance gap without delaying API and paper-trading priorities.
- Cost: medium implementation effort; low single-owner review/storage cost.
- Dependencies: approved D8-T3A, Strategy Review contracts, Evidence Assessment references, existing audit/privacy conventions.
- Model: GPT-5.6 Terra, medium-to-high reasoning.
- Decision: build now as one bounded task.
- Acceptance: typed contracts; deterministic fail-closed policy; owner-only approval; append-only lifecycle; in-memory repository/read model; Unified Audit translation; no AI calls or strategy mutation; focused tests and strict typecheck pass.

### D8-T4 — Intelligence Layer Milestone Review

- Problem: reconcile the completed Day 8 boundary before the next phase.
- Value: confirms dependencies, limitations, validation totals, and Phase 1 priorities.
- Cost: small documentation effort; no operating cost.
- Dependencies: owner-approved D8-T3B.
- Model: GPT-5.6 Luna, medium reasoning.
- Decision: build now.
- Acceptance: documentation and validation reconciliation only; no new engine.

### Later — Strategy Change Proposal Workflow

- Problem: turn applicable Approved Knowledge into a separately reviewed change proposal.
- Value: supports disciplined future strategy evolution.
- Cost: medium; owner review overhead grows with proposal volume.
- Dependencies: a concrete strategy-change consumer, D8-T3B, Strategy Versioning integration design, and durable outcome/evaluation evidence.
- Model: GPT-5.6 Sol for architecture, Terra for implementation.
- Decision: backlog; do not delay Phase 1 API or Paper Trading.
- Acceptance: separate proposal/approval record, current Approved Knowledge gate, full Strategy Versioning validation and owner approval, no active-plan mutation.

A separate D8-T3C Approval Workflow and D8-T4 Approved Knowledge Store are not recommended. Splitting them would leave incomplete authority boundaries and add milestone overhead; D8-T3B should implement the minimum cohesive aggregate and read model together.

## Deferred

- Strategy Change Proposal implementation
- automatic lesson generation or approval
- AI drafting/reviewer adapters and multi-model opinions
- multiple owners, quorum, delegation, and policy-based granting of approval
- semantic duplicate detection, embeddings, vector search, and general knowledge retrieval
- production persistence, transaction/outbox implementation, backup, restore, signing, and encryption
- dashboard/UI, notifications, API exposure, and paper-trading integration
- multi-cycle statistical learning, strategy ranking, optimization, and automatic strategy creation
- live market data, broker integration, and active-trade intervention
