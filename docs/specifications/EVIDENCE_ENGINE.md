# Evidence Engine Foundation

Status: D8-T1 foundation implemented, owner-approved, committed, and pushed
Contract version: `1.0`

## Responsibility

The Evidence Engine implements Alpha's planned Evidence Assessment Foundation. It converts an explicit `CrossSystemEvidenceLinkResult` into a deterministic, read-only `EvidenceAssessment` under a named, versioned policy.

Its governing rule is: **“No Evidence, No Decision.”** A decision request must fail closed unless its required evidence has been explicitly assessed as sufficient under a versioned deterministic policy.

The engine answers only whether declared evidence is available, complete enough under policy, fresh where a threshold exists, traceable, version-compatible, and free of unresolved declared conflicts. Authoritative domain repositories remain the sources of truth.

## Non-responsibilities

The engine does not:

- discover evidence or infer relevance;
- traverse an evidence graph;
- query or mutate source repositories;
- calculate prediction probability or financial confidence;
- rank opportunities;
- generate `BUY`, `SELL`, `ENTER`, `EXIT`, position-size, profit, or risk output;
- arbitrate conflicts;
- duplicate Historical Pattern, Historical Analogy, Event Replay, Decision Engine, or Risk Engine behavior;
- invoke AI, a provider, a network, or fuzzy/semantic matching;
- persist assessments.

## Dependency Direction

```text
authoritative repositories and read models
  -> Cross-System Evidence Linking / Historical Evidence Product Surface
  -> Evidence Engine
  -> future read-only Decision Engine consumer
```

The request supplies the already-resolved link view. Every link must have exactly one assessment item so a caller cannot silently omit evidence from the assessment. The engine performs no repository lookup and follows no recursive links.

## Input Contract

`EvidenceAssessmentRequest` contains:

- caller-assigned assessment ID and fixed evaluation time;
- schema version `1.0`;
- an explicit supported subject reference;
- a deterministic, read-only Cross-System Evidence Linking result;
- one required or optional assessment item for every link;
- zero or more explicit structured conflict declarations;
- a named and versioned policy.

An item can carry an authoritative observation timestamp for the target evidence record. The engine does not derive timestamps from prose or invent a timestamp when one is absent.

Conflicts must identify at least two included item IDs, a bounded field reference, and one supported reason. Conflicts are declarations from an authoritative caller; the engine does not infer or resolve them.

## Evidence Item Resolution

Each item receives one explicit status:

- `ACCEPTED`: the item passes applicable deterministic rules;
- `UNRESOLVED`: one or both explicit link endpoints did not resolve;
- `UNAVAILABLE`: an endpoint repository was unavailable;
- `STALE`: its age exceeds the applicable threshold;
- `CONFLICTING`: it belongs to an unresolved declared conflict;
- `REJECTED`: it is resolved but fails required version, provenance, or freshness-information policy.

Resolved versions, requested references, relation, source and target provenance, observation time, calculated age, threshold, and reason codes remain visible in the output.

## Assessment Dimensions

The foundation implements only dimensions supported by current structured contracts:

| Dimension | Deterministic input | Output rule |
| --- | --- | --- |
| Availability | Link and endpoint resolution states | Required failures are `FAILED`; optional failures are `PARTIAL`. |
| Completeness | Required/optional declarations, accepted required count, policy minimum | Missing or rejected required evidence is `FAILED`; optional gaps may be `PARTIAL`. |
| Freshness | Caller-supplied observation time and exact per-entity policy threshold | Age is whole elapsed seconds; no rule produces `NOT_ASSESSED`. |
| Provenance | Source and target endpoint correlation, trace, and audit-reference IDs | A missing required target provenance set fails only when the versioned policy requires it. |
| Consistency | Explicit conflict declarations | Required conflicts are `FAILED`; optional conflicts are `PARTIAL`. |
| Version compatibility | Requested version, resolved version, and resolver status | Mismatch/unavailable versions fail required evidence; policy may require an explicit target version. |

`validity`, source reliability normalization, sample adequacy, semantic similarity, and predictive calibration are deferred. Existing systems use different confidence concepts, so this foundation does not blend them.

## Sufficiency States

The overall status is categorical:

- `SUFFICIENT`: no required blocker exists and the accepted required count meets policy;
- `INSUFFICIENT`: required evidence is missing, unresolved, stale, unverifiable, or below the minimum;
- `CONFLICTING`: required evidence has an unresolved declared conflict;
- `UNAVAILABLE`: a required evidence source repository is unavailable.

The fail-closed precedence is `UNAVAILABLE`, then `CONFLICTING`, then `INSUFFICIENT`, then `SUFFICIENT`. All blockers remain visible even when a higher-precedence state determines the overall result.

Optional missing, stale, or unavailable evidence produces warnings and may make a dimension `PARTIAL`, but does not by itself prevent `SUFFICIENT`.

## Downstream Progression Gate

Only an explicitly `SUFFICIENT` assessment may allow a request to proceed to downstream Decision Engine evaluation. `INSUFFICIENT`, `CONFLICTING`, and `UNAVAILABLE` stop progression; AI cannot override those states, and required blockers cannot be averaged away.

`SUFFICIENT` is necessary but not sufficient for action. It does not mean `BUY`, `ENTER`, expected profitability, risk approval, or execution approval. The Decision Engine must still evaluate the opportunity, the Risk Engine may reject or constrain it, frozen trading-plan rules still apply, and human approval or later execution controls may still be required.

The assessment ID, schema version, policy ID and version, evaluation time, considered evidence, blockers, warnings, and trace metadata preserve the basis of the gate for audit.

## Policy and Versioning

`EvidenceAssessmentPolicy` preserves:

- policy ID;
- policy version;
- minimum accepted required-evidence count, which must be at least one;
- whether required target provenance is mandatory;
- whether required target versions must be explicit and resolvable;
- zero or one freshness threshold per supported target entity type.

The complete effective policy is copied into the assessment. There are no hidden defaults or market-specific opinions. A future Config System adapter may supply an approved policy, but this foundation does not add a second configuration framework or modify Python configuration.

## Conflict and Freshness Behavior

Conflicting evidence is never averaged. The assessment preserves conflict IDs, item IDs, field references, reasons, provenance, and stopping blockers. Resolution belongs to a future reviewed workflow or authoritative source correction.

Freshness is evaluated only when a policy rule exists for the target entity type. Missing observation time under an applicable rule rejects the item; stale age uses the caller-fixed `evaluatedAt`, making repeated input deterministic. Future observation timestamps are invalid.

## Output and Auditability

`EvidenceAssessment` is serializable and deeply frozen. It includes:

- identity, subject, evaluation time, and schema version;
- categorical overall status;
- the full effective policy;
- deterministically ordered evidence items and status-specific item-ID lists;
- blockers and warnings;
- per-dimension assessments;
- a transparent required-completeness numerator and denominator;
- explicit conflicts;
- deduplicated trace, correlation, and audit-reference IDs;
- `deterministic: true` and `readOnly: true` markers.

The completeness fraction is a count ratio, not a probability or confidence score. It cannot override blockers. The engine contains no aggregate score and no recommendation field.

The caller supplies stable assessment identity and time. If future persistence or Unified Audit translation is approved, it must preserve this output without logging unnecessary source payloads.

## Extension Process

An extension requires:

1. an authoritative structured source field or read contract;
2. an explicit deterministic rule and policy/version impact;
3. no transfer of source ownership;
4. a documented failure state for missing or incomparable data;
5. focused tests for ordering, reconstruction, and fail-closed behavior;
6. owner review before any Decision Engine integration.

New entity types must first be approved in Cross-System Evidence Linking. The Evidence Engine must not create a parallel evidence graph or accept unrestricted payload objects.

## Narrow Demonstration

The focused test fixture assesses a prediction with resolved versioned historical evidence and provenance. Additional fixtures demonstrate missing required evidence, source unavailability, explicit conflict, optional unresolved support, version policy, and deterministic freshness.

## Deferred

- runtime enforcement of the documented gate inside the Decision Engine
- dashboard or UI
- persistence and Unified Audit writes
- AI evidence interpretation or summaries
- semantic similarity and automatic conflict resolution
- source-reliability normalization and sample adequacy
- probability calibration and machine learning
- portfolio allocation, risk controls, trading recommendations, and execution
- live market ingestion, backtesting, and paper trading
