# Alpha Journal Specification v1.0

Status: Implemented foundation

Date: 2026-07-18

## 1. Problem Solved

Alpha needs a permanent record of what was known, believed, decided, observed, and learned at a specific point in time. Without that record, later outcomes can silently replace earlier reasoning and make honest review impossible.

Alpha Journal is not a generic notes application. It is an evidence-first, append-only business record that preserves context and rationale while linking to the systems that own predictions, research, decisions, trades, strategies, portfolios, development validation, and audit evidence.

Core principle: journal records preserve what was known and believed at the time. Later knowledge must not rewrite earlier entries.

## 2. Expected Value, Cost, and Timing

Expected value:

- Preserves decision context and owner reasoning before hindsight
- Connects Prediction Log evidence to later reflection without changing predictions
- Separates factual observation, interpretation, assumptions, uncertainty, action, and outcome
- Creates structured inputs for future Learning Loop and Strategy Versioning review
- Makes market, portfolio, risk, behavioral, and development lessons queryable
- Extends Unified Audit traceability into the business evidence layer

Implementation cost is moderate: provider-neutral contracts, deterministic validation, a small lifecycle service, two repositories, privacy-aware export, audit translation, documentation, and focused tests.

Operating cost is low for the current single-owner environment. The implementation uses local append-only NDJSON and the Node standard library, with no database, network service, provider call, or new package.

It should be built now because Prediction Log is already authoritative, but Alpha needs a separate place for explanation, reflection, and lessons before Research Lab or Strategy Versioning can consume that evidence honestly.

## 3. Non-Goals

The foundation does not implement:

- Generic mutable notes
- Research Lab or research execution
- Strategy Versioning, activation, rollback, or automatic strategy changes
- Learning Loop automation
- Trade, broker, portfolio, or capital execution
- Live market data or external APIs
- Provider SDKs, credentials, network calls, or AI summarization
- Resolution of references owned by future systems
- Encryption, signing, backup, retention deletion, or production database behavior
- Multi-process or distributed-writer safety

## 4. Architecture Position

```text
Research / market observation / portfolio context / Prediction Log
  -> Alpha Journal finalized evidence
  -> append-only amendment or review
  -> deterministic summary, statistics, export, and audit translation
  -> future Learning Loop evidence
  -> future owner-reviewed Strategy Versioning proposal
```

Source systems remain authoritative. Prediction Log owns predictions, Unified Audit Repository owns normalized audit evidence, Decision records own final decisions, Trade records own execution/outcomes, and future Strategy Versioning owns strategy state. Journal links to those records and never mutates or replaces them.

## 5. Journal Entry Model

`AlphaJournalEntrySnapshot` captures:

- Schema, creation, and event timestamps
- Category and title
- Factual observations
- Interpretation
- Assumptions and uncertainty
- Decision rationale
- Planned action and optional actual-action reference
- Expected outcome and risk notes
- Optional confidence from 0 through 100
- Optional market, ticker, and asset
- Tags
- Owner and author type
- Privacy and retention classifications
- Typed evidence graph
- Immutable context snapshot
- Correlation and trace identities
- Scalar metadata with secret-bearing keys prohibited

Ticker, asset, prediction, and trade references are optional so macro, policy, sector, portfolio, system-validation, and development entries remain valid.

The authoritative `AlphaJournalEntry` adds only its deterministic entry ID and reconstructed lifecycle history.

## 6. Categories

The v1 categories are:

- `MARKET_OBSERVATION`
- `RESEARCH_NOTE`
- `DECISION_RATIONALE`
- `PREDICTION_NOTE`
- `PRE_TRADE_PLAN`
- `EXECUTION_OBSERVATION`
- `POST_TRADE_REVIEW`
- `RISK_OBSERVATION`
- `PORTFOLIO_REVIEW`
- `STRATEGY_NOTE`
- `LESSON_LEARNED`
- `SYSTEM_VALIDATION`
- `DEVELOPMENT_NOTE`
- `OWNER_REFLECTION`

These categories cover the requested evidence types without adding speculative domains.

## 7. Lifecycle and Authoritative Boundary

```text
DRAFT (workspace only; not repository evidence)
  -> FINALIZED
  -> REVIEWED
  -> ARCHIVED
```

The simplest append-only model is used: drafts are not stored in the authoritative repository. A caller may manage draft text outside this port, but the first repository event is an immutable finalization from `DRAFT` to `FINALIZED`.

Legal transitions are:

| From | To | Requirement |
|---|---|---|
| Draft | Finalized | Complete, valid snapshot |
| Finalized | Reviewed | Immutable review appended in the same repository event |
| Finalized | Archived | Archive history appended |
| Reviewed | Archived | Archive history appended |
| Archived | None | Terminal lifecycle state |

There is no update, overwrite, replacement, or delete interface. Reviews preserve original text and context. Archive does not erase evidence.

## 8. Deterministic Identity and Ordering

Entry IDs use a stable FNV-1a 64-bit digest of canonical, key-sorted snapshot content:

```text
journal:<16 lowercase hexadecimal characters>
```

The identity is reproducible evidence identity, not a cryptographic signature. Amendment, review, history, audit, export, correlation, and trace IDs are deterministic caller-supplied identifiers validated against the shared Alpha identifier pattern.

Every persisted event receives a monotonically increasing repository sequence. Repository sequence, not timestamp, determines storage and query order. Every event also carries a canonical payload fingerprint.

Identical replay returns the original record and sequence. A duplicate identity with different content fails as an idempotency conflict.

## 9. Immutable Context Snapshot

The point-in-time context supports:

- Capture and optional market timestamps
- Portfolio snapshot reference
- Opportunity score and policy version
- Risk snapshot and policy version
- Prediction reference
- Configuration version
- Strategy reference
- Policy-version map
- Router decision and selected model reference when AI contributed
- Source-data timestamps
- Owner decision state

No live data is fetched. References may be unresolved. Defensive cloning ensures caller mutation, lifecycle changes, reviews, amendments, queries, and exports cannot change the original snapshot.

## 10. Evidence Graph

Typed references support:

- Prediction
- Research
- Decision
- Trade
- Strategy
- Portfolio snapshot
- Unified Audit
- Related Journal entry
- Development Validation record

Each reference contains a stable ID, record type, explicit `RESOLVED` or `UNRESOLVED` state, and optional version. The Journal owns no referenced record and stores no raw external record duplication. Typed collections reject mismatched record types, duplicate references, malformed IDs, and self-reference.

Unresolved references are structurally valid because several owning systems are future work.

## 11. Amendments and Corrections

Amendments are separate immutable records. Supported types are:

- Factual correction
- Clarification
- Additional context
- Changed interpretation
- Later outcome
- Retracted conclusion

Each amendment contains its own ID, original entry ID, optional parent amendment, timestamp, reason, additional/corrected structured content, author, evidence references, and audit reference.

The original entry remains visible and authoritative as the historical point-in-time record. Parent relationships must remain within one entry and cannot be missing, self-referential, or cyclic.

## 12. Reviews and Lessons

Reviews are separate immutable records and atomically advance a finalized entry projection to `REVIEWED`. A review records:

- What happened and what was expected
- What was correct and incorrect
- Controllable and uncontrollable factors
- Process and outcome quality
- Optional Prediction Log accuracy classification
- Optional trading profitability classification
- Emotional or behavioral observation
- Structured lessons
- Future rule or experiment
- Optional strategy-change candidate
- Audit reference

Lessons are evidence only. Neither a review nor a lesson changes a prediction, trade, strategy, configuration, risk rule, or portfolio state. Strategy candidates require future Strategy Versioning and owner approval.

## 13. Privacy

The Journal reuses `PrivacyLevel`:

- `PUBLIC`
- `INTERNAL`
- `SENSITIVE`
- `LOCAL_ONLY`

The foundation rejects `PUBLIC` as an authoritative default. Callers must select `INTERNAL`, `SENSITIVE`, or `LOCAL_ONLY`.

Secret-bearing metadata keys, credentials, API keys, authorization headers, bearer tokens, and private keys are prohibited. `LOCAL_ONLY` entries cannot be externally exported. Sensitive external export requires a policy-authorized reference when configured.

Privacy is policy enforcement, not encryption. Local files are currently unencrypted and must remain outside Git.

## 14. Repository Boundary

`AlphaJournalRepository` provides only:

- Append finalized entry
- Append amendment
- Append review with lifecycle history
- Append archive history
- Retrieve entry, amendment, and review
- Deterministic filtered query and pagination
- Retrieve complete entry history
- List related entries
- Read append-only repository events

There is no update, overwrite, or delete method.

The in-memory repository provides deterministic defensive storage for tests and local use. The local repository persists the same canonical event stream to NDJSON.

## 15. Local Persistence

Runtime location:

```text
data/runtime/alpha-journal/
```

The local repository:

- Restricts store IDs to traversal-safe characters
- Resolves storage beneath the configured root
- Flushes every append
- Requires canonical JSON and newline termination
- Verifies contiguous sequences and fingerprints during reconstruction
- Replays all validation and identity checks on load
- Fails closed on malformed, truncated, non-canonical, duplicate, or inconsistent history

It is single-owner and single-process development persistence. It is not concurrent-writer safe, encrypted, signed, backed up, or a production transaction boundary.

## 16. Query, Summary, Statistics, and Export

Filters support date range, category, lifecycle status, ticker, asset, prediction, research, trade, strategy, tags, trace, correlation, and privacy. Pagination follows repository sequence.

Deterministic summaries expose entry identity, timestamp, category, title, status, subject, tags, review state, and amendment count without AI-generated text.

Statistics include:

- Entries by category, day, and month
- Entries by ticker or asset
- Reviewed and unreviewed counts
- Lessons by tag
- Prediction-linked and strategy-linked entry counts
- Review process-quality distribution

Exports contain filtered entry-history bundles, including amendments and reviews, in JSON or newline-terminated NDJSON. Export never changes source state.

## 17. Prediction Log Integration

Journal evidence may link to prediction creation, lock, outcome, review, accuracy, profitability, and lesson events through stable Prediction references and review classifications.

Prediction Log remains the prediction source of truth. Journal records context, explanation, reflection, and lessons. It cannot edit, lock, resolve, review, archive, or otherwise mutate Prediction Log records.

## 18. Unified Audit Integration

A pure translation maps journal operation audits into `JOURNAL_ENTRY` records from the `JOURNAL` source subsystem. Supported operation types are:

- Entry finalized
- Review appended
- Amendment appended
- Entry archived
- Exported
- Validation rejected

Translation preserves correlation, trace, actor, privacy, retention, policy versions, reason codes, and source identities. Translation does not persist audit records and does not recursively audit audit-operation records.

Unified Audit Repository remains the normalized audit evidence source of truth.

## 19. Validation

The foundation rejects:

- Missing, malformed, conflicting, or non-deterministic IDs
- Malformed or future timestamps
- Empty authoritative content
- Confidence or opportunity score outside 0 through 100
- Invalid lifecycle transitions or backward lifecycle time
- Review before finalization or duplicate review
- Amendment before entry, duplicate amendment, invalid parent, self-reference, or cycle
- Archive before finalization
- Invalid, duplicate, mismatched, or self-referential typed references
- Public-default or restricted export privacy downgrade
- Secret-bearing metadata
- Invalid pagination or time ranges
- Non-canonical, malformed, truncated, or inconsistent NDJSON
- Path traversal

## 20. Future Compatibility and Limitations

Future Research Lab may create or consume research references but cannot rewrite Journal entries. Future Strategy Versioning may evaluate lesson and strategy-candidate evidence but requires reviewed owner activation. Future Development Validation Log may resolve current validation references.

Known limitations:

- FNV identity is not a cryptographic signature
- References are structurally validated but not resolved across repositories
- No encryption or tamper-resistant signing
- No multi-writer coordination or production database
- No retention executor, backup, restoration, or archival service
- No AI summarization
- Draft workspace persistence is intentionally outside the authoritative port
